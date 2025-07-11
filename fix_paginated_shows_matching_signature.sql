-- FUNCTION WITH MATCHING SIGNATURE FOR CLIENT CODE
-- This script creates a version that matches the exact parameter names and positions
-- that the client code is expecting, while avoiding ambiguous column references internally

-- Drop the function to recreate it
DROP FUNCTION IF EXISTS public.get_paginated_shows;

-- Create a version with the exact parameter signature the client expects
CREATE OR REPLACE FUNCTION public.get_paginated_shows(
  lat float,                          -- Must match original signature
  long float,                         -- Must match original signature
  radius_miles float DEFAULT 25,      -- Must match original signature
  start_date timestamp with time zone DEFAULT current_date, -- Must match original signature
  end_date timestamp with time zone DEFAULT (current_date + interval '30 days'), -- Must match original signature
  max_entry_fee numeric DEFAULT NULL, -- Must match original signature
  categories text[] DEFAULT NULL,     -- Must match original signature
  features jsonb DEFAULT NULL,        -- Must match original signature
  page_size integer DEFAULT 20,       -- Must match original signature
  page integer DEFAULT 1              -- Must match original signature
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
  
  -- Create local variables to avoid ambiguous references
  local_start_date timestamp with time zone := start_date;
  local_end_date timestamp with time zone := end_date;
BEGIN
  -- Calculate offset based on page number and page size
  offset_val := (page - 1) * page_size;
  
  -- Convert input coordinates to a geography point for distance calculation
  search_point := ST_SetSRID(ST_MakePoint(long, lat), 4326)::geography;
  
  -- First, get the total count of shows that match criteria
  SELECT COUNT(*)::integer INTO total_count
  FROM public.shows s
  WHERE
    -- Basic status check
    s.status = 'ACTIVE'
    
    -- Date filtering using local variables to avoid ambiguity
    AND s.end_date >= local_start_date
    AND s.start_date <= local_end_date
    
    -- Location filtering
    AND (
      s.coordinates IS NOT NULL AND
      ST_DWithin(
        s.coordinates::geography,
        search_point,
        radius_miles * 1609.34  -- Convert miles to meters
      )
    );

  -- Get the paginated results
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'location', s.location,
      'address', s.address,
      'start_date', s.start_date,
      'end_date', s.end_date,
      'entry_fee', s.entry_fee,
      'image_url', s.image_url,
      'status', s.status,
      'coordinates', s.coordinates,
      'latitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_Y(s.coordinates::geometry) ELSE NULL END,
      'longitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_X(s.coordinates::geometry) ELSE NULL END,
      'distance_miles', ST_Distance(s.coordinates::geography, search_point) / 1609.34
    )
  ) INTO shows_data
  FROM (
    SELECT *
    FROM public.shows s
    WHERE
      -- Basic status check
      s.status = 'ACTIVE'
      
      -- Date filtering using local variables to avoid ambiguity
      AND s.end_date >= local_start_date
      AND s.start_date <= local_end_date
      
      -- Location filtering
      AND (
        s.coordinates IS NOT NULL AND
        ST_DWithin(
          s.coordinates::geography,
          search_point,
          radius_miles * 1609.34  -- Convert miles to meters
        )
      )
    ORDER BY
      -- Sort by start date first (sooner first)
      s.start_date ASC,
      -- Then by distance (closest first)
      ST_Distance(s.coordinates::geography, search_point) ASC
    LIMIT page_size
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
      'page_size', page_size,
      'current_page', page,
      'total_pages', CEIL(GREATEST(total_count, 1)::numeric / page_size)
    ),
    'debug_info', jsonb_build_object(
      'timestamp', now(),
      'search_point', jsonb_build_object('lat', lat, 'long', long),
      'date_range', jsonb_build_object('start', local_start_date, 'end', local_end_date),
      'current_date', CURRENT_DATE
    )
  );
  
  RETURN filtered_shows;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'errorCode', SQLSTATE
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_paginated_shows TO authenticated, anon;

-- Add comment
COMMENT ON FUNCTION public.get_paginated_shows IS 
'Retrieves paginated shows within specified radius and date range.
This version keeps the exact parameter names expected by the client code
but uses local variables internally to avoid ambiguous column references.';
