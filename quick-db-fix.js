#!/usr/bin/env node
/**
 * quick-db-fix.js
 * 
 * A simple script to apply the SQL fix for show details display issues.
 * This script connects to your Supabase project and applies the SQL fix directly.
 * 
 * Usage:
 *   node quick-db-fix.js --url=YOUR_SUPABASE_URL --key=YOUR_SERVICE_ROLE_KEY
 *   
 * Or set environment variables:
 *   SUPABASE_URL=YOUR_SUPABASE_URL SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY node quick-db-fix.js
 */

const { createClient } = require('@supabase/supabase-js');
const { program } = require('commander');

// Parse command line arguments
program
  .option('--url <url>', 'Supabase project URL')
  .option('--key <key>', 'Supabase service role key')
  .parse(process.argv);

const options = program.opts();

// Get credentials from command line args or environment variables
const supabaseUrl = options.url || process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = options.key || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('\x1b[31mError: Missing Supabase credentials\x1b[0m');
  console.log('\nPlease provide your Supabase credentials using one of these methods:');
  console.log('1. Command line arguments:');
  console.log('   node quick-db-fix.js --url=YOUR_SUPABASE_URL --key=YOUR_SERVICE_ROLE_KEY');
  console.log('2. Environment variables:');
  console.log('   SUPABASE_URL=YOUR_SUPABASE_URL SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY node quick-db-fix.js');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseKey);

// The SQL fix for the get_show_details_by_id function
const sqlFix = `
-- Fixed version without the username column
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
  
  -- Get all participating dealers with their profiles (without username)
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')),
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
`;

// Function to apply the SQL fix
async function applyFix() {
  console.log('\x1b[34m=== CARD SHOW FINDER - QUICK DB FIX ===\x1b[0m');
  console.log('Connecting to Supabase...');
  
  try {
    // Apply the SQL fix
    console.log('Applying SQL fix...');
    const { error } = await supabase.rpc('pgexec', { sql: sqlFix });
    
    if (error) {
      console.error('\x1b[31mError applying SQL fix:\x1b[0m', error.message);
      
      // Try alternative approach if pgexec is not available
      console.log('Trying alternative approach...');
      const { error: altError } = await supabase.rpc('exec_sql', { query: sqlFix });
      
      if (altError) {
        console.error('\x1b[31mAlternative approach failed:\x1b[0m', altError.message);
        console.log('\nPlease apply the SQL manually using the Supabase SQL Editor:');
        console.log('1. Go to https://supabase.com/dashboard/project/_/sql');
        console.log('2. Create a new query');
        console.log('3. Paste the SQL fix (saved to fix-show-details.sql)');
        console.log('4. Run the query');
        
        // Save SQL to a file for manual application
        const fs = require('fs');
        fs.writeFileSync('fix-show-details.sql', sqlFix);
        console.log('\nSQL fix saved to fix-show-details.sql');
        
        process.exit(1);
      }
    }
    
    // Verify the fix was applied
    console.log('Verifying fix...');
    const { data, error: verifyError } = await supabase
      .from('pg_proc')
      .select('proname')
      .eq('proname', 'get_show_details_by_id')
      .maybeSingle();
    
    if (verifyError) {
      console.log('\x1b[33mWarning: Could not verify if fix was applied.\x1b[0m');
      console.log('Please check manually if the function was created successfully.');
    } else if (data) {
      console.log('\x1b[32mSuccess! The get_show_details_by_id function has been fixed.\x1b[0m');
    } else {
      console.log('\x1b[33mWarning: Function not found after applying fix.\x1b[0m');
      console.log('Please check manually if there were any errors during function creation.');
    }
    
    // Test the function with a sample show ID
    console.log('\nTesting the function with a sample show...');
    const { data: testData, error: testError } = await supabase.rpc(
      'get_show_details_by_id',
      { show_id: '00000000-0000-0000-0000-000000000000' }
    );
    
    if (testError) {
      if (testError.message.includes('not found')) {
        console.log('\x1b[33mTest show not found (expected), but function executed without errors.\x1b[0m');
        console.log('\x1b[32mFix appears to be working correctly!\x1b[0m');
      } else {
        console.log('\x1b[31mError testing function:\x1b[0m', testError.message);
      }
    } else {
      console.log('\x1b[32mFunction executed successfully!\x1b[0m');
    }
    
    console.log('\n\x1b[34m=== NEXT STEPS ===\x1b[0m');
    console.log('1. Restart your application completely (not just refresh)');
    console.log('2. Navigate to a show created by a Show Organizer');
    console.log('3. Verify that all information appears correctly without errors');
    
  } catch (err) {
    console.error('\x1b[31mUnexpected error:\x1b[0m', err.message);
    process.exit(1);
  }
}

// Run the fix
applyFix();
