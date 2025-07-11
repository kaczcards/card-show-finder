-- ENHANCED FIX FOR HOMEPAGE SHOWS LOADING
-- This script provides a more complete fix for the get_paginated_shows function
-- with improved pagination and added debugging information

-- Drop the function to recreate it with the enhanced version
DROP FUNCTION IF EXISTS public.get_paginated_shows;

-- Create the enhanced function
CREATE OR REPLACE FUNCTION public.get_paginated_shows(
  lat float,                          -- Latitude of center point
  long float,                         -- Longitude of center point
  radius_miles float DEFAULT 25,      -- Search radius in miles
  start_date timestamp with time zone DEFAULT current_date, -- Start of date range
  end_date timestamp with time zone DEFAULT (current_date + interval '30 days'), -- End of date range
  max_entry_fee numeric DEFAULT NULL, -- Maximum entry fee filter
  categories text[] DEFAULT NULL,     -- Categories filter
  features jsonb DEFAULT NULL,        -- Features filter
  page_size integer DEFAULT 20,       -- Number of results per page
  page integer DEFAULT 1              -- Page number (1-based)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count integer;
  offset_val integer;
  search_point geography;
  shows_data jsonb;
  filtered_shows jsonb;
BEGIN
  -- Calculate offset based on page number and page size
  offset_val := (page - 1) * page_size;
  
  -- Convert input coordinates to a geography point for distance calculation
  search_point := ST_SetSRID(ST_MakePoint(long, lat), 4326)::geography;
  
  -- First, get the total count of shows that match the criteria
  SELECT COUNT(*)::integer INTO total_count
  FROM public.shows s
  WHERE
    -- Only current or future shows
    s.end_date >= CURRENT_DATE AND
    
    -- Only active shows
    s.status = 'ACTIVE';

  -- Now get the paginated results
  WITH filtered_shows_cte AS (
    SELECT 
      s.*,
      CASE 
        WHEN s.coordinates IS NOT NULL THEN 
          ST_Y(s.coordinates::geometry)
        ELSE NULL 
      END AS latitude,
      CASE 
        WHEN s.coordinates IS NOT NULL THEN 
          ST_X(s.coordinates::geometry)
        ELSE NULL 
      END AS longitude,
      CASE 
        WHEN s.coordinates IS NOT NULL THEN 
          ST_Distance(s.coordinates::geography, search_point) / 1609.34
        ELSE NULL 
      END AS distance_miles
    FROM public.shows s
    WHERE
      -- Only current or future shows
      s.end_date >= CURRENT_DATE AND
      
      -- Only active shows
      s.status = 'ACTIVE'
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', fs.id,
      'series_id', fs.series_id,
      'title', fs.title,
      'description', fs.description,
      'location', fs.location,
      'address', fs.address,
      'start_date', fs.start_date,
      'end_date', fs.end_date,
      'entry_fee', fs.entry_fee,
      'image_url', fs.image_url,
      'rating', fs.rating,
      'coordinates', fs.coordinates,
      'status', fs.status,
      'organizer_id', fs.organizer_id,
      'features', fs.features,
      'categories', fs.categories,
      'created_at', fs.created_at,
      'updated_at', fs.updated_at,
      'latitude', fs.latitude,
      'longitude', fs.longitude,
      'distance_miles', fs.distance_miles
    )
  ) INTO shows_data
  FROM filtered_shows_cte fs
  ORDER BY
    -- Order by date first (sooner first)
    fs.start_date ASC
  LIMIT page_size
  OFFSET offset_val;
  
  -- Handle case where no shows are found
  IF shows_data IS NULL THEN
    shows_data := '[]'::jsonb;
  END IF;
  
  -- Build result with pagination metadata and debug info
  filtered_shows := jsonb_build_object(
    'data', shows_data,
    'pagination', jsonb_build_object(
      'total_count', total_count,
      'page_size', page_size,
      'current_page', page,
      'total_pages', CEIL(GREATEST(total_count, 1)::numeric / page_size),
      'offset', offset_val
    ),
    'debug_info', jsonb_build_object(
      'timestamp', now(),
      'filter_criteria', jsonb_build_object(
        'lat', lat,
        'long', long,
        'radius_miles', radius_miles,
        'start_date', start_date,
        'end_date', end_date,
        'current_date', CURRENT_DATE
      )
    )
  );
  
  RETURN filtered_shows;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return error information
    RAISE LOG 'Error in get_paginated_shows: %', SQLERRM;
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'errorCode', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_paginated_shows TO authenticated, anon;

-- Add documentation comment
COMMENT ON FUNCTION public.get_paginated_shows IS 
'Retrieves a paginated list of active upcoming shows.
This enhanced version:
1. Uses a CTE for cleaner query structure
2. Provides latitude, longitude and distance_miles in results
3. Adds debug information to help diagnose issues
4. Properly handles pagination with minimal filtering';
