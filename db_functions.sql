-- db_functions.sql
-- PostgreSQL function for spatial queries to find shows within a specified distance
-- This function replaces the problematic PostgREST filter string approach

-- Function to find shows within a specified radius
CREATE OR REPLACE FUNCTION public.find_shows_within_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_miles DOUBLE PRECISION
)
RETURNS SETOF public.shows
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT *
  FROM public.shows
  WHERE ST_DWithin(
    coordinates::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_miles * 1609.34  -- Convert miles to meters
  )
  AND status = 'ACTIVE'  -- Only return active shows by default
  ORDER BY 
    ST_Distance(
      coordinates::geography, 
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
    ) ASC;  -- Order by distance (closest first)
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.find_shows_within_radius TO authenticated, anon;

-- Comment on function
COMMENT ON FUNCTION public.find_shows_within_radius IS 
'Finds shows within a specified radius (in miles) from a center point.
Parameters:
  center_lat - Latitude of the center point
  center_lng - Longitude of the center point
  radius_miles - Radius in miles
Returns:
  All columns from the shows table for shows within the specified radius,
  ordered by distance (closest first).';

-- Function to find shows within a radius with additional filters
CREATE OR REPLACE FUNCTION public.find_filtered_shows(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_miles DOUBLE PRECISION,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  max_entry_fee NUMERIC DEFAULT NULL,
  show_categories TEXT[] DEFAULT NULL,
  show_features TEXT[] DEFAULT NULL
)
RETURNS SETOF public.shows
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT *
  FROM public.shows
  WHERE 
    -- Spatial filter
    ST_DWithin(
      coordinates::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_miles * 1609.34  -- Convert miles to meters
    )
    -- Status filter - only active shows
    AND status = 'ACTIVE'
    -- Date filters
    AND (start_date IS NULL OR shows.start_date >= start_date)
    AND (end_date IS NULL OR shows.end_date <= end_date)
    -- Entry fee filter
    AND (max_entry_fee IS NULL OR entry_fee <= max_entry_fee)
    -- Category filter
    AND (show_categories IS NULL OR shows.categories && show_categories)
    -- Features filter - this is more complex as features are stored as JSONB
    AND (
      show_features IS NULL 
      OR (
        CASE WHEN array_length(show_features, 1) > 0 THEN
          -- Check if all requested features exist in the show's features
          (SELECT bool_and(shows.features->feature = 'true')
           FROM unnest(show_features) AS feature)
        ELSE true
        END
      )
    )
  ORDER BY 
    ST_Distance(
      coordinates::geography, 
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
    ) ASC;  -- Order by distance (closest first)
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.find_filtered_shows TO authenticated, anon;

-- Comment on function
COMMENT ON FUNCTION public.find_filtered_shows IS 
'Finds shows within a specified radius with additional filtering options.
Parameters:
  center_lat - Latitude of the center point
  center_lng - Longitude of the center point
  radius_miles - Radius in miles
  start_date - Optional minimum start date
  end_date - Optional maximum end date
  max_entry_fee - Optional maximum entry fee
  show_categories - Optional array of categories to filter by
  show_features - Optional array of features to filter by
Returns:
  All columns from the shows table for shows matching the filters,
  ordered by distance (closest first).';
