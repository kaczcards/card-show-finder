-- Migration: 20250203_approve_show_v2.sql
-- Description: Create a NEW function with a different name to bypass caching
-- Created: February 3, 2025

-- Create a completely new function with a different name
CREATE OR REPLACE FUNCTION public.approve_show_v2(
  p_pending_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_data JSONB;
  v_show_id UUID;
  v_daily_schedule JSONB;
  v_start_date DATE;
  v_end_date DATE;
  v_features JSONB;
  v_categories TEXT[];
BEGIN
  -- Get the raw data
  SELECT raw_payload
  INTO v_show_data
  FROM scraped_shows_pending
  WHERE id = p_pending_id
    AND status = 'PENDING';
  
  IF v_show_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Show not found or already processed');
  END IF;
  
  -- Extract schedule
  v_daily_schedule := v_show_data->'dailySchedule';
  
  -- Get dates
  IF v_daily_schedule IS NOT NULL AND jsonb_array_length(v_daily_schedule) > 0 THEN
    SELECT MIN((e->>'date')::DATE), MAX((e->>'date')::DATE)
    INTO v_start_date, v_end_date
    FROM jsonb_array_elements(v_daily_schedule) e;
  ELSE
    v_start_date := (v_show_data->>'startDate')::DATE;
    v_end_date := COALESCE((v_show_data->>'endDate')::DATE, v_start_date);
  END IF;
  
  -- Get features
  v_features := COALESCE(v_show_data->'features', '[]'::jsonb);
  
  -- Get categories
  IF v_show_data->'categories' IS NOT NULL THEN
    v_categories := ARRAY(SELECT jsonb_array_elements_text(v_show_data->'categories'));
  ELSE
    v_categories := ARRAY[]::text[];
  END IF;
  
  -- Insert the show
  INSERT INTO shows (
    title, location, address, start_date, end_date,
    status, daily_schedule, features, categories
  ) VALUES (
    COALESCE(v_show_data->>'name', 'Untitled'),
    COALESCE(v_show_data->>'venueName', 'TBD'),
    COALESCE(v_show_data->>'address', 'TBD'),
    v_start_date::TIMESTAMPTZ,
    v_end_date::TIMESTAMPTZ,
    'ACTIVE',
    v_daily_schedule,
    v_features,
    v_categories
  )
  RETURNING id INTO v_show_id;
  
  -- Update the pending record
  UPDATE scraped_shows_pending
  SET status = 'APPROVED', reviewed_at = now(), admin_notes = p_admin_notes
  WHERE id = p_pending_id;
  
  -- Update the organizer submission
  UPDATE web_show_submissions
  SET approved_show_id = v_show_id, status = 'APPROVED'
  WHERE pending_show_id = p_pending_id;
  
  RETURN jsonb_build_object('success', true, 'show_id', v_show_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'state', SQLSTATE);
END;
$$;

SELECT 'New function approve_show_v2 created!' as result;
