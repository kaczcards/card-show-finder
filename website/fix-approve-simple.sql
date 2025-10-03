-- ================================================================
-- SIMPLE FIX: approve_pending_show Function
-- ================================================================
-- This version just casts to JSONB directly without type checking
-- ================================================================

CREATE OR REPLACE FUNCTION public.approve_pending_show(
  p_pending_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_raw_payload TEXT;
  v_normalized_json TEXT;
  v_status TEXT;
  v_show_data JSONB;
  v_show_id UUID;
  v_start_date TEXT;
  v_end_date TEXT;
  v_name TEXT;
  v_venue TEXT;
  v_address TEXT;
  v_description TEXT;
  v_entry_fee_text TEXT;
  v_entry_fee NUMERIC;
  v_image_url TEXT;
BEGIN
  -- Get the pending record data as TEXT
  SELECT 
    raw_payload::TEXT,
    normalized_json::TEXT,
    status::TEXT
  INTO v_raw_payload, v_normalized_json, v_status
  FROM public.scraped_shows_pending
  WHERE id = p_pending_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pending show not found'
    );
  END IF;
  
  -- Convert TEXT to JSONB
  BEGIN
    IF v_normalized_json IS NOT NULL AND v_normalized_json != '' THEN
      v_show_data := v_normalized_json::JSONB;
    ELSIF v_raw_payload IS NOT NULL AND v_raw_payload != '' THEN
      v_show_data := v_raw_payload::JSONB;
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'No show data found'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to parse JSON data: ' || SQLERRM
    );
  END;
  
  -- Extract values from JSONB
  v_name := v_show_data->>'name';
  v_start_date := v_show_data->>'startDate';
  v_end_date := v_show_data->>'endDate';
  v_venue := COALESCE(v_show_data->>'venueName', v_show_data->>'city', 'TBD');
  v_address := COALESCE(v_show_data->>'address', 'Address not provided');
  v_description := COALESCE(v_show_data->>'description', '');
  v_entry_fee_text := v_show_data->>'entryFee';
  v_image_url := v_show_data->>'imageUrl';
  
  -- Validate required fields
  IF v_name IS NULL OR v_name = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Show name is required'
    );
  END IF;
  
  IF v_start_date IS NULL OR v_start_date = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Start date is required'
    );
  END IF;
  
  -- Parse entry fee
  BEGIN
    IF v_entry_fee_text IS NOT NULL AND v_entry_fee_text != '' THEN
      v_entry_fee := v_entry_fee_text::NUMERIC;
    ELSE
      v_entry_fee := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_entry_fee := NULL;
  END;
  
  -- Insert into shows table
  BEGIN
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
      v_name,
      v_description,
      v_venue,
      v_address,
      v_start_date::TIMESTAMP WITH TIME ZONE,
      COALESCE(v_end_date::TIMESTAMP WITH TIME ZONE, v_start_date::TIMESTAMP WITH TIME ZONE),
      v_entry_fee,
      v_image_url,
      'ACTIVE'
    )
    ON CONFLICT (title, start_date, location) DO UPDATE
    SET
      description = EXCLUDED.description,
      address = EXCLUDED.address,
      end_date = EXCLUDED.end_date,
      entry_fee = EXCLUDED.entry_fee,
      image_url = EXCLUDED.image_url,
      updated_at = now()
    RETURNING id INTO v_show_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to insert show: ' || SQLERRM
    );
  END;
  
  -- Update the pending record
  UPDATE public.scraped_shows_pending
  SET 
    status = 'APPROVED',
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    reviewed_at = now()
  WHERE id = p_pending_id;
  
  -- Try to log the action
  BEGIN
    INSERT INTO public.admin_feedback (
      pending_id,
      admin_id,
      action,
      feedback
    ) VALUES (
      p_pending_id,
      auth.uid(),
      'APPROVED',
      p_admin_notes
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'show_id', v_show_id,
    'message', 'Show approved and published successfully'
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.approve_pending_show TO anon;
GRANT EXECUTE ON FUNCTION public.approve_pending_show TO authenticated;

-- Verify it was created
SELECT 
  proname as function_name,
  prosrc as source_code
FROM pg_proc 
WHERE proname = 'approve_pending_show';
