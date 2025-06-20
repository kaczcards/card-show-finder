/**
 * test-db-functions.js
 * 
 * A simple script to test if the Supabase database functions
 * for spatial queries are properly deployed and working.
 */

// Load environment variables from .env file
require('dotenv').config();

// Import Supabase client
const { createClient } = require('@supabase/supabase-js');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration. Please check your .env file.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test coordinates (near Indianapolis, similar to ZIP 46060)
const testCoordinates = {
  latitude: 39.9615, 
  longitude: -86.0156
};

// Test parameters
const radius = 25; // 25 miles
const startDate = new Date(); // today
const endDate = new Date();
endDate.setDate(endDate.getDate() + 30); // 30 days from now

/**
 * Test the find_shows_within_radius function
 */
async function testFindShowsWithinRadius() {
  console.log('\n--- Testing find_shows_within_radius ---');
  console.log(`Using coordinates: ${testCoordinates.latitude}, ${testCoordinates.longitude}`);
  console.log(`Radius: ${radius} miles`);
  
  try {
    const { data, error } = await supabase.rpc('find_shows_within_radius', {
      center_lat: testCoordinates.latitude,
      center_lng: testCoordinates.longitude,
      radius_miles: radius
    });
    
    if (error) {
      console.error('Error calling find_shows_within_radius:', error);
      return false;
    }
    
    console.log(`Success! Found ${data?.length || 0} shows within ${radius} miles.`);
    if (data && data.length > 0) {
      console.log('First show:', {
        id: data[0].id,
        title: data[0].title,
        location: data[0].location,
        status: data[0].status,
        coordinates: data[0].coordinates
      });
    } else {
      console.log('No shows found within the radius.');
    }
    return true;
  } catch (err) {
    console.error('Exception when calling find_shows_within_radius:', err);
    return false;
  }
}

/**
 * Test the find_filtered_shows function
 */
async function testFindFilteredShows() {
  console.log('\n--- Testing find_filtered_shows ---');
  console.log(`Using coordinates: ${testCoordinates.latitude}, ${testCoordinates.longitude}`);
  console.log(`Radius: ${radius} miles`);
  console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  try {
    const { data, error } = await supabase.rpc('find_filtered_shows', {
      center_lat: testCoordinates.latitude,
      center_lng: testCoordinates.longitude,
      radius_miles: radius,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      max_entry_fee: null,
      show_categories: null,
      show_features: null
    });
    
    if (error) {
      console.error('Error calling find_filtered_shows:', error);
      return false;
    }
    
    console.log(`Success! Found ${data?.length || 0} shows matching filters.`);
    if (data && data.length > 0) {
      console.log('First show:', {
        id: data[0].id,
        title: data[0].title,
        location: data[0].location,
        startDate: data[0].start_date,
        endDate: data[0].end_date,
        status: data[0].status
      });
    } else {
      console.log('No shows found matching the filters.');
    }
    return true;
  } catch (err) {
    console.error('Exception when calling find_filtered_shows:', err);
    return false;
  }
}

/**
 * Test basic query to get all active shows
 */
async function testBasicQuery() {
  console.log('\n--- Testing basic query for all active shows ---');
  
  try {
    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .eq('status', 'ACTIVE');
    
    if (error) {
      console.error('Error with basic query:', error);
      return false;
    }
    
    console.log(`Success! Found ${data?.length || 0} active shows in total.`);
    if (data && data.length > 0) {
      console.log('First show:', {
        id: data[0].id,
        title: data[0].title,
        location: data[0].location,
        status: data[0].status
      });
    } else {
      console.log('No active shows found in the database.');
    }
    return true;
  } catch (err) {
    console.error('Exception when running basic query:', err);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Starting database function tests...');
  console.log(`Supabase URL: ${supabaseUrl}`);
  
  // First check if we can connect at all
  try {
    const { data, error } = await supabase.from('shows').select('count');
    if (error) throw error;
    console.log('Successfully connected to Supabase!');
  } catch (err) {
    console.error('Failed to connect to Supabase:', err);
    return;
  }
  
  // Run the tests
  const basicQueryResult = await testBasicQuery();
  const radiusResult = await testFindShowsWithinRadius();
  const filteredResult = await testFindFilteredShows();
  
  // Summary
  console.log('\n--- Test Summary ---');
  console.log(`Basic query: ${basicQueryResult ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`find_shows_within_radius: ${radiusResult ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`find_filtered_shows: ${filteredResult ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (!radiusResult || !filteredResult) {
    console.log('\nPossible issues:');
    console.log('1. Database functions may not be properly deployed');
    console.log('2. RLS policies might be preventing access to the functions');
    console.log('3. There might be syntax errors in the function definitions');
    console.log('\nSuggested actions:');
    console.log('1. Check if the functions exist in the Supabase dashboard');
    console.log('2. Verify that the functions have the correct parameters');
    console.log('3. Make sure the functions have proper permissions (GRANT EXECUTE)');
  }
}

// Run the tests
runTests().catch(err => {
  console.error('Unhandled error during tests:', err);
});
