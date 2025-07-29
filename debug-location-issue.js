/**
 * debug-location-issue.js
 * 
 * Debug script to identify why shows hundreds of miles away from a user's home zip code
 * are appearing in the home screen despite radius filtering.
 * 
 * Usage:
 *   node debug-location-issue.js --userId=<userId> --zipCode=<zipCode> --radius=<radius>
 * 
 * Example:
 *   node debug-location-issue.js --userId=123e4567-e89b-12d3-a456-426614174000 --zipCode=46032 --radius=25
 */

/* ------------------------------------------------------------------ */
/* CommonJS requires – convert ES imports to `require()`               */
/* ------------------------------------------------------------------ */
const { createClient } = require('@supabase/supabase-js');
const locationService = require('./src/services/locationService');
const dotenv = require('dotenv');
const minimist = require('minimist');

// Load environment variables
dotenv.config();

// Parse command line arguments
const argv = minimist(process.argv.slice(2));
const userId = argv.userId;
const zipCode = argv.zipCode;
const testRadius = argv.radius || 25; // Default to 25 miles

// Validate required arguments
if (!userId || !zipCode) {
  console.error('Error: userId and zipCode are required parameters');
  console.log('Usage: node debug-location-issue.js --userId=<userId> --zipCode=<zipCode> --radius=<radius>');
  process.exit(1);
}

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be defined in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Main debug function
 */
async function debugLocationIssue() {
  console.log('='.repeat(80));
  console.log(`LOCATION FILTERING DEBUG - User: ${userId}, ZIP: ${zipCode}, Radius: ${testRadius} miles`);
  console.log('='.repeat(80));

  try {
    // Step 1: Test coordinate retrieval from user's home zip code
    console.log('\n1. TESTING COORDINATE RETRIEVAL FROM ZIP CODE');
    console.log('-'.repeat(80));
    
    let zipData = await locationService.getZipCodeCoordinates(zipCode);
    
    if (!zipData || !zipData.coordinates) {
      console.error(`❌ Failed to get coordinates for ZIP code: ${zipCode}`);
      console.log('Checking if user has a valid home ZIP code in profile...');
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('home_zip_code')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.error(`❌ Error fetching user profile: ${profileError.message}`);
      } else if (!profile || !profile.home_zip_code) {
        console.error(`❌ User does not have a home ZIP code set in their profile`);
      } else if (profile.home_zip_code !== zipCode) {
        console.log(`⚠️ User's profile ZIP code (${profile.home_zip_code}) differs from test ZIP code (${zipCode})`);
        console.log('Trying to get coordinates for profile ZIP code...');
        const profileZipData = await locationService.getZipCodeCoordinates(profile.home_zip_code);
        if (profileZipData && profileZipData.coordinates) {
          console.log(`✅ Successfully retrieved coordinates for profile ZIP code: ${JSON.stringify(profileZipData.coordinates)}`);
        } else {
          console.error(`❌ Failed to get coordinates for profile ZIP code: ${profile.home_zip_code}`);
        }
      }
      
      // Use fallback coordinates for testing
      console.log('Using fallback coordinates (Carmel, IN) for testing');
      zipData = {
        zipCode,
        city: 'Carmel',
        state: 'IN',
        coordinates: { latitude: 39.9784, longitude: -86.118 }
      };
    } else {
      console.log(`✅ Successfully retrieved coordinates for ZIP ${zipCode}:`);
      console.log(`   City: ${zipData.city}, State: ${zipData.state}`);
      console.log(`   Coordinates: ${JSON.stringify(zipData.coordinates)}`);
    }
    
    const userCoordinates = zipData.coordinates;
    
    // Step 2: Test the various RPC functions with the user's coordinates
    console.log('\n2. TESTING RPC FUNCTIONS WITH USER COORDINATES');
    console.log('-'.repeat(80));
    
    // 2.1: Test nearby_shows RPC
    console.log('\n2.1 Testing nearby_shows RPC');
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    console.log(`Parameters: lat=${userCoordinates.latitude}, long=${userCoordinates.longitude}, radius=${testRadius} miles`);
    console.log(`Date range: ${startDate} to ${endDate}`);
    
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
      const outsideRadiusShows = nearbyData.filter(show => {
        // Extract coordinates using the same logic as mapDbShowToAppShow
        let showCoords;
        
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
        
        const distance = locationService.calculateDistanceBetweenCoordinates(
          userCoordinates,
          showCoords
        );
        
        return distance > testRadius;
      });
      
      if (outsideRadiusShows.length > 0) {
        console.error(`❌ Found ${outsideRadiusShows.length} shows outside the ${testRadius} mile radius!`);
        outsideRadiusShows.forEach(show => {
          let showCoords;
          
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
          
          if (showCoords) {
            const distance = locationService.calculateDistanceBetweenCoordinates(
              userCoordinates,
              showCoords
            );
            
            console.log(`   Show: ${show.id} - "${show.title}"`);
            console.log(`   Location: ${show.location}`);
            console.log(`   Coordinates: ${JSON.stringify(showCoords)}`);
            console.log(`   Distance: ${distance.toFixed(2)} miles (outside ${testRadius} mile radius)`);
            console.log(`   Status: ${show.status}`);
            console.log(`   Dates: ${new Date(show.start_date).toLocaleDateString()} to ${new Date(show.end_date).toLocaleDateString()}`);
            console.log('-'.repeat(40));
          }
        });
      } else {
        console.log(`✅ All shows returned by nearby_shows are within the ${testRadius} mile radius`);
      }
    }
    
    // 2.2: Test find_filtered_shows RPC (fallback #1)
    console.log('\n2.2 Testing find_filtered_shows RPC (Fallback #1)');
    
    const { data: filteredData, error: filteredError } = await supabase.rpc(
      'find_filtered_shows',
      {
        center_lat: userCoordinates.latitude,
        center_lng: userCoordinates.longitude,
        radius_miles: testRadius,
        start_date: startDate,
        end_date: endDate,
        max_entry_fee: null,
        show_categories: null,
        show_features: null,
      }
    );
    
    if (filteredError) {
      console.error(`❌ find_filtered_shows RPC failed: ${filteredError.message}`);
    } else {
      console.log(`✅ find_filtered_shows RPC returned ${filteredData.length} shows`);
      
      // Check if any shows are outside the radius
      const outsideRadiusFiltered = filteredData.filter(show => {
        let showCoords;
        
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
        
        const distance = locationService.calculateDistanceBetweenCoordinates(
          userCoordinates,
          showCoords
        );
        
        return distance > testRadius;
      });
      
      if (outsideRadiusFiltered.length > 0) {
        console.error(`❌ Found ${outsideRadiusFiltered.length} shows outside the ${testRadius} mile radius!`);
        // Log first 5 shows outside radius
        outsideRadiusFiltered.slice(0, 5).forEach(show => {
          let showCoords;
          
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
          
          if (showCoords) {
            const distance = locationService.calculateDistanceBetweenCoordinates(
              userCoordinates,
              showCoords
            );
            
            console.log(`   Show: ${show.id} - "${show.title}"`);
            console.log(`   Location: ${show.location}`);
            console.log(`   Coordinates: ${JSON.stringify(showCoords)}`);
            console.log(`   Distance: ${distance.toFixed(2)} miles (outside ${testRadius} mile radius)`);
            console.log('-'.repeat(40));
          }
        });
      } else {
        console.log(`✅ All shows returned by find_filtered_shows are within the ${testRadius} mile radius`);
      }
    }
    
    // 2.3: Test find_shows_within_radius RPC (fallback #2)
    console.log('\n2.3 Testing find_shows_within_radius RPC (Fallback #2)');
    
    const { data: radiusData, error: radiusError } = await supabase.rpc(
      'find_shows_within_radius',
      {
        center_lat: userCoordinates.latitude,
        center_lng: userCoordinates.longitude,
        radius_miles: testRadius,
      }
    );
    
    if (radiusError) {
      console.error(`❌ find_shows_within_radius RPC failed: ${radiusError.message}`);
    } else {
      console.log(`✅ find_shows_within_radius RPC returned ${radiusData.length} shows`);
      
      // Check if any shows are outside the radius
      const outsideRadiusOnly = radiusData.filter(show => {
        let showCoords;
        
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
        
        const distance = locationService.calculateDistanceBetweenCoordinates(
          userCoordinates,
          showCoords
        );
        
        return distance > testRadius;
      });
      
      if (outsideRadiusOnly.length > 0) {
        console.error(`❌ Found ${outsideRadiusOnly.length} shows outside the ${testRadius} mile radius!`);
        // Log first 5 shows outside radius
        outsideRadiusOnly.slice(0, 5).forEach(show => {
          let showCoords;
          
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
          
          if (showCoords) {
            const distance = locationService.calculateDistanceBetweenCoordinates(
              userCoordinates,
              showCoords
            );
            
            console.log(`   Show: ${show.id} - "${show.title}"`);
            console.log(`   Location: ${show.location}`);
            console.log(`   Coordinates: ${JSON.stringify(showCoords)}`);
            console.log(`   Distance: ${distance.toFixed(2)} miles (outside ${testRadius} mile radius)`);
            console.log('-'.repeat(40));
          }
        });
      } else {
        console.log(`✅ All shows returned by find_shows_within_radius are within the ${testRadius} mile radius`);
      }
    }
    
    // 2.4: Test get_paginated_shows RPC (used by useInfiniteShows hook)
    console.log('\n2.4 Testing get_paginated_shows RPC (used by useInfiniteShows)');
    
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
      const outsideRadiusPaginated = paginatedData.data.filter(show => {
        let showCoords;
        
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
        
        const distance = locationService.calculateDistanceBetweenCoordinates(
          userCoordinates,
          showCoords
        );
        
        return distance > testRadius;
      });
      
      if (outsideRadiusPaginated.length > 0) {
        console.error(`❌ Found ${outsideRadiusPaginated.length} shows outside the ${testRadius} mile radius!`);
        // Log first 5 shows outside radius
        outsideRadiusPaginated.slice(0, 5).forEach(show => {
          let showCoords;
          
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
          
          if (showCoords) {
            const distance = locationService.calculateDistanceBetweenCoordinates(
              userCoordinates,
              showCoords
            );
            
            console.log(`   Show: ${show.id} - "${show.title}"`);
            console.log(`   Location: ${show.location}`);
            console.log(`   Coordinates: ${JSON.stringify(showCoords)}`);
            console.log(`   Distance: ${distance.toFixed(2)} miles (outside ${testRadius} mile radius)`);
            console.log('-'.repeat(40));
          }
        });
      } else {
        console.log(`✅ All shows returned by get_paginated_shows are within the ${testRadius} mile radius`);
      }
    }
    
    // Step 3: Test the emergency fallback (direct query without radius filtering)
    console.log('\n3. TESTING EMERGENCY FALLBACK (direct query without radius filtering)');
    console.log('-'.repeat(80));
    
    const { data: emergencyData, error: emergencyError } = await supabase
      .from('shows')
      .select('*')
      .eq('status', 'ACTIVE')
      .gte('end_date', new Date().toISOString());
    
    if (emergencyError) {
      console.error(`❌ Emergency fallback query failed: ${emergencyError.message}`);
    } else {
      console.log(`✅ Emergency fallback returned ${emergencyData.length} shows`);
      
      // Count shows outside radius
      let outsideCount = 0;
      let insideCount = 0;
      let missingCoordsCount = 0;
      
      emergencyData.forEach(show => {
        let showCoords;
        
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
        
        if (!showCoords) {
          missingCoordsCount++;
          return;
        }
        
        const distance = locationService.calculateDistanceBetweenCoordinates(
          userCoordinates,
          showCoords
        );
        
        if (distance > testRadius) {
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
    
    // Step 4: Test distance calculation between coordinates
    console.log('\n4. TESTING DISTANCE CALCULATION');
    console.log('-'.repeat(80));
    
    // Test with a known distance (Indianapolis to Chicago ~180 miles)
    const indianapolis = { latitude: 39.7684, longitude: -86.1581 };
    const chicago = { latitude: 41.8781, longitude: -87.6298 };
    
    const calculatedDistance = locationService.calculateDistanceBetweenCoordinates(
      indianapolis,
      chicago
    );
    
    console.log(`Distance from Indianapolis to Chicago: ${calculatedDistance.toFixed(2)} miles (should be ~180 miles)`);
    
    if (Math.abs(calculatedDistance - 180) > 10) {
      console.error(`❌ Distance calculation may be inaccurate! Expected ~180 miles, got ${calculatedDistance.toFixed(2)}`);
    } else {
      console.log(`✅ Distance calculation appears accurate`);
    }
    
    // Step 5: Check for potential coordinate swapping issues
    console.log('\n5. CHECKING FOR COORDINATE SWAPPING ISSUES');
    console.log('-'.repeat(80));
    
    // Check if any shows have suspicious coordinates (lat/lng swapped)
    const { data: allShows, error: allShowsError } = await supabase
      .from('shows')
      .select('id, title, location, latitude, longitude, coordinates')
      .eq('status', 'ACTIVE');
    
    if (allShowsError) {
      console.error(`❌ Failed to fetch shows for coordinate check: ${allShowsError.message}`);
    } else {
      const suspiciousShows = allShows.filter(show => {
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
      
      if (suspiciousShows.length > 0) {
        console.error(`❌ Found ${suspiciousShows.length} shows with suspicious coordinates (possible lat/lng swap):`);
        suspiciousShows.forEach(show => {
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
          }
          
          console.log(`   Show: ${show.id} - "${show.title}"`);
          console.log(`   Location: ${show.location}`);
          console.log(`   Suspicious coordinates: lat=${lat}, lng=${lng}`);
          console.log('-'.repeat(40));
        });
      } else {
        console.log(`✅ No shows with suspicious coordinates found`);
      }
    }
    
    // Summary
    console.log('\n='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`1. User coordinates from ZIP ${zipCode}: ${JSON.stringify(userCoordinates)}`);
    console.log(`2. RPC Function Results:`);
    console.log(`   - nearby_shows: ${nearbyData ? nearbyData.length : 'Failed'} shows`);
    console.log(`   - find_filtered_shows: ${filteredData ? filteredData.length : 'Failed'} shows`);
    console.log(`   - find_shows_within_radius: ${radiusData ? radiusData.length : 'Failed'} shows`);
    console.log(`   - get_paginated_shows: ${paginatedData?.data ? paginatedData.data.length : 'Failed'} shows`);
    console.log(`3. Emergency fallback: ${emergencyData ? emergencyData.length : 'Failed'} shows`);
    
    if (nearbyError || filteredError || radiusError || paginatedError) {
      console.error(`❌ One or more RPC functions failed - this could cause fallback to less accurate methods`);
    }
    
    console.log('\nPOSSIBLE ISSUES:');
    
    if (!zipData || !zipData.coordinates) {
      console.log(`1. ❌ Failed to get coordinates for ZIP code ${zipCode} - check if ZIP code is valid`);
    }
    
    if (nearbyError && filteredError && radiusError) {
      console.log(`2. ❌ All RPC functions failed - check Supabase functions and database`);
    }
    
    if (outsideRadiusShows && outsideRadiusShows.length > 0) {
      console.log(`3. ❌ nearby_shows RPC returning shows outside radius - check function implementation`);
    }
    
    if (outsideRadiusFiltered && outsideRadiusFiltered.length > 0) {
      console.log(`4. ❌ find_filtered_shows RPC returning shows outside radius - check function implementation`);
    }
    
    if (outsideRadiusOnly && outsideRadiusOnly.length > 0) {
      console.log(`5. ❌ find_shows_within_radius RPC returning shows outside radius - check function implementation`);
    }
    
    if (outsideRadiusPaginated && outsideRadiusPaginated.length > 0) {
      console.log(`6. ❌ get_paginated_shows RPC returning shows outside radius - check function implementation`);
    }
    
    console.log('\nRECOMMENDED FIXES:');
    console.log('1. Ensure user has a valid home ZIP code in their profile');
    console.log('2. Check RPC function implementations for proper radius filtering');
    console.log('3. Verify coordinates are stored correctly (not swapped) in the database');
    console.log('4. Add client-side distance filtering as a safety measure');
    console.log('5. If emergency fallback is triggered, add a warning to the UI');
    
  } catch (error) {
    console.error('Unhandled error in debug script:', error);
  }
}

// Run the debug function
debugLocationIssue().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
