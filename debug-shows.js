/**
 * debug-shows.js
 * 
 * This script helps debug issues with shows not appearing in the app.
 * It tests various queries and RPC functions to identify potential problems.
 * 
 * Usage: node debug-shows.js
 */

// Load environment variables from .env file
require('dotenv').config();

// Import required packages
const { createClient } = require('@supabase/supabase-js');
const util = require('util');

// Sample coordinates (Los Angeles, CA)
const SAMPLE_LOCATION = {
  latitude: 34.0522,
  longitude: -118.2437,
  radius: 50 // miles
};

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

// Test users for RLS testing
const TEST_USERS = [
  { email: 'test@example.com', password: 'password123' },
  // Add more test users if needed
];

/**
 * Pretty print an object with colors and indentation
 */
function prettyPrint(obj, label = '') {
  if (label) {
    console.log(`\n\x1b[1;36m${label}:\x1b[0m`);
  }
  console.log(util.inspect(obj, { colors: true, depth: null }));
}

/**
 * Test a basic count query to see how many shows exist
 */
async function testShowCount() {
  console.log('\n🔢 Testing basic show count...');
  
  try {
    // Test with service role (bypasses RLS)
    const { count: serviceCount, error: serviceError } = await supabaseService
      .from('shows')
      .select('*', { count: 'exact', head: true });
      
    if (serviceError) {
      console.error('❌ Error counting shows with service role:', serviceError.message);
    } else {
      console.log(`✅ Total shows in database (service role): ${serviceCount}`);
    }
    
    // Test with anonymous role (subject to RLS)
    const { count: anonCount, error: anonError } = await supabaseAnon
      .from('shows')
      .select('*', { count: 'exact', head: true });
      
    if (anonError) {
      console.error('❌ Error counting shows with anonymous role:', anonError.message);
    } else {
      console.log(`✅ Total shows visible to anonymous users: ${anonCount}`);
    }
    
    // Check for active shows only
    const { count: activeCount, error: activeError } = await supabaseService
      .from('shows')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE');
      
    if (activeError) {
      console.error('❌ Error counting active shows:', activeError.message);
    } else {
      console.log(`✅ Total ACTIVE shows in database: ${activeCount}`);
    }
    
    return { serviceCount, anonCount, activeCount };
  } catch (error) {
    console.error('❌ Unexpected error in testShowCount:', error.message);
    return { serviceCount: 0, anonCount: 0, activeCount: 0 };
  }
}

/**
 * Test the get_paginated_shows RPC function
 */
async function testGetPaginatedShows() {
  console.log('\n🔍 Testing get_paginated_shows RPC function...');
  
  try {
    // Test with service role first
    console.log('Testing with service role...');
    const { data: serviceData, error: serviceError } = await supabaseService.rpc(
      'get_paginated_shows',
      {
        lat: SAMPLE_LOCATION.latitude,
        lng: SAMPLE_LOCATION.longitude,
        radius_miles: SAMPLE_LOCATION.radius,
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
    
    if (serviceError) {
      console.error('❌ Error calling get_paginated_shows with service role:', serviceError.message);
      
      // Check if it's a parameter name issue
      console.log('Trying with alternative parameter names (long instead of lng)...');
      const { data: altData, error: altError } = await supabaseService.rpc(
        'get_paginated_shows',
        {
          lat: SAMPLE_LOCATION.latitude,
          long: SAMPLE_LOCATION.longitude, // Try with 'long' instead of 'lng'
          radius_miles: SAMPLE_LOCATION.radius,
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
      
      if (altError) {
        console.error('❌ Alternative parameter names also failed:', altError.message);
      } else {
        console.log('✅ Alternative parameter names worked!');
        prettyPrint(altData, 'Results with alternative parameter names');
      }
    } else {
      console.log('✅ RPC call successful with service role');
      prettyPrint(serviceData, 'Service role results');
      
      if (serviceData && serviceData.data) {
        console.log(`📊 Found ${serviceData.data.length} shows with service role`);
      }
    }
    
    // Test with anonymous role
    console.log('\nTesting with anonymous role...');
    const { data: anonData, error: anonError } = await supabaseAnon.rpc(
      'get_paginated_shows',
      {
        lat: SAMPLE_LOCATION.latitude,
        lng: SAMPLE_LOCATION.longitude,
        radius_miles: SAMPLE_LOCATION.radius,
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
    
    if (anonError) {
      console.error('❌ Error calling get_paginated_shows with anonymous role:', anonError.message);
    } else {
      console.log('✅ RPC call successful with anonymous role');
      prettyPrint(anonData, 'Anonymous role results');
      
      if (anonData && anonData.data) {
        console.log(`📊 Found ${anonData.data.length} shows with anonymous role`);
      }
    }
    
    return { serviceData, anonData };
  } catch (error) {
    console.error('❌ Unexpected error in testGetPaginatedShows:', error.message);
    return { serviceData: null, anonData: null };
  }
}

/**
 * Test direct queries to the shows table
 */
async function testDirectShowsQuery() {
  console.log('\n📋 Testing direct queries to shows table...');
  
  try {
    // Get all shows with service role
    const { data: allShows, error: allError } = await supabaseService
      .from('shows')
      .select('*')
      .limit(5);
      
    if (allError) {
      console.error('❌ Error querying shows directly:', allError.message);
    } else {
      console.log(`✅ Successfully queried shows table directly`);
      console.log(`📊 Sample of ${allShows.length} shows:`);
      
      // Print summary of each show
      allShows.forEach((show, index) => {
        console.log(`\nShow #${index + 1}:`);
        console.log(`  ID: ${show.id}`);
        console.log(`  Title: ${show.title}`);
        console.log(`  Location: ${show.location}`);
        console.log(`  Status: ${show.status}`);
        console.log(`  Start Date: ${new Date(show.start_date).toLocaleDateString()}`);
        console.log(`  Coordinates: ${JSON.stringify(show.coordinates)}`);
        
        // Check if coordinates are in the expected format
        if (show.coordinates) {
          if (typeof show.coordinates === 'object' && show.coordinates.coordinates) {
            console.log('  ⚠️ Coordinates in PostGIS format, may need conversion in client');
          } else if (typeof show.latitude === 'number' && typeof show.longitude === 'number') {
            console.log('  ✅ Coordinates in flat format (latitude/longitude)');
          } else {
            console.log('  ❌ Unexpected coordinates format');
          }
        } else {
          console.log('  ❌ Missing coordinates');
        }
      });
    }
    
    // Test proximity query
    console.log('\nTesting direct proximity query...');
    const { data: nearbyShows, error: nearbyError } = await supabaseService.rpc(
      'nearby_shows',
      {
        lat: SAMPLE_LOCATION.latitude,
        long: SAMPLE_LOCATION.longitude,
        radius_miles: SAMPLE_LOCATION.radius
      }
    );
    
    if (nearbyError) {
      console.error('❌ Error with nearby_shows function:', nearbyError.message);
      
      // Try alternative parameter name
      const { data: altNearbyShows, error: altNearbyError } = await supabaseService.rpc(
        'nearby_shows',
        {
          lat: SAMPLE_LOCATION.latitude,
          lng: SAMPLE_LOCATION.longitude,
          radius_miles: SAMPLE_LOCATION.radius
        }
      );
      
      if (altNearbyError) {
        console.error('❌ Alternative parameter name also failed:', altNearbyError.message);
      } else {
        console.log('✅ Alternative parameter name worked for nearby_shows!');
        console.log(`📊 Found ${altNearbyShows.length} nearby shows`);
      }
    } else {
      console.log('✅ nearby_shows function worked!');
      console.log(`📊 Found ${nearbyShows.length} nearby shows`);
    }
    
    return { allShows, nearbyShows };
  } catch (error) {
    console.error('❌ Unexpected error in testDirectShowsQuery:', error.message);
    return { allShows: [], nearbyShows: [] };
  }
}

/**
 * Test RLS policies by signing in as a test user
 */
async function testWithAuthenticatedUser() {
  console.log('\n👤 Testing with authenticated user...');
  
  if (TEST_USERS.length === 0) {
    console.log('⚠️ No test users provided, skipping authenticated tests');
    return null;
  }
  
  const testUser = TEST_USERS[0];
  
  try {
    // Sign in
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password
    });
    
    if (authError) {
      console.error('❌ Error signing in test user:', authError.message);
      return null;
    }
    
    console.log(`✅ Successfully signed in as ${testUser.email}`);
    
    // Create a new client with the user's session
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${authData.session.access_token}`
        }
      }
    });
    
    // Test show count
    const { count, error: countError } = await supabaseUser
      .from('shows')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.error('❌ Error counting shows as authenticated user:', countError.message);
    } else {
      console.log(`✅ Total shows visible to authenticated user: ${count}`);
    }
    
    // Test RPC function
    const { data: rpcData, error: rpcError } = await supabaseUser.rpc(
      'get_paginated_shows',
      {
        lat: SAMPLE_LOCATION.latitude,
        lng: SAMPLE_LOCATION.longitude,
        radius_miles: SAMPLE_LOCATION.radius,
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
    
    if (rpcError) {
      console.error('❌ Error calling get_paginated_shows as authenticated user:', rpcError.message);
    } else {
      console.log('✅ RPC call successful as authenticated user');
      
      if (rpcData && rpcData.data) {
        console.log(`📊 Found ${rpcData.data.length} shows as authenticated user`);
      }
    }
    
    return { authData, count, rpcData };
  } catch (error) {
    console.error('❌ Unexpected error in testWithAuthenticatedUser:', error.message);
    return null;
  }
}

/**
 * Check RLS policies on the shows table
 */
async function checkRLSPolicies() {
  console.log('\n🔒 Checking RLS policies...');
  
  try {
    // Get RLS policies for shows table
    const { data: policies, error } = await supabaseService
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'shows');
      
    if (error) {
      console.error('❌ Error querying RLS policies:', error.message);
      
      // Alternative approach - query pg_catalog directly
      const { data: altPolicies, error: altError } = await supabaseService.rpc(
        'exec_sql',
        {
          sql_string: `
            SELECT 
              schemaname, 
              tablename, 
              policyname, 
              permissive, 
              roles, 
              cmd, 
              qual, 
              with_check
            FROM 
              pg_policies 
            WHERE 
              tablename = 'shows'
          `
        }
      );
      
      if (altError) {
        console.error('❌ Alternative policy query also failed:', altError.message);
      } else {
        console.log('✅ Retrieved policies through alternative query');
        prettyPrint(altPolicies, 'RLS Policies for shows table');
      }
    } else {
      console.log('✅ Successfully retrieved RLS policies');
      prettyPrint(policies, 'RLS Policies for shows table');
    }
    
    return { policies };
  } catch (error) {
    console.error('❌ Unexpected error in checkRLSPolicies:', error.message);
    return { policies: [] };
  }
}

/**
 * Check database function definitions
 */
async function checkDatabaseFunctions() {
  console.log('\n⚙️ Checking database function definitions...');
  
  try {
    // Check get_paginated_shows function
    const { data: paginatedFn, error: paginatedError } = await supabaseService.rpc(
      'exec_sql',
      {
        sql_string: `
          SELECT 
            pg_get_functiondef(p.oid) as definition
          FROM 
            pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE 
            n.nspname = 'public' AND
            p.proname = 'get_paginated_shows'
        `
      }
    );
    
    if (paginatedError) {
      console.error('❌ Error retrieving get_paginated_shows definition:', paginatedError.message);
    } else if (paginatedFn && paginatedFn.length > 0) {
      console.log('✅ Found get_paginated_shows function definition');
      
      // Check parameter names in the function definition
      const definition = paginatedFn[0].definition;
      console.log('\nParameter analysis:');
      
      if (definition.includes('lat float') || definition.includes('lat FLOAT')) {
        console.log('✅ Found "lat" parameter');
      } else {
        console.log('❌ Missing "lat" parameter');
      }
      
      if (definition.includes('lng float') || definition.includes('lng FLOAT')) {
        console.log('✅ Found "lng" parameter');
      } else {
        console.log('❌ Missing "lng" parameter - check if it uses "long" instead');
      }
      
      if (definition.includes('long float') || definition.includes('long FLOAT')) {
        console.log('⚠️ Function uses "long" parameter but client is sending "lng"');
      }
    } else {
      console.log('⚠️ No definition found for get_paginated_shows function');
    }
    
    return { paginatedFn };
  } catch (error) {
    console.error('❌ Unexpected error in checkDatabaseFunctions:', error.message);
    return { paginatedFn: null };
  }
}

/**
 * Main function to run all tests
 */
async function main() {
  console.log('🔍 Starting show debugging script...');
  console.log(`📍 Using sample location: ${SAMPLE_LOCATION.latitude}, ${SAMPLE_LOCATION.longitude} (${SAMPLE_LOCATION.radius} mile radius)`);
  
  // Run all tests
  await testShowCount();
  await testGetPaginatedShows();
  await testDirectShowsQuery();
  await testWithAuthenticatedUser();
  await checkRLSPolicies();
  await checkDatabaseFunctions();
  
  console.log('\n📋 Summary of potential issues:');
  console.log('1. Parameter name mismatch (lng vs long) in get_paginated_shows function');
  console.log('2. RLS policies might be too restrictive');
  console.log('3. Coordinate format issues (PostGIS vs flat lat/lng)');
  console.log('4. Shows might exist but be outside the search radius');
  console.log('5. Shows might have incorrect status (not "ACTIVE")');
  console.log('6. Date range filtering might be excluding shows');
  
  console.log('\n🔧 Suggested fixes:');
  console.log('1. Check parameter names in database functions');
  console.log('2. Review RLS policies to ensure shows are visible');
  console.log('3. Verify coordinate data format in both database and client');
  console.log('4. Try increasing search radius or using coordinates near known shows');
  console.log('5. Check show status values in the database');
  console.log('6. Widen date range if shows are being excluded');
  
  console.log('\n✅ Debugging complete!');
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
