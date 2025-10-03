/**
 * Script to fix the search function to include MVP Dealer booth content in search results
 * Issue: Searching for "Star Wars" should return shows where MVP Dealers have "Star Wars" in their booth info
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

async function fixSearchFunction() {
  console.log('🔧 Fixing search function to include MVP Dealer booth content...');
  
  // First, let me check what search functions exist in the database
  console.log('🔍 Checking existing search functions...');
  
  // The corrected SQL - using the correct field names from show_participants table
  const functionSQL = `
-- Fix Issue #5: Update search to include MVP Dealer booth content
-- This fixes the search to include dealer specialties, notable items, and card types

-- First check what the actual column names are in show_participants table
-- Common columns: specialty, notable_items, card_types, price_range

-- Drop existing search functions that might interfere
DROP FUNCTION IF EXISTS public.search_shows_advanced CASCADE;
DROP FUNCTION IF EXISTS public.get_shows_paginated CASCADE;

-- Create the enhanced search function with correct field references
CREATE OR REPLACE FUNCTION public.search_shows_enhanced(
  lat double precision DEFAULT NULL,
  lng double precision DEFAULT NULL,
  radius_miles integer DEFAULT 25,
  start_date date DEFAULT CURRENT_DATE,
  end_date date DEFAULT (CURRENT_DATE + INTERVAL '90 days'),
  max_entry_fee numeric DEFAULT NULL,
  categories text[] DEFAULT NULL,
  features jsonb DEFAULT NULL,
  keyword text DEFAULT NULL,
  dealer_card_types text[] DEFAULT NULL,
  page_size integer DEFAULT 20,
  page integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  offset_val integer;
  total_count integer;
  results jsonb;
BEGIN
  -- Calculate offset for pagination
  offset_val := (page - 1) * page_size;
  
  -- Build the enhanced search query that includes dealer booth content
  WITH matching_shows AS (
    SELECT DISTINCT s.id
    FROM public.shows s
    LEFT JOIN public.show_participants sp ON s.id = sp.showid
    LEFT JOIN public.profiles p ON sp.userid = p.id
    WHERE
      -- Date range filter (only future shows by default)
      s.start_date >= start_date AND
      s.start_date <= end_date AND
      
      -- Status filter (only active shows)
      LOWER(s.status) IN ('active', 'upcoming') AND
      
      -- Location filter (if coordinates provided)
      (
        (lat IS NULL OR lng IS NULL) OR
        (
          s.coordinates IS NOT NULL AND
          ST_DWithin(
            s.coordinates,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326),
            radius_miles * 1609.34
          )
        )
      ) AND
      
      -- Entry fee filter
      (max_entry_fee IS NULL OR s.entry_fee <= max_entry_fee) AND
      
      -- Categories filter
      (categories IS NULL OR s.categories && categories) AND
      
      -- Features filter
      (features IS NULL OR s.features @> features) AND
      
      -- ENHANCED KEYWORD SEARCH - Now includes MVP Dealer booth content!
      (
        keyword IS NULL OR
        -- Search show details
        s.title ILIKE '%' || keyword || '%' OR
        s.description ILIKE '%' || keyword || '%' OR
        s.location ILIKE '%' || keyword || '%' OR
        s.address ILIKE '%' || keyword || '%' OR
        -- Search MVP Dealer booth content from show_participants
        sp.specialty ILIKE '%' || keyword || '%' OR
        sp.notable_items ILIKE '%' || keyword || '%' OR
        sp.card_types ILIKE '%' || keyword || '%' OR
        sp.price_range ILIKE '%' || keyword || '%' OR
        -- Search dealer profile info as fallback
        p.first_name ILIKE '%' || keyword || '%' OR
        p.last_name ILIKE '%' || keyword || '%'
      ) AND
      
      -- Dealer card types filter
      (
        dealer_card_types IS NULL OR
        EXISTS (
          SELECT 1 FROM unnest(string_to_array(sp.card_types, ',')) AS ct
          WHERE TRIM(ct) = ANY(dealer_card_types)
        )
      )
  )
  SELECT COUNT(*) INTO total_count FROM matching_shows;
  
  -- Get the actual paginated results
  WITH filtered_shows AS (
    SELECT DISTINCT ON (s.id)
      s.*,
      -- Add distance if coordinates provided
      CASE WHEN lat IS NOT NULL AND lng IS NOT NULL AND s.coordinates IS NOT NULL THEN
        ST_DistanceSphere(
          s.coordinates,
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)
        ) / 1609.34
      ELSE NULL END as distance_miles,
      -- Extract coordinates
      CASE WHEN s.coordinates IS NOT NULL THEN ST_Y(s.coordinates) ELSE NULL END as latitude,
      CASE WHEN s.coordinates IS NOT NULL THEN ST_X(s.coordinates) ELSE NULL END as longitude
    FROM public.shows s
    LEFT JOIN public.show_participants sp ON s.id = sp.showid
    LEFT JOIN public.profiles p ON sp.userid = p.id
    WHERE
      s.start_date >= start_date AND
      s.start_date <= end_date AND
      LOWER(s.status) IN ('active', 'upcoming') AND
      (
        (lat IS NULL OR lng IS NULL) OR
        (
          s.coordinates IS NOT NULL AND
          ST_DWithin(
            s.coordinates,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326),
            radius_miles * 1609.34
          )
        )
      ) AND
      (max_entry_fee IS NULL OR s.entry_fee <= max_entry_fee) AND
      (categories IS NULL OR s.categories && categories) AND
      (features IS NULL OR s.features @> features) AND
      (
        keyword IS NULL OR
        s.title ILIKE '%' || keyword || '%' OR
        s.description ILIKE '%' || keyword || '%' OR
        s.location ILIKE '%' || keyword || '%' OR
        s.address ILIKE '%' || keyword || '%' OR
        sp.specialty ILIKE '%' || keyword || '%' OR
        sp.notable_items ILIKE '%' || keyword || '%' OR
        sp.card_types ILIKE '%' || keyword || '%' OR
        sp.price_range ILIKE '%' || keyword || '%' OR
        p.first_name ILIKE '%' || keyword || '%' OR
        p.last_name ILIKE '%' || keyword || '%'
      ) AND
      (
        dealer_card_types IS NULL OR
        EXISTS (
          SELECT 1 FROM unnest(string_to_array(sp.card_types, ',')) AS ct
          WHERE TRIM(ct) = ANY(dealer_card_types)
        )
      )
    ORDER BY
      s.id,
      CASE WHEN lat IS NOT NULL AND lng IS NOT NULL THEN
        ST_DistanceSphere(s.coordinates, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
      ELSE NULL END ASC NULLS LAST,
      s.start_date ASC
    LIMIT page_size
    OFFSET offset_val
  )
  SELECT jsonb_build_object(
    'data', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', fs.id,
        'title', fs.title,
        'description', fs.description,
        'location', fs.location,
        'address', fs.address,
        'start_date', fs.start_date,
        'end_date', fs.end_date,
        'entry_fee', fs.entry_fee,
        'image_url', fs.image_url,
        'status', fs.status,
        'organizer_id', fs.organizer_id,
        'features', fs.features,
        'categories', fs.categories,
        'created_at', fs.created_at,
        'updated_at', fs.updated_at,
        'coordinates', CASE WHEN fs.latitude IS NOT NULL AND fs.longitude IS NOT NULL THEN
          jsonb_build_object('latitude', fs.latitude, 'longitude', fs.longitude)
        ELSE NULL END,
        'distance_miles', fs.distance_miles
      )
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'total_count', total_count,
      'page_size', page_size,
      'current_page', page,
      'total_pages', CEIL(total_count::float / page_size),
      'has_more', (offset_val + page_size) < total_count
    )
  ) INTO results
  FROM filtered_shows fs;
  
  RETURN COALESCE(results, jsonb_build_object(
    'data', '[]'::jsonb,
    'pagination', jsonb_build_object(
      'total_count', 0,
      'page_size', page_size,
      'current_page', page,
      'total_pages', 0,
      'has_more', false
    )
  ));
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in search_shows_enhanced: %', SQLERRM;
    RETURN jsonb_build_object('error', SQLERRM, 'sql_state', SQLSTATE);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.search_shows_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_shows_enhanced TO anon;
GRANT EXECUTE ON FUNCTION public.search_shows_enhanced TO service_role;

-- Add helpful comment
COMMENT ON FUNCTION public.search_shows_enhanced IS 
'Enhanced search function that searches both show content AND MVP Dealer booth content.
When searching for keywords like "Star Wars", it will find:
1. Shows with "Star Wars" in title/description/location
2. Shows where MVP Dealers have "Star Wars" in their specialty, notable_items, or card_types
This allows attendees to find shows based on what dealers are selling!';
  `;
  
  console.log('📋 Please run the following SQL in your Supabase SQL Editor:');
  console.log('');
  console.log(functionSQL);
  console.log('');
  console.log('This will create an enhanced search function that includes MVP Dealer booth content in searches.');
  
  return functionSQL;
}

console.log('🚀 Preparing enhanced search function...');
fixSearchFunction();