-- Migration: 20250819100500_tighten_show_details_rpc_and_add_indexes.sql
-- Description: Tightens the get_show_details_by_id RPC to only include active participants
-- and adds performance indexes for queries used by the RPC.

-- Drop the function if it already exists to ensure clean installation
DROP FUNCTION IF EXISTS public.get_show_details_by_id;

-- Create the improved function with status filtering and ordered results
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
  -- Now filtered by active status and ordered by role priority then name
  WITH all_dealers AS (
    SELECT
      p.id,
      TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS name,
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
      p.ebay_store_url,
      -- Create a role_order for sorting
      CASE 
        WHEN UPPER(p.role) = 'SHOW_ORGANIZER' THEN 1
        WHEN UPPER(p.role) = 'MVP_DEALER' THEN 2
        WHEN UPPER(p.role) = 'DEALER' THEN 3
        ELSE 4
      END AS role_order
    FROM 
      public.show_participants sp
    JOIN 
      public.profiles p ON sp.userid = p.id
    WHERE 
      sp.showid = show_id
    AND
      LOWER(p.role) IN ('mvp_dealer', 'dealer', 'show_organizer')
    AND
      sp.status IN ('registered', 'confirmed')
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
      ORDER BY d.role_order, d.name
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

-- Add performance indexes for the show_participants table
CREATE INDEX IF NOT EXISTS idx_show_participants_showid 
  ON public.show_participants(showid);
  
CREATE INDEX IF NOT EXISTS idx_show_participants_userid 
  ON public.show_participants(userid);
  
CREATE INDEX IF NOT EXISTS idx_show_participants_showid_userid 
  ON public.show_participants(showid, userid);
  
CREATE INDEX IF NOT EXISTS idx_show_participants_status 
  ON public.show_participants(status);

COMMENT ON FUNCTION public.get_show_details_by_id IS 
'Gets detailed information about a show including:
 - All show information
 - Organizer profile (if available)
 - List of participating dealers with their profiles and complete booth details
 - Both camelCase and snake_case field names for compatibility
 
 Security enhancements:
 - Only includes participants with status ''registered'' or ''confirmed''
 - Orders dealers by role priority (SHOW_ORGANIZER first, then MVP_DEALER, then DEALER)
 - Performance indexes added for showid, userid, and status columns
 
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
