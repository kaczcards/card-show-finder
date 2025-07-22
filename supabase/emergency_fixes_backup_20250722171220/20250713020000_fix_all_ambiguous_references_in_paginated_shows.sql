-- Migration: 20250713020000_fix_all_ambiguous_references_in_paginated_shows.sql
-- Description: Fixes all ambiguous parameter references in the get_paginated_shows function
-- by qualifying them with the function name.

-- Drop the function to recreate it with the fix
DROP FUNCTION IF EXISTS public.get_paginated_shows;

-- Create the function with fixed parameter references
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
  shows_data jsonb;
  filtered_shows jsonb;
BEGIN
  -- Calculate offset based on page number and page size
  offset_val := (get_paginated_shows.page - 1) * get_paginated_shows.page_size;
  
  -- First, get the total count of shows that match the criteria
  SELECT COUNT(*)::integer INTO total_count
  FROM public.shows s
  WHERE
    -- Filter for shows in the specified date range
    s.start_date >= get_paginated_shows.start_date AND
    s.start_date <= get_paginated_shows.end_date AND
    -- Filter for shows within the specified radius
    ST_DWithin(
      s.coordinates::geography,
      ST_SetSRID(ST_MakePoint(get_paginated_shows.long, get_paginated_shows.lat), 4326)::geography,
      get_paginated_shows.radius_miles * 1609.34  -- Convert miles to meters
    ) AND
    -- Only return active shows
    s.status = 'ACTIVE' AND
    -- Apply max entry fee filter if provided
    (get_paginated_shows.max_entry_fee IS NULL OR s.entry_fee <= get_paginated_shows.max_entry_fee) AND
    -- Apply categories filter if provided
    (get_paginated_shows.categories IS NULL OR s.categories && get_paginated_shows.categories) AND
    -- Apply features filter if provided (more complex)
    (get_paginated_shows.features IS NULL OR (
      -- For each key in features, check if show.features has that key with value true
      -- This is a simplification - for complex feature filtering, consider a more specific approach
      s.features @> get_paginated_shows.features
    ));

  -- Now get the paginated results
  SELECT 
    jsonb_agg(
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
        'latitude', ST_Y(s.coordinates::geometry),
        'longitude', ST_X(s.coordinates::geometry)
      )
    ) INTO shows_data
  FROM public.shows s
  WHERE
    -- Filter for shows in the specified date range
    s.start_date >= get_paginated_shows.start_date AND
    s.start_date <= get_paginated_shows.end_date AND
    -- Filter for shows within the specified radius
    ST_DWithin(
      s.coordinates::geography,
      ST_SetSRID(ST_MakePoint(get_paginated_shows.long, get_paginated_shows.lat), 4326)::geography,
      get_paginated_shows.radius_miles * 1609.34  -- Convert miles to meters
    ) AND
    -- Only return active shows
    s.status = 'ACTIVE' AND
    -- Apply max entry fee filter if provided
    (get_paginated_shows.max_entry_fee IS NULL OR s.entry_fee <= get_paginated_shows.max_entry_fee) AND
    -- Apply categories filter if provided
    (get_paginated_shows.categories IS NULL OR s.categories && get_paginated_shows.categories) AND
    -- Apply features filter if provided
    (get_paginated_shows.features IS NULL OR (
      s.features @> get_paginated_shows.features
    ))
  ORDER BY 
    -- Order by distance (closest first)
    ST_Distance(
      s.coordinates::geography, 
      ST_SetSRID(ST_MakePoint(get_paginated_shows.long, get_paginated_shows.lat), 4326)::geography
    ) ASC
  LIMIT get_paginated_shows.page_size
  OFFSET offset_val;
  
  -- Handle case where no shows are found
  IF shows_data IS NULL THEN
    shows_data := '[]'::jsonb;
  END IF;
  
  -- Build the final result object with pagination metadata
  filtered_shows := jsonb_build_object(
    'data', shows_data,
    'pagination', jsonb_build_object(
      'total_count', total_count,
      'page_size', get_paginated_shows.page_size,
      'current_page', get_paginated_shows.page,
      'total_pages', CEIL(total_count::numeric / get_paginated_shows.page_size)
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
'Retrieves a paginated list of shows within a specified radius and matching filter criteria.

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

Returns:
  A JSONB object containing:
  - data: Array of show objects with all columns plus extracted latitude/longitude
  - pagination: Object with total_count, page_size, current_page, and total_pages';
