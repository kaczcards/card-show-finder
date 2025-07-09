-- Migration: 20240709_enable_extensions_and_create_nearby_shows_function.sql
-- Description: Enables required PostgreSQL extensions and creates the nearby_shows function
-- for finding shows within a specified radius from a center point.

-- Enable required PostgreSQL extensions for spatial queries
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
-- PostGIS is likely already enabled based on the schema, but ensure it's there
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;

-- Function to find nearby shows within a specified radius
-- Uses the PostGIS ST_DWithin function since coordinates are already stored as geography type
CREATE OR REPLACE FUNCTION public.nearby_shows(
  lat float,
  long float,
  radius_miles float DEFAULT 25,
  start_date timestamp with time zone DEFAULT current_date,
  end_date timestamp with time zone DEFAULT (current_date + interval '30 days')
)
RETURNS SETOF public.shows
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT *
  FROM public.shows
  WHERE
    -- Filter for shows in the specified date range (default: next 30 days)
    start_date >= $4 AND
    start_date <= $5 AND
    -- Filter for shows within the specified radius
    ST_DWithin(
      coordinates::geography,
      ST_SetSRID(ST_MakePoint(long, lat), 4326)::geography,
      radius_miles * 1609.34  -- Convert miles to meters
    ) AND
    -- Only return active shows
    status = 'ACTIVE'
  ORDER BY 
    ST_Distance(
      coordinates::geography, 
      ST_SetSRID(ST_MakePoint(long, lat), 4326)::geography
    ) ASC;  -- Order by distance (closest first)
$$;

-- Alternative implementation using cube/earthdistance as specified in the plan
-- This serves as a fallback if PostGIS functions have any issues
CREATE OR REPLACE FUNCTION public.nearby_shows_earth_distance(
  lat float,
  long float,
  radius_miles float DEFAULT 25,
  start_date timestamp with time zone DEFAULT current_date,
  end_date timestamp with time zone DEFAULT (current_date + interval '30 days')
)
RETURNS SETOF public.shows
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT *
  FROM public.shows
  WHERE
    -- Filter for shows in the specified date range (default: next 30 days)
    start_date >= $4 AND
    start_date <= $5 AND
    -- Filter for shows within the specified radius using earth_distance
    -- This requires extracting lat/long from the geography type
    earth_distance(
      ll_to_earth(
        ST_Y(ST_AsText(coordinates)::geometry),
        ST_X(ST_AsText(coordinates)::geometry)
      ),
      ll_to_earth(lat, long)
    ) <= radius_miles * 1609.34 AND -- Convert miles to meters
    -- Only return active shows
    status = 'ACTIVE'
  ORDER BY
    earth_distance(
      ll_to_earth(
        ST_Y(ST_AsText(coordinates)::geometry),
        ST_X(ST_AsText(coordinates)::geometry)
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
  All columns from the shows table for shows within the specified radius,
  ordered by distance (closest first).';

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
  All columns from the shows table for shows within the specified radius,
  ordered by distance (closest first).';
