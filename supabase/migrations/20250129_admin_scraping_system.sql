-- Migration: 20250129_admin_scraping_system.sql
-- Description: Adds tables, functions, and policies for the admin-controlled scraping system
-- Created: January 29, 2025

-- Run migration in a transaction to ensure all-or-nothing application
BEGIN;

-- ================================================================
-- SECTION 1: PREREQUISITE CHECKS
-- ================================================================

-- Ensure extensions are available
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    RAISE EXCEPTION 'PostGIS extension is required but not installed';
  END IF;
END
$$;

-- ================================================================
-- SECTION 2: TABLE CREATION
-- ================================================================

-- 1. Staging table for scraped shows pending admin review
CREATE TABLE IF NOT EXISTS public.scraped_shows_pending (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_url       TEXT NOT NULL,
  raw_payload      JSONB NOT NULL,                -- AI extracted object
  normalized_json  JSONB,                         -- post-normalization
  geocoded_json    JSONB,                         -- coords + parsed addr
  status           TEXT NOT NULL DEFAULT 'PENDING',
  admin_notes      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  reviewed_at      TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXTRACT_ERROR', 'GEOCODE_ERROR', 'DUPLICATE'))
);

COMMENT ON TABLE public.scraped_shows_pending IS 'Staging table for scraped card show data pending admin review';

-- 2. Admin feedback log
CREATE TABLE IF NOT EXISTS public.admin_feedback (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pending_id    UUID REFERENCES scraped_shows_pending(id),
  admin_id      UUID REFERENCES profiles(id),
  action        TEXT NOT NULL,
  feedback      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_action CHECK (action IN ('APPROVE', 'REJECT', 'EDIT', 'COMMENT'))
);

COMMENT ON TABLE public.admin_feedback IS 'Audit trail of admin actions on scraped show data';

-- 3. Scraping sources master list
CREATE TABLE IF NOT EXISTS public.scraping_sources (
  url                 TEXT PRIMARY KEY,
  priority_score      INT DEFAULT 50 NOT NULL,
  last_success_at     TIMESTAMPTZ,
  last_error_at       TIMESTAMPTZ,
  error_streak        INT DEFAULT 0 NOT NULL,
  notes               TEXT,
  enabled             BOOLEAN DEFAULT TRUE NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_priority_score CHECK (priority_score BETWEEN 0 AND 100)
);

COMMENT ON TABLE public.scraping_sources IS 'Master list of URLs for the card show scraper with priority and status tracking';

-- ================================================================
-- SECTION 3: INDEXES
-- ================================================================

-- Indexes for scraped_shows_pending
CREATE INDEX IF NOT EXISTS idx_scraped_shows_pending_status ON public.scraped_shows_pending(status);
CREATE INDEX IF NOT EXISTS idx_scraped_shows_pending_created_at ON public.scraped_shows_pending(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_shows_pending_status_created_at ON public.scraped_shows_pending(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_shows_pending_source_url ON public.scraped_shows_pending(source_url);

-- Indexes for admin_feedback
CREATE INDEX IF NOT EXISTS idx_admin_feedback_pending_id ON public.admin_feedback(pending_id);
CREATE INDEX IF NOT EXISTS idx_admin_feedback_admin_id ON public.admin_feedback(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_feedback_created_at ON public.admin_feedback(created_at DESC);

-- Indexes for scraping_sources
CREATE INDEX IF NOT EXISTS idx_scraping_sources_priority ON public.scraping_sources(priority_score DESC, last_success_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_scraping_sources_enabled ON public.scraping_sources(enabled, priority_score DESC);

-- ================================================================
-- SECTION 4: ROW LEVEL SECURITY POLICIES
-- ================================================================

-- Enable RLS on all tables
ALTER TABLE public.scraped_shows_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_sources ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is an admin (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN
    CREATE OR REPLACE FUNCTION public.is_admin() 
    RETURNS BOOLEAN AS $$
    BEGIN
      RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND LOWER(role) = 'admin'
      );
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    COMMENT ON FUNCTION public.is_admin() IS 'Checks if the current user has admin role';
  END IF;
END
$$;

-- RLS Policies for scraped_shows_pending
CREATE POLICY admin_all_scraped_shows_pending
  ON public.scraped_shows_pending
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

-- RLS Policies for admin_feedback
CREATE POLICY admin_all_admin_feedback
  ON public.admin_feedback
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

-- RLS Policies for scraping_sources
CREATE POLICY admin_all_scraping_sources
  ON public.scraping_sources
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

-- ================================================================
-- SECTION 5: HELPER FUNCTIONS
-- ================================================================

-- Function to approve a pending show and move it to the shows table
CREATE OR REPLACE FUNCTION public.approve_pending_show(
  p_pending_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending_record RECORD;
  v_show_id UUID;
  v_result JSONB;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Only administrators can approve shows'
    );
  END IF;

  -- Get the pending record
  SELECT * INTO v_pending_record 
  FROM public.scraped_shows_pending
  WHERE id = p_pending_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Pending show not found'
    );
  END IF;
  
  -- Check if already approved
  IF v_pending_record.status = 'APPROVED' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Show already approved'
    );
  END IF;
  
  -- Use geocoded_json if available, otherwise normalized_json, otherwise raw_payload
  DECLARE
    v_data JSONB := COALESCE(v_pending_record.geocoded_json, v_pending_record.normalized_json, v_pending_record.raw_payload);
  BEGIN
    -- Insert into shows table
    INSERT INTO public.shows (
      title,
      description,
      location,
      address,
      start_date,
      end_date,
      entry_fee,
      coordinates,
      status,
      website_url
    )
    VALUES (
      v_data->>'name',
      v_data->>'description',
      COALESCE(v_data->>'venueName', v_data->>'venue_name', v_data->>'location'),
      COALESCE(
        v_data->>'address', 
        CONCAT_WS(', ', 
          COALESCE(v_data->>'venueName', v_data->>'venue_name'), 
          v_data->>'city', 
          v_data->>'state'
        )
      ),
      (v_data->>'startDate')::TIMESTAMPTZ,
      (v_data->>'endDate')::TIMESTAMPTZ,
      CASE 
        WHEN v_data->>'entryFee' ~ '^[0-9]+(\.[0-9]+)?$' THEN (v_data->>'entryFee')::NUMERIC
        ELSE NULL
      END,
      CASE
        WHEN v_data->>'latitude' IS NOT NULL AND v_data->>'longitude' IS NOT NULL 
        THEN ST_SetSRID(ST_MakePoint((v_data->>'longitude')::FLOAT, (v_data->>'latitude')::FLOAT), 4326)::GEOGRAPHY
        ELSE NULL
      END,
      'ACTIVE',
      COALESCE(v_data->>'url', v_pending_record.source_url)
    )
    ON CONFLICT (title, start_date, location) DO UPDATE
    SET
      description = EXCLUDED.description,
      address = EXCLUDED.address,
      end_date = EXCLUDED.end_date,
      entry_fee = EXCLUDED.entry_fee,
      coordinates = EXCLUDED.coordinates,
      website_url = EXCLUDED.website_url,
      updated_at = now()
    RETURNING id INTO v_show_id;
  END;
  
  -- Update the pending record
  UPDATE public.scraped_shows_pending
  SET 
    status = 'APPROVED',
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    reviewed_at = now()
  WHERE id = p_pending_id;
  
  -- Log the admin action
  INSERT INTO public.admin_feedback (
    pending_id,
    admin_id,
    action,
    feedback
  )
  VALUES (
    p_pending_id,
    auth.uid(),
    'APPROVE',
    p_admin_notes
  );
  
  -- Update the scraping source success stats
  UPDATE public.scraping_sources
  SET 
    last_success_at = now(),
    error_streak = 0,
    priority_score = LEAST(priority_score + 2, 100)
  WHERE url = v_pending_record.source_url;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', TRUE,
    'show_id', v_show_id,
    'message', 'Show approved and added to database'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.approve_pending_show IS 'Approves a pending scraped show and moves it to the shows table';

-- Function to reject a pending show
CREATE OR REPLACE FUNCTION public.reject_pending_show(
  p_pending_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending_record RECORD;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Only administrators can reject shows'
    );
  END IF;

  -- Get the pending record
  SELECT * INTO v_pending_record 
  FROM public.scraped_shows_pending
  WHERE id = p_pending_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Pending show not found'
    );
  END IF;
  
  -- Check if already rejected
  IF v_pending_record.status = 'REJECTED' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Show already rejected'
    );
  END IF;
  
  -- Update the pending record
  UPDATE public.scraped_shows_pending
  SET 
    status = 'REJECTED',
    admin_notes = p_reason,
    reviewed_at = now()
  WHERE id = p_pending_id;
  
  -- Log the admin action
  INSERT INTO public.admin_feedback (
    pending_id,
    admin_id,
    action,
    feedback
  )
  VALUES (
    p_pending_id,
    auth.uid(),
    'REJECT',
    p_reason
  );
  
  -- Update the scraping source stats
  UPDATE public.scraping_sources
  SET 
    priority_score = GREATEST(priority_score - 3, 0)
  WHERE url = v_pending_record.source_url;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Show rejected'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.reject_pending_show IS 'Rejects a pending scraped show and logs feedback';

-- Function to edit a pending show
CREATE OR REPLACE FUNCTION public.edit_pending_show(
  p_pending_id UUID,
  p_normalized_json JSONB,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending_record RECORD;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Only administrators can edit pending shows'
    );
  END IF;

  -- Get the pending record
  SELECT * INTO v_pending_record 
  FROM public.scraped_shows_pending
  WHERE id = p_pending_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Pending show not found'
    );
  END IF;
  
  -- Update the pending record
  UPDATE public.scraped_shows_pending
  SET 
    normalized_json = p_normalized_json,
    admin_notes = COALESCE(p_admin_notes, admin_notes)
  WHERE id = p_pending_id;
  
  -- Log the admin action
  INSERT INTO public.admin_feedback (
    pending_id,
    admin_id,
    action,
    feedback
  )
  VALUES (
    p_pending_id,
    auth.uid(),
    'EDIT',
    p_admin_notes
  );
  
  -- Return success
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Show data updated'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.edit_pending_show IS 'Edits a pending scraped show before approval';

-- Function to get pending shows with pagination
CREATE OR REPLACE FUNCTION public.get_pending_shows(
  p_status TEXT DEFAULT 'PENDING',
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_count INTEGER;
  v_shows JSONB;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Only administrators can view pending shows'
    );
  END IF;

  -- Get total count
  SELECT COUNT(*) INTO v_total_count
  FROM public.scraped_shows_pending
  WHERE status = p_status;
  
  -- Get paginated results
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', ssp.id,
        'source_url', ssp.source_url,
        'raw_payload', ssp.raw_payload,
        'normalized_json', ssp.normalized_json,
        'geocoded_json', ssp.geocoded_json,
        'status', ssp.status,
        'admin_notes', ssp.admin_notes,
        'created_at', ssp.created_at,
        'reviewed_at', ssp.reviewed_at
      )
    ) INTO v_shows
  FROM public.scraped_shows_pending ssp
  WHERE ssp.status = p_status
  ORDER BY ssp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
  
  -- Handle empty results
  IF v_shows IS NULL THEN
    v_shows := '[]'::JSONB;
  END IF;
  
  -- Return paginated results with metadata
  RETURN jsonb_build_object(
    'success', TRUE,
    'data', v_shows,
    'pagination', jsonb_build_object(
      'total', v_total_count,
      'limit', p_limit,
      'offset', p_offset,
      'pages', CEIL(v_total_count::NUMERIC / p_limit)
    )
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.get_pending_shows IS 'Gets a paginated list of pending shows for admin review';

-- Function to get scraping sources with stats
CREATE OR REPLACE FUNCTION public.get_scraping_sources(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_count INTEGER;
  v_sources JSONB;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Only administrators can view scraping sources'
    );
  END IF;

  -- Get total count
  SELECT COUNT(*) INTO v_total_count
  FROM public.scraping_sources;
  
  -- Get paginated results with stats
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'url', ss.url,
        'priority_score', ss.priority_score,
        'last_success_at', ss.last_success_at,
        'last_error_at', ss.last_error_at,
        'error_streak', ss.error_streak,
        'notes', ss.notes,
        'enabled', ss.enabled,
        'created_at', ss.created_at,
        'updated_at', ss.updated_at,
        'stats', jsonb_build_object(
          'pending_count', (
            SELECT COUNT(*) 
            FROM public.scraped_shows_pending 
            WHERE source_url = ss.url AND status = 'PENDING'
          ),
          'approved_count', (
            SELECT COUNT(*) 
            FROM public.scraped_shows_pending 
            WHERE source_url = ss.url AND status = 'APPROVED'
          ),
          'rejected_count', (
            SELECT COUNT(*) 
            FROM public.scraped_shows_pending 
            WHERE source_url = ss.url AND status = 'REJECTED'
          ),
          'error_count', (
            SELECT COUNT(*) 
            FROM public.scraped_shows_pending 
            WHERE source_url = ss.url AND status IN ('EXTRACT_ERROR', 'GEOCODE_ERROR')
          )
        )
      )
    ) INTO v_sources
  FROM public.scraping_sources ss
  ORDER BY ss.priority_score DESC, ss.last_success_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
  
  -- Handle empty results
  IF v_sources IS NULL THEN
    v_sources := '[]'::JSONB;
  END IF;
  
  -- Return paginated results with metadata
  RETURN jsonb_build_object(
    'success', TRUE,
    'data', v_sources,
    'pagination', jsonb_build_object(
      'total', v_total_count,
      'limit', p_limit,
      'offset', p_offset,
      'pages', CEIL(v_total_count::NUMERIC / p_limit)
    )
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.get_scraping_sources IS 'Gets a paginated list of scraping sources with stats';

-- Function to update scraping source priority
CREATE OR REPLACE FUNCTION public.update_scraping_source(
  p_url TEXT,
  p_priority_score INTEGER DEFAULT NULL,
  p_enabled BOOLEAN DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source RECORD;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Only administrators can update scraping sources'
    );
  END IF;

  -- Get the source
  SELECT * INTO v_source 
  FROM public.scraping_sources
  WHERE url = p_url;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Scraping source not found'
    );
  END IF;
  
  -- Update the source
  UPDATE public.scraping_sources
  SET 
    priority_score = COALESCE(p_priority_score, priority_score),
    enabled = COALESCE(p_enabled, enabled),
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE url = p_url;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Scraping source updated'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.update_scraping_source IS 'Updates a scraping source priority, enabled status, or notes';

-- ================================================================
-- SECTION 6: INITIAL DATA POPULATION
-- ================================================================

-- Populate scraping_sources with the current MASTER_URL_LIST plus the two missing sample sites
INSERT INTO public.scraping_sources (url, priority_score, notes)
VALUES
  -- Sample sites (high priority)
  ('https://dpmsportcards.com/indiana-card-shows/', 90, 'Sample site - already in MASTER_URL_LIST'),
  ('https://tcdb.com/CardShows.cfm', 90, 'Sample site - added as requested'),
  ('https://sportscollectorsdigest.com/show-calendar#ohio', 90, 'Sample site - added as requested'),
  
  -- Existing MASTER_URL_LIST (medium priority)
  ('https://www.sacramentocardshow916.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://katysportscardshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://nonacollects.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.collectiblesoncollege.com/showcalendar-834086-307805.html', 50, 'From original MASTER_URL_LIST'),
  ('https://frontrowcardshow.com/collections/san-diego', 50, 'From original MASTER_URL_LIST'),
  ('https://www.frankandsonshow.net/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.trifectacollectibles.com/events/list/', 50, 'From original MASTER_URL_LIST'),
  ('https://cvcshow.com/events/', 50, 'From original MASTER_URL_LIST'),
  ('https://westcoastcardshow.com/events/', 50, 'From original MASTER_URL_LIST'),
  ('https://frontrowcardshow.com/collections/pasadena', 50, 'From original MASTER_URL_LIST'),
  ('https://www.nocofriendsofbaseball.com/event-details/1-table-2025-friends-of-baseball-card-memorabilia-show', 50, 'From original MASTER_URL_LIST'),
  ('https://www.norrispenrose.com/events-1/pikes-peak-sports-cards-super-show', 50, 'From original MASTER_URL_LIST'),
  ('https://nationalwesterncenter.com/event/denver-card-show-2/2025-05-17/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.card.party/', 50, 'From original MASTER_URL_LIST'),
  ('https://floridastatefair.com/event/tampa-sports-collectors-expo-3/2025-06-07/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.beckett.com/venue_manager', 50, 'From original MASTER_URL_LIST'),
  ('https://charliescollectibleshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.culturecollisiontradeshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.cardshq.com/pages/events', 50, 'From original MASTER_URL_LIST'),
  ('https://www.dallascardshow.com/chicago', 50, 'From original MASTER_URL_LIST'),
  ('https://www.premiercardshows.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.nsccshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://jjallstarsportscards.com/midwest-monster-show/', 50, 'From original MASTER_URL_LIST'),
  ('https://jjallstarsportscards.com/show-dates/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.homeofpurdue.com/event/tippecanoe-sports-collectibles-show/20265/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.racingmemorabiliashow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://flippincardshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.northeastcardexpo.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.cardshows.net/methuen-show-dates', 50, 'From original MASTER_URL_LIST'),
  ('https://www.cravetheauto.com/baseball-card-shows', 50, 'From original MASTER_URL_LIST'),
  ('https://www.shopemeraldsquare.com/events', 50, 'From original MASTER_URL_LIST'),
  ('https://www.legendsfanshop.com/card-shows/', 50, 'From original MASTER_URL_LIST'),
  ('https://collectorsarena.net/pages/events-calendar', 50, 'From original MASTER_URL_LIST'),
  ('https://www.thezonecards.com/cardshows', 50, 'From original MASTER_URL_LIST'),
  ('https://www.cardshowmn.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://shakopeebowl.com/sports-card-show', 50, 'From original MASTER_URL_LIST'),
  ('https://www.kccardshows.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://stlsportscollectors.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://afterthegameinc.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://relicsantiquemall.com/event-center-calendar-2/', 50, 'From original MASTER_URL_LIST'),
  ('https://cardscollectibles.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://jerseyshoretoyshow.com/pages/woodbridge-card-show', 50, 'From original MASTER_URL_LIST'),
  ('https://www.ocnj.us/SportsMemorabiliaShow', 50, 'From original MASTER_URL_LIST'),
  ('https://bleeckertrading.com/pages/trade-night', 50, 'From original MASTER_URL_LIST'),
  ('https://www.nyshows.org/show-calendar-new', 50, 'From original MASTER_URL_LIST'),
  ('https://www.litcgshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.fanaticsfest.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://anyshowpromotions.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.tidewatercardsandcollectibles.com/upcoming-shows', 50, 'From original MASTER_URL_LIST'),
  ('https://www.toledosportscardshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://gametimesportscollect.com/event-schedule/', 50, 'From original MASTER_URL_LIST'),
  ('https://collectaconusa.com/cleveland/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.dallascardshow.com/cincinnati', 50, 'From original MASTER_URL_LIST'),
  ('https://strongsvillesports.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://phillyshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.sbsportspromotions.com/pages/show-schedule', 50, 'From original MASTER_URL_LIST'),
  ('https://www.chestercountycardshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://phillynon-sportscardshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://discoveryparkofamerica.com/event/jackson-sports-cards-collectibles-show-at-discovery-park-2/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.dallascardshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://conroesportscardshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://htowncardshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.nrgpark.com/event/tristar-collectors-show-2/', 50, 'From original MASTER_URL_LIST'),
  ('https://collectaconusa.com/dallas/', 50, 'From original MASTER_URL_LIST'),
  ('http://757cardshows.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://csashows.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.sportscardinvestor.com/card-shows/', 50, 'From original MASTER_URL_LIST'),
  ('https://collectaconusa.com/richmond/', 50, 'From original MASTER_URL_LIST'),
  ('https://frontrowcardshow.com/collections/seattle', 50, 'From original MASTER_URL_LIST'),
  ('https://pnwshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://twinoaksshows.com/home-page', 50, 'From original MASTER_URL_LIST'),
  ('https://www.wsscaseattle.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.wisconsincardshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://madisoncardshow.com/', 50, 'From original MASTER_URL_LIST'),
  ('http://wsca1975.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://www.fatdaddyssports.com/', 50, 'From original MASTER_URL_LIST'),
  ('https://theoshkoshcardshow.com/', 50, 'From original MASTER_URL_LIST')
ON CONFLICT (url) DO UPDATE
SET 
  notes = EXCLUDED.notes || ' (updated)',
  updated_at = now();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scraped_shows_pending TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_feedback TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scraping_sources TO service_role;

-- Commit the transaction
COMMIT;
