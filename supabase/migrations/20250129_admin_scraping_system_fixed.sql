-- Migration: 20250129_admin_scraping_system_fixed.sql
-- Description: Creates tables and functions for the admin-controlled scraping system
-- Created: January 29, 2025

-- ================================================================
-- SECTION 1: SAFETY CHECKS & EXTENSIONS
-- ================================================================

-- Ensure required extensions are enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

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
  status           TEXT DEFAULT 'PENDING',        -- PENDING | APPROVED | REJECTED
  admin_notes      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  reviewed_at      TIMESTAMPTZ
);

-- 2. Admin feedback log for audit trail
CREATE TABLE IF NOT EXISTS public.admin_feedback (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pending_id    UUID REFERENCES scraped_shows_pending(id),
  admin_id      UUID REFERENCES auth.users(id),
  action        TEXT NOT NULL,                 -- approve / reject / edit
  feedback      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 3. Scraping sources master list with priority scoring
CREATE TABLE IF NOT EXISTS public.scraping_sources (
  url                 TEXT PRIMARY KEY,
  priority_score      INT DEFAULT 50,   -- 0-100, higher runs sooner
  last_success_at     TIMESTAMPTZ,
  last_error_at       TIMESTAMPTZ,
  error_streak        INT DEFAULT 0,
  enabled             BOOLEAN DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ================================================================
-- SECTION 3: INDEXES
-- ================================================================

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scraped_shows_pending_status ON public.scraped_shows_pending(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_feedback_pending_id ON public.admin_feedback(pending_id);
CREATE INDEX IF NOT EXISTS idx_scraping_sources_priority ON public.scraping_sources(priority_score DESC, last_success_at);

-- ================================================================
-- SECTION 4: HELPER FUNCTIONS
-- ================================================================

-- Helper function to check if user is an admin (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_admin' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    EXECUTE $FUNC$
    CREATE OR REPLACE FUNCTION public.is_admin() 
    RETURNS BOOLEAN AS $INNER$
    BEGIN
      RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND LOWER(role) = 'admin'
      );
    END;
    $INNER$ LANGUAGE plpgsql SECURITY DEFINER;
    $FUNC$;
    
    COMMENT ON FUNCTION public.is_admin() IS 'Checks if the current user has admin role';
  END IF;
END
$$;

-- Function to increment priority score
CREATE OR REPLACE FUNCTION public.increment_priority(url_param TEXT, increment_amount INT)
RETURNS INT AS $$
DECLARE
  current_score INT;
BEGIN
  SELECT priority_score INTO current_score FROM public.scraping_sources WHERE url = url_param;
  RETURN LEAST(100, COALESCE(current_score, 50) + increment_amount);
END;
$$ LANGUAGE plpgsql;

-- Function to decrement priority score
CREATE OR REPLACE FUNCTION public.decrement_priority(url_param TEXT, decrement_amount INT)
RETURNS INT AS $$
DECLARE
  current_score INT;
BEGIN
  SELECT priority_score INTO current_score FROM public.scraping_sources WHERE url = url_param;
  RETURN GREATEST(0, COALESCE(current_score, 50) - decrement_amount);
END;
$$ LANGUAGE plpgsql;

-- Function to increment error streak
CREATE OR REPLACE FUNCTION public.increment_error_streak(url_param TEXT)
RETURNS INT AS $$
DECLARE
  current_streak INT;
BEGIN
  SELECT error_streak INTO current_streak FROM public.scraping_sources WHERE url = url_param;
  RETURN COALESCE(current_streak, 0) + 1;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- SECTION 5: ADMIN WORKFLOW FUNCTIONS
-- ================================================================

-- Function to get pending shows with pagination
CREATE OR REPLACE FUNCTION public.get_pending_shows(
  p_status TEXT DEFAULT 'PENDING',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_data JSONB;
  total_count INT;
BEGIN
  -- Get total count for pagination
  SELECT COUNT(*) INTO total_count
  FROM public.scraped_shows_pending
  WHERE status = p_status;
  
  -- Get paginated results
  SELECT 
    jsonb_build_object(
      'data', COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb),
      'pagination', jsonb_build_object(
        'total', total_count,
        'limit', p_limit,
        'offset', p_offset,
        'pages', CEIL(total_count::numeric / p_limit)
      )
    ) INTO result_data
  FROM (
    SELECT 
      id, 
      source_url, 
      raw_payload, 
      normalized_json, 
      geocoded_json, 
      status, 
      admin_notes, 
      created_at, 
      reviewed_at
    FROM public.scraped_shows_pending
    WHERE status = p_status
    ORDER BY created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;
  
  RETURN result_data;
END;
$$;

-- Function to approve a pending show
CREATE OR REPLACE FUNCTION public.approve_pending_show(
  p_pending_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending_record public.scraped_shows_pending;
  v_show_data JSONB;
  v_show_id UUID;
BEGIN
  -- Get the pending record
  SELECT * INTO v_pending_record
  FROM public.scraped_shows_pending
  WHERE id = p_pending_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pending show not found'
    );
  END IF;
  
  -- Check if already processed
  IF v_pending_record.status != 'PENDING' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Show already ' || v_pending_record.status
    );
  END IF;
  
  -- Use normalized_json if available, otherwise use raw_payload
  v_show_data := COALESCE(v_pending_record.normalized_json, v_pending_record.raw_payload);
  
  -- Insert into shows table
  INSERT INTO public.shows (
    title,
    description,
    location,
    address,
    start_date,
    end_date,
    entry_fee,
    image_url,
    status
  ) VALUES (
    v_show_data->>'name',
    v_show_data->>'description',
    COALESCE(v_show_data->>'venueName', v_show_data->>'city'),
    COALESCE(v_show_data->>'address', v_show_data->>'city' || ', ' || v_show_data->>'state'),
    (v_show_data->>'startDate')::TIMESTAMP WITH TIME ZONE,
    (v_show_data->>'endDate')::TIMESTAMP WITH TIME ZONE,
    (v_show_data->>'entryFee')::NUMERIC,
    v_pending_record.source_url,
    'ACTIVE'
  )
  ON CONFLICT (title, start_date, location) DO UPDATE
  SET
    description = EXCLUDED.description,
    address = EXCLUDED.address,
    end_date = EXCLUDED.end_date,
    updated_at = now()
  RETURNING id INTO v_show_id;
  
  -- Update the pending record
  UPDATE public.scraped_shows_pending
  SET 
    status = 'APPROVED',
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    reviewed_at = now()
  WHERE id = p_pending_id;
  
  -- Log the action
  INSERT INTO public.admin_feedback (
    pending_id,
    admin_id,
    action,
    feedback
  ) VALUES (
    p_pending_id,
    auth.uid(),
    'APPROVE',
    p_admin_notes
  );
  
  -- Update source priority score
  UPDATE public.scraping_sources
  SET 
    priority_score = LEAST(100, priority_score + 2),
    updated_at = now()
  WHERE url = v_pending_record.source_url;
  
  RETURN jsonb_build_object(
    'success', true,
    'show_id', v_show_id,
    'message', 'Show approved and published'
  );
END;
$$;

-- Function to reject a pending show
CREATE OR REPLACE FUNCTION public.reject_pending_show(
  p_pending_id UUID,
  p_reason TEXT DEFAULT 'Rejected by admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending_record public.scraped_shows_pending;
BEGIN
  -- Get the pending record
  SELECT * INTO v_pending_record
  FROM public.scraped_shows_pending
  WHERE id = p_pending_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pending show not found'
    );
  END IF;
  
  -- Check if already processed
  IF v_pending_record.status != 'PENDING' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Show already ' || v_pending_record.status
    );
  END IF;
  
  -- Update the pending record
  UPDATE public.scraped_shows_pending
  SET 
    status = 'REJECTED',
    admin_notes = p_reason,
    reviewed_at = now()
  WHERE id = p_pending_id;
  
  -- Log the action
  INSERT INTO public.admin_feedback (
    pending_id,
    admin_id,
    action,
    feedback
  ) VALUES (
    p_pending_id,
    auth.uid(),
    'REJECT',
    p_reason
  );
  
  -- Update source priority score (decrease for rejections)
  UPDATE public.scraping_sources
  SET 
    priority_score = GREATEST(0, priority_score - 3),
    updated_at = now()
  WHERE url = v_pending_record.source_url;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Show rejected'
  );
END;
$$;

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
  v_pending_record public.scraped_shows_pending;
BEGIN
  -- Get the pending record
  SELECT * INTO v_pending_record
  FROM public.scraped_shows_pending
  WHERE id = p_pending_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pending show not found'
    );
  END IF;
  
  -- Check if already processed
  IF v_pending_record.status != 'PENDING' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Show already ' || v_pending_record.status
    );
  END IF;
  
  -- Update the pending record
  UPDATE public.scraped_shows_pending
  SET 
    normalized_json = p_normalized_json,
    admin_notes = COALESCE(p_admin_notes, admin_notes)
  WHERE id = p_pending_id;
  
  -- Log the action
  INSERT INTO public.admin_feedback (
    pending_id,
    admin_id,
    action,
    feedback
  ) VALUES (
    p_pending_id,
    auth.uid(),
    'EDIT',
    p_admin_notes
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Show edited'
  );
END;
$$;

-- Function to get scraping sources
CREATE OR REPLACE FUNCTION public.get_scraping_sources(
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_data JSONB;
  total_count INT;
BEGIN
  -- Get total count for pagination
  SELECT COUNT(*) INTO total_count
  FROM public.scraping_sources;
  
  -- Get paginated results
  SELECT 
    jsonb_build_object(
      'data', COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb),
      'pagination', jsonb_build_object(
        'total', total_count,
        'limit', p_limit,
        'offset', p_offset,
        'pages', CEIL(total_count::numeric / p_limit)
      )
    ) INTO result_data
  FROM (
    SELECT 
      url,
      priority_score,
      last_success_at,
      last_error_at,
      error_streak,
      enabled,
      notes,
      created_at,
      updated_at
    FROM public.scraping_sources
    ORDER BY priority_score DESC, last_success_at NULLS FIRST
    LIMIT p_limit
    OFFSET p_offset
  ) t;
  
  RETURN result_data;
END;
$$;

-- Function to update scraping source
CREATE OR REPLACE FUNCTION public.update_scraping_source(
  p_url TEXT,
  p_priority_score INT DEFAULT NULL,
  p_enabled BOOLEAN DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source_record public.scraping_sources;
BEGIN
  -- Get the source record
  SELECT * INTO v_source_record
  FROM public.scraping_sources
  WHERE url = p_url;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Scraping source not found'
    );
  END IF;
  
  -- Update the source record
  UPDATE public.scraping_sources
  SET 
    priority_score = COALESCE(p_priority_score, priority_score),
    enabled = COALESCE(p_enabled, enabled),
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE url = p_url;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Scraping source updated'
  );
END;
$$;

-- ================================================================
-- SECTION 6: ROW LEVEL SECURITY POLICIES
-- ================================================================

-- Enable RLS on all tables
ALTER TABLE public.scraped_shows_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_sources ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
  -- Drop policies for scraped_shows_pending
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scraped_shows_pending' AND policyname = 'admin_all_scraped_shows_pending') THEN
    DROP POLICY admin_all_scraped_shows_pending ON public.scraped_shows_pending;
  END IF;
  
  -- Drop policies for admin_feedback
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_feedback' AND policyname = 'admin_all_admin_feedback') THEN
    DROP POLICY admin_all_admin_feedback ON public.admin_feedback;
  END IF;
  
  -- Drop policies for scraping_sources
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scraping_sources' AND policyname = 'admin_all_scraping_sources') THEN
    DROP POLICY admin_all_scraping_sources ON public.scraping_sources;
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
-- SECTION 7: SEED DATA
-- ================================================================

-- Seed scraping_sources with initial URLs
INSERT INTO public.scraping_sources (url, priority_score, notes, enabled)
VALUES
  -- Sample sites (high priority)
  ('https://dpmsportcards.com/indiana-card-shows/', 90, 'Sample site - Indiana card shows', true),
  ('https://tcdb.com/CardShows.cfm', 90, 'Sample site - TCDB card shows', true),
  ('https://sportscollectorsdigest.com/show-calendar', 90, 'Sample site - Sports Collectors Digest', true),
  
  -- Other sites from existing scraper
  ('https://www.sacramentocardshow916.com/', 50, 'Existing site', true),
  ('https://katysportscardshow.com/', 50, 'Existing site', true),
  ('https://nonacollects.com/', 50, 'Existing site', true),
  ('https://www.collectiblesoncollege.com/showcalendar-834086-307805.html', 50, 'Existing site', true),
  ('https://frontrowcardshow.com/collections/san-diego', 50, 'Existing site', true),
  ('https://www.frankandsonshow.net/', 50, 'Existing site', true),
  ('https://www.trifectacollectibles.com/events/list/', 50, 'Existing site', true),
  ('https://cvcshow.com/events/', 50, 'Existing site', true),
  ('https://westcoastcardshow.com/events/', 50, 'Existing site', true),
  ('https://frontrowcardshow.com/collections/pasadena', 50, 'Existing site', true),
  ('https://www.nocofriendsofbaseball.com/event-details/1-table-2025-friends-of-baseball-card-memorabilia-show', 50, 'Existing site', true),
  ('https://www.norrispenrose.com/events-1/pikes-peak-sports-cards-super-show', 50, 'Existing site', true),
  ('https://nationalwesterncenter.com/event/denver-card-show-2/2025-05-17/', 50, 'Existing site', true),
  ('https://www.card.party/', 50, 'Existing site', true),
  ('https://floridastatefair.com/event/tampa-sports-collectors-expo-3/2025-06-07/', 50, 'Existing site', true),
  ('https://www.beckett.com/venue_manager', 50, 'Existing site', true),
  ('https://charliescollectibleshow.com/', 50, 'Existing site', true),
  ('https://www.culturecollisiontradeshow.com/', 50, 'Existing site', true),
  ('https://www.cardshq.com/pages/events', 50, 'Existing site', true),
  ('https://www.dallascardshow.com/chicago', 50, 'Existing site', true),
  ('https://www.premiercardshows.com/', 50, 'Existing site', true),
  ('https://www.nsccshow.com/', 50, 'Existing site', true)
ON CONFLICT (url) 
DO UPDATE SET
  priority_score = GREATEST(scraping_sources.priority_score, EXCLUDED.priority_score),
  notes = COALESCE(EXCLUDED.notes, scraping_sources.notes),
  enabled = EXCLUDED.enabled;

-- ================================================================
-- SECTION 8: GRANT PERMISSIONS
-- ================================================================

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.scraped_shows_pending TO authenticated;
GRANT SELECT ON public.admin_feedback TO authenticated;
GRANT SELECT ON public.scraping_sources TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_pending_shows TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_pending_show TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_pending_show TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_pending_show TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_scraping_sources TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_scraping_source TO authenticated;

-- ================================================================
-- SECTION 9: COMMENTS
-- ================================================================

COMMENT ON TABLE public.scraped_shows_pending IS 'Staging table for scraped card shows pending admin review';
COMMENT ON TABLE public.admin_feedback IS 'Audit trail of admin actions on scraped shows';
COMMENT ON TABLE public.scraping_sources IS 'Master list of scraping sources with priority scoring';

COMMENT ON FUNCTION public.get_pending_shows IS 'Gets paginated list of pending shows for admin review';
COMMENT ON FUNCTION public.approve_pending_show IS 'Approves a pending show and publishes it to the shows table';
COMMENT ON FUNCTION public.reject_pending_show IS 'Rejects a pending show with reason';
COMMENT ON FUNCTION public.edit_pending_show IS 'Edits a pending show before approval';
COMMENT ON FUNCTION public.get_scraping_sources IS 'Gets paginated list of scraping sources';
COMMENT ON FUNCTION public.update_scraping_source IS 'Updates a scraping source priority and settings';
