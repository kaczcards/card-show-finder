-- FINAL FIX FOR HOMEPAGE SHOWS LOADING (Version 2)
-- This script fixes the ambiguous column reference issues by fully qualifying parameter names

-- Drop the function to recreate it with the final version
DROP FUNCTION IF EXISTS public.get_paginated_shows;

-- Create the complete fixed function with proper filtering and fully qualified names
CREATE OR REPLACE FUNCTION public.get_paginated_shows(
  lat float,                          -- Latitude of center point
  long float,                         -- Longitude of center point
  radius_miles float DEFAULT 25,      -- Search radius in miles (default: 25)
  start_date timestamp with time zone DEFAULT current_date, -- Start of date range (default: today)
  end_date timestamp with time zone DEFAULT (current_date + interval '30 days'), -- End of date range (default: 30 days from now)
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
  offset_val := (get_paginated_shows.page - 1) * get_paginated_shows.page_size;
  
  -- Convert input coordinates to a geography point for distance calculation
  search_point := ST_SetSRID(ST_MakePoint(get_paginated_shows.long, get_paginated_shows.lat), 4326)::geography;
  
  -- First, get the total count of shows that match the criteria with full filtering
  SELECT COUNT(*)::integer INTO total_count
  FROM public.shows s
  WHERE
    -- Basic status check - only active shows
    s.status = 'ACTIVE'
    
    -- Date filtering - only shows happening within the specified date range
    AND s.end_date >= get_paginated_shows.start_date
    AND s.start_date <= get_paginated_shows.end_date
    
    -- Location filtering - only shows within the specified radius
    AND (
      s.coordinates IS NOT NULL AND
      ST_DWithin(
        s.coordinates::geography,
        search_point,
        get_paginated_shows.radius_miles * 1609.34  -- Convert miles to meters
      )
    )
    
    -- Optional filters when provided
    AND (get_paginated_shows.max_entry_fee IS NULL OR s.entry_fee <= get_paginated_shows.max_entry_fee)
    AND (get_paginated_shows.categories IS NULL OR s.categories && get_paginated_shows.categories)
    AND (get_paginated_shows.features IS NULL OR s.features @> get_paginated_shows.features);

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
      'latitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_Y(s.coordinates::geometry) ELSE NULL END,
      'longitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_X(s.coordinates::geometry) ELSE NULL END,
      'distance_miles', ST_Distance(s.coordinates::geography, search_point) / 1609.34
    )
  ) INTO shows_data
  FROM (
    SELECT *
    FROM public.shows s
    WHERE
      -- Basic status check - only active shows
      s.status = 'ACTIVE'
      
      -- Date filtering - only shows happening within the specified date range
      AND s.end_date >= get_paginated_shows.start_date
      AND s.start_date <= get_paginated_shows.end_date
      
      -- Location filtering - only shows within the specified radius
      AND (
        s.coordinates IS NOT NULL AND
        ST_DWithin(
          s.coordinates::geography,
          search_point,
          get_paginated_shows.radius_miles * 1609.34  -- Convert miles to meters
        )
      )
      
      -- Optional filters when provided
      AND (get_paginated_shows.max_entry_fee IS NULL OR s.entry_fee <= get_paginated_shows.max_entry_fee)
      AND (get_paginated_shows.categories IS NULL OR s.categories && get_paginated_shows.categories)
      AND (get_paginated_shows.features IS NULL OR s.features @> get_paginated_shows.features)
      
    ORDER BY
      -- Sort by start date first (sooner first)
      s.start_date ASC,
      -- Then by distance (closest first)
      ST_Distance(s.coordinates::geography, search_point) ASC
      
    LIMIT get_paginated_shows.page_size
    OFFSET offset_val
  ) s;
  
  -- Handle case where no shows are found
  IF shows_data IS NULL THEN
    shows_data := '[]'::jsonb;
  END IF;
  
  -- Build result with pagination metadata
  filtered_shows := jsonb_build_object(
    'data', shows_data,
    'pagination', jsonb_build_object(
      'total_count', total_count,
      'page_size', get_paginated_shows.page_size,
      'current_page', get_paginated_shows.page,
      'total_pages', CEIL(GREATEST(total_count, 1)::numeric / get_paginated_shows.page_size)
    )
  );
  
  RETURN filtered_shows;
  
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
'Retrieves a paginated list of active upcoming shows within a specified radius.
This fixed version:
1. Properly filters shows within the specified radius (default: 25 miles)
2. Only returns shows within the specified date range (default: next 30 days)
3. Avoids ambiguous column references by fully qualifying parameter names
4. Correctly extracts latitude/longitude from coordinates
5. Includes distance calculation in miles
6. Sorts results by start date and then by distance';
