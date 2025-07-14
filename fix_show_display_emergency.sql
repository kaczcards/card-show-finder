-- fix_show_display_emergency.sql
-- EMERGENCY FIX: Simplified get_paginated_shows function to make shows appear on homepage
-- This version uses absolute minimal filtering and ignores coordinates if missing

-- Drop the function to recreate it
DROP FUNCTION IF EXISTS public.get_paginated_shows;

-- Create a super simplified version that prioritizes showing results
CREATE OR REPLACE FUNCTION public.get_paginated_shows(
  lat float,
  long float,
  radius_miles float DEFAULT 25,
  start_date timestamp with time zone DEFAULT current_date,
  end_date timestamp with time zone DEFAULT (current_date + interval '30 days'),
  max_entry_fee numeric DEFAULT NULL,
  categories text[] DEFAULT NULL,
  features jsonb DEFAULT NULL,
  page_size integer DEFAULT 20,
  page integer DEFAULT 1,
  status text DEFAULT 'ACTIVE'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count integer;
  offset_val integer;
  shows_data jsonb;
  result_json jsonb;
BEGIN
  -- Calculate offset based on page number and page size
  offset_val := (page - 1) * page_size;
  
  -- First, get the total count of shows that match minimal criteria
  SELECT COUNT(*)::integer INTO total_count
  FROM public.shows s
  WHERE
    -- Basic status check - only ACTIVE shows
    s.status = 'ACTIVE'
    
    -- Basic date filtering - only current and future shows
    AND s.end_date >= CURRENT_DATE;
  
  -- Get shows with minimal filtering
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'series_id', s.series_id,
      'title', s.title,
      'description', s.description,
      'location', s.location,
      'address', s.address,
      'start_date', s.start_date,
      'end_date', s.end_date,
      'entry_fee', s.entry_fee,
      'image_url', s.image_url,
      'rating', s.rating,
      'coordinates', s.coordinates,
      'status', s.status,
      'organizer_id', s.organizer_id,
      'features', s.features,
      'categories', s.categories,
      'created_at', s.created_at,
      'updated_at', s.updated_at,
      -- Safely extract latitude and longitude
      'latitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_Y(s.coordinates::geometry) ELSE NULL END,
      'longitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_X(s.coordinates::geometry) ELSE NULL END
    )
  ) INTO shows_data
  FROM (
    SELECT *
    FROM public.shows s
    WHERE
      -- Basic status check - only ACTIVE shows
      s.status = 'ACTIVE'
      
      -- Basic date filtering - only current and future shows
      AND s.end_date >= CURRENT_DATE
      
    ORDER BY
      -- Order by start date (sooner first)
      s.start_date ASC
    LIMIT page_size
    OFFSET offset_val
  ) s;
  
  -- Handle case where no shows are found
  IF shows_data IS NULL THEN
    shows_data := '[]'::jsonb;
  END IF;
  
  -- Build result with pagination metadata
  result_json := jsonb_build_object(
    'data', shows_data,
    'pagination', jsonb_build_object(
      'total_count', total_count,
      'page_size', page_size,
      'current_page', page,
      'total_pages', CEIL(GREATEST(total_count, 1)::numeric / page_size)
    )
  );
  
  RETURN result_json;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return error information
    RAISE LOG 'Error in get_paginated_shows: %', SQLERRM;
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'errorCode', SQLSTATE,
      'message', 'An error occurred while retrieving shows. Please try again.'
    );
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_paginated_shows TO authenticated, anon;

-- Add documentation comment
COMMENT ON FUNCTION public.get_paginated_shows IS 
'EMERGENCY VERSION: Simplified function that prioritizes showing results.
This version:
1. Uses minimal filtering (just status=ACTIVE and end_date >= today)
2. Completely ignores coordinates and distance filtering
3. Ignores most optional filters to ensure shows appear
4. Orders by start date only

This is intended as a temporary fix to ensure shows appear on the homepage.';
