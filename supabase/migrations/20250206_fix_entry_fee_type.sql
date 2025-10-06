-- Migration: Fix entry_fee type conversion
-- Description: Update approve_show_v2 to properly convert text entry_fee to numeric
-- Created: October 6, 2025

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
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_features JSONB;
  v_categories TEXT[];
  v_organizer_email TEXT;
  v_organizer_name TEXT;
  v_show_name TEXT;
  v_email_id UUID;
  v_timezone TEXT;
  v_first_day JSONB;
  v_last_day JSONB;
  v_description TEXT;
  v_entry_fee_text TEXT;
  v_entry_fee NUMERIC;
  v_image_url TEXT;
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
  
  -- Extract organizer info
  v_organizer_email := v_show_data->>'organizerEmail';
  v_organizer_name := v_show_data->>'organizerName';
  v_show_name := v_show_data->>'name';
  
  -- Extract optional fields
  v_description := v_show_data->>'description';
  v_image_url := v_show_data->>'imageUrl';
  
  -- Extract and convert entry_fee
  v_entry_fee_text := v_show_data->>'entryFee';
  IF v_entry_fee_text IS NOT NULL AND v_entry_fee_text != '' THEN
    BEGIN
      -- Try to extract numeric value (handles "$5", "5.00", "5" etc)
      v_entry_fee := regexp_replace(v_entry_fee_text, '[^0-9.]', '', 'g')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      -- If conversion fails, set to NULL
      v_entry_fee := NULL;
      RAISE NOTICE 'Could not convert entry_fee "%" to numeric, setting to NULL', v_entry_fee_text;
    END;
  ELSE
    v_entry_fee := NULL;
  END IF;
  
  -- Extract schedule
  v_daily_schedule := v_show_data->'dailySchedule';
  
  -- Get timezone from first day's schedule (all days should have same timezone)
  IF v_daily_schedule IS NOT NULL AND jsonb_array_length(v_daily_schedule) > 0 THEN
    v_timezone := COALESCE(v_daily_schedule->0->>'timezone', 'America/New_York');
    
    -- Get first and last days
    v_first_day := v_daily_schedule->0;
    v_last_day := v_daily_schedule->(jsonb_array_length(v_daily_schedule) - 1);
    
    -- Build proper timestamps with timezone
    v_start_date := (
      (v_first_day->>'date') || ' ' || 
      (v_first_day->>'startTime') || ':00 ' || 
      v_timezone
    )::TIMESTAMPTZ;
    
    v_end_date := (
      (v_last_day->>'date') || ' ' || 
      (v_last_day->>'endTime') || ':00 ' || 
      v_timezone
    )::TIMESTAMPTZ;
  ELSE
    -- Fallback to old format (no timezone info)
    v_start_date := (v_show_data->>'startDate')::TIMESTAMPTZ;
    v_end_date := COALESCE((v_show_data->>'endDate')::TIMESTAMPTZ, v_start_date);
  END IF;
  
  -- Get features
  v_features := COALESCE(v_show_data->'features', '[]'::jsonb);
  
  -- Get categories
  IF v_show_data->'categories' IS NOT NULL THEN
    v_categories := ARRAY(SELECT jsonb_array_elements_text(v_show_data->'categories'));
  ELSE
    v_categories := ARRAY[]::text[];
  END IF;
  
  -- Insert the show with description and optional fields
  INSERT INTO shows (
    title, location, address, start_date, end_date,
    status, daily_schedule, features, categories,
    description, entry_fee, image_url
  ) VALUES (
    COALESCE(v_show_name, 'Untitled'),
    COALESCE(v_show_data->>'venueName', 'TBD'),
    COALESCE(v_show_data->>'address', 'TBD'),
    v_start_date,
    v_end_date,
    'ACTIVE',
    v_daily_schedule,
    v_features,
    v_categories,
    v_description,
    v_entry_fee,
    v_image_url
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
  
  -- Queue approval email if we have organizer email
  IF v_organizer_email IS NOT NULL AND v_organizer_email != '' THEN
    BEGIN
      v_email_id := queue_approval_email(
        v_organizer_email,
        v_organizer_name,
        v_show_name,
        v_show_id,
        v_start_date::DATE
      );
      
      RAISE NOTICE 'Email queued with ID: %', v_email_id;
    EXCEPTION WHEN OTHERS THEN
      -- Don't fail approval if email queueing fails
      RAISE NOTICE 'Failed to queue email: %', SQLERRM;
    END;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'show_id', v_show_id,
    'email_queued', v_email_id IS NOT NULL,
    'start_date', v_start_date,
    'end_date', v_end_date,
    'timezone', v_timezone
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'state', SQLSTATE);
END;
$$;

COMMENT ON FUNCTION public.approve_show_v2 IS 'Approves a show with proper entry_fee type conversion from text to numeric';

SELECT '✅ Entry fee type conversion fixed!' as result;
