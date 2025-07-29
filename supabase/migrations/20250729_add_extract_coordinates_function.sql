-- Migration: 20250729_add_extract_coordinates_function.sql
-- Description: Adds a simple, reliable RPC function to get shows with properly extracted coordinates.
-- This bypasses the complex nearby_shows approach with a simpler solution that works consistently.

-- Drop the function if it already exists
DROP FUNCTION IF EXISTS public.get_shows_with_coordinates;

-- Create the function
CREATE OR REPLACE FUNCTION public.get_shows_with_coordinates(
  p_start_date timestamp with time zone DEFAULT current_date,
  p_end_date timestamp with time zone DEFAULT (current_date + interval '30 days')
)
RETURNS TABLE (
  -- Return all columns from shows table
  id uuid,
  series_id uuid,
  title text,
  description text,
  location text,
  address text,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  entry_fee numeric,
  image_url text,
  rating numeric,
  coordinates geometry(Point, 4326),
  status text,
  organizer_id uuid,
  features jsonb,
  categories text[],
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  -- Add extracted latitude and longitude as separate columns
  latitude double precision,
  longitude double precision
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    s.*,
    ST_Y(s.coordinates::geometry) as latitude,
    ST_X(s.coordinates::geometry) as longitude
  FROM public.shows s
  WHERE
    -- Filter for active shows
    s.status = 'ACTIVE' AND
    -- Filter for shows that are active during the date range:
    -- 1. Show hasn't ended before our search starts
    s.end_date >= p_start_date AND
    -- 2. Show starts before our search ends
    s.start_date <= p_end_date
  ORDER BY 
    s.start_date ASC;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_shows_with_coordinates TO authenticated, anon;

-- Add comment to function for documentation
COMMENT ON FUNCTION public.get_shows_with_coordinates IS 
'Gets shows with properly extracted coordinates for client-side filtering.

This function:
1. Returns all active shows within a date range
2. Includes extracted latitude and longitude as separate numeric columns
3. Bypasses complex location filtering (to be done client-side)
4. Provides a simple, reliable way to get shows with usable coordinates

Parameters:
  p_start_date - Start date for filtering shows (default: current date)
  p_end_date   - End date for filtering shows (default: current date + 30 days)

Returns:
  All columns from the shows table plus extracted latitude and longitude,
  for shows active within the specified date range, ordered by start date.';
