-- db_migrations/fix_show_date_filtering.sql

-- This script fixes the date filtering logic in the `find_filtered_shows` function.
-- The original function did not explicitly exclude shows that have already ended
-- when a future `start_date` was not provided.
-- This version adds a condition to ensure `shows.end_date` is always greater
-- than or equal to the current timestamp (`NOW()`), effectively excluding historical shows.

-- Drop the existing function to allow recreation with updated logic
DROP FUNCTION IF EXISTS public.find_filtered_shows(
    center_lat double precision,
    center_lng double precision,
    radius_miles double precision,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    max_entry_fee numeric,
    show_categories text[],
    show_features text[]
);

-- Recreate the function with the corrected date filtering
CREATE FUNCTION public.find_filtered_shows(
    center_lat double precision,
    center_lng double precision,
    radius_miles double precision,
    start_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
    end_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
    max_entry_fee numeric DEFAULT NULL::numeric,
    show_categories text[] DEFAULT NULL::text[],
    show_features text[] DEFAULT NULL::text[]
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
    -- Ensure the show's start date is on or after the provided start_date (if any)
    AND (start_date IS NULL OR shows.start_date >= start_date)
    -- Ensure the show's end date is on or before the provided end_date (if any)
    AND (end_date IS NULL OR shows.end_date <= end_date)
    -- IMPORTANT: Ensure the show's end date is in the future or present (excludes historical shows)
    AND shows.end_date >= NOW()
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

-- Grant permissions to the function
GRANT ALL ON FUNCTION public.find_filtered_shows(
    center_lat double precision,
    center_lng double precision,
    radius_miles double precision,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    max_entry_fee numeric,
    show_categories text[],
    show_features text[]
) TO anon;
GRANT ALL ON FUNCTION public.find_filtered_shows(
    center_lat double precision,
    center_lng double precision,
    radius_miles double precision,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    max_entry_fee numeric,
    show_categories text[],
    show_features text[]
) TO authenticated;
GRANT ALL ON FUNCTION public.find_filtered_shows(
    center_lat double precision,
    center_lng double precision,
    radius_miles double precision,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    max_entry_fee numeric,
    show_categories text[],
    show_features text[]
) TO service_role;

-- Add a comment to the function for documentation
COMMENT ON FUNCTION public.find_filtered_shows(
    center_lat double precision,
    center_lng double precision,
    radius_miles double precision,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    max_entry_fee numeric,
    show_categories text[],
    show_features text[]
) IS 'Finds shows within a specified radius with additional filtering options.
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
  ordered by distance (closest first).
  Includes a fix to ensure only current or future shows are returned based on end_date.';
