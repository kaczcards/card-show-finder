-- Migration: 20240710_update_nearby_shows_function.sql
-- Description: Updates the nearby_shows function to properly extract latitude and longitude
-- from PostGIS point data and return them as separate columns.

-- Drop the existing function
DROP FUNCTION IF EXISTS public.nearby_shows;

-- Recreate the function with latitude and longitude extraction
CREATE OR REPLACE FUNCTION public.nearby_shows(
  lat float,
  long float,
  radius_miles float DEFAULT 25,
  start_date timestamp with time zone DEFAULT current_date,
  end_date timestamp with time zone DEFAULT (current_date + interval '30 days')
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
  -- Add the extracted latitude and longitude columns
  latitude float,
  longitude float
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
    -- Filter for shows in the specified date range (default: next 30 days)
    s.start_date >= start_date AND
    s.start_date <= end_date AND
    -- Filter for shows within the specified radius
    ST_DWithin(
      s.coordinates::geography,
      ST_SetSRID(ST_MakePoint(long, lat), 4326)::geography,
      radius_miles * 1609.34  -- Convert miles to meters
    ) AND
    -- Only return active shows
    s.status = 'ACTIVE'
  ORDER BY 
    ST_Distance(
      s.coordinates::geography, 
      ST_SetSRID(ST_MakePoint(long, lat), 4326)::geography
    ) ASC;  -- Order by distance (closest first)
$$;

-- Also update the alternative implementation
DROP FUNCTION IF EXISTS public.nearby_shows_earth_distance;

CREATE OR REPLACE FUNCTION public.nearby_shows_earth_distance(
  lat float,
  long float,
  radius_miles float DEFAULT 25,
  start_date timestamp with time zone DEFAULT current_date,
  end_date timestamp with time zone DEFAULT (current_date + interval '30 days')
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
  -- Add the extracted latitude and longitude columns
  latitude float,
  longitude float
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
    -- Filter for shows in the specified date range (default: next 30 days)
    s.start_date >= start_date AND
    s.start_date <= end_date AND
    -- Filter for shows within the specified radius using earth_distance
    earth_distance(
      ll_to_earth(
        ST_Y(s.coordinates::geometry),
        ST_X(s.coordinates::geometry)
      ),
      ll_to_earth(lat, long)
    ) <= radius_miles * 1609.34 AND -- Convert miles to meters
    -- Only return active shows
    s.status = 'ACTIVE'
  ORDER BY
    earth_distance(
      ll_to_earth(
        ST_Y(s.coordinates::geometry),
        ST_X(s.coordinates::geometry)
      ),
      ll_to_earth(lat, long)
    ) ASC; -- Order by distance (closest first)
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.nearby_shows TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.nearby_shows_earth_distance TO authenticated, anon;

-- Add comments to functions for documentation
COMMENT ON FUNCTION public.nearby_shows IS 
'Finds shows within a specified radius (in miles) from a center point.
Parameters:
  lat - Latitude of the center point
  long - Longitude of the center point
  radius_miles - Radius in miles (default: 25)
  start_date - Start date for filtering shows (default: current date)
  end_date - End date for filtering shows (default: current date + 30 days)
Returns:
  All columns from the shows table plus extracted latitude and longitude,
  for shows within the specified radius, ordered by distance (closest first).';

COMMENT ON FUNCTION public.nearby_shows_earth_distance IS 
'Alternative implementation using cube/earthdistance extensions.
Finds shows within a specified radius (in miles) from a center point.
Parameters:
  lat - Latitude of the center point
  long - Longitude of the center point
  radius_miles - Radius in miles (default: 25)
  start_date - Start date for filtering shows (default: current date)
  end_date - End date for filtering shows (default: current date + 30 days)
Returns:
  All columns from the shows table plus extracted latitude and longitude,
  for shows within the specified radius, ordered by distance (closest first).';
