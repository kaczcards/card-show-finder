-- Migration: 20250714010000_fix_homepage_show_display.sql
-- Description: Production-quality fix for the get_paginated_shows function
-- This addresses issues with:
-- 1. Coordinate handling (especially with missing or default coordinates)
-- 2. Date filtering logic
-- 3. Shows created by organizers not appearing in results
-- 4. Performance optimization

-- Drop the function to recreate it with the improved version
DROP FUNCTION IF EXISTS public.get_paginated_shows;

-- Create the improved function with robust error handling and coordinate handling
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
  filtered_shows jsonb;
  is_default_coordinates boolean;
  debug_info jsonb;
BEGIN
  -- Calculate offset based on page number and page size
  offset_val := (get_paginated_shows.page - 1) * get_paginated_shows.page_size;
  
  -- Determine if we're using default/placeholder coordinates
  -- This is important because we'll skip distance filtering in this case
  is_default_coordinates := (abs(get_paginated_shows.lat) < 0.1 AND abs(get_paginated_shows.long) < 0.1);
  
  -- Convert input coordinates to a geography point for distance calculation
  -- Only if we're not using default coordinates
  IF NOT is_default_coordinates THEN
    search_point := ST_SetSRID(ST_MakePoint(get_paginated_shows.long, get_paginated_shows.lat), 4326)::geography;
  END IF;
  
  -- Build the base query for counting and data retrieval
  -- We'll use a common approach for both to ensure consistency
  WITH filtered_shows AS (
    SELECT s.*
    FROM public.shows s
    WHERE
      -- Basic status check - only shows with the specified status (default: ACTIVE)
      s.status = get_paginated_shows.status
      
      -- Date filtering - only shows happening within the specified date range
      -- Include shows that start before end_date and end after start_date (overlap)
      AND s.end_date >= get_paginated_shows.start_date
      AND s.start_date <= get_paginated_shows.end_date
      
      -- Location filtering - only if we have valid coordinates and not using defaults
      AND (
        is_default_coordinates OR -- Skip distance filtering for default coordinates
        (
          s.coordinates IS NOT NULL AND
          ST_DWithin(
            s.coordinates::geography,
            search_point,
            get_paginated_shows.radius_miles * 1609.34  -- Convert miles to meters
          )
        )
      )
      
      -- Optional filters when provided
      AND (get_paginated_shows.max_entry_fee IS NULL OR s.entry_fee <= get_paginated_shows.max_entry_fee)
      AND (get_paginated_shows.categories IS NULL OR s.categories && get_paginated_shows.categories)
      AND (get_paginated_shows.features IS NULL OR s.features @> get_paginated_shows.features)
  )
  
  -- First, get the total count of shows that match the criteria
  SELECT COUNT(*)::integer INTO total_count
  FROM filtered_shows;
  
  -- Now get the paginated results with all filtering applied
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
      'longitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_X(s.coordinates::geometry) ELSE NULL END,
      -- Calculate distance in miles from the search point (only if not using default coordinates)
      'distance_miles', CASE 
        WHEN is_default_coordinates OR s.coordinates IS NULL THEN NULL
        ELSE ST_Distance(s.coordinates::geography, search_point) / 1609.34
      END
    )
  ) INTO shows_data
  FROM (
    SELECT *
    FROM filtered_shows
    ORDER BY
      -- Order by start date first (sooner first)
      start_date ASC,
      -- Then by distance (closest first) if not using default coordinates
      CASE 
        WHEN NOT is_default_coordinates AND coordinates IS NOT NULL THEN 
          ST_Distance(coordinates::geography, search_point)
        ELSE NULL
      END ASC NULLS LAST
    LIMIT get_paginated_shows.page_size
    OFFSET offset_val
  ) s;
  
  -- Handle case where no shows are found
  IF shows_data IS NULL THEN
    shows_data := '[]'::jsonb;
  END IF;
  
  -- Add debug info if needed (can be removed in production)
  debug_info := jsonb_build_object(
    'is_default_coordinates', is_default_coordinates,
    'search_coordinates', jsonb_build_object('lat', get_paginated_shows.lat, 'long', get_paginated_shows.long),
    'radius_miles', get_paginated_shows.radius_miles,
    'date_range', jsonb_build_object('start', get_paginated_shows.start_date, 'end', get_paginated_shows.end_date)
  );
  
  -- Build result with pagination metadata
  filtered_shows := jsonb_build_object(
    'data', shows_data,
    'pagination', jsonb_build_object(
      'total_count', total_count,
      'page_size', get_paginated_shows.page_size,
      'current_page', get_paginated_shows.page,
      'total_pages', CEIL(GREATEST(total_count, 1)::numeric / get_paginated_shows.page_size)
    ),
    'debug', debug_info
  );
  
  RETURN filtered_shows;
  
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
          'lat', get_paginated_shows.lat,
          'long', get_paginated_shows.long,
          'radius_miles', get_paginated_shows.radius_miles,
          'start_date', get_paginated_shows.start_date,
          'end_date', get_paginated_shows.end_date
        )
      )
    );
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_paginated_shows TO authenticated, anon;

-- Add documentation comment
COMMENT ON FUNCTION public.get_paginated_shows IS 
'Retrieves a paginated list of shows within a specified radius and matching filter criteria.
This production-quality version:

1. Properly handles missing or default coordinates (0,0) by skipping distance filtering
2. Uses a date range overlap approach to ensure all relevant shows appear
3. Eliminates GROUP BY issues by using a WITH clause and subquery
4. Safely extracts latitude/longitude from coordinates
5. Includes distance calculation in miles when appropriate
6. Provides detailed error information for troubleshooting
7. Adds debug information to help diagnose issues

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
  - data: Array of show objects with all columns plus extracted latitude/longitude and distance_miles
  - pagination: Object with total_count, page_size, current_page, and total_pages
  - debug: Object with debugging information';
