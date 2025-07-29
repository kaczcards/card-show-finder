-- Migration: 20250729_fix_nearby_shows_date_filtering.sql
-- Description: Fixes the date filtering logic in nearby_shows functions to properly
-- return shows that are ACTIVE/RUNNING during the date range, not just shows that
-- START within the date range.
--
-- PROBLEM: The current function only returns shows where start_date is within the 
-- specified range, missing shows that:
--   1. Started before the range but are still running
--   2. Span across the entire search period
--
-- FIX: Change date filtering to include shows that:
--   1. Haven't ended before our search starts (end_date >= start_date)
--   2. Start before our search ends (start_date <= end_date)

/* -------------------------------------------------------------------
 * 🔄  Ensure **all** legacy variations of `nearby_shows` are removed
 *     before recreating the canonical version.  PostgreSQL requires
 *     fully-qualified signatures when multiple overloads exist, so we
 *     enumerate the common historical signatures and also include a
 *     catch-all drop as a last resort.
 * ------------------------------------------------------------------*/

-- Version A: original 5-arg function (no defaults)
DROP FUNCTION IF EXISTS public.nearby_shows(
  float,
  float,
  float,
  timestamp with time zone,
  timestamp with time zone
) CASCADE;

-- Version B: 5-arg function with named parameters (old names)
DROP FUNCTION IF EXISTS public.nearby_shows(
  lat float,
  long float,
  radius_miles float,
  start_date timestamp with time zone,
  end_date timestamp with time zone
) CASCADE;

-- Version C: 3-arg function (radius only, no date filters)
DROP FUNCTION IF EXISTS public.nearby_shows(
  float,
  float,
  float
) CASCADE;

-- Version D: zero-arg helper (some early test deployments)
DROP FUNCTION IF EXISTS public.nearby_shows() CASCADE;

-- Catch-all – drops any remaining overloads that slipped through
DROP FUNCTION IF EXISTS public.nearby_shows CASCADE;

/* -------------------------------------------------------------------
 * Re-create the canonical `nearby_shows` (5 args, new param names)
 * ------------------------------------------------------------------*/
-- Re-create the function with the **correct** signature
CREATE OR REPLACE FUNCTION public.nearby_shows(
  lat float,
  long float,
  radius_miles float DEFAULT 25,
  filter_start_date timestamp with time zone DEFAULT current_date,
  filter_end_date timestamp with time zone DEFAULT (current_date + interval '30 days')
)
RETURNS SETOF public.shows
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    s.*
  FROM public.shows s
  WHERE
    -- FIXED: Proper date range filtering to include all shows active during the period
    s.end_date >= filter_start_date AND     -- Show hasn't ended before our search starts
    s.start_date <= filter_end_date AND     -- Show starts before our search ends
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
/* -------------------------------------------------------------------
 * Ensure all variations of `nearby_shows_earth_distance` are removed
 * ------------------------------------------------------------------*/

-- 5-arg original
DROP FUNCTION IF EXISTS public.nearby_shows_earth_distance(
  float,
  float,
  float,
  timestamp with time zone,
  timestamp with time zone
) CASCADE;

-- 5-arg with named parameters
DROP FUNCTION IF EXISTS public.nearby_shows_earth_distance(
  lat float,
  long float,
  radius_miles float,
  start_date timestamp with time zone,
  end_date timestamp with time zone
) CASCADE;

-- 3-arg (no dates)
DROP FUNCTION IF EXISTS public.nearby_shows_earth_distance(
  float,
  float,
  float
) CASCADE;

-- zero-arg
DROP FUNCTION IF EXISTS public.nearby_shows_earth_distance() CASCADE;

-- catch-all
DROP FUNCTION IF EXISTS public.nearby_shows_earth_distance CASCADE;

CREATE OR REPLACE FUNCTION public.nearby_shows_earth_distance(
  lat float,
  long float,
  radius_miles float DEFAULT 25,
  filter_start_date timestamp with time zone DEFAULT current_date,
  filter_end_date timestamp with time zone DEFAULT (current_date + interval '30 days')
)
RETURNS SETOF public.shows
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    s.*
  FROM public.shows s
  WHERE
    -- FIXED: Proper date range filtering to include all shows active during the period
    s.end_date >= filter_start_date AND     -- Show hasn't ended before our search starts
    s.start_date <= filter_end_date AND     -- Show starts before our search ends
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
Shows are included if they are active during any part of the date range.

Date filtering logic:
- Shows that end on or after filter_start_date (haven''t ended before search starts)
- Shows that start on or before filter_end_date (start before search ends)
This captures all shows that are active during any part of the date range.

Parameters:
  lat - Latitude of the center point
  long - Longitude of the center point
  radius_miles - Radius in miles (default: 25)
  filter_start_date - Start date for filtering shows (default: current date)
  filter_end_date   - End date for filtering shows (default: current date + 30 days)

Returns:
  All columns from the shows table for shows within the specified radius, 
  ordered by distance (closest first).';

COMMENT ON FUNCTION public.nearby_shows_earth_distance IS 
'Alternative implementation using cube/earthdistance extensions.
Finds shows within a specified radius (in miles) from a center point.
Shows are included if they are active during any part of the date range.

Date filtering logic:
- Shows that end on or after filter_start_date (haven''t ended before search starts)
- Shows that start on or before filter_end_date (start before search ends)
This captures all shows that are active during any part of the date range.

Parameters:
  lat - Latitude of the center point
  long - Longitude of the center point
  radius_miles - Radius in miles (default: 25)
  filter_start_date - Start date for filtering shows (default: current date)
  filter_end_date   - End date for filtering shows (default: current date + 30 days)

Returns:
  All columns from the shows table for shows within the specified radius, 
  ordered by distance (closest first).';
