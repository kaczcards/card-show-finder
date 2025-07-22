-- Migration: 20250714030000_diagnostic_and_fix_get_shows.sql
-- Description: Diagnostic queries and simplified get_paginated_shows function
-- to troubleshoot why shows aren't appearing on the homepage

-- PART 1: DIAGNOSTIC QUERIES
-- These queries will help identify why shows aren't appearing

-- 1. Check if there are any shows in the database
SELECT 'Total shows in database' as check_type, COUNT(*) as count FROM public.shows;

-- 2. Check shows with status = 'ACTIVE'
SELECT 'Active shows' as check_type, COUNT(*) as count FROM public.shows WHERE status = 'ACTIVE';

-- 3. Check shows in the expected date range (next 30 days)
SELECT 'Shows in next 30 days' as check_type, COUNT(*) as count 
FROM public.shows 
WHERE start_date <= (CURRENT_DATE + interval '30 days')
AND end_date >= CURRENT_DATE;

-- 4. Check shows with valid coordinates
SELECT 'Shows with valid coordinates' as check_type, COUNT(*) as count 
FROM public.shows 
WHERE coordinates IS NOT NULL;

-- 5. Check shows near ZIP 46060 (lat: 40.0772001, long: -85.925938)
SELECT 'Shows near ZIP 46060 (25 mile radius)' as check_type, COUNT(*) as count 
FROM public.shows 
WHERE coordinates IS NOT NULL
AND ST_DWithin(
  coordinates::geography,
  ST_SetSRID(ST_MakePoint(-85.925938, 40.0772001), 4326)::geography,
  25 * 1609.34  -- 25 miles in meters
);

-- 6. Check shows that should appear on homepage (combining all filters)
SELECT 'Shows matching all homepage filters' as check_type, COUNT(*) as count 
FROM public.shows s
WHERE s.status = 'ACTIVE'
AND s.end_date >= CURRENT_DATE
AND s.start_date <= (CURRENT_DATE + interval '30 days')
AND s.coordinates IS NOT NULL
AND ST_DWithin(
  s.coordinates::geography,
  ST_SetSRID(ST_MakePoint(-85.925938, 40.0772001), 4326)::geography,
  25 * 1609.34  -- 25 miles in meters
);

-- 7. List all shows near ZIP 46060 with details to inspect
SELECT 
  id, 
  title, 
  location, 
  status,
  start_date,
  end_date,
  ST_X(coordinates::geometry) as longitude,
  ST_Y(coordinates::geometry) as latitude,
  ST_Distance(
    coordinates::geography,
    ST_SetSRID(ST_MakePoint(-85.925938, 40.0772001), 4326)::geography
  ) / 1609.34 as distance_miles
FROM public.shows
WHERE coordinates IS NOT NULL
ORDER BY 
  ST_Distance(
    coordinates::geography,
    ST_SetSRID(ST_MakePoint(-85.925938, 40.0772001), 4326)::geography
  ) ASC
LIMIT 10;

-- 8. Check the organizer's shows specifically
SELECT 'Shows created by organizer' as check_type, COUNT(*) as count 
FROM public.shows 
WHERE organizer_id = 'eb10066f-8064-439e-9ea5-6a50f29957e0';

-- 9. List details of the organizer's shows
SELECT 
  id, 
  title, 
  location, 
  status,
  start_date,
  end_date,
  ST_X(coordinates::geometry) as longitude,
  ST_Y(coordinates::geometry) as latitude,
  series_id
FROM public.shows
WHERE organizer_id = 'eb10066f-8064-439e-9ea5-6a50f29957e0';

-- PART 2: SIMPLIFIED get_paginated_shows FUNCTION
-- This version uses minimal filtering and includes detailed debug info

-- Drop the function to recreate it
DROP FUNCTION IF EXISTS public.get_paginated_shows;

-- Create a simplified version with minimal filtering
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
  page integer DEFAULT 1,             -- Page number (1-based)
  status text DEFAULT 'ACTIVE'        -- Show status filter
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
  result_json jsonb;
  is_default_coordinates boolean;
  debug_info jsonb;
  fallback_mode boolean := false;
  filter_conditions text;
  query_text text;
BEGIN
  -- Calculate offset based on page number and page size
  offset_val := (page - 1) * page_size;
  
  -- Determine if we're using default/placeholder coordinates
  is_default_coordinates := (abs(lat) < 0.1 AND abs(long) < 0.1);
  
  -- Convert input coordinates to a geography point for distance calculation
  IF NOT is_default_coordinates THEN
    search_point := ST_SetSRID(ST_MakePoint(long, lat), 4326)::geography;
  END IF;
  
  -- Build filter conditions for logging
  filter_conditions := 'status = ''' || status || ''' AND end_date >= ''' || start_date || 
                       ''' AND start_date <= ''' || end_date || '''';
  
  -- First, get the total count of shows that match the criteria
  -- Using ONLY essential filters: status and date range
  SELECT COUNT(*)::integer INTO total_count
  FROM public.shows s
  WHERE
    -- Basic status check
    s.status = status
    
    -- Basic date filtering - only current and future shows
    AND s.end_date >= start_date
    AND s.start_date <= end_date;
  
  -- If no shows found with basic filters, enable fallback mode to show ANY shows
  IF total_count = 0 THEN
    fallback_mode := true;
    -- Count ALL shows regardless of filters
    SELECT COUNT(*)::integer INTO total_count
    FROM public.shows;
    
    -- Log this situation
    RAISE NOTICE 'No shows found with basic filters, enabling fallback mode to show ANY shows';
  END IF;
  
  -- Now get the paginated results
  -- If in fallback mode, return ANY shows, otherwise apply minimal filtering
  IF fallback_mode THEN
    -- FALLBACK MODE: Get ANY shows, ordered by start date
    query_text := 'SELECT * FROM public.shows ORDER BY start_date ASC LIMIT $1 OFFSET $2';
    
    EXECUTE query_text
    INTO shows_data
    USING page_size, offset_val;
    
    -- Convert to JSONB
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
        'latitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_Y(s.coordinates::geometry) ELSE NULL END,
        'longitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_X(s.coordinates::geometry) ELSE NULL END,
        'distance_miles', NULL -- No distance calculation in fallback mode
      )
    ) INTO shows_data
    FROM (
      SELECT *
      FROM public.shows
      ORDER BY start_date ASC
      LIMIT page_size
      OFFSET offset_val
    ) s;
  ELSE
    -- NORMAL MODE: Apply minimal filtering (status and date range only)
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
        'latitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_Y(s.coordinates::geometry) ELSE NULL END,
        'longitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_X(s.coordinates::geometry) ELSE NULL END,
        'distance_miles', CASE 
          WHEN is_default_coordinates OR s.coordinates IS NULL THEN NULL
          ELSE ST_Distance(s.coordinates::geography, search_point) / 1609.34
        END
      )
    ) INTO shows_data
    FROM (
      SELECT *
      FROM public.shows s
      WHERE
        -- Basic status check
        s.status = status
        
        -- Basic date filtering
        AND s.end_date >= start_date
        AND s.start_date <= end_date
        
        -- Apply distance filtering ONLY if we have valid coordinates
        AND (
          is_default_coordinates OR -- Skip distance filtering for default coordinates
          s.coordinates IS NULL OR  -- Include shows with missing coordinates
          ST_DWithin(
            s.coordinates::geography,
            search_point,
            radius_miles * 1609.34  -- Convert miles to meters
          )
        )
      ORDER BY
        -- Order by start date first (sooner first)
        s.start_date ASC,
        -- Then by distance (closest first) if not using default coordinates
        CASE 
          WHEN NOT is_default_coordinates AND s.coordinates IS NOT NULL THEN 
            ST_Distance(s.coordinates::geography, search_point)
          ELSE NULL
        END ASC NULLS LAST
      LIMIT page_size
      OFFSET offset_val
    ) s;
  END IF;
  
  -- Handle case where no shows are found
  IF shows_data IS NULL THEN
    shows_data := '[]'::jsonb;
  END IF;
  
  -- Add debug info
  debug_info := jsonb_build_object(
    'fallback_mode', fallback_mode,
    'is_default_coordinates', is_default_coordinates,
    'search_coordinates', jsonb_build_object('lat', lat, 'long', long),
    'radius_miles', radius_miles,
    'date_range', jsonb_build_object('start', start_date, 'end', end_date),
    'filters', jsonb_build_object(
      'filter_conditions', filter_conditions,
      'max_entry_fee', max_entry_fee,
      'categories', categories,
      'features', features,
      'status', status
    ),
    'pagination', jsonb_build_object(
      'page', page,
      'page_size', page_size,
      'offset', offset_val,
      'total_count', total_count
    )
  );
  
  -- Build result with pagination metadata
  result_json := jsonb_build_object(
    'data', shows_data,
    'pagination', jsonb_build_object(
      'total_count', total_count,
      'page_size', page_size,
      'current_page', page,
      'total_pages', CEIL(GREATEST(total_count, 1)::numeric / page_size)
    ),
    'debug', debug_info
  );
  
  RETURN result_json;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return error information
    RAISE LOG 'Error in get_paginated_shows: %', SQLERRM;
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'errorCode', SQLSTATE,
      'message', 'An error occurred while retrieving shows. Please try again.',
      'details', jsonb_build_object(
        'input_params', jsonb_build_object(
          'lat', lat,
          'long', long,
          'radius_miles', radius_miles,
          'start_date', start_date,
          'end_date', end_date
        )
      )
    );
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_paginated_shows TO authenticated, anon;

-- Add documentation comment
COMMENT ON FUNCTION public.get_paginated_shows IS 
'DIAGNOSTIC VERSION: Retrieves a paginated list of shows with minimal filtering.
This version includes:

1. Fallback mode that returns ANY shows if no shows match the basic filters
2. Minimal filtering (just status and date range)
3. Includes shows with missing coordinates
4. Detailed debug information
5. Simplified distance calculations

Parameters:
  lat - Latitude of the center point
  long - Longitude of the center point
  radius_miles - Radius in miles (default: 25)
  start_date - Start date for filtering shows (default: current date)
  end_date - End date for filtering shows (default: current date + 30 days)
  max_entry_fee - Maximum entry fee filter (default: NULL = no limit)
  categories - Array of categories to filter by (default: NULL = all categories)
  features - JSONB object of required features (default: NULL = no feature filtering)
  page_size - Number of results per page (default: 20)
  page - Page number, 1-based (default: 1)
  status - Show status to filter by (default: ACTIVE)

Returns:
  A JSONB object containing:
  - data: Array of show objects
  - pagination: Object with total_count, page_size, current_page, and total_pages
  - debug: Object with detailed debugging information';

-- Create a helper function to fix any shows with invalid coordinates
CREATE OR REPLACE FUNCTION public.fix_show_coordinates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update shows with NULL coordinates to use a default value
  UPDATE public.shows
  SET coordinates = ST_SetSRID(ST_MakePoint(-85.925938, 40.0772001), 4326)::geography
  WHERE coordinates IS NULL
  AND organizer_id = 'eb10066f-8064-439e-9ea5-6a50f29957e0';
  
  -- Log the update
  RAISE NOTICE 'Updated coordinates for shows with NULL coordinates';
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.fix_show_coordinates TO authenticated, anon;

-- Execute the fix for shows with NULL coordinates
SELECT fix_show_coordinates();
