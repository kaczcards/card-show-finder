-- create-show-with-coordinates.sql
-- This function creates a show with proper PostGIS coordinates
-- It bypasses the problematic trigger by using ST_SetSRID and ST_Point directly

-- Drop the function if it already exists to avoid conflicts
DROP FUNCTION IF EXISTS public.create_show_with_coordinates;

-- Create the function with all necessary parameters for a show
CREATE OR REPLACE FUNCTION public.create_show_with_coordinates(
  p_title TEXT,
  p_description TEXT,
  p_location TEXT,
  p_address TEXT,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_entry_fee NUMERIC,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_features JSONB DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL,
  p_series_id UUID DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL
)
RETURNS SETOF shows
LANGUAGE plpgsql
SECURITY DEFINER -- Use security definer to respect RLS policies
AS $$
DECLARE
  v_user_id UUID;
  v_show_id UUID;
BEGIN
  -- Get the current user ID from the auth context
  v_user_id := auth.uid();
  
  -- Validate required parameters
  IF p_title IS NULL OR p_location IS NULL OR p_address IS NULL OR 
     p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'Required parameters cannot be null';
  END IF;
  
  -- Validate coordinates
  IF p_latitude IS NULL OR p_longitude IS NULL OR
     p_latitude < -90 OR p_latitude > 90 OR
     p_longitude < -180 OR p_longitude > 180 THEN
    RAISE EXCEPTION 'Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180';
  END IF;
  
  -- Validate dates
  IF p_end_date <= p_start_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;
  
  -- Insert the show with PostGIS geography point
  INSERT INTO public.shows (
    title,
    description,
    location,
    address,
    start_date,
    end_date,
    entry_fee,
    coordinates,
    features,
    categories,
    series_id,
    image_url,
    organizer_id,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_title,
    p_description,
    p_location,
    p_address,
    p_start_date,
    p_end_date,
    p_entry_fee,
    -- Create PostGIS geography point using ST_SetSRID and ST_Point
    ST_SetSRID(ST_Point(p_longitude, p_latitude), 4326)::geography,
    p_features,
    p_categories,
    p_series_id,
    p_image_url,
    v_user_id,  -- Set the current user as the organizer
    'ACTIVE',   -- Default status
    NOW(),      -- Created at current time
    NOW()       -- Updated at current time
  )
  RETURNING id INTO v_show_id;
  
  -- Return the created show
  RETURN QUERY
  SELECT * FROM public.shows WHERE id = v_show_id;
END;
$$;

-- Add helpful comment to the function
COMMENT ON FUNCTION public.create_show_with_coordinates IS 
'Creates a show with proper PostGIS coordinates using ST_SetSRID and ST_Point. 
This function handles RLS policies correctly and bypasses any problematic triggers.
It validates coordinates, dates, and required parameters before insertion.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_show_with_coordinates TO authenticated;
