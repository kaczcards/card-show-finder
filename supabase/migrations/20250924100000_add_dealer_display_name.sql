-- Migration: 20250924100000_add_dealer_display_name.sql
-- Description: Add display_name field to profiles table for custom dealer names
-- Date: 2025-09-24

-- Add display_name column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN public.profiles.display_name IS 
'Custom display name for dealers to show on booth info and show details instead of first+last name. Allows business names, nicknames, etc.';

-- Update the get_show_details_by_id function to use display_name
-- This function is critical for displaying dealer information to attendees
DROP FUNCTION IF EXISTS public.get_show_details_by_id;

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
  
  -- Get all dealers participating in the show with complete booth details
  -- UPDATED: Now prioritizes display_name over first_name + last_name
  WITH all_dealers AS (
    SELECT
      p.id,
      -- Prioritize display_name if set, otherwise fall back to first_name + last_name
      COALESCE(
        NULLIF(TRIM(p.display_name), ''), 
        TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))
      ) AS name,
      p.profile_image_url,
      UPPER(COALESCE(p.role, '')) AS role,
      p.account_type,
      sp.booth_location,
      sp.card_types,
      sp.specialty,
      sp.price_range,
      sp.notable_items,
      sp.payment_methods,
      sp.open_to_trades,
      sp.buying_cards,
      p.facebook_url,
      p.instagram_url,
      p.twitter_url,
      p.whatnot_url,
      p.ebay_store_url
    FROM 
      public.show_participants sp
    JOIN 
      public.profiles p ON sp.userid = p.id
    WHERE 
      sp.showid = show_id
    AND
      LOWER(p.role) IN ('mvp_dealer', 'dealer', 'show_organizer')
  )
  
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'name', d.name,
        'profileImageUrl', d.profile_image_url,
        'role', d.role,
        'accountType', d.account_type,
        -- Include both snake_case and camelCase for maximum compatibility
        'boothLocation', d.booth_location,
        'booth_location', d.booth_location,
        'cardTypes', d.card_types,
        'card_types', d.card_types,
        'specialty', d.specialty,
        'priceRange', d.price_range,
        'price_range', d.price_range,
        'notableItems', d.notable_items,
        'notable_items', d.notable_items,
        'paymentMethods', d.payment_methods,
        'payment_methods', d.payment_methods,
        'openToTrades', d.open_to_trades,
        'open_to_trades', d.open_to_trades,
        'buyingCards', d.buying_cards,
        'buying_cards', d.buying_cards,
        -- Include social media links
        'facebookUrl', d.facebook_url,
        'instagramUrl', d.instagram_url,
        'twitterUrl', d.twitter_url,
        'whatnotUrl', d.whatnot_url,
        'ebayStoreUrl', d.ebay_store_url
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

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.get_show_details_by_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_show_details_by_id TO anon;
GRANT EXECUTE ON FUNCTION public.get_show_details_by_id TO service_role;

COMMENT ON FUNCTION public.get_show_details_by_id IS 
'Gets detailed information about a show including:
 - All show information
 - Organizer profile (if available)
 - List of participating dealers with their profiles and complete booth details
 - Both camelCase and snake_case field names for compatibility
 
 UPDATED: Now prioritizes display_name over first_name + last_name for dealer names.
 
 Booth details include:
 - booth_location/boothLocation: Where to find the dealer at the show
 - card_types/cardTypes: Types of cards the dealer primarily sells
 - specialty: Dealer''s niche or specialty
 - price_range/priceRange: General price point range
 - notable_items/notableItems: Hot or hard-to-find items the dealer is known for
 - payment_methods/paymentMethods: Payment types accepted by the dealer
 - open_to_trades/openToTrades: Whether the dealer is open to trading cards
 - buying_cards/buyingCards: Whether the dealer is interested in buying cards
 - Social media links (facebookUrl, instagramUrl, twitterUrl, whatnotUrl, ebayStoreUrl)
 
Parameters:
 - show_id: UUID of the show to retrieve

Returns:
 A JSON object with show, organizer, and participatingDealers properties.
 
This function is accessible to all users (including anonymous) and bypasses RLS
to ensure attendees can see complete booth information for all dealer types.';