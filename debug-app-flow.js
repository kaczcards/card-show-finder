/**
 * debug-app-flow.js
 * 
 * This script tests the exact data flow path that the Card Show Finder app uses
 * to fetch and display shows on the homepage. It helps identify where the issue
 * might be in the data flow that's preventing shows from appearing.
 * 
 * Usage: node debug-app-flow.js
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

// Output directory for saving debug logs
const OUTPUT_DIR = path.join(__dirname, 'debug-output');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// -----------------------------------------------------------------------
// EXACT APP PARAMETERS - These match what the app would use
// -----------------------------------------------------------------------

// HomeScreen's fallback coordinates (Carmel, IN)
const FALLBACK_COORDINATES = {
  latitude: 39.9784,
  longitude: -86.118
};

// Default filter values from HomeScreen
const DEFAULT_FILTERS = {
  radius: 50, // Updated from 100 to 50 miles
  startDate: new Date(),
  endDate: new Date(new Date().setDate(new Date().getDate() + 30)), // 30 days
  maxEntryFee: undefined,
  features: [],
  categories: [],
};

// -----------------------------------------------------------------------
// UTILITY FUNCTIONS
// -----------------------------------------------------------------------

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
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`📝 Results saved to ${filePath}`);
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
 * Convert a raw database show to the app format (exactly as showService does)
 * This is copied directly from src/services/showService.ts
 */
function mapDbShowToAppShow(row) {
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    address: row.address,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    entryFee: row.entry_fee,
    description: row.description ?? undefined,
    imageUrl: row.image_url ?? undefined,
    rating: row.rating ?? undefined,
    // Prefer explicit latitude / longitude columns (added in updated Supabase functions);
    // fall back to legacy PostGIS object when they are not present.
    coordinates:
      typeof row.latitude === 'number' && typeof row.longitude === 'number'
        ? {
            latitude: row.latitude,
            longitude: row.longitude,
          }
        : row.coordinates &&
          row.coordinates.coordinates &&
          Array.isArray(row.coordinates.coordinates) &&
          row.coordinates.coordinates.length >= 2
        ? {
            latitude: row.coordinates.coordinates[1],
            longitude: row.coordinates.coordinates[0],
          }
        : undefined,
    status: row.status,
    organizerId: row.organizer_id,
    features: row.features ?? {},
  };
}

// -----------------------------------------------------------------------
// TEST FUNCTIONS - Each tests a specific part of the data flow
// -----------------------------------------------------------------------

/**
 * Test 1: Direct RPC call with exact parameters
 * This tests the get_paginated_shows RPC function directly with the exact
 * parameters that the app would use.
 */
async function testDirectRpcCall() {
  console.log('\n🔍 TEST 1: DIRECT RPC CALL WITH EXACT PARAMETERS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Convert app parameters to RPC parameters (exactly as showService does)
  const rpcParams = {
    lat: FALLBACK_COORDINATES.latitude,
    lng: FALLBACK_COORDINATES.longitude, // Note: Using 'lng' as in showService
    radius_miles: DEFAULT_FILTERS.radius,
    start_date: DEFAULT_FILTERS.startDate.toISOString(),
    end_date: DEFAULT_FILTERS.endDate.toISOString(),
    max_entry_fee: DEFAULT_FILTERS.maxEntryFee,
    categories: DEFAULT_FILTERS.categories.length > 0 ? DEFAULT_FILTERS.categories : null,
    features: DEFAULT_FILTERS.features.length > 0 ? DEFAULT_FILTERS.features : null,
    page_size: 20,
    page: 1,
    status: 'ACTIVE'
  };
  
  console.log('RPC Parameters:');
  prettyPrint(rpcParams);
  
  try {
    console.log('\nCalling get_paginated_shows RPC function...');
    
    const { data, error } = await supabaseAnon.rpc(
      'get_paginated_shows',
      rpcParams
    );
    
    if (error) {
      console.error('❌ ERROR: RPC call failed!');
      console.error(`   ${error.message}`);
      
      // Try alternative parameter names
      console.log('\nTrying with alternative parameter names (long instead of lng)...');
      const altParams = { ...rpcParams, long: rpcParams.lng };
      delete altParams.lng;
      
      const { data: altData, error: altError } = await supabaseAnon.rpc(
        'get_paginated_shows',
        altParams
      );
      
      if (altError) {
        console.error('❌ Alternative parameter names also failed!');
        console.error(`   ${altError.message}`);
        return { success: false, error };
      } else {
        console.log('✅ Alternative parameter names worked!');
        prettyPrint(altData, 'Results with alternative parameter names');
        saveResults(altData, 'direct_rpc_alt_params.json');
        
        // Check if we got results with alternative params
        if (altData && altData.data && altData.data.length > 0) {
          console.log(`📊 Found ${altData.data.length} shows with alternative parameter names`);
          console.log('⚠️ PARAMETER NAME MISMATCH DETECTED! App uses "lng" but function expects "long"');
          return { success: true, data: altData, paramNameMismatch: true };
        } else {
          console.log('⚠️ No shows found even with alternative parameter names');
          return { success: true, data: altData, paramNameMismatch: true, noResults: true };
        }
      }
    }
    
    // Check if we got results
    if (data && data.data && data.data.length > 0) {
      console.log('✅ SUCCESS! RPC call returned results');
      console.log(`📊 Found ${data.data.length} shows out of ${data.pagination.total_count} total`);
      
      // Display first show details
      const firstShow = data.data[0];
      console.log('\nFirst show details:');
      console.log(`  Title: ${firstShow.title}`);
      console.log(`  Location: ${firstShow.location}`);
      console.log(`  Date: ${formatDate(firstShow.start_date)}`);
      console.log(`  Distance: ${firstShow.distance_miles.toFixed(1)} miles`);
      
      // Verify coordinates are properly extracted
      if (typeof firstShow.latitude === 'number' && typeof firstShow.longitude === 'number') {
        console.log(`  Coordinates: ${firstShow.latitude.toFixed(4)}, ${firstShow.longitude.toFixed(4)}`);
      } else {
        console.log('  ⚠️ Warning: Coordinates not properly extracted');
      }
      
      saveResults(data, 'direct_rpc_results.json');
      return { success: true, data };
    } else {
      console.log('⚠️ RPC call succeeded but returned no results');
      saveResults(data, 'direct_rpc_empty_results.json');
      return { success: true, data, noResults: true };
    }
  } catch (error) {
    console.error('❌ FATAL ERROR in RPC call:');
    console.error(error);
    return { success: false, error };
  }
}

/**
 * Test 2: Test showService.getPaginatedShows function
 * This simulates exactly what the app's showService would do.
 */
async function testShowService() {
  console.log('\n🔍 TEST 2: SIMULATING SHOWSERVICE.GETPAGINATEDSHOWS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // These are the exact parameters that would be passed to getPaginatedShows
  const serviceParams = {
    latitude: FALLBACK_COORDINATES.latitude,
    longitude: FALLBACK_COORDINATES.longitude,
    radius: DEFAULT_FILTERS.radius,
    startDate: DEFAULT_FILTERS.startDate,
    endDate: DEFAULT_FILTERS.endDate,
    maxEntryFee: DEFAULT_FILTERS.maxEntryFee,
    categories: DEFAULT_FILTERS.categories.length > 0 ? DEFAULT_FILTERS.categories : null,
    features: DEFAULT_FILTERS.features.length > 0 ? DEFAULT_FILTERS.features : null,
    pageSize: 20,
    page: 1
  };
  
  console.log('ShowService Parameters:');
  prettyPrint(serviceParams);
  
  try {
    // This simulates the getPaginatedShows function from showService.ts
    console.log('\nSimulating showService.getPaginatedShows...');
    
    // Convert to ISO strings as the service would
    const toIso = (d) => d instanceof Date ? d.toISOString() : d;
    
    // Call RPC with converted parameters (exactly as showService does)
    const { data, error } = await supabaseAnon.rpc('get_paginated_shows', {
      lat: serviceParams.latitude,
      lng: serviceParams.longitude,
      radius_miles: typeof serviceParams.radius === 'number' && !isNaN(serviceParams.radius) ? serviceParams.radius : 25,
      start_date: toIso(serviceParams.startDate),
      end_date: toIso(serviceParams.endDate),
      max_entry_fee: typeof serviceParams.maxEntryFee === 'number' ? serviceParams.maxEntryFee : null,
      categories: serviceParams.categories,
      features: serviceParams.features,
      page_size: serviceParams.pageSize,
      page: serviceParams.page,
      status: 'ACTIVE', // Explicitly request only ACTIVE shows
    });
    
    if (error) {
      console.warn('❌ showService RPC call failed:', error.message);
      console.warn('Simulating fallback to direct query...');
      
      // Simulate the fallback function
      return await testShowServiceFallback(serviceParams);
    }
    
    // Process results as showService would
    if (data && data.data) {
      console.log('✅ SUCCESS! showService RPC call returned results');
      console.log(`📊 Found ${data.data.length} shows out of ${data.pagination.total_count} total`);
      
      // Map results to app format (as showService would)
      const mappedShows = data.data.map(mapDbShowToAppShow);
      
      console.log('\nMapped shows (as app would see them):');
      if (mappedShows.length > 0) {
        console.log(`First show: ${mappedShows[0].title}`);
        
        // Check if coordinates were properly mapped
        if (mappedShows[0].coordinates) {
          console.log(`Coordinates: ${mappedShows[0].coordinates.latitude}, ${mappedShows[0].coordinates.longitude}`);
        } else {
          console.log('⚠️ WARNING: Coordinates not properly mapped in showService!');
        }
      } else {
        console.log('No shows after mapping (this should not happen)');
      }
      
      saveResults({ 
        rawData: data, 
        mappedShows 
      }, 'showservice_results.json');
      
      return { success: true, data, mappedShows };
    } else {
      console.log('⚠️ showService RPC call succeeded but returned no results');
      saveResults(data, 'showservice_empty_results.json');
      return { success: true, data, noResults: true };
    }
  } catch (error) {
    console.error('❌ FATAL ERROR in showService simulation:');
    console.error(error);
    return { success: false, error };
  }
}

/**
 * Test the fallback function in showService
 * This simulates what happens when the RPC fails and the service falls back
 * to a direct query.
 */
async function testShowServiceFallback(params) {
  console.log('\n🔍 TEST 2B: SIMULATING SHOWSERVICE FALLBACK FUNCTION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    console.log('Simulating fallback direct query...');
    
    // This simulates the fallback function from showService
    const query = supabaseAnon
      .from('shows')
      .select('*')
      .eq('status', 'ACTIVE')
      .gte('end_date', new Date().toISOString());
    
    // Apply date range filter
    if (params.startDate) {
      query.lte('start_date', params.endDate.toISOString());
    }
    
    // Apply max entry fee filter if provided
    if (typeof params.maxEntryFee === 'number') {
      query.lte('entry_fee', params.maxEntryFee);
    }
    
    // Apply categories filter if provided
    if (params.categories && params.categories.length > 0) {
      query.overlaps('categories', params.categories);
    }
    
    // Get the results
    const { data, error, count } = await query.limit(params.pageSize).range(
      (params.page - 1) * params.pageSize,
      params.page * params.pageSize - 1
    );
    
    if (error) {
      console.error('❌ Fallback query failed:', error.message);
      return { success: false, error };
    }
    
    // Get total count
    const { count: totalCount, error: countError } = await supabaseAnon
      .from('shows')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')
      .gte('end_date', new Date().toISOString());
    
    if (countError) {
      console.error('❌ Count query failed:', countError.message);
    }
    
    console.log(`✅ Fallback query found ${data.length} shows (from ${totalCount} total)`);
    
    // Map to app format
    const mappedShows = data.map(mapDbShowToAppShow);
    
    console.log('\nMapped shows from fallback (as app would see them):');
    if (mappedShows.length > 0) {
      console.log(`First show: ${mappedShows[0].title}`);
      
      // Check if coordinates were properly mapped
      if (mappedShows[0].coordinates) {
        console.log(`Coordinates: ${mappedShows[0].coordinates.latitude}, ${mappedShows[0].coordinates.longitude}`);
      } else {
        console.log('⚠️ WARNING: Coordinates not properly mapped in fallback!');
        
        // Try to extract coordinates manually
        if (data[0].coordinates) {
          console.log('Raw coordinates:', data[0].coordinates);
          
          // Try to parse PostGIS format
          try {
            // Query to extract coordinates
            const { data: coordData, error: coordError } = await supabaseService.rpc('exec_sql', {
              sql_string: `SELECT 
                ST_X(('${data[0].coordinates}')::geometry) as longitude,
                ST_Y(('${data[0].coordinates}')::geometry) as latitude
              `
            });
            
            if (!coordError && coordData && coordData.length > 0) {
              console.log(`Extracted coordinates: ${coordData[0].latitude}, ${coordData[0].longitude}`);
            }
          } catch (e) {
            console.log('Failed to extract coordinates:', e.message);
          }
        }
      }
    } else {
      console.log('No shows found in fallback query');
    }
    
    saveResults({ 
      rawData: data, 
      mappedShows,
      totalCount 
    }, 'fallback_results.json');
    
    return { 
      success: true, 
      data: {
        data: mappedShows,
        pagination: {
          totalCount,
          pageSize: params.pageSize,
          currentPage: params.page,
          totalPages: Math.ceil(totalCount / params.pageSize)
        }
      }
    };
  } catch (error) {
    console.error('❌ FATAL ERROR in fallback simulation:');
    console.error(error);
    return { success: false, error };
  }
}

/**
 * Test 3: Simulate useInfiniteShows hook
 * This simulates the exact behavior of the useInfiniteShows hook
 * that the HomeScreen component uses.
 */
async function testUseInfiniteShows() {
  console.log('\n🔍 TEST 3: SIMULATING USEINFINITESHOWS HOOK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // These are the exact parameters passed to useInfiniteShows in HomeScreen
  const hookParams = {
    coordinates: FALLBACK_COORDINATES,
    radius: DEFAULT_FILTERS.radius,
    startDate: DEFAULT_FILTERS.startDate,
    endDate: DEFAULT_FILTERS.endDate,
    maxEntryFee: DEFAULT_FILTERS.maxEntryFee,
    features: DEFAULT_FILTERS.features,
    categories: DEFAULT_FILTERS.categories,
    enabled: true
  };
  
  console.log('useInfiniteShows Parameters:');
  prettyPrint(hookParams);
  
  try {
    // Simulate the hook by calling showService.getPaginatedShows
    console.log('\nSimulating useInfiniteShows hook...');
    
    // This would be the first query the hook makes
    const result = await testShowService();
    
    if (!result.success) {
      console.error('❌ useInfiniteShows simulation failed');
      return { success: false, error: result.error };
    }
    
    if (result.noResults) {
      console.log('⚠️ useInfiniteShows would return zero shows');
      return { success: true, shows: [], totalCount: 0 };
    }
    
    // Extract shows and pagination from result
    const shows = result.mappedShows || [];
    const totalCount = result.data.pagination?.total_count || 0;
    
    console.log(`✅ useInfiniteShows would return ${shows.length} shows (out of ${totalCount} total)`);
    
    // Check if the shows have valid coordinates
    const showsWithValidCoords = shows.filter(show => 
      show.coordinates && 
      typeof show.coordinates.latitude === 'number' && 
      typeof show.coordinates.longitude === 'number'
    );
    
    console.log(`📊 Shows with valid coordinates: ${showsWithValidCoords.length} out of ${shows.length}`);
    
    if (showsWithValidCoords.length < shows.length) {
      console.log('⚠️ WARNING: Some shows are missing valid coordinates!');
      console.log('This could cause rendering issues in the app.');
    }
    
    saveResults({ 
      shows, 
      totalCount,
      showsWithValidCoords: showsWithValidCoords.length
    }, 'useinfiniteshows_results.json');
    
    return { success: true, shows, totalCount };
  } catch (error) {
    console.error('❌ FATAL ERROR in useInfiniteShows simulation:');
    console.error(error);
    return { success: false, error };
  }
}

/**
 * Test 4: Check if there are any issues with the emergency fallback
 * This simulates the emergency fetch that HomeScreen does when shows count > 0
 * but no shows are returned.
 */
async function testEmergencyFallback() {
  console.log('\n🔍 TEST 4: CHECKING EMERGENCY FALLBACK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    console.log('Simulating HomeScreen emergency fetch...');
    
    // This is the exact query HomeScreen would make in its emergency fetch
    const { data, error } = await supabaseAnon
      .from('shows')
      .select('*')
      .eq('status', 'ACTIVE')
      .gte('end_date', new Date().toISOString());
    
    if (error) {
      console.error('❌ Emergency fetch failed:', error.message);
      return { success: false, error };
    }
    
    console.log(`✅ Emergency fetch found ${data.length} shows`);
    
    if (data.length > 0) {
      // Map shows to app format
      const mappedShows = data.map(show => ({
        id: show.id,
        title: show.title,
        location: show.location,
        address: show.address,
        startDate: show.start_date,
        endDate: show.end_date,
        entryFee: show.entry_fee || 0,
        description: show.description,
        status: show.status,
        organizerId: show.organizer_id,
        features: show.features || {},
        categories: show.categories || [],
        seriesId: show.series_id,
        startTime: show.start_time,
        endTime: show.end_time,
        imageUrl: show.image_url,
        // Safely derive coordinates – guard against missing/null fields
        coordinates: (() => {
          const lat = show?.coordinates?.coordinates?.[1];
          const lng = show?.coordinates?.coordinates?.[0];
          return (
            typeof lat === 'number' &&
            typeof lng === 'number' &&
            Number.isFinite(lat) &&
            Number.isFinite(lng)
          )
            ? { latitude: lat, longitude: lng }
            : undefined;
        })()
      }));
      
      console.log('\nMapped emergency shows:');
      console.log(`First show: ${mappedShows[0].title}`);
      
      // Check if coordinates were properly mapped
      if (mappedShows[0].coordinates) {
        console.log(`Coordinates: ${mappedShows[0].coordinates.latitude}, ${mappedShows[0].coordinates.longitude}`);
      } else {
        console.log('⚠️ WARNING: Coordinates not properly mapped in emergency fetch!');
        
        // Check the raw coordinates
        if (data[0].coordinates) {
          console.log('Raw coordinates:', data[0].coordinates);
          
          // Try to parse PostGIS format
          if (typeof data[0].coordinates === 'string' && data[0].coordinates.startsWith('0101')) {
            console.log('⚠️ Coordinates appear to be in PostGIS binary format');
            console.log('The emergency fetch might not be extracting them correctly');
          }
        }
      }
      
      // Count shows with valid coordinates
      const showsWithValidCoords = mappedShows.filter(show => 
        show.coordinates && 
        typeof show.coordinates.latitude === 'number' && 
        typeof show.coordinates.longitude === 'number'
      );
      
      console.log(`📊 Emergency shows with valid coordinates: ${showsWithValidCoords.length} out of ${mappedShows.length}`);
      
      if (showsWithValidCoords.length < mappedShows.length) {
        console.log('⚠️ WARNING: Some emergency shows are missing valid coordinates!');
        console.log('This could cause rendering issues in the app.');
      }
      
      saveResults({ 
        rawData: data, 
        mappedShows,
        showsWithValidCoords: showsWithValidCoords.length
      }, 'emergency_fallback_results.json');
      
      return { success: true, shows: mappedShows };
    } else {
      console.log('⚠️ Emergency fetch returned zero shows');
      return { success: true, shows: [] };
    }
  } catch (error) {
    console.error('❌ FATAL ERROR in emergency fallback:');
    console.error(error);
    return { success: false, error };
  }
}

/**
 * Test 5: Check if there are issues with the status field
 */
async function testShowStatus() {
  console.log('\n🔍 TEST 5: CHECKING SHOW STATUS ISSUES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    console.log('Checking all possible status values in the database...');
    
    // Query to get counts by status
    const { data: statusData, error: statusError } = await supabaseService.rpc('exec_sql', {
      sql_string: `
        SELECT status, COUNT(*) 
        FROM public.shows 
        GROUP BY status
        ORDER BY COUNT(*) DESC
      `
    });
    
    if (statusError) {
      console.error('❌ Status query failed:', statusError.message);
      
      // Fallback to direct query
      const { data, error } = await supabaseService
        .from('shows')
        .select('status');
      
      if (error) {
        console.error('❌ Fallback status query also failed:', error.message);
        return { success: false, error };
      }
      
      // Count statuses manually
      const statusCounts = {};
      data.forEach(show => {
        const status = show.status || 'null';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      console.log('Status counts (from fallback query):');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
      
      // Check if we have any 'active' (lowercase) status
      if (statusCounts['active']) {
        console.log('⚠️ WARNING: Found shows with lowercase "active" status!');
        console.log('The app is looking for uppercase "ACTIVE" status.');
        console.log('This could be causing shows to not appear.');
      }
      
      return { success: true, statusCounts };
    }
    
    console.log('Status counts:');
    statusData.forEach(row => {
      console.log(`  ${row.status || 'null'}: ${row.count}`);
    });
    
    // Check if we have any 'active' (lowercase) status
    const lowercaseActive = statusData.find(row => row.status === 'active');
    if (lowercaseActive) {
      console.log('⚠️ WARNING: Found shows with lowercase "active" status!');
      console.log('The app is looking for uppercase "ACTIVE" status.');
      console.log('This could be causing shows to not appear.');
      
      // Count shows that are lowercase active and have upcoming dates
      const { data: upcomingActive, error: upcomingError } = await supabaseService
        .from('shows')
        .select('*')
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString());
      
      if (!upcomingError && upcomingActive) {
        console.log(`Found ${upcomingActive.length} upcoming shows with lowercase "active" status`);
        
        if (upcomingActive.length > 0) {
          console.log('\nSample of upcoming lowercase "active" shows:');
          upcomingActive.slice(0, 3).forEach((show, i) => {
            console.log(`  ${i+1}. ${show.title} (${formatDate(show.start_date)})`);
          });
          
          // Save these shows for potential fixing
          saveResults(upcomingActive, 'lowercase_active_shows.json');
        }
      }
    }
    
    return { success: true, statusData };
  } catch (error) {
    console.error('❌ FATAL ERROR in status check:');
    console.error(error);
    return { success: false, error };
  }
}

/**
 * Fix lowercase 'active' status to uppercase 'ACTIVE'
 */
async function fixShowStatus() {
  console.log('\n🔧 FIXING SHOW STATUS ISSUES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    console.log('Updating lowercase "active" status to uppercase "ACTIVE"...');
    
    const { data, error } = await supabaseService
      .from('shows')
      .update({ status: 'ACTIVE' })
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .select();
    
    if (error) {
      console.error('❌ Status update failed:', error.message);
      return { success: false, error };
    }
    
    console.log(`✅ Successfully updated ${data.length} shows from "active" to "ACTIVE"`);
    
    if (data.length > 0) {
      console.log('\nUpdated shows:');
      data.slice(0, 5).forEach((show, i) => {
        console.log(`  ${i+1}. ${show.title} (${formatDate(show.start_date)})`);
      });
      
      saveResults(data, 'fixed_show_status.json');
    }
    
    return { success: true, updatedShows: data };
  } catch (error) {
    console.error('❌ FATAL ERROR in status fix:');
    console.error(error);
    return { success: false, error };
  }
}

/**
 * Main function to run all tests
 */
async function main() {
  console.log('🧪 STARTING APP DATA FLOW DEBUGGING');
  console.log(`🔗 Connected to Supabase: ${supabaseUrl}`);
  
  // Run all tests
  const rpcResult = await testDirectRpcCall();
  const serviceResult = await testShowService();
  const hookResult = await testUseInfiniteShows();
  const emergencyResult = await testEmergencyFallback();
  const statusResult = await testShowStatus();
  
  // Check if we need to fix show status
  let fixResult = null;
  const hasLowercaseActive = statusResult.success && 
    statusResult.statusData && 
    statusResult.statusData.some(row => row.status === 'active');
  
  if (hasLowercaseActive) {
    console.log('\n⚠️ Found lowercase "active" status - attempting to fix...');
    fixResult = await fixShowStatus();
  }
  
  // Summarize results
  console.log('\n📋 SUMMARY OF FINDINGS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const issues = [];
  
  // Check for RPC issues
  if (!rpcResult.success) {
    issues.push('❌ Direct RPC call failed - database function might be missing or have errors');
  } else if (rpcResult.paramNameMismatch) {
    issues.push('⚠️ Parameter name mismatch detected (lng vs long)');
  } else if (rpcResult.noResults) {
    issues.push('⚠️ RPC call succeeded but returned no results');
  }
  
  // Check for showService issues
  if (!serviceResult.success) {
    issues.push('❌ ShowService simulation failed');
  } else if (serviceResult.noResults) {
    issues.push('⚠️ ShowService returned no results');
  }
  
  // Check for useInfiniteShows issues
  if (!hookResult.success) {
    issues.push('❌ useInfiniteShows simulation failed');
  } else if (hookResult.shows && hookResult.shows.length === 0) {
    issues.push('⚠️ useInfiniteShows would return zero shows');
  }
  
  // Check for emergency fallback issues
  if (!emergencyResult.success) {
    issues.push('❌ Emergency fallback failed');
  } else if (emergencyResult.shows && emergencyResult.shows.length === 0) {
    issues.push('⚠️ Emergency fallback returned zero shows');
  }
  
  // Check for status issues
  if (hasLowercaseActive) {
    if (fixResult && fixResult.success) {
      issues.push('✅ Fixed lowercase "active" status (was causing shows to not appear)');
    } else {
      issues.push('⚠️ Found shows with lowercase "active" status but failed to fix them');
    }
  }
  
  if (issues.length > 0) {
    console.log('Issues found:');
    issues.forEach(issue => console.log(`  ${issue}`));
  } else {
    console.log('✅ No major issues found in the data flow');
  }
  
  // Provide recommendations
  console.log('\n🔧 RECOMMENDATIONS:');
  
  if (hasLowercaseActive && fixResult && fixResult.success) {
    console.log('1. ✅ Fixed lowercase "active" status - shows should now appear!');
    console.log('   Restart the app and check if shows now appear on the homepage.');
  }
  
  if (rpcResult.paramNameMismatch) {
    console.log('2. Update showService.ts to use "long" instead of "lng" in RPC parameters');
    console.log('   Change: lng: longitude  →  long: longitude');
  }
  
  if (issues.some(i => i.includes('zero shows'))) {
    console.log('3. Check if there are any active shows within 50 miles of Carmel, IN');
    console.log('   If not, consider adding test shows in that area or changing the fallback location');
  }
  
  if (issues.some(i => i.includes('coordinates'))) {
    console.log('4. Verify coordinate extraction in mapDbShowToAppShow function');
    console.log('   Ensure it correctly handles PostGIS binary format');
  }
  
  console.log('\n✅ Debugging complete!');
  
  // If we fixed lowercase active status, recommend restarting the app
  if (hasLowercaseActive && fixResult && fixResult.success) {
    console.log('\n🎉 IMPORTANT: Status issues were fixed! Restart the app to see if shows appear now.');
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
