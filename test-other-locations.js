/**
 * test-other-locations.js
 * 
 * A script to test if card shows can be found at various locations across the US
 * with different radius settings. This helps determine if the issue is with
 * specific locations or with the query/database functions.
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

// Define test locations across the US
const testLocations = [
  { name: "New York City", latitude: 40.7128, longitude: -74.0060 },
  { name: "Los Angeles", latitude: 34.0522, longitude: -118.2437 },
  { name: "Chicago", latitude: 41.8781, longitude: -87.6298 },
  { name: "Houston", latitude: 29.7604, longitude: -95.3698 },
  { name: "Phoenix", latitude: 33.4484, longitude: -112.0740 },
  { name: "Philadelphia", latitude: 39.9526, longitude: -75.1652 },
  { name: "San Antonio", latitude: 29.4241, longitude: -98.4936 },
  { name: "Dallas", latitude: 32.7767, longitude: -96.7970 },
  { name: "Indianapolis", latitude: 39.7684, longitude: -86.1581 }, // Close to 46060 ZIP
  { name: "Columbus", latitude: 39.9612, longitude: -82.9988 }
];

// Test radii in miles
const testRadii = [25, 100];

// Date range (next 30 days)
const startDate = new Date(); // today
const endDate = new Date();
endDate.setDate(endDate.getDate() + 30); // 30 days from now

/**
 * Test find_shows_within_radius for a specific location and radius
 */
async function testLocationWithRadius(location, radiusMiles) {
  try {
    const { data, error } = await supabase.rpc('find_shows_within_radius', {
      center_lat: location.latitude,
      center_lng: location.longitude,
      radius_miles: radiusMiles
    });
    
    if (error) {
      console.error(`Error for ${location.name} at ${radiusMiles} miles:`, error);
      return { success: false, count: 0, error: error.message };
    }
    
    return { 
      success: true, 
      count: data?.length || 0,
      shows: data && data.length > 0 ? data.map(show => ({
        id: show.id,
        title: show.title,
        location: show.location
      })) : []
    };
  } catch (err) {
    console.error(`Exception for ${location.name} at ${radiusMiles} miles:`, err);
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Test find_filtered_shows for a specific location and radius with date range
 */
async function testLocationWithFilters(location, radiusMiles) {
  try {
    const { data, error } = await supabase.rpc('find_filtered_shows', {
      center_lat: location.latitude,
      center_lng: location.longitude,
      radius_miles: radiusMiles,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      max_entry_fee: null,
      show_categories: null,
      show_features: null
    });
    
    if (error) {
      console.error(`Error for ${location.name} at ${radiusMiles} miles with filters:`, error);
      return { success: false, count: 0, error: error.message };
    }
    
    return { 
      success: true, 
      count: data?.length || 0,
      shows: data && data.length > 0 ? data.map(show => ({
        id: show.id,
        title: show.title,
        location: show.location,
        startDate: show.start_date,
        endDate: show.end_date
      })) : []
    };
  } catch (err) {
    console.error(`Exception for ${location.name} at ${radiusMiles} miles with filters:`, err);
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Run tests for all locations and radii
 */
async function runTests() {
  console.log('Starting location tests...');
  console.log(`Testing ${testLocations.length} locations with ${testRadii.length} different radii`);
  console.log(`Date range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
  console.log('-----------------------------------------------------------');
  
  // First check if we can connect to Supabase
  try {
    const { data, error } = await supabase.from('shows').select('count');
    if (error) throw error;
    console.log('Successfully connected to Supabase!');
  } catch (err) {
    console.error('Failed to connect to Supabase:', err);
    return;
  }
  
  // Track results for summary
  const results = [];
  
  // Test each location with each radius
  for (const location of testLocations) {
    console.log(`\nTesting location: ${location.name} (${location.latitude}, ${location.longitude})`);
    
    for (const radius of testRadii) {
      console.log(`\n  Testing with ${radius} mile radius:`);
      
      // Test basic radius search
      console.log(`    - Basic radius search (find_shows_within_radius):`);
      const radiusResult = await testLocationWithRadius(location, radius);
      console.log(`      Found ${radiusResult.count} shows`);
      if (radiusResult.count > 0) {
        console.log('      First few shows:');
        radiusResult.shows.slice(0, 3).forEach(show => {
          console.log(`      • ${show.title} at ${show.location}`);
        });
      }
      
      // Test filtered search with dates
      console.log(`    - Filtered search with dates (find_filtered_shows):`);
      const filteredResult = await testLocationWithFilters(location, radius);
      console.log(`      Found ${filteredResult.count} shows in the next 30 days`);
      if (filteredResult.count > 0) {
        console.log('      First few shows:');
        filteredResult.shows.slice(0, 3).forEach(show => {
          console.log(`      • ${show.title} at ${show.location}`);
        });
      }
      
      // Save results for summary
      results.push({
        location: location.name,
        radius,
        radiusCount: radiusResult.count,
        filteredCount: filteredResult.count
      });
    }
  }
  
  // Print summary table
  console.log('\n\n-----------------------------------------------------------');
  console.log('SUMMARY OF RESULTS');
  console.log('-----------------------------------------------------------');
  console.log('Location            | 25 Miles | 25 Miles | 100 Miles | 100 Miles');
  console.log('                    | (Basic)  | (Filtered)| (Basic)  | (Filtered)');
  console.log('-----------------------------------------------------------');
  
  for (const location of testLocations) {
    const locationResults = results.filter(r => r.location === location.name);
    const r25Basic = locationResults.find(r => r.radius === 25)?.radiusCount || 0;
    const r25Filtered = locationResults.find(r => r.radius === 25)?.filteredCount || 0;
    const r100Basic = locationResults.find(r => r.radius === 100)?.radiusCount || 0;
    const r100Filtered = locationResults.find(r => r.radius === 100)?.filteredCount || 0;
    
    // Format location name to fixed width
    const locName = location.name.padEnd(20, ' ').substring(0, 20);
    console.log(`${locName}| ${r25Basic.toString().padStart(8, ' ')} | ${r25Filtered.toString().padStart(9, ' ')} | ${r100Basic.toString().padStart(8, ' ')} | ${r100Filtered.toString().padStart(9, ' ')}`);
  }
  
  // Analyze results
  const anyShowsFound = results.some(r => r.radiusCount > 0 || r.filteredCount > 0);
  const widerRadiusHelps = results.some(r => 
    (r.radius === 100 && r.radiusCount > 0) && 
    results.some(r2 => r2.location === r.location && r2.radius === 25 && r2.radiusCount === 0)
  );
  
  console.log('\n-----------------------------------------------------------');
  console.log('ANALYSIS');
  console.log('-----------------------------------------------------------');
  
  if (!anyShowsFound) {
    console.log('❌ No shows found at any location or radius!');
    console.log('   This suggests a potential issue with:');
    console.log('   1. The database functions not working correctly');
    console.log('   2. No active shows in the database');
    console.log('   3. Permission/RLS issues preventing access to show data');
  } else if (widerRadiusHelps) {
    console.log('✅ Shows found at some locations with wider radius!');
    console.log('   This suggests the issue might be that:');
    console.log('   1. The default 25-mile radius is too small for your data');
    console.log('   2. Shows exist but are not near the user\'s location');
  } else {
    console.log('✅ Shows found at some locations!');
    console.log('   This suggests the issue might be that:');
    console.log('   1. The user\'s location is not near any shows');
    console.log('   2. There might be an issue with how coordinates are being resolved');
  }
  
  console.log('\nRecommended next steps:');
  console.log('1. Check if the shows in the database have correct coordinates');
  console.log('2. Verify that the user\'s ZIP code is being correctly geocoded');
  console.log('3. Consider increasing the default radius in the app');
  console.log('4. Add more detailed logging to the app to track the exact query parameters');
}

// Run the tests
runTests().catch(err => {
  console.error('Unhandled error during tests:', err);
});
