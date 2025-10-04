-- Migration: 20250203_multi_day_schedule_and_organizer_contact.sql
-- Description: Adds support for multi-day shows with variable schedules and organizer contact info
-- Created: February 3, 2025
-- 
-- This migration addresses two issues:
-- 1. Shows with different times per day (e.g., Day 1: 8am-2pm, Day 2: 12pm-8pm)
-- 2. Organizer contact information for follow-up after submission (mailing list)

-- ================================================================
-- SECTION 1: CREATE WEB_SHOW_SUBMISSIONS TABLE (MAILING LIST)
-- ================================================================

-- Table to store organizer contact info separately (mailing list)
-- This keeps organizer info private and gives you a mailing list of all submitters
CREATE TABLE IF NOT EXISTS public.web_show_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organizer_name TEXT NOT NULL,
  organizer_email TEXT NOT NULL,
  pending_show_id UUID REFERENCES public.scraped_shows_pending(id),
  approved_show_id UUID REFERENCES public.shows(id),
  status TEXT DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED
  submitted_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  
  -- Useful for tracking unique submitters
  CONSTRAINT unique_pending_submission UNIQUE (pending_show_id)
);

COMMENT ON TABLE public.web_show_submissions IS 'Mailing list of organizers who submitted shows via web form';
COMMENT ON COLUMN public.web_show_submissions.organizer_name IS 'Name of the person who submitted the show';
COMMENT ON COLUMN public.web_show_submissions.organizer_email IS 'Email for follow-up and mailing list';
COMMENT ON COLUMN public.web_show_submissions.pending_show_id IS 'Links to the pending show submission';
COMMENT ON COLUMN public.web_show_submissions.approved_show_id IS 'Filled when show is approved - links to live show';
COMMENT ON COLUMN public.web_show_submissions.status IS 'Tracks submission status: PENDING, APPROVED, REJECTED';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_web_submissions_email ON public.web_show_submissions(organizer_email);
CREATE INDEX IF NOT EXISTS idx_web_submissions_status ON public.web_show_submissions(status);
CREATE INDEX IF NOT EXISTS idx_web_submissions_pending ON public.web_show_submissions(pending_show_id);
CREATE INDEX IF NOT EXISTS idx_web_submissions_approved ON public.web_show_submissions(approved_show_id);

-- ================================================================
-- SECTION 2: ADD DAILY_SCHEDULE COLUMN TO SHOWS TABLE
-- ================================================================

-- Add JSONB column for multi-day schedules with variable times
ALTER TABLE public.shows 
ADD COLUMN IF NOT EXISTS daily_schedule JSONB;

COMMENT ON COLUMN public.shows.daily_schedule IS 'Array of daily schedules for multi-day shows. Format: [{"date":"2025-10-04","startTime":"08:00","endTime":"14:00","notes":""}]. Leave null for single-day shows or use start_time/end_time fields.';

-- ================================================================
-- SECTION 3: ENABLE RLS ON NEW TABLE
-- ================================================================

ALTER TABLE public.web_show_submissions ENABLE ROW LEVEL SECURITY;

-- Only admins can view the mailing list
CREATE POLICY web_submissions_admin_read
  ON public.web_show_submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND LOWER(role) = 'admin'
    )
  );

-- Allow anonymous inserts (web form submissions)
CREATE POLICY web_submissions_anon_insert
  ON public.web_show_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Only admins can update/delete
CREATE POLICY web_submissions_admin_all
  ON public.web_show_submissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND LOWER(role) = 'admin'
    )
  );

-- ================================================================
-- SECTION 4: UPDATE approve_pending_show FUNCTION
-- ================================================================

-- Drop and recreate the function to handle daily_schedule and web_show_submissions
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
  v_daily_schedule JSONB;
  v_overall_start_date DATE;
  v_overall_end_date DATE;
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
  
  -- Extract daily schedule if it exists
  v_daily_schedule := v_show_data->'dailySchedule';
  
  -- Determine overall start and end dates
  IF v_daily_schedule IS NOT NULL AND jsonb_array_length(v_daily_schedule) > 0 THEN
    -- Multi-day show with schedule array
    -- Get the min and max dates from the schedule
    SELECT 
      MIN((entry->>'date')::DATE),
      MAX((entry->>'date')::DATE)
    INTO v_overall_start_date, v_overall_end_date
    FROM jsonb_array_elements(v_daily_schedule) AS entry;
  ELSE
    -- Single-day show or legacy format
    v_overall_start_date := (v_show_data->>'startDate')::DATE;
    v_overall_end_date := COALESCE((v_show_data->>'endDate')::DATE, v_overall_start_date);
  END IF;
  
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
    website_url,
    status,
    daily_schedule,
    features,
    categories,
    created_at,
    updated_at
  ) VALUES (
    v_show_data->>'name',
    v_show_data->>'description',
    COALESCE(v_show_data->>'venueName', v_show_data->>'city'),
    COALESCE(v_show_data->>'address', v_show_data->>'city' || ', ' || v_show_data->>'state'),
    v_overall_start_date::TIMESTAMP WITH TIME ZONE,
    v_overall_end_date::TIMESTAMP WITH TIME ZONE,
    CASE 
      WHEN v_show_data->>'entryFee' IS NOT NULL 
      THEN (regexp_replace(v_show_data->>'entryFee', '[^0-9.]', '', 'g'))::NUMERIC
      ELSE NULL
    END,
    v_show_data->>'imageUrl',
    v_show_data->>'contactEmail',
    'ACTIVE',
    v_daily_schedule,  -- Store the daily schedule JSONB
    -- Convert features array from JSON to JSONB (features is stored as JSONB)
    COALESCE(v_show_data->'features', '{}'::jsonb),
    -- Convert categories array from JSON to text array
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(v_show_data->'categories')),
      ARRAY[]::text[]
    ),
    now(),
    now()
  )
  RETURNING id INTO v_show_id;
  
  -- Update the web_show_submissions table with approved show ID
  UPDATE public.web_show_submissions
  SET 
    approved_show_id = v_show_id,
    status = 'APPROVED'
  WHERE pending_show_id = p_pending_id;
  
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
  
  -- Update source priority score (if source URL exists)
  IF v_pending_record.source_url IS NOT NULL THEN
    UPDATE public.scraping_sources
    SET 
      priority_score = LEAST(100, priority_score + 2),
      updated_at = now()
    WHERE url = v_pending_record.source_url;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'show_id', v_show_id,
    'message', 'Show approved and published with schedule'
  );
END;
$$;

COMMENT ON FUNCTION public.approve_pending_show IS 'Approves a pending show and stores daily_schedule in shows table';

-- ================================================================
-- SECTION 5: UPDATE reject_pending_show FUNCTION
-- ================================================================

-- Update reject function to also update web_show_submissions
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
  
  -- Update web_show_submissions
  UPDATE public.web_show_submissions
  SET 
    status = 'REJECTED',
    notes = p_reason
  WHERE pending_show_id = p_pending_id;
  
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
  IF v_pending_record.source_url IS NOT NULL THEN
    UPDATE public.scraping_sources
    SET 
      priority_score = GREATEST(0, priority_score - 3),
      updated_at = now()
    WHERE url = v_pending_record.source_url;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Show rejected'
  );
END;
$$;

-- ================================================================
-- SECTION 6: HELPER FUNCTION TO GET MAILING LIST
-- ================================================================

-- Function for admins to export mailing list
CREATE OR REPLACE FUNCTION public.get_organizer_mailing_list(
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 1000,
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
  -- Security check: only admins can access
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND LOWER(role) = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin access required'
    );
  END IF;
  
  -- Get total count
  SELECT COUNT(*) INTO total_count
  FROM public.web_show_submissions
  WHERE p_status IS NULL OR status = p_status;
  
  -- Get paginated results
  SELECT 
    jsonb_build_object(
      'success', true,
      'data', COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb),
      'pagination', jsonb_build_object(
        'total', total_count,
        'limit', p_limit,
        'offset', p_offset
      )
    ) INTO result_data
  FROM (
    SELECT 
      id,
      organizer_name,
      organizer_email,
      status,
      submitted_at,
      approved_show_id,
      notes
    FROM public.web_show_submissions
    WHERE p_status IS NULL OR status = p_status
    ORDER BY submitted_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;
  
  RETURN result_data;
END;
$$;

COMMENT ON FUNCTION public.get_organizer_mailing_list IS 'Returns mailing list of organizers who submitted shows (admin only)';

-- ================================================================
-- SECTION 7: GRANT PERMISSIONS
-- ================================================================

-- Grant permissions on new table
GRANT INSERT ON public.web_show_submissions TO anon;
GRANT SELECT ON public.web_show_submissions TO authenticated;

-- Grant execute on new function
GRANT EXECUTE ON FUNCTION public.get_organizer_mailing_list TO authenticated;

-- ================================================================
-- SECTION 8: MIGRATION COMPLETE
-- ================================================================

-- Add a migration marker
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 20250203_multi_day_schedule_and_organizer_contact completed successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Created web_show_submissions table (organizer mailing list)';
  RAISE NOTICE '✓ Added daily_schedule JSONB column to shows table';
  RAISE NOTICE '✓ Updated approve_pending_show function to handle multi-day schedules';
  RAISE NOTICE '✓ Updated reject_pending_show function to track web submissions';
  RAISE NOTICE '✓ Added get_organizer_mailing_list function for admin exports';
  RAISE NOTICE '';
  RAISE NOTICE 'HOMEPAGE DISPLAY LOGIC:';
  RAISE NOTICE '- Single-day shows: "Oct 4, 2025 • 8:00 AM - 2:00 PM"';
  RAISE NOTICE '- Multi-day shows: "Oct 4-6, 2025 • See full schedule →"';
  RAISE NOTICE '========================================';
END
$$;
