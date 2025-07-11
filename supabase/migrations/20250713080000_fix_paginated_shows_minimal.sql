-- Migration: 20250713080000_fix_paginated_shows_minimal.sql
-- Description: Creates a minimal version of get_paginated_shows with very basic filtering
-- and extensive debug information to identify why shows aren't appearing

-- Drop the function to recreate it
DROP FUNCTION IF EXISTS public.get_paginated_shows;

-- Create a very minimal version that should return shows if they exist
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
  active_count integer;
  offset_val integer;
  shows_data jsonb;
  sample_shows jsonb;
  filtered_shows jsonb;
  search_point geography;
BEGIN
  -- Convert input coordinates to a geography point
  search_point := ST_SetSRID(ST_MakePoint(long, lat), 4326)::geography;
  
  -- Get diagnostic counts
  SELECT COUNT(*) INTO total_count FROM public.shows;
  SELECT COUNT(*) INTO active_count FROM public.shows WHERE status = 'ACTIVE';
  
  -- Get sample of shows for debugging
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'location', s.location,
      'status', s.status,
      'has_coordinates', (s.coordinates IS NOT NULL),
      'start_date', s.start_date,
      'end_date', s.end_date,
      'lat', CASE WHEN s.coordinates IS NOT NULL THEN ST_Y(s.coordinates::geometry) ELSE NULL END,
      'long', CASE WHEN s.coordinates IS NOT NULL THEN ST_X(s.coordinates::geometry) ELSE NULL END
    )
  ) INTO sample_shows
  FROM public.shows s
  LIMIT 10;
  
  -- Now get the paginated results with very minimal filtering
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'location', s.location,
        'start_date', s.start_date,
        'end_date', s.end_date,
        'entry_fee', s.entry_fee,
        'status', s.status,
        'lat', CASE WHEN s.coordinates IS NOT NULL THEN ST_Y(s.coordinates::geometry) ELSE NULL END,
        'long', CASE WHEN s.coordinates IS NOT NULL THEN ST_X(s.coordinates::geometry) ELSE NULL END,
        'distance_miles', CASE 
          WHEN s.coordinates IS NOT NULL THEN 
            ST_Distance(s.coordinates::geography, search_point) / 1609.34
          ELSE NULL 
        END
      )
    ) INTO shows_data
  FROM public.shows s
  WHERE 
    -- Extremely minimal filtering - just ensure it's active
    s.status = 'ACTIVE'
  GROUP BY 
    s.id, s.coordinates
  LIMIT get_paginated_shows.page_size
  OFFSET offset_val;
  
  -- Handle case where no shows are found
  IF shows_data IS NULL THEN
    shows_data := '[]'::jsonb;
  END IF;
  
  -- Build comprehensive diagnostic result
  filtered_shows := jsonb_build_object(
    'data', shows_data,
    'pagination', jsonb_build_object(
      'total_count', active_count,
      'page_size', get_paginated_shows.page_size,
      'current_page', get_paginated_shows.page
    ),
    'diagnostic_info', jsonb_build_object(
      'timestamp', now(),
      'search_lat', lat,
      'search_long', long,
      'radius_miles', radius_miles,
      'total_shows_in_db', total_count,
      'active_shows_count', active_count,
      'minimal_filtering', true,
      'sample_shows', sample_shows,
      'current_date', current_date,
      'timezone', current_setting('TIMEZONE')
    )
  );
  
  RETURN filtered_shows;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return detailed error information
    RAISE LOG 'Error in get_paginated_shows: %', SQLERRM;
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'errorCode', SQLSTATE,
      'diagnostic_info', jsonb_build_object(
        'timestamp', now(),
        'search_lat', lat,
        'search_long', long
      )
    );
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_paginated_shows TO authenticated, anon;

-- Add documentation comment
COMMENT ON FUNCTION public.get_paginated_shows IS 
'MINIMAL DEBUG VERSION: Returns all active shows without date/distance filtering.
This version applies only the status = ACTIVE filter and includes detailed diagnostic information.
Use this to determine if there are any active shows in the database at all.';
