-- Migration: 20250714050000_fix_show_details_for_organizer_shows.sql
-- Description: Updates the get_show_details_by_id function to properly include 
-- dealer/booth details for shows created by Show Organizers

-- Drop the function if it already exists to ensure clean installation
DROP FUNCTION IF EXISTS public.get_show_details_by_id;

-- Create the improved function that properly handles organizer-created shows
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
BEGIN
  -- Get the show data
  SELECT 
    to_jsonb(s) AS show
  INTO show_data
  FROM 
    public.shows s
  WHERE 
    s.id = show_id;
    
  IF show_data IS NULL THEN
    RAISE EXCEPTION 'Show with ID % not found', show_id;
  END IF;
  
  -- Get the organizer profile if it exists
  IF (show_data->>'organizer_id') IS NOT NULL THEN
    SELECT 
      to_jsonb(p) AS profile
    INTO organizer_data
    FROM 
      public.profiles p
    WHERE 
      p.id = (show_data->>'organizer_id')::UUID;
  ELSE
    organizer_data := NULL;
  END IF;
  
  -- Get all participating dealers with their profiles
  -- Improved query to ensure it includes dealers for organizer-created shows
  WITH all_dealers AS (
    -- Get dealers from show_participants table (traditional shows)
    SELECT 
      p.id,
      TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS name,
      p.profile_image_url,
      UPPER(COALESCE(p.role, '')) AS role,
      p.account_type,
      sp.booth_location
    FROM 
      public.show_participants sp
    JOIN 
      public.profiles p ON sp.userid = p.id
    WHERE 
      sp.showid = show_id
    AND
      LOWER(p.role) IN ('mvp_dealer', 'dealer')
      
    UNION ALL
    
    -- Get dealers from organizer_show_dealers table (organizer-created shows)
    SELECT 
      p.id,
      TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS name,
      p.profile_image_url,
      UPPER(COALESCE(p.role, '')) AS role,
      p.account_type,
      osd.booth_location
    FROM 
      public.organizer_show_dealers osd
    JOIN 
      public.profiles p ON osd.dealer_id = p.id
    WHERE 
      osd.show_id = show_id
    AND
      LOWER(p.role) IN ('mvp_dealer', 'dealer')
  )
  
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'name', d.name,
        'profileImageUrl', d.profile_image_url,
        'role', d.role,
        'accountType', d.account_type,
        'boothLocation', d.booth_location
      )
    ) AS dealers
  INTO dealers_data
  FROM 
    all_dealers d;
    
  -- If no dealers found, set to empty array instead of null
  IF dealers_data IS NULL THEN
    dealers_data := '[]'::JSONB;
  END IF;
  
  -- Combine all data into a single JSON object
  result_json := jsonb_build_object(
    'show', show_data,
    'organizer', organizer_data,
    'participatingDealers', dealers_data,
    'isFavoriteCount', (
      SELECT COUNT(*) 
      FROM public.user_favorite_shows 
      WHERE public.user_favorite_shows.show_id = get_show_details_by_id.show_id
    )
  );
  
  RETURN result_json;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return error information
    RAISE LOG 'Error in get_show_details_by_id: %', SQLERRM;
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'errorCode', SQLSTATE
    );
END;
$$;

-- Grant execute permissions to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_show_details_by_id TO authenticated, anon;

-- Add documentation comment
COMMENT ON FUNCTION public.get_show_details_by_id IS 
'Retrieves complete details for a show including:
 - All show information
 - Organizer profile (if available)
 - List of participating dealers with their profiles
 
Parameters:
 - show_id: UUID of the show to retrieve

Returns:
 A JSON object with show, organizer, and participatingDealers properties.
 
This function optimizes data loading by fetching all related data in a single query,
eliminating the need for multiple sequential database calls from the client.

This improved version properly handles shows created by Show Organizers by:
1. Including dealers from both show_participants and organizer_show_dealers tables
2. Ensuring booth details are properly displayed regardless of how the show was created
3. Using a UNION ALL to combine results from both sources
4. Maintaining consistent property names for client compatibility';
