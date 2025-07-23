/**
 * debug-app-exact.js
 * 
 * This script exactly mimics what the Card Show Finder app does to find shows.
 * It helps debug why no shows appear on the homepage despite the database function working.
 * 
 * Usage: node debug-app-exact.js
 */

// Load environment variables from .env file
require('dotenv').config();

// Import required packages
const { createClient } = require('@supabase/supabase-js');
const util = require('util');
const fs = require('fs');
const path = require('path');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERROR: Missing Supabase credentials in .env file');
  console.error('   Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are defined');
  process.exit(1);
}

// Create Supabase clients with different auth contexts
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

// Default location used in the app (if location services are disabled)
// This is usually a central US location or the last known location
const DEFAULT_APP_LOCATION = {
  latitude: 39.8283, // Approximate center of continental US
  longitude: -98.5795
};

// Common test locations that might be used by app users
const TEST_LOCATIONS = [
  { name: 'Los Angeles', latitude: 34.0522, longitude: -118.2437 },
  { name: 'New York City', latitude: 40.7128, longitude: -74.0060 },
  { name: 'Chicago', latitude: 41.8781, longitude: -87.6298 },
  { name: 'Miami', latitude: 25.7617, longitude: -80.1918 },
  { name: 'Dallas', latitude: 32.7767, longitude: -96.7970 },
  { name: 'San Francisco', latitude: 37.7749, longitude: -122.4194 },
  { name: 'Boston', latitude: 42.3601, longitude: -71.0589 },
  { name: 'Philadelphia', latitude: 39.9526, longitude: -75.1652 },
  { name: 'Carmel, IN', latitude: 39.9784, longitude: -86.1180 }, // From our previous test
  DEFAULT_APP_LOCATION
];

// Radius values to test (in miles)
const TEST_RADIUS_VALUES = [25, 50, 100, 250, 500, 1000];

// Status values to test
const TEST_STATUS_VALUES = ['ACTIVE', 'pending', null];

// Date ranges to test
const TEST_DATE_RANGES = [
  { name: 'Default (30 days)', startDate: new Date(), endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  { name: 'Next 90 days', startDate: new Date(), endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
  { name: 'Next 365 days', startDate: new Date(), endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
  { name: 'All future dates', startDate: new Date(), endDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000) }
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
 * Save results to a JSON file for later analysis
 */
function saveResults(data, filename) {
  const outputDir = path.join(__dirname, 'debug-output');
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`📝 Results saved to ${filePath}`);
}

/**
 * Test the get_paginated_shows function with exact app parameters
 */
async function testExactAppParameters() {
  console.log('\n🔍 Testing with EXACT app parameters...');
  
  // These are the exact parameters the app would use
  const appParams = {
    lat: DEFAULT_APP_LOCATION.latitude,
    lng: DEFAULT_APP_LOCATION.longitude,
    radius_miles: 25, // Default app radius
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    max_entry_fee: null,
    categories: null,
    features: null,
    page_size: 20,
    page: 1,
    status: 'ACTIVE'
  };
  
  console.log('App parameters:', appParams);
  
  try {
    // Call the function with the app parameters
    const { data, error } = await supabaseAnon.rpc(
      'get_paginated_shows',
      appParams
    );
    
    if (error) {
      console.error('❌ Error with exact app parameters:', error.message);
      return null;
    }
    
    // Check if we got results
    if (data && data.data && data.data.length > 0) {
      console.log(`✅ Success! Found ${data.data.length} shows with exact app parameters`);
      console.log(`📊 Total shows available: ${data.pagination.total_count}`);
      prettyPrint(data.data, 'Shows found');
    } else {
      console.log('❌ No shows found with exact app parameters');
      console.log('This matches the app behavior - no shows displayed');
    }
    
    return data;
  } catch (error) {
    console.error('❌ Unexpected error with exact app parameters:', error.message);
    return null;
  }
}

/**
 * Check what shows exist in the database
 */
async function checkExistingShows() {
  console.log('\n📋 Checking what shows exist in the database...');
  
  try {
    // Get all shows with service role (bypasses RLS)
    const { data: allShows, error: allError } = await supabaseService
      .from('shows')
      .select('*');
      
    if (allError) {
      console.error('❌ Error querying shows directly:', allError.message);
      return null;
    }
    
    console.log(`✅ Found ${allShows.length} total shows in the database`);
    
    // Count shows by status
    const showsByStatus = {};
    allShows.forEach(show => {
      const status = show.status || 'null';
      showsByStatus[status] = (showsByStatus[status] || 0) + 1;
    });
    
    console.log('📊 Shows by status:');
    Object.entries(showsByStatus).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    // Check for active shows with upcoming dates
    const now = new Date();
    const activeUpcomingShows = allShows.filter(show => 
      show.status === 'ACTIVE' && 
      new Date(show.end_date) >= now
    );
    
    console.log(`📆 Found ${activeUpcomingShows.length} ACTIVE shows with upcoming dates`);
    
    if (activeUpcomingShows.length > 0) {
      console.log('\nSample of ACTIVE upcoming shows:');
      activeUpcomingShows.slice(0, 5).forEach((show, index) => {
        console.log(`\nShow #${index + 1}:`);
        console.log(`  ID: ${show.id}`);
        console.log(`  Title: ${show.title}`);
        console.log(`  Location: ${show.location}`);
        console.log(`  Status: ${show.status}`);
        console.log(`  Start Date: ${new Date(show.start_date).toLocaleDateString()}`);
        console.log(`  End Date: ${new Date(show.end_date).toLocaleDateString()}`);
        
        // Extract coordinates if possible
        if (show.coordinates) {
          try {
            // Try to extract coordinates from PostGIS format
            const { data, error } = supabaseService.rpc('exec_sql', {
              sql_string: `SELECT 
                ST_X(('${show.coordinates}')::geometry) as longitude,
                ST_Y(('${show.coordinates}')::geometry) as latitude
              `
            });
            
            if (!error && data && data.length > 0) {
              console.log(`  Coordinates: ${data[0].latitude}, ${data[0].longitude}`);
            } else {
              console.log(`  Coordinates (raw): ${show.coordinates}`);
            }
          } catch (e) {
            console.log(`  Coordinates (raw): ${show.coordinates}`);
          }
        } else {
          console.log('  ❌ No coordinates');
        }
      });
      
      // Save all active upcoming shows for analysis
      saveResults(activeUpcomingShows, 'active_upcoming_shows.json');
    }
    
    return { allShows, activeUpcomingShows };
  } catch (error) {
    console.error('❌ Unexpected error checking existing shows:', error.message);
    return null;
  }
}

/**
 * Test with different status values
 */
async function testDifferentStatusValues() {
  console.log('\n🔄 Testing with different status values...');
  
  const results = {};
  
  for (const status of TEST_STATUS_VALUES) {
    console.log(`\nTesting status: ${status || 'null (all)'}`);
    
    try {
      const { data, error } = await supabaseAnon.rpc(
        'get_paginated_shows',
        {
          lat: DEFAULT_APP_LOCATION.latitude,
          lng: DEFAULT_APP_LOCATION.longitude,
          radius_miles: 1000, // Large radius to find any shows
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
          page_size: 100,
          page: 1,
          status: status
        }
      );
      
      if (error) {
        console.error(`❌ Error with status ${status}:`, error.message);
        continue;
      }
      
      if (data && data.data && data.data.length > 0) {
        console.log(`✅ Found ${data.data.length} shows with status ${status || 'null'}`);
        console.log(`  Total available: ${data.pagination.total_count}`);
        results[status || 'null'] = data;
      } else {
        console.log(`❌ No shows found with status ${status || 'null'}`);
      }
    } catch (error) {
      console.error(`❌ Unexpected error with status ${status}:`, error.message);
    }
  }
  
  return results;
}

/**
 * Test with different locations and radiuses
 */
async function testLocationsAndRadiuses() {
  console.log('\n🌎 Testing different locations and radiuses...');
  
  const results = {};
  
  for (const location of TEST_LOCATIONS) {
    console.log(`\nTesting location: ${location.name || 'Custom'}`);
    
    for (const radius of TEST_RADIUS_VALUES) {
      console.log(`  Radius: ${radius} miles`);
      
      try {
        const { data, error } = await supabaseAnon.rpc(
          'get_paginated_shows',
          {
            lat: location.latitude,
            lng: location.longitude,
            radius_miles: radius,
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
            page_size: 100,
            page: 1,
            status: 'ACTIVE'
          }
        );
        
        if (error) {
          console.error(`  ❌ Error with radius ${radius}:`, error.message);
          continue;
        }
        
        if (data && data.data && data.data.length > 0) {
          console.log(`  ✅ Found ${data.data.length} shows within ${radius} miles of ${location.name || 'Custom'}`);
          console.log(`    Total available: ${data.pagination.total_count}`);
          
          // Save the first successful result
          if (!results[location.name]) {
            results[location.name] = { radius, data };
          }
          
          // No need to test larger radiuses if we found shows
          break;
        } else {
          console.log(`  ❌ No shows found within ${radius} miles of ${location.name || 'Custom'}`);
        }
      } catch (error) {
        console.error(`  ❌ Unexpected error with radius ${radius}:`, error.message);
      }
    }
  }
  
  // Save successful results
  if (Object.keys(results).length > 0) {
    saveResults(results, 'successful_locations.json');
  }
  
  return results;
}

/**
 * Test with different date ranges
 */
async function testDateRanges() {
  console.log('\n📅 Testing different date ranges...');
  
  const results = {};
  
  for (const dateRange of TEST_DATE_RANGES) {
    console.log(`\nTesting date range: ${dateRange.name}`);
    
    try {
      const { data, error } = await supabaseAnon.rpc(
        'get_paginated_shows',
        {
          lat: DEFAULT_APP_LOCATION.latitude,
          lng: DEFAULT_APP_LOCATION.longitude,
          radius_miles: 1000, // Large radius to find any shows
          start_date: dateRange.startDate.toISOString(),
          end_date: dateRange.endDate.toISOString(),
          page_size: 100,
          page: 1,
          status: 'ACTIVE'
        }
      );
      
      if (error) {
        console.error(`❌ Error with date range ${dateRange.name}:`, error.message);
        continue;
      }
      
      if (data && data.data && data.data.length > 0) {
        console.log(`✅ Found ${data.data.length} shows with date range ${dateRange.name}`);
        console.log(`  Total available: ${data.pagination.total_count}`);
        results[dateRange.name] = data;
      } else {
        console.log(`❌ No shows found with date range ${dateRange.name}`);
      }
    } catch (error) {
      console.error(`❌ Unexpected error with date range ${dateRange.name}:`, error.message);
    }
  }
  
  return results;
}

/**
 * Test with pending shows to see if they should be ACTIVE
 */
async function testPendingShows() {
  console.log('\n🔍 Testing if pending shows should be ACTIVE...');
  
  try {
    // Get all pending shows
    const { data: pendingShows, error } = await supabaseService
      .from('shows')
      .select('*')
      .eq('status', 'pending');
      
    if (error) {
      console.error('❌ Error querying pending shows:', error.message);
      return null;
    }
    
    console.log(`Found ${pendingShows.length} pending shows`);
    
    // Check which pending shows have upcoming dates
    const now = new Date();
    const upcomingPendingShows = pendingShows.filter(show => 
      new Date(show.end_date) >= now
    );
    
    console.log(`📆 ${upcomingPendingShows.length} pending shows have upcoming dates`);
    
    if (upcomingPendingShows.length > 0) {
      console.log('\nSample of upcoming pending shows that could be activated:');
      upcomingPendingShows.slice(0, 5).forEach((show, index) => {
        console.log(`\nShow #${index + 1}:`);
        console.log(`  ID: ${show.id}`);
        console.log(`  Title: ${show.title}`);
        console.log(`  Location: ${show.location}`);
        console.log(`  Start Date: ${new Date(show.start_date).toLocaleDateString()}`);
        console.log(`  End Date: ${new Date(show.end_date).toLocaleDateString()}`);
      });
      
      // Save upcoming pending shows for potential activation
      saveResults(upcomingPendingShows, 'upcoming_pending_shows.json');
    }
    
    return { pendingShows, upcomingPendingShows };
  } catch (error) {
    console.error('❌ Unexpected error testing pending shows:', error.message);
    return null;
  }
}

/**
 * Update show status to ACTIVE (if needed)
 */
async function activateShow(showId) {
  console.log(`\n🔄 Attempting to activate show ${showId}...`);
  
  try {
    const { data, error } = await supabaseService
      .from('shows')
      .update({ status: 'ACTIVE' })
      .eq('id', showId)
      .select();
      
    if (error) {
      console.error('❌ Error activating show:', error.message);
      return false;
    }
    
    console.log('✅ Show activated successfully!');
    console.log('Updated show details:');
    prettyPrint(data[0]);
    
    return true;
  } catch (error) {
    console.error('❌ Unexpected error activating show:', error.message);
    return false;
  }
}

/**
 * Test if the app's exact query would return results
 */
async function testAppExactQuery() {
  console.log('\n📱 Testing the app\'s exact query...');
  
  try {
    // This is the exact query from the app's useInfiniteShows hook
    const { data, error } = await supabaseAnon.rpc(
      'get_paginated_shows',
      {
        lat: DEFAULT_APP_LOCATION.latitude,
        lng: DEFAULT_APP_LOCATION.longitude,
        radius_miles: 25,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        max_entry_fee: null,
        categories: null,
        features: null,
        page_size: 20,
        page: 1,
        status: 'ACTIVE'
      }
    );
    
    if (error) {
      console.error('❌ Error with app exact query:', error.message);
      return null;
    }
    
    if (data && data.data && data.data.length > 0) {
      console.log(`✅ App query would return ${data.data.length} shows`);
      console.log(`  Total available: ${data.pagination.total_count}`);
      return data;
    } else {
      console.log('❌ App query returns 0 shows - matches app behavior');
      return null;
    }
  } catch (error) {
    console.error('❌ Unexpected error with app exact query:', error.message);
    return null;
  }
}

/**
 * Main function to run all tests
 */
async function main() {
  console.log('🔍 Starting comprehensive app debugging...');
  console.log(`🔗 Connected to Supabase: ${supabaseUrl}`);
  
  // First check what shows exist in the database
  const existingShows = await checkExistingShows();
  
  // Test with exact app parameters
  await testExactAppParameters();
  
  // Test with different status values
  await testDifferentStatusValues();
  
  // Test with different locations and radiuses
  const locationResults = await testLocationsAndRadiuses();
  
  // Test with different date ranges
  await testDateRanges();
  
  // Check pending shows
  const pendingResults = await testPendingShows();
  
  // Test app's exact query
  await testAppExactQuery();
  
  // Provide recommendations
  console.log('\n📋 Summary and Recommendations:');
  
  if (existingShows && existingShows.activeUpcomingShows.length === 0) {
    console.log('🚨 CRITICAL ISSUE: No ACTIVE shows with upcoming dates found in the database');
    console.log('This explains why no shows appear in the app');
    
    if (pendingResults && pendingResults.upcomingPendingShows.length > 0) {
      console.log('\n✅ SOLUTION: Activate some pending shows');
      console.log(`There are ${pendingResults.upcomingPendingShows.length} pending shows with upcoming dates`);
      console.log('To activate a show, run this SQL in Supabase:');
      console.log(`UPDATE public.shows SET status = 'ACTIVE' WHERE id = '[SHOW_ID]';`);
      
      // Offer to activate a show
      if (pendingResults.upcomingPendingShows.length > 0) {
        const showToActivate = pendingResults.upcomingPendingShows[0];
        console.log(`\nWould you like to activate this show?`);
        console.log(`  Title: ${showToActivate.title}`);
        console.log(`  Location: ${showToActivate.location}`);
        console.log(`  Start Date: ${new Date(showToActivate.start_date).toLocaleDateString()}`);
        console.log(`  ID: ${showToActivate.id}`);
        console.log('\nTo activate, run:');
        console.log(`node debug-app-exact.js --activate ${showToActivate.id}`);
      }
    }
  } else if (Object.keys(locationResults).length > 0) {
    console.log('✅ Shows were found with some location/radius combinations');
    console.log('The issue may be that the app is using a location where no shows are nearby');
    console.log('\nRecommendations:');
    console.log('1. Increase the default radius in the app (currently 25 miles)');
    console.log('2. Add shows in more locations');
    console.log('3. Make sure the app is using accurate location services');
  } else {
    console.log('❌ No shows found with any combination of parameters');
    console.log('This suggests there might be deeper issues with:');
    console.log('1. Show data in the database');
    console.log('2. Coordinate format or conversion');
    console.log('3. Date range filtering');
  }
  
  console.log('\n✅ Debugging complete!');
  
  // Check if we should activate a show
  if (process.argv.includes('--activate') && process.argv.length > 3) {
    const showId = process.argv[3];
    await activateShow(showId);
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
