-- Migration: 20250912_geocoding_cache_and_set_show_coordinates.sql
-- Description: Creates geocoding cache table and coordinate-setting functions
-- Created: September 12, 2025

-- Ensure PostGIS extension is available
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Create geocode_cache table for storing Google Maps API results
CREATE TABLE IF NOT EXISTS public.geocode_cache (
  address_hash TEXT PRIMARY KEY,
  address_norm TEXT NOT NULL,
  formatted_address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add unique index on normalized address
CREATE UNIQUE INDEX IF NOT EXISTS geocode_cache_address_norm_idx ON public.geocode_cache (address_norm);

-- Add btree index on created_at for efficient time-based queries
CREATE INDEX IF NOT EXISTS geocode_cache_created_at_idx ON public.geocode_cache USING btree (created_at);

-- Add comments
COMMENT ON TABLE public.geocode_cache IS 'Cache for Google Maps geocoding results to reduce API usage and costs';
COMMENT ON COLUMN public.geocode_cache.address_hash IS 'Hash of the original address string for consistent lookup';
COMMENT ON COLUMN public.geocode_cache.address_norm IS 'Normalized address string for fuzzy matching';
COMMENT ON COLUMN public.geocode_cache.formatted_address IS 'Formatted address returned by Google Maps API';
COMMENT ON COLUMN public.geocode_cache.lat IS 'Latitude coordinate';
COMMENT ON COLUMN public.geocode_cache.lng IS 'Longitude coordinate';
COMMENT ON COLUMN public.geocode_cache.raw IS 'Raw JSON response from Google Maps API for additional data';
COMMENT ON COLUMN public.geocode_cache.created_at IS 'Timestamp when the cache entry was created';

-- 2. Enable RLS on geocode_cache
ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

-- Revoke all privileges from anon and authenticated
REVOKE ALL ON TABLE public.geocode_cache FROM anon, authenticated;

-- Grant privileges to service_role only
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.geocode_cache TO service_role;

-- 3. Create set_show_coordinates function
CREATE OR REPLACE FUNCTION public.set_show_coordinates(
  show_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Validate coordinates
  IF NOT validate_coordinates(p_lat, p_lng) THEN
    RAISE EXCEPTION 'Invalid coordinates: latitude=%, longitude=%', p_lat, p_lng;
  END IF;
  
  -- Update the show with new coordinates
  UPDATE public.shows
  SET 
    coordinates = create_geography_point(p_lat, p_lng),
    updated_at = now()
  WHERE id = show_id
  RETURNING 1 INTO updated_count;
  
  -- Return true if a row was updated, false otherwise
  RETURN COALESCE(updated_count, 0) > 0;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in set_show_coordinates: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Grant execute permission to service_role only
REVOKE ALL ON FUNCTION public.set_show_coordinates(UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_show_coordinates(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO service_role;

-- Add documentation comment
COMMENT ON FUNCTION public.set_show_coordinates IS 
'Updates coordinates for a show using validated latitude and longitude.
This function safely handles coordinate validation and properly creates a PostGIS geography point.
SECURITY DEFINER ensures it runs with elevated privileges.

Parameters:
  show_id - UUID of the show to update
  p_lat - Latitude (must be between -90 and 90)
  p_lng - Longitude (must be between -180 and 180)

Returns:
  Boolean indicating if a show was successfully updated';

-- 4. Create geocode_cache_upsert function
CREATE OR REPLACE FUNCTION public.geocode_cache_upsert(
  p_address_hash TEXT,
  p_address_norm TEXT,
  p_formatted_address TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_raw JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate coordinates
  IF NOT validate_coordinates(p_lat, p_lng) THEN
    RAISE EXCEPTION 'Invalid coordinates: latitude=%, longitude=%', p_lat, p_lng;
  END IF;
  
  -- Upsert into geocode_cache
  INSERT INTO public.geocode_cache (
    address_hash,
    address_norm,
    formatted_address,
    lat,
    lng,
    raw,
    created_at
  )
  VALUES (
    p_address_hash,
    p_address_norm,
    p_formatted_address,
    p_lat,
    p_lng,
    p_raw,
    now()
  )
  ON CONFLICT (address_hash) 
  DO UPDATE SET
    address_norm = p_address_norm,
    formatted_address = p_formatted_address,
    lat = p_lat,
    lng = p_lng,
    raw = p_raw,
    created_at = now();
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in geocode_cache_upsert: %', SQLERRM;
    RAISE;
END;
$$;

-- Grant execute permission to service_role only
REVOKE ALL ON FUNCTION public.geocode_cache_upsert(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.geocode_cache_upsert(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, JSONB) TO service_role;

-- Add documentation comment
COMMENT ON FUNCTION public.geocode_cache_upsert IS 
'Upserts geocoding results into the cache to reduce API usage.
SECURITY DEFINER ensures it runs with elevated privileges.

Parameters:
  p_address_hash - Hash of the original address string
  p_address_norm - Normalized address string for fuzzy matching
  p_formatted_address - Formatted address returned by Google Maps API
  p_lat - Latitude coordinate
  p_lng - Longitude coordinate
  p_raw - Raw JSON response from Google Maps API';
