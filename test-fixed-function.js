/**
 * test-fixed-function.js
 * 
 * This script tests the get_paginated_shows function after applying the fix.
 * It verifies that shows are returned with proper coordinates.
 * 
 * Usage: node test-fixed-function.js
 */

// Load environment variables from .env file
require('dotenv').config();

// Import required packages
const { createClient } = require('@supabase/supabase-js');
const util = require('util');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERROR: Missing Supabase credentials in .env file');
  console.error('   Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are defined');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test locations to try
const TEST_LOCATIONS = [
  { name: 'Los Angeles', latitude: 34.0522, longitude: -118.2437, radius: 50 },
  { name: 'New York City', latitude: 40.7128, longitude: -74.0060, radius: 50 },
  { name: 'Chicago', latitude: 41.8781, longitude: -87.6298, radius: 50 },
  { name: 'Miami', latitude: 25.7617, longitude: -80.1918, radius: 50 },
  { name: 'Dallas', latitude: 32.7767, longitude: -96.7970, radius: 50 },
  // Add more locations to increase chances of finding shows
];

/**
 * Pretty print an object with colors and indentation
 */
function prettyPrint(obj, label = '') {
  if (label) {
    console.log(`\n\x1b[1;36m${label}:\x1b[0m`);
  }
  console.log(util.inspect(obj, { colors: true, depth: 4 }));
}

/**
 * Test the get_paginated_shows function with a specific location
 */
async function testLocation(location) {
  console.log(`\n🔍 Testing location: ${location.name}`);
  console.log(`📍 Coordinates: ${location.latitude}, ${location.longitude} (${location.radius} mile radius)`);
  
  try {
    // Call the function with the test location
    const { data, error } = await supabase.rpc(
      'get_paginated_shows',
      {
        lat: location.latitude,
        lng: location.longitude,
        radius_miles: location.radius,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        max_entry_fee: null,
        categories: null,
        features: null,
        page_size: 10,
        page: 1,
        status: 'ACTIVE'
      }
    );
    
    if (error) {
      console.error(`❌ Error with ${location.name}:`, error.message);
      return null;
    }
    
    // Check if we got results
    if (data && data.data && data.data.length > 0) {
      console.log(`✅ Success! Found ${data.data.length} shows near ${location.name}`);
      console.log(`📊 Total shows available: ${data.pagination.total_count}`);
      
      // Print first show details to verify coordinates are correct
      const firstShow = data.data[0];
      console.log('\nFirst show details:');
      console.log(`  Title: ${firstShow.title}`);
      console.log(`  Location: ${firstShow.location}`);
      console.log(`  Start Date: ${new Date(firstShow.start_date).toLocaleDateString()}`);
      console.log(`  Distance: ${firstShow.distance_miles.toFixed(2)} miles`);
      
      // Verify coordinates are properly extracted
      if (typeof firstShow.latitude === 'number' && typeof firstShow.longitude === 'number') {
        console.log(`  ✅ Coordinates extracted correctly: ${firstShow.latitude}, ${firstShow.longitude}`);
      } else {
        console.log(`  ❌ Coordinates not properly extracted`);
        if (firstShow.coordinates) {
          console.log(`  Raw coordinates:`, firstShow.coordinates);
        }
      }
      
      return data;
    } else {
      console.log(`ℹ️ No shows found near ${location.name}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Unexpected error testing ${location.name}:`, error.message);
    return null;
  }
}

/**
 * Test with various radius values at a single location
 */
async function testRadiusVariations(location) {
  console.log(`\n🔍 Testing different radius values at ${location.name}`);
  
  const radiusValues = [10, 25, 50, 100, 250];
  
  for (const radius of radiusValues) {
    console.log(`\nTrying ${radius} mile radius...`);
    
    try {
      const { data, error } = await supabase.rpc(
        'get_paginated_shows',
        {
          lat: location.latitude,
          lng: location.longitude,
          radius_miles: radius,
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          page_size: 5,
          page: 1,
        }
      );
      
      if (error) {
        console.error(`❌ Error with ${radius} mile radius:`, error.message);
        continue;
      }
      
      if (data && data.data && data.data.length > 0) {
        console.log(`✅ Found ${data.data.length} shows within ${radius} miles`);
        console.log(`  Total available: ${data.pagination.total_count}`);
      } else {
        console.log(`ℹ️ No shows found within ${radius} miles`);
      }
    } catch (error) {
      console.error(`❌ Unexpected error with ${radius} mile radius:`, error.message);
    }
  }
}

/**
 * Main function to run all tests
 */
async function main() {
  console.log('🧪 Starting get_paginated_shows function test...');
  console.log(`🔗 Connected to Supabase: ${supabaseUrl}`);
  
  // Test each location
  let foundShowsAtAnyLocation = false;
  
  for (const location of TEST_LOCATIONS) {
    const result = await testLocation(location);
    if (result && result.data && result.data.length > 0) {
      foundShowsAtAnyLocation = true;
      
      // If we found shows at this location, test different radius values
      await testRadiusVariations(location);
      
      // Print full details of first show to verify all data is correct
      console.log('\n📋 Full details of first show:');
      prettyPrint(result.data[0]);
      
      // No need to test more locations if we've found shows
      break;
    }
  }
  
  if (!foundShowsAtAnyLocation) {
    console.log('\n⚠️ No shows found at any test location.');
    console.log('This could be because:');
    console.log('1. There are no ACTIVE shows in the database');
    console.log('2. Shows exist but are outside the test radiuses');
    console.log('3. Shows exist but have dates outside the test range');
    console.log('4. The function is still not working correctly');
    
    // Try with a very large radius as a last resort
    console.log('\n🌎 Trying with a very large radius (1000 miles) from US center...');
    
    const { data, error } = await supabase.rpc(
      'get_paginated_shows',
      {
        lat: 39.8283, // Approximate center of continental US
        lng: -98.5795,
        radius_miles: 1000,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        page_size: 10,
        page: 1,
      }
    );
    
    if (error) {
      console.error('❌ Error with large radius test:', error.message);
    } else if (data && data.data && data.data.length > 0) {
      console.log(`✅ Found ${data.data.length} shows with large radius!`);
      console.log('First show:');
      console.log(`  Title: ${data.data[0].title}`);
      console.log(`  Location: ${data.data[0].location}`);
      console.log(`  Coordinates: ${data.data[0].latitude}, ${data.data[0].longitude}`);
      console.log(`  Distance: ${data.data[0].distance_miles.toFixed(2)} miles`);
    } else {
      console.log('❌ No shows found even with very large radius.');
      console.log('The database might not contain any ACTIVE shows.');
    }
  }
  
  console.log('\n✅ Testing complete!');
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
