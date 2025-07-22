-- Migration: 20250713060000_fix_paginated_shows_full_debug.sql
-- Description: Creates a comprehensive debug version of the get_paginated_shows function
-- that returns ALL shows with minimal filtering and detailed diagnostic information

-- Drop the function to recreate it with the debug version
DROP FUNCTION IF EXISTS public.get_paginated_shows;

-- Create the debug version with comprehensive diagnostic information
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
  total_shows_in_db integer;
  active_shows_count integer;
  offset_val integer;
  shows_data jsonb;
  all_shows jsonb;
  db_state jsonb;
  filtered_shows jsonb;
BEGIN
  -- Calculate offset based on page number and page size
  offset_val := (get_paginated_shows.page - 1) * get_paginated_shows.page_size;
  
  -- Get diagnostic counts
  SELECT COUNT(*) INTO total_shows_in_db FROM public.shows;
  SELECT COUNT(*) INTO active_shows_count FROM public.shows WHERE status = 'ACTIVE';
  
  -- Get ALL shows with minimal filtering for debugging
  SELECT jsonb_agg(to_jsonb(s)) INTO all_shows
  FROM (
    SELECT * FROM public.shows LIMIT 5
  ) s;
  
  -- Get database table structure for debugging
  SELECT jsonb_object_agg(table_name, columns) INTO db_state
  FROM (
    SELECT 
      table_name,
      jsonb_agg(
        jsonb_build_object(
          'column_name', column_name,
          'data_type', data_type
        ) ORDER BY ordinal_position
      ) AS columns
    FROM 
      information_schema.columns
    WHERE 
      table_schema = 'public' AND
      table_name = 'shows'
    GROUP BY
      table_name
  ) t;
  
  -- Now get the paginated results with NO FILTERS AT ALL
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'location', s.location,
      'start_date', s.start_date,
      'end_date', s.end_date,
      'entry_fee', s.entry_fee,
      'status', s.status,
      'coordinates', s.coordinates
    )
  ) INTO shows_data
  FROM public.shows s
  GROUP BY s.id
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
      'page_size', get_paginated_shows.page_size,
      'current_page', get_paginated_shows.page,
      'total_pages', CEIL(GREATEST(total_shows_in_db, 1)::numeric / get_paginated_shows.page_size)
    ),
    'diagnostic_info', jsonb_build_object(
      'all_filters_removed', true,
      'total_shows_in_db', total_shows_in_db,
      'active_shows_count', active_shows_count,
      'db_state', db_state,
      'sample_shows', all_shows,
      'current_timestamp', now(),
      'current_date', current_date,
      'function_parameters', jsonb_build_object(
        'lat', lat,
        'long', long,
        'radius_miles', radius_miles,
        'start_date', start_date,
        'end_date', end_date,
        'max_entry_fee', max_entry_fee,
        'categories', categories,
        'features', features,
        'page_size', page_size,
        'page', page
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
      'errorCode', SQLSTATE,
      'stacktrace', jsonb_build_object(
        'message', SQLERRM,
        'hint', SQLHINT,
        'detail', SQLERRDETAIL,
        'context', SQLCONTEXT
      )
    );
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_paginated_shows TO authenticated, anon;

-- Add documentation comment
COMMENT ON FUNCTION public.get_paginated_shows IS 
'FULL DEBUG VERSION: All filtering removed, shows comprehensive diagnostic information.
This version returns ALL shows with basic fields and includes detailed diagnostic information
about the database state, all shows in the database, and the function parameters.

This is a temporary diagnostic version to troubleshoot why no shows are appearing.';
