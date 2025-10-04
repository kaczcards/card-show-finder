-- Migration: 20250203_fix_approve_function.sql
-- Description: Fix approve_pending_show function to handle features and categories more robustly
-- Created: February 3, 2025

-- Drop and recreate the function with better error handling
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
  v_features JSONB;
  v_categories TEXT[];
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
  
  -- Handle features - convert to JSONB or use empty object
  BEGIN
    IF v_show_data->'features' IS NOT NULL THEN
      v_features := v_show_data->'features';
    ELSE
      v_features := '[]'::jsonb;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_features := '[]'::jsonb;
  END;
  
  -- Handle categories - convert to text array or use empty array
  BEGIN
    IF v_show_data->'categories' IS NOT NULL AND jsonb_typeof(v_show_data->'categories') = 'array' THEN
      v_categories := ARRAY(SELECT jsonb_array_elements_text(v_show_data->'categories'));
    ELSE
      v_categories := ARRAY[]::text[];
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_categories := ARRAY[]::text[];
  END;
  
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
    v_daily_schedule,
    v_features,
    v_categories,
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
EXCEPTION WHEN OTHERS THEN
  -- Catch any errors and return them in the response
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

COMMENT ON FUNCTION public.approve_pending_show IS 'Approves a pending show with robust error handling for features and categories';

-- Done
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixed approve_pending_show function';
  RAISE NOTICE 'Added better error handling for features and categories';
  RAISE NOTICE '========================================';
END
$$;
