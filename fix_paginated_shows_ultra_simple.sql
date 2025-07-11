-- ULTRA SIMPLE VERSION FOR HOMEPAGE SHOWS
-- This script creates the most basic version possible with fully qualified names

-- Drop the function to recreate it
DROP FUNCTION IF EXISTS public.get_paginated_shows;

-- Create an ultra-simple version that returns any shows
CREATE OR REPLACE FUNCTION public.get_paginated_shows(
  lat float DEFAULT 0,
  long float DEFAULT 0,
  radius_miles float DEFAULT 25,
  p_start_date timestamp with time zone DEFAULT current_date,
  p_end_date timestamp with time zone DEFAULT (current_date + interval '30 days'),
  max_entry_fee numeric DEFAULT NULL,
  categories text[] DEFAULT NULL,
  features jsonb DEFAULT NULL,
  page_size integer DEFAULT 20,
  page integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  show_count integer;
  result_data jsonb;
BEGIN
  -- Get basic count
  SELECT COUNT(*) INTO show_count FROM public.shows;
  
  -- Get ANY shows at all
  SELECT 
    jsonb_build_object(
      'data', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'location', s.location,
          'start_date', s.start_date,
          'status', s.status
        ))
        FROM public.shows s
        LIMIT 10),
        '[]'::jsonb
      ),
      'pagination', jsonb_build_object(
        'total_count', show_count,
        'page_size', page_size,
        'current_page', page
      ),
      'debug_info', jsonb_build_object(
        'timestamp', now(),
        'total_shows', show_count
      )
    ) INTO result_data;
  
  RETURN result_data;
  
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
'ULTRA SIMPLE VERSION: Returns any shows in the database with minimal fields.
This version has no filtering at all and uses renamed parameters to avoid conflicts.';
