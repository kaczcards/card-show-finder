/**
 * Script to update the get_show_details_by_id function to use display_name
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Please ensure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updateShowDetailsFunction() {
  console.log('🔧 Updating get_show_details_by_id function to use display_name...');
  
  // The SQL to update the function
  const functionSQL = `
-- Update the get_show_details_by_id function to use display_name
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
  `;
  
  console.log('📋 Please run the following SQL in your Supabase SQL Editor:');
  console.log('');
  console.log(functionSQL);
  console.log('');
  console.log('This will update the get_show_details_by_id function to prioritize display_name over first_name + last_name.');
  
  return functionSQL;
}

console.log('🚀 Preparing get_show_details_by_id function update...');
updateShowDetailsFunction();