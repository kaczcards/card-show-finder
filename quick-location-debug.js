/**
 * quick-location-debug.js
 * 
 * A simple debug script to identify why shows hundreds of miles away are appearing
 * despite radius filtering. This script tests the location filtering implementation
 * and identifies which part of the chain is failing.
 * 
 * Usage:
 *   node quick-location-debug.js [--radius=25]
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const minimist = require('minimist');

// Load environment variables
dotenv.config();

// Parse command line arguments
const argv = minimist(process.argv.slice(2));
const testRadius = argv.radius || 25; // Default to 25 miles
const testZipCode = '46032'; // Carmel, IN

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be defined in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Calculate distance between two coordinates using the Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Check if a show is outside the radius
 */
function isShowOutsideRadius(show, userCoordinates, radius) {
  let showCoords;
  
  // Extract coordinates using the same logic as in the app
  if (typeof show.latitude === 'number' && typeof show.longitude === 'number') {
    showCoords = {
      latitude: show.latitude,
      longitude: show.longitude
    };
  } else if (show.coordinates && 
            show.coordinates.coordinates && 
            Array.isArray(show.coordinates.coordinates) && 
            show.coordinates.coordinates.length >= 2) {
    showCoords = {
      latitude: show.coordinates.coordinates[1],
      longitude: show.coordinates.coordinates[0]
    };
  }
  
  if (!showCoords) return false;
  
  const distance = calculateDistance(
    userCoordinates.latitude,
    userCoordinates.longitude,
    showCoords.latitude,
    showCoords.longitude
  );
  
  return { 
    isOutside: distance > radius,
    distance,
    coordinates: showCoords
  };
}

/**
 * Get coordinates for a ZIP code
 */
async function getZipCodeCoordinates(zipCode) {
  try {
    // First check if we have the ZIP code in our database
    const { data: zipCodeData, error: fetchError } = await supabase
      .from('zip_codes')
      .select('*')
      .eq('zip_code', zipCode)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
      throw fetchError;
    }

    if (zipCodeData) {
      return {
        zipCode: zipCodeData.zip_code,
        city: zipCodeData.city,
        state: zipCodeData.state,
        coordinates: {
          latitude: zipCodeData.latitude,
          longitude: zipCodeData.longitude,
        },
      };
    }

    // If not found, return null (we'll use fallback coordinates)
    return null;
  } catch (error) {
    console.error('Error getting ZIP code coordinates:', error);
    return null;
  }
}

/**
 * Main debug function
 */
async function debugLocationFiltering() {
  console.log('='.repeat(80));
  console.log(`LOCATION FILTERING DEBUG - ZIP: ${testZipCode}, Radius: ${testRadius} miles`);
  console.log('='.repeat(80));

  try {
    // Step 1: Test coordinate retrieval for the test ZIP code
    console.log('\n1. TESTING COORDINATE RETRIEVAL');
    console.log('-'.repeat(80));
    
    const zipData = await getZipCodeCoordinates(testZipCode);
    
    let userCoordinates;
    if (!zipData || !zipData.coordinates) {
      console.log(`❌ Failed to get coordinates for ZIP code: ${testZipCode} from database`);
      console.log('Using hardcoded fallback coordinates for Carmel, IN');
      
      // Use fallback coordinates for testing (Carmel, IN)
      userCoordinates = { latitude: 39.9784, longitude: -86.118 };
    } else {
      console.log(`✅ Successfully retrieved coordinates for ZIP ${testZipCode}:`);
      console.log(`   City: ${zipData.city}, State: ${zipData.state}`);
      console.log(`   Coordinates: ${JSON.stringify(zipData.coordinates)}`);
      
      userCoordinates = zipData.coordinates;
    }
    
    // Step 2: Test the RPC functions with the coordinates
    console.log('\n2. TESTING RPC FUNCTIONS');
    console.log('-'.repeat(80));
    
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // 2.1: Test nearby_shows RPC
    console.log('\n2.1 Testing nearby_shows RPC');
    console.log(`Parameters: lat=${userCoordinates.latitude}, long=${userCoordinates.longitude}, radius=${testRadius} miles`);
    
    const { data: nearbyData, error: nearbyError } = await supabase.rpc(
      'nearby_shows',
      {
        lat: userCoordinates.latitude,
        long: userCoordinates.longitude,
        radius_miles: testRadius,
        start_date: startDate,
        end_date: endDate,
      }
    );
    
    if (nearbyError) {
      console.error(`❌ nearby_shows RPC failed: ${nearbyError.message}`);
    } else {
      console.log(`✅ nearby_shows RPC returned ${nearbyData.length} shows`);
      
      // Check if any shows are outside the radius
      const outsideRadiusShows = [];
      
      nearbyData.forEach(show => {
        const result = isShowOutsideRadius(show, userCoordinates, testRadius);
        if (result.isOutside) {
          outsideRadiusShows.push({
            id: show.id,
            title: show.title,
            location: show.location,
            distance: result.distance,
            coordinates: result.coordinates
          });
        }
      });
      
      if (outsideRadiusShows.length > 0) {
        console.error(`❌ Found ${outsideRadiusShows.length} shows outside the ${testRadius} mile radius!`);
        outsideRadiusShows.slice(0, 3).forEach(show => {
          console.log(`   Show: ${show.id} - "${show.title}"`);
          console.log(`   Location: ${show.location}`);
          console.log(`   Distance: ${show.distance.toFixed(2)} miles (outside ${testRadius} mile radius)`);
          console.log('-'.repeat(40));
        });
        
        if (outsideRadiusShows.length > 3) {
          console.log(`   ... and ${outsideRadiusShows.length - 3} more shows outside radius`);
        }
      } else {
        console.log(`✅ All shows returned by nearby_shows are within the ${testRadius} mile radius`);
      }
    }
    
    // 2.2: Test get_paginated_shows RPC (used by useInfiniteShows hook)
    console.log('\n2.2 Testing get_paginated_shows RPC (used by useInfiniteShows)');
    
    const { data: paginatedData, error: paginatedError } = await supabase.rpc(
      'get_paginated_shows',
      {
        lat: userCoordinates.latitude,
        lng: userCoordinates.longitude,
        radius_miles: testRadius,
        start_date: startDate,
        end_date: endDate,
        max_entry_fee: null,
        categories: null,
        features: null,
        page_size: 50,
        page: 1,
        status: 'ACTIVE',
      }
    );
    
    if (paginatedError) {
      console.error(`❌ get_paginated_shows RPC failed: ${paginatedError.message}`);
    } else if (!paginatedData || !paginatedData.data || !Array.isArray(paginatedData.data)) {
      console.error(`❌ get_paginated_shows returned invalid data structure: ${JSON.stringify(paginatedData)}`);
    } else {
      console.log(`✅ get_paginated_shows RPC returned ${paginatedData.data.length} shows`);
      console.log(`   Total count: ${paginatedData.pagination?.total_count || 'unknown'}`);
      
      // Check if any shows are outside the radius
      const outsideRadiusPaginated = [];
      
      paginatedData.data.forEach(show => {
        const result = isShowOutsideRadius(show, userCoordinates, testRadius);
        if (result.isOutside) {
          outsideRadiusPaginated.push({
            id: show.id,
            title: show.title,
            location: show.location,
            distance: result.distance,
            coordinates: result.coordinates
          });
        }
      });
      
      if (outsideRadiusPaginated.length > 0) {
        console.error(`❌ Found ${outsideRadiusPaginated.length} shows outside the ${testRadius} mile radius!`);
        outsideRadiusPaginated.slice(0, 3).forEach(show => {
          console.log(`   Show: ${show.id} - "${show.title}"`);
          console.log(`   Location: ${show.location}`);
          console.log(`   Distance: ${show.distance.toFixed(2)} miles (outside ${testRadius} mile radius)`);
          console.log('-'.repeat(40));
        });
        
        if (outsideRadiusPaginated.length > 3) {
          console.log(`   ... and ${outsideRadiusPaginated.length - 3} more shows outside radius`);
        }
      } else {
        console.log(`✅ All shows returned by get_paginated_shows are within the ${testRadius} mile radius`);
      }
    }
    
    // Step 3: Test the emergency fallback (direct query without radius filtering)
    console.log('\n3. TESTING EMERGENCY FALLBACK');
    console.log('-'.repeat(80));
    
    const { data: emergencyData, error: emergencyError } = await supabase
      .from('shows')
      .select('*')
      .eq('status', 'ACTIVE')
      .gte('end_date', new Date().toISOString())
      .limit(50);
    
    if (emergencyError) {
      console.error(`❌ Emergency fallback query failed: ${emergencyError.message}`);
    } else {
      console.log(`✅ Emergency fallback returned ${emergencyData.length} shows`);
      
      // Count shows outside radius
      let outsideCount = 0;
      let insideCount = 0;
      let missingCoordsCount = 0;
      
      emergencyData.forEach(show => {
        const result = isShowOutsideRadius(show, userCoordinates, testRadius);
        if (result === false) {
          missingCoordsCount++;
        } else if (result.isOutside) {
          outsideCount++;
        } else {
          insideCount++;
        }
      });
      
      console.log(`   Shows within ${testRadius} miles: ${insideCount}`);
      console.log(`   Shows outside ${testRadius} miles: ${outsideCount}`);
      console.log(`   Shows with missing coordinates: ${missingCoordsCount}`);
      
      if (outsideCount > 0) {
        console.warn(`⚠️ Emergency fallback would display ${outsideCount} shows outside the radius`);
        console.log('   This is expected since the emergency fallback does not filter by distance');
      }
    }
    
    // Step 4: Check for coordinate issues in the database
    console.log('\n4. CHECKING FOR COORDINATE ISSUES');
    console.log('-'.repeat(80));
    
    const { data: sampleShows, error: sampleError } = await supabase
      .from('shows')
      .select('id, title, location, latitude, longitude, coordinates')
      .eq('status', 'ACTIVE')
      .limit(50);
    
    if (sampleError) {
      console.error(`❌ Failed to fetch shows for coordinate check: ${sampleError.message}`);
    } else {
      const missingCoordinates = sampleShows.filter(show => {
        const hasExplicitCoords = typeof show.latitude === 'number' && typeof show.longitude === 'number';
        const hasPostgisCoords = show.coordinates && 
                                show.coordinates.coordinates && 
                                Array.isArray(show.coordinates.coordinates) && 
                                show.coordinates.coordinates.length >= 2;
        
        return !hasExplicitCoords && !hasPostgisCoords;
      });
      
      if (missingCoordinates.length > 0) {
        console.warn(`⚠️ Found ${missingCoordinates.length} shows with missing coordinates`);
        console.log(`   This could cause these shows to be included even when they shouldn't be`);
      } else {
        console.log(`✅ All sampled shows have valid coordinates`);
      }
      
      // Check for suspicious coordinates (possible lat/lng swap)
      const suspiciousCoordinates = sampleShows.filter(show => {
        let lat, lng;
        
        if (typeof show.latitude === 'number' && typeof show.longitude === 'number') {
          lat = show.latitude;
          lng = show.longitude;
        } else if (show.coordinates && 
                  show.coordinates.coordinates && 
                  Array.isArray(show.coordinates.coordinates) && 
                  show.coordinates.coordinates.length >= 2) {
          lat = show.coordinates.coordinates[1];
          lng = show.coordinates.coordinates[0];
        } else {
          return false;
        }
        
        // Check if coordinates might be swapped (US is roughly in -125 to -65 longitude)
        return (Math.abs(lat) > 90 || (lng > 0 && lng < 180) || lng < -180);
      });
      
      if (suspiciousCoordinates.length > 0) {
        console.error(`❌ Found ${suspiciousCoordinates.length} shows with suspicious coordinates (possible lat/lng swap)`);
      } else {
        console.log(`✅ No shows with suspicious coordinates found`);
      }
    }
    
    // Summary
    console.log('\n='.repeat(80));
    console.log('SUMMARY AND RECOMMENDATIONS');
    console.log('='.repeat(80));
    
    console.log('Possible Issues:');
    
    if (nearbyError) {
      console.log(`1. ❌ nearby_shows RPC failed - check Supabase function implementation`);
    }
    
    if (paginatedError) {
      console.log(`2. ❌ get_paginated_shows RPC failed - check Supabase function implementation`);
    }
    
    if (outsideRadiusShows && outsideRadiusShows.length > 0) {
      console.log(`3. ❌ nearby_shows RPC returning shows outside radius - check function implementation`);
    }
    
    if (outsideRadiusPaginated && outsideRadiusPaginated.length > 0) {
      console.log(`4. ❌ get_paginated_shows RPC returning shows outside radius - check function implementation`);
    }
    
    if (missingCoordinates && missingCoordinates.length > 0) {
      console.log(`5. ❌ Some shows are missing coordinates - these may bypass radius filtering`);
    }
    
    if (suspiciousCoordinates && suspiciousCoordinates.length > 0) {
      console.log(`6. ❌ Some shows have suspicious coordinates - possible lat/lng swap`);
    }
    
    console.log('\nRecommended Fixes:');
    console.log('1. Add client-side distance filtering in HomeScreen.tsx as a safety measure');
    console.log('2. Ensure all shows have valid coordinates in the database');
    console.log('3. Check RPC function implementations for proper radius filtering');
    console.log('4. If emergency fallback is triggered, add a warning to the UI');
    console.log('5. Consider adding a database trigger to validate coordinates on insert/update');
    
  } catch (error) {
    console.error('Unhandled error in debug script:', error);
  }
}

// Run the debug function
debugLocationFiltering().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
