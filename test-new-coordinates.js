/**
 * test-new-coordinates.js
 * 
 * This script tests the new fallback coordinates used in HomeScreen.
 * It verifies that shows will appear with the Carmel, IN coordinates
 * and a 50 mile radius - exactly what the app will use as fallback.
 * 
 * Usage: node test-new-coordinates.js
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

// Create Supabase client - using anon key to simulate real app usage
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// HomeScreen's new fallback coordinates (Carmel, IN)
const FALLBACK_COORDINATES = {
  latitude: 39.9784,
  longitude: -86.118
};

// HomeScreen's default radius (updated to 50 miles)
const DEFAULT_RADIUS = 50;

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
 * Format a date for display
 */
function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Test the exact parameters that HomeScreen will use
 */
async function testHomeScreenFallback() {
  console.log('\n🔍 TESTING HOMESCREEN FALLBACK PARAMETERS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Location: Carmel, IN (${FALLBACK_COORDINATES.latitude}, ${FALLBACK_COORDINATES.longitude})`);
  console.log(`🔍 Radius: ${DEFAULT_RADIUS} miles`);
  console.log(`📅 Date Range: Next 30 days (default)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // These are the exact parameters HomeScreen uses
  const params = {
    lat: FALLBACK_COORDINATES.latitude,
    lng: FALLBACK_COORDINATES.longitude,
    radius_miles: DEFAULT_RADIUS,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    max_entry_fee: null,
    categories: null,
    features: null,
    page_size: 20,
    page: 1,
    status: 'ACTIVE'
  };
  
  try {
    console.log('Calling get_paginated_shows with HomeScreen parameters...');
    
    // Call the function with the exact parameters HomeScreen uses
    const { data, error } = await supabase.rpc(
      'get_paginated_shows',
      params
    );
    
    if (error) {
      console.error('\n❌ ERROR: Function call failed!');
      console.error(`   ${error.message}`);
      console.error('\nThis means the app will NOT display shows on the homepage!');
      return false;
    }
    
    // Check if we got results
    if (data && data.data && data.data.length > 0) {
      console.log('\n✅ SUCCESS! Found shows with HomeScreen fallback parameters');
      console.log(`📊 Total shows available: ${data.pagination.total_count}`);
      console.log(`📊 Shows on first page: ${data.data.length}`);
      
      // Display a summary of each show
      console.log('\n📋 SHOWS THAT WILL APPEAR ON HOMEPAGE:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      data.data.forEach((show, index) => {
        console.log(`\n🎫 SHOW #${index + 1}: ${show.title}`);
        console.log(`   📍 Location: ${show.location}`);
        console.log(`   📅 Date: ${formatDate(show.start_date)}`);
        console.log(`   💰 Entry Fee: $${show.entry_fee || 'Free'}`);
        console.log(`   🧭 Distance: ${show.distance_miles.toFixed(1)} miles`);
        
        // Verify coordinates are properly extracted
        if (typeof show.latitude === 'number' && typeof show.longitude === 'number') {
          console.log(`   🌎 Coordinates: ${show.latitude.toFixed(4)}, ${show.longitude.toFixed(4)}`);
        } else {
          console.log('   ⚠️ Warning: Coordinates not properly extracted');
        }
      });
      
      console.log('\n🎉 THE FIX WORKED! Users will see these shows on the homepage.');
      console.log('   The app should now display shows properly without requiring location permissions.');
      
      return true;
    } else {
      console.log('\n⚠️ WARNING: No shows found with HomeScreen fallback parameters');
      console.log('This means the app will show "No upcoming shows found" on the homepage.');
      console.log('\nPossible reasons:');
      console.log('1. There are no ACTIVE shows within 50 miles of Carmel, IN');
      console.log('2. All shows in that area are outside the next 30 days');
      console.log('3. The database function is still not working correctly');
      
      console.log('\nRecommendations:');
      console.log('1. Try increasing the radius in HomeScreen');
      console.log('2. Add more shows in the database near the fallback location');
      console.log('3. Change the fallback coordinates to a location with more shows');
      
      return false;
    }
  } catch (error) {
    console.error('\n❌ FATAL ERROR:');
    console.error(error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🧪 TESTING NEW HOMESCREEN FALLBACK COORDINATES');
  console.log(`🔗 Connected to Supabase: ${supabaseUrl}`);
  
  const success = await testHomeScreenFallback();
  
  if (success) {
    console.log('\n✅ TEST PASSED: HomeScreen will display shows with the new fallback coordinates!');
  } else {
    console.log('\n❌ TEST FAILED: HomeScreen may still show no results with the new fallback coordinates.');
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
