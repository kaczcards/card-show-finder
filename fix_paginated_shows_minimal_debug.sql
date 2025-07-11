-- MINIMAL DEBUG VERSION FOR HOMEPAGE SHOWS
-- This script creates a super-simplified version of get_paginated_shows function
-- that returns ALL shows regardless of filtering for debugging purposes

-- Drop the function to recreate it with the debug version
DROP FUNCTION IF EXISTS public.get_paginated_shows;

-- Create a completely stripped-down version that just returns active shows
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
  active_count integer;
  upcoming_count integer;
  shows_data jsonb;
  filtered_shows jsonb;
BEGIN
  -- Get diagnostic counts
  SELECT COUNT(*) INTO total_count FROM public.shows;
  SELECT COUNT(*) INTO active_count FROM public.shows WHERE status = 'ACTIVE';
  SELECT COUNT(*) INTO upcoming_count FROM public.shows 
    WHERE end_date >= CURRENT_DATE AND status = 'ACTIVE';
  
  -- Get ALL shows with zero filtering for debugging
  SELECT jsonb_agg(to_jsonb(s)) INTO shows_data
  FROM (
    SELECT *
    FROM public.shows
    ORDER BY start_date ASC
    LIMIT 20
  ) s;
  
  -- Handle case where no shows are found
  IF shows_data IS NULL THEN
    shows_data := '[]'::jsonb;
  END IF;
  
  -- Build result with diagnostic information
  filtered_shows := jsonb_build_object(
    'data', shows_data,
    'pagination', jsonb_build_object(
      'total_count', total_count,
      'page_size', 20,
      'current_page', 1,
      'total_pages', 1
    ),
    'debug_info', jsonb_build_object(
      'timestamp', now(),
      'total_shows_count', total_count,
      'active_shows_count', active_count,
      'upcoming_shows_count', upcoming_count,
      'current_date', CURRENT_DATE,
      'message', 'DEBUG VERSION - Returns ALL shows regardless of filtering',
      'notes', ARRAY[
        'This is a diagnostic version that bypasses all filtering',
        'Check if any shows appear in the result at all',
        'Examine total_shows_count to see if database has shows',
        'Check active_shows_count to see how many shows are marked ACTIVE',
        'Check upcoming_shows_count to see how many shows are not past events'
      ]
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
'DIAGNOSTIC VERSION: Returns ALL shows with no filtering for debugging.
This function counts the total shows, active shows, and upcoming active shows,
and returns them in the debug_info section along with the first 20 shows.';
