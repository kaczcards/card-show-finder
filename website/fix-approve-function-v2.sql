-- ================================================================
-- Fix: approve_pending_show Function v2
-- ================================================================
-- This version handles both TEXT and JSONB column types
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
  v_pending_record RECORD;
  v_show_data JSONB;
  v_show_id UUID;
  v_entry_fee NUMERIC;
  v_start_date TIMESTAMP WITH TIME ZONE;
  v_end_date TIMESTAMP WITH TIME ZONE;
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
  
  -- Convert to JSONB if needed (handle both TEXT and JSONB types)
  BEGIN
    IF v_pending_record.normalized_json IS NOT NULL THEN
      -- Try normalized_json first
      IF pg_typeof(v_pending_record.normalized_json) = 'text'::regtype THEN
        v_show_data := v_pending_record.normalized_json::JSONB;
      ELSE
        v_show_data := v_pending_record.normalized_json;
      END IF;
    ELSIF v_pending_record.raw_payload IS NOT NULL THEN
      -- Fall back to raw_payload
      IF pg_typeof(v_pending_record.raw_payload) = 'text'::regtype THEN
        v_show_data := v_pending_record.raw_payload::JSONB;
      ELSE
        v_show_data := v_pending_record.raw_payload;
      END IF;
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'No show data found (both raw_payload and normalized_json are NULL)'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to parse show data: ' || SQLERRM
    );
  END;
  
  -- Safely parse dates
  BEGIN
    v_start_date := (v_show_data->>'startDate')::TIMESTAMP WITH TIME ZONE;
  EXCEPTION WHEN OTHERS THEN
    v_start_date := NULL;
  END;
  
  BEGIN
    v_end_date := (v_show_data->>'endDate')::TIMESTAMP WITH TIME ZONE;
  EXCEPTION WHEN OTHERS THEN
    v_end_date := v_start_date; -- Default to start date if end date fails
  END;
  
  -- Safely parse entry fee (handle NULL, empty string, or text like "Free")
  BEGIN
    IF v_show_data->>'entryFee' IS NOT NULL AND v_show_data->>'entryFee' != '' THEN
      v_entry_fee := (v_show_data->>'entryFee')::NUMERIC;
    ELSE
      v_entry_fee := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_entry_fee := NULL; -- If it's not a valid number, set to NULL
  END;
  
  -- Validate required fields
  IF v_show_data->>'name' IS NULL OR v_show_data->>'name' = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Show name is required'
    );
  END IF;
  
  IF v_start_date IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Valid start date is required'
    );
  END IF;
  
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
      v_show_data->>'name',
      COALESCE(v_show_data->>'description', ''),
      COALESCE(v_show_data->>'venueName', v_show_data->>'city', 'TBD'),
      COALESCE(
        v_show_data->>'address', 
        CASE 
          WHEN v_show_data->>'city' IS NOT NULL AND v_show_data->>'state' IS NOT NULL 
          THEN v_show_data->>'city' || ', ' || v_show_data->>'state'
          ELSE 'Address not provided'
        END
      ),
      v_start_date,
      COALESCE(v_end_date, v_start_date),
      v_entry_fee,
      v_show_data->>'imageUrl',
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
  
  -- Try to log the action (don't fail if this table doesn't exist)
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
    -- Ignore if admin_feedback table doesn't exist
    NULL;
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'show_id', v_show_id,
    'message', 'Show approved and published successfully'
  );
END;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.approve_pending_show TO anon;
GRANT EXECUTE ON FUNCTION public.approve_pending_show TO authenticated;

-- ================================================================
-- Done!
-- ================================================================
COMMENT ON FUNCTION public.approve_pending_show IS 
  'Approves a pending show and publishes it to the shows table - handles both TEXT and JSONB data types';
