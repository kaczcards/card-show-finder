/**
 * test-la-shows.js
 * 
 * This script tests finding card shows near Los Angeles using both database functions
 * and simulates the HomeScreen.tsx logic for expanding search radius.
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

// Los Angeles coordinates
const losAngeles = {
  latitude: 34.0522,
  longitude: -118.2437,
  name: "Los Angeles"
};

// Date range (next 30 days)
const startDate = new Date(); // today
const endDate = new Date();
endDate.setDate(endDate.getDate() + 30); // 30 days from now

/**
 * Format a show object for display
 */
function formatShow(show) {
  return {
    id: show.id,
    title: show.title,
    location: show.location,
    address: show.address,
    startDate: new Date(show.start_date).toLocaleDateString(),
    endDate: new Date(show.end_date).toLocaleDateString(),
    entryFee: show.entry_fee,
    status: show.status,
    coordinates: show.coordinates,
    features: show.features,
    categories: show.categories
  };
}

/**
 * Test find_shows_within_radius function
 */
async function testFindShowsWithinRadius(location, radius) {
  console.log(`\n--- Testing find_shows_within_radius ---`);
  console.log(`Location: ${location.name} (${location.latitude}, ${location.longitude})`);
  console.log(`Radius: ${radius} miles`);
  
  try {
    const { data, error } = await supabase.rpc('find_shows_within_radius', {
      center_lat: location.latitude,
      center_lng: location.longitude,
      radius_miles: radius
    });
    
    if (error) {
      console.error('Error calling find_shows_within_radius:', error);
      return { success: false, shows: [], error };
    }
    
    console.log(`Success! Found ${data?.length || 0} shows within ${radius} miles.`);
    
    if (data && data.length > 0) {
      console.log('\nShows found:');
      data.forEach((show, index) => {
        console.log(`\n[${index + 1}] ${show.title}`);
        console.log(JSON.stringify(formatShow(show), null, 2));
      });
    } else {
      console.log('No shows found within the radius.');
    }
    
    return { success: true, shows: data || [], error: null };
  } catch (err) {
    console.error('Exception when calling find_shows_within_radius:', err);
    return { success: false, shows: [], error: err };
  }
}

/**
 * Test find_filtered_shows function
 */
async function testFindFilteredShows(location, radius) {
  console.log(`\n--- Testing find_filtered_shows ---`);
  console.log(`Location: ${location.name} (${location.latitude}, ${location.longitude})`);
  console.log(`Radius: ${radius} miles`);
  console.log(`Date range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
  
  try {
    const { data, error } = await supabase.rpc('find_filtered_shows', {
      center_lat: location.latitude,
      center_lng: location.longitude,
      radius_miles: radius,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      max_entry_fee: null,
      show_categories: null,
      show_features: null
    });
    
    if (error) {
      console.error('Error calling find_filtered_shows:', error);
      return { success: false, shows: [], error };
    }
    
    console.log(`Success! Found ${data?.length || 0} shows matching filters.`);
    
    if (data && data.length > 0) {
      console.log('\nShows found:');
      data.forEach((show, index) => {
        console.log(`\n[${index + 1}] ${show.title}`);
        console.log(JSON.stringify(formatShow(show), null, 2));
      });
    } else {
      console.log('No shows found matching the filters.');
    }
    
    return { success: true, shows: data || [], error: null };
  } catch (err) {
    console.error('Exception when calling find_filtered_shows:', err);
    return { success: false, shows: [], error: err };
  }
}

/**
 * Test HomeScreen expanded radius logic
 */
async function testExpandedRadiusLogic(location) {
  console.log(`\n--- Testing HomeScreen Expanded Radius Logic ---`);
  console.log(`Location: ${location.name} (${location.latitude}, ${location.longitude})`);
  
  // Initial radius (25 miles)
  const initialRadius = 25;
  console.log(`Step 1: Initial search with ${initialRadius} mile radius`);
  
  const initialResult = await testFindFilteredShows(location, initialRadius);
  
  // If no shows found, expand radius to 100 miles (like in HomeScreen.tsx)
  if (initialResult.success && initialResult.shows.length === 0) {
    const expandedRadius = 100;
    console.log(`\nStep 2: No shows found, expanding to ${expandedRadius} mile radius`);
    
    const expandedResult = await testFindFilteredShows(location, expandedRadius);
    
    if (expandedResult.success) {
      if (expandedResult.shows.length > 0) {
        console.log(`\n✅ Success! Found ${expandedResult.shows.length} shows after expanding radius.`);
        console.log('This confirms the expanded radius logic is working correctly.');
      } else {
        console.log('\n⚠️ No shows found even with expanded radius.');
        console.log('This suggests there might be no shows in this area or other filtering issues.');
      }
    }
    
    return expandedResult;
  } else {
    console.log('\nShows found with initial radius, no need to expand.');
    return initialResult;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Starting Los Angeles card show tests...');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Testing date range: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
  
  // First check if we can connect to Supabase
  try {
    const { data, error } = await supabase.from('shows').select('count');
    if (error) throw error;
    console.log('Successfully connected to Supabase!');
  } catch (err) {
    console.error('Failed to connect to Supabase:', err);
    return;
  }
  
  // Run the tests
  await testFindShowsWithinRadius(losAngeles, 25);
  await testFindFilteredShows(losAngeles, 25);
  await testExpandedRadiusLogic(losAngeles);
  
  // Test with a location that should have no shows to verify expansion
  const noShowsLocation = {
    latitude: 36.7783,
    longitude: -119.4179,
    name: "Fresno (should have no shows)"
  };
  
  console.log('\n\n========================================');
  console.log('TESTING WITH LOCATION THAT SHOULD HAVE NO SHOWS');
  console.log('========================================');
  
  await testExpandedRadiusLogic(noShowsLocation);
  
  console.log('\n\n========================================');
  console.log('TESTS COMPLETE');
  console.log('========================================');
}

// Run the tests
runTests().catch(err => {
  console.error('Unhandled error during tests:', err);
});
