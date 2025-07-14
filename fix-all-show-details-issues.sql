-- Migration: fix-all-show-details-issues.sql
-- Description: Comprehensive fix for show details display issues
-- This addresses text rendering errors and ensures consistent data structure
-- for both regular shows and organizer-created shows

-- Drop the function to recreate it with improvements
DROP FUNCTION IF EXISTS public.get_show_details_by_id;

-- Create the improved function with consistent data structure and null handling
CREATE OR REPLACE FUNCTION public.get_show_details_by_id(
  show_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  show_data JSONB;
  organizer_data JSONB;
  dealers_data JSONB;
  result_json JSONB;
  debug_info JSONB;
BEGIN
  -- Get the show data with explicit null handling and data sanitization
  SELECT 
    jsonb_build_object(
      'id', s.id,
      'title', COALESCE(s.title, 'Untitled Show'),
      'description', COALESCE(s.description, ''),
      'location', COALESCE(s.location, ''),
      'address', COALESCE(s.address, ''),
      'start_date', s.start_date,
      'end_date', s.end_date,
      'start_time', COALESCE(s.start_time, ''),
      'end_time', COALESCE(s.end_time, ''),
      'entry_fee', s.entry_fee,
      'image_url', s.image_url,
      'rating', COALESCE(s.rating, 0),
      'status', COALESCE(s.status, 'ACTIVE'),
      'organizer_id', s.organizer_id,
      'coordinates', s.coordinates,
      'features', COALESCE(s.features, '{}'),
      'categories', COALESCE(s.categories, '{}'),
      'created_at', s.created_at,
      'updated_at', s.updated_at,
      -- Ensure consistent field naming for client compatibility
      'startTime', COALESCE(s.start_time, ''),
      'endTime', COALESCE(s.end_time, ''),
      'latitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_Y(s.coordinates::geometry) ELSE NULL END,
      'longitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_X(s.coordinates::geometry) ELSE NULL END
    ) AS show
  INTO show_data
  FROM 
    public.shows s
  WHERE 
    s.id = show_id;
    
  IF show_data IS NULL THEN
    RAISE EXCEPTION 'Show with ID % not found', show_id;
  END IF;
  
  -- Get the organizer profile if it exists, with explicit null handling
  IF (show_data->>'organizer_id') IS NOT NULL THEN
    SELECT 
      jsonb_build_object(
        'id', p.id,
        'username', COALESCE(p.username, ''),
        'first_name', COALESCE(p.first_name, ''),
        'last_name', COALESCE(p.last_name, ''),
        'full_name', COALESCE(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), 'Show Organizer'),
        'email', COALESCE(p.email, ''),
        'profile_image_url', p.profile_image_url,
        'avatar_url', p.profile_image_url, -- Duplicate for client compatibility
        'role', COALESCE(UPPER(p.role), 'USER'),
        'account_type', COALESCE(p.account_type, 'FREE')
      ) AS profile
    INTO organizer_data
    FROM 
      public.profiles p
    WHERE 
      p.id = (show_data->>'organizer_id')::UUID;
  ELSE
    organizer_data := NULL;
  END IF;
  
  -- Get all participating dealers with their profiles
  -- Using only the show_participants table which exists
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', COALESCE(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), COALESCE(p.username, 'Dealer')),
        'profileImageUrl', p.profile_image_url,
        'role', COALESCE(UPPER(p.role), 'DEALER'),
        'accountType', COALESCE(p.account_type, 'FREE'),
        'boothLocation', COALESCE(sp.booth_location, '')
      )
    ) AS dealers
  INTO dealers_data
  FROM 
    public.show_participants sp
  JOIN 
    public.profiles p ON sp.userid = p.id
  WHERE 
    sp.showid = show_id
  AND
    LOWER(COALESCE(p.role, 'dealer')) IN ('mvp_dealer', 'dealer');
    
  -- If no dealers found, set to empty array instead of null
  IF dealers_data IS NULL THEN
    dealers_data := '[]'::JSONB;
  END IF;
  
  -- Add debug info to help diagnose issues
  debug_info := jsonb_build_object(
    'query_time', NOW(),
    'show_id', show_id,
    'has_organizer', organizer_data IS NOT NULL,
    'dealer_count', jsonb_array_length(COALESCE(dealers_data, '[]'::JSONB))
  );
  
  -- Combine all data into a single JSON object
  result_json := jsonb_build_object(
    'show', show_data,
    'organizer', organizer_data,
    'participatingDealers', dealers_data,
    'isFavoriteCount', (
      SELECT COUNT(*) 
      FROM public.user_favorite_shows 
      WHERE public.user_favorite_shows.show_id = get_show_details_by_id.show_id
    ),
    'debug', debug_info
  );
  
  RETURN result_json;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return error information
    RAISE LOG 'Error in get_show_details_by_id: %', SQLERRM;
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'errorCode', SQLSTATE,
      'message', 'An error occurred while retrieving show details. Please try again.',
      'details', jsonb_build_object(
        'show_id', show_id,
        'timestamp', NOW()
      )
    );
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_show_details_by_id TO authenticated, anon;

-- Add documentation comment
COMMENT ON FUNCTION public.get_show_details_by_id IS 
'Retrieves complete details for a show including:
 - All show information with consistent field naming and null handling
 - Organizer profile (if available)
 - List of participating dealers with their profiles

This improved version:
1. Ensures consistent data structure for all shows
2. Handles null values gracefully to prevent client-side errors
3. Provides both snake_case and camelCase field names for compatibility
4. Adds debug information to help diagnose issues
5. Properly formats text fields to prevent React Native rendering errors
6. Uses only existing tables (show_participants) without referencing non-existent tables

Parameters:
 - show_id: UUID of the show to retrieve

Returns:
 A JSON object with show, organizer, participatingDealers, and isFavoriteCount properties.';
