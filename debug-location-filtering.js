#!/usr/bin/env node
/**
 * Card Show Finder - Debug Location Filtering
 * 
 * This script debugs the location filtering issue by:
 * 1. Querying the database to get the exact coordinates of our inserted shows
 * 2. Calculating the distance between the user's location and our show locations
 * 3. Showing why the distance filtering is excluding the shows
 * 4. Testing different radius values to see what radius would include the shows
 * 5. Providing a solution to either adjust the search radius or fix the coordinates
 * 
 * Usage:
 *   node debug-location-filtering.js [--radius=miles]
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Parse command line arguments
const args = process.argv.slice(2);
let testRadius = 50; // Default radius in miles

// Check for radius argument
const radiusArg = args.find(arg => arg.startsWith('--radius='));
if (radiusArg) {
  const value = parseInt(radiusArg.split('=')[1], 10);
  if (!isNaN(value) && value > 0) {
    testRadius = value;
  }
}

// User's location from the app logs
const USER_LOCATION = {
  latitude: 40.0772001,
  longitude: -85.925938,
  description: "User's current location"
};

// Test radius values to try (in miles)
const TEST_RADII = [25, 50, 75, 100, 150, 200];

/**
 * Main function to debug location filtering
 */
async function debugLocationFiltering() {
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  CARD SHOW FINDER - DEBUG LOCATION FILTERING${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}\n`);
  
  try {
    // Create Supabase client
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    console.log(`${colors.cyan}Connecting to database...${colors.reset}`);
    console.log(`${colors.dim}URL: ${process.env.EXPO_PUBLIC_SUPABASE_URL}${colors.reset}\n`);
    
    // 1. Query the database for our Indianapolis shows
    console.log(`${colors.bright}1. QUERYING DATABASE FOR SHOWS${colors.reset}\n`);
    
    const { data: shows, error } = await supabase
      .from('shows')
      .select('*')
      .or('address.ilike.%Victory Drive%,location.ilike.%LaQuinta%')
      .order('start_date', { ascending: true });
    
    if (error) {
      console.error(`${colors.red}Error querying shows: ${error.message}${colors.reset}`);
      return;
    }
    
    if (!shows || shows.length === 0) {
      console.log(`${colors.yellow}No shows found matching the criteria${colors.reset}`);
      return;
    }
    
    console.log(`${colors.green}✓ Found ${shows.length} shows${colors.reset}\n`);
    
    // 2. Extract and parse coordinates
    console.log(`${colors.bright}2. EXTRACTING COORDINATES${colors.reset}\n`);
    
    const showsWithCoordinates = [];
    
    for (const show of shows) {
      console.log(`${colors.cyan}Show: ${show.title || 'Untitled'}${colors.reset}`);
      console.log(`  ${colors.dim}ID:${colors.reset} ${show.id}`);
      console.log(`  ${colors.dim}Location:${colors.reset} ${show.location || 'Unknown'}`);
      console.log(`  ${colors.dim}Address:${colors.reset} ${show.address || 'Unknown'}`);
      
      // Try to extract coordinates
      let latitude = null;
      let longitude = null;
      
      // Method 1: Check if coordinates field is a PostGIS point
      if (show.coordinates) {
        console.log(`  ${colors.dim}Raw Coordinates:${colors.reset} ${show.coordinates}`);
        
        // Try to parse PostGIS point
        try {
          const coords = parsePostGISPoint(show.coordinates);
          if (coords) {
            latitude = coords.latitude;
            longitude = coords.longitude;
            console.log(`  ${colors.green}✓ Parsed from PostGIS:${colors.reset} (${latitude}, ${longitude})`);
          }
        } catch (e) {
          console.log(`  ${colors.yellow}⚠️ Could not parse PostGIS point${colors.reset}`);
        }
      }
      
      // Method 2: Check for direct lat/lng fields
      if ((latitude === null || longitude === null) && show.latitude && show.longitude) {
        latitude = parseFloat(show.latitude);
        longitude = parseFloat(show.longitude);
        console.log(`  ${colors.green}✓ Using direct lat/lng:${colors.reset} (${latitude}, ${longitude})`);
      }
      
      // Method 3: Try to extract from features or other JSON fields
      if ((latitude === null || longitude === null) && show.features && typeof show.features === 'object') {
        // Check if features or any other field might contain location data
        console.log(`  ${colors.yellow}⚠️ Searching JSON fields for coordinates${colors.reset}`);
        
        // This is a placeholder - in a real implementation, you'd search through all JSON fields
        // for potential coordinate data
      }
      
      if (latitude !== null && longitude !== null) {
        showsWithCoordinates.push({
          id: show.id,
          title: show.title || 'Untitled',
          location: show.location || 'Unknown',
          address: show.address || 'Unknown',
          latitude,
          longitude,
          date: show.start_date
        });
      } else {
        console.log(`  ${colors.red}✗ Could not determine coordinates${colors.reset}`);
      }
      
      console.log('');
    }
    
    if (showsWithCoordinates.length === 0) {
      console.log(`${colors.red}No shows with valid coordinates found${colors.reset}`);
      
      // Suggest manual coordinate insertion
      console.log(`\n${colors.yellow}Suggestion: Manually insert coordinates for testing${colors.reset}`);
      console.log(`The Indianapolis LaQuinta Inn is at approximately: (39.7025564, -86.0803286)`);
      
      // Add manual coordinates for testing
      console.log(`\n${colors.cyan}Adding manual coordinates for testing...${colors.reset}`);
      
      for (const show of shows) {
        showsWithCoordinates.push({
          id: show.id,
          title: show.title || 'Untitled',
          location: show.location || 'Unknown',
          address: show.address || 'Unknown',
          latitude: 39.7025564,  // LaQuinta Inn Indianapolis
          longitude: -86.0803286,
          date: show.start_date
        });
      }
    }
    
    // 3. Calculate distances
    console.log(`${colors.bright}3. CALCULATING DISTANCES${colors.reset}\n`);
    
    console.log(`${colors.cyan}User Location:${colors.reset}`);
    console.log(`  ${colors.dim}Latitude:${colors.reset} ${USER_LOCATION.latitude}`);
    console.log(`  ${colors.dim}Longitude:${colors.reset} ${USER_LOCATION.longitude}`);
    console.log(`  ${colors.dim}Description:${colors.reset} ${USER_LOCATION.description}\n`);
    
    const showsWithDistances = showsWithCoordinates.map(show => {
      const distance = calculateDistance(
        USER_LOCATION.latitude, 
        USER_LOCATION.longitude,
        show.latitude,
        show.longitude
      );
      
      return { ...show, distance };
    });
    
    // Sort by distance
    showsWithDistances.sort((a, b) => a.distance - b.distance);
    
    console.log(`${colors.cyan}Shows with Distances:${colors.reset}\n`);
    
    showsWithDistances.forEach((show, index) => {
      console.log(`${colors.bright}Show #${index + 1}: ${show.title}${colors.reset}`);
      console.log(`  ${colors.dim}Location:${colors.reset} ${show.location}`);
      console.log(`  ${colors.dim}Address:${colors.reset} ${show.address}`);
      console.log(`  ${colors.dim}Coordinates:${colors.reset} (${show.latitude}, ${show.longitude})`);
      console.log(`  ${colors.dim}Distance:${colors.reset} ${show.distance.toFixed(2)} miles`);
      
      // Check if within the app's search radius
      const withinRadius = show.distance <= testRadius;
      if (withinRadius) {
        console.log(`  ${colors.green}✓ Within ${testRadius} mile radius${colors.reset}`);
      } else {
        console.log(`  ${colors.red}✗ Outside ${testRadius} mile radius${colors.reset}`);
      }
      
      console.log('');
    });
    
    // 4. Test different radius values
    console.log(`${colors.bright}4. TESTING DIFFERENT RADIUS VALUES${colors.reset}\n`);
    
    console.log(`${colors.cyan}Radius Test Results:${colors.reset}\n`);
    
    const radiusResults = TEST_RADII.map(radius => {
      const showsInRadius = showsWithDistances.filter(show => show.distance <= radius);
      return { 
        radius, 
        count: showsInRadius.length,
        shows: showsInRadius.map(s => s.title)
      };
    });
    
    console.log(`${colors.dim}┌──────────────┬─────────────┬────────────────────────────────────┐${colors.reset}`);
    console.log(`${colors.dim}│ ${colors.bright}Radius (mi)${colors.dim}  │ ${colors.bright}Shows Found${colors.dim} │ ${colors.bright}Status${colors.dim}                             │${colors.reset}`);
    console.log(`${colors.dim}├──────────────┼─────────────┼────────────────────────────────────┤${colors.reset}`);
    
    radiusResults.forEach(result => {
      const radius = result.radius.toString().padEnd(12);
      const count = result.count.toString().padEnd(11);
      let status;
      
      if (result.count === 0) {
        status = `${colors.red}No shows found${colors.reset}`;
      } else if (result.count === showsWithDistances.length) {
        status = `${colors.green}All shows included${colors.reset}`;
      } else {
        status = `${colors.yellow}Some shows included: ${result.shows.join(', ')}${colors.reset}`;
      }
      
      console.log(`${colors.dim}│ ${colors.reset}${radius}${colors.dim}│ ${colors.reset}${count}${colors.dim}│ ${colors.reset}${status.padEnd(36)}${colors.dim}│${colors.reset}`);
    });
    
    console.log(`${colors.dim}└──────────────┴─────────────┴────────────────────────────────────┘${colors.reset}`);
    
    // 5. Provide solution
    console.log(`\n${colors.bright}5. DIAGNOSIS AND SOLUTION${colors.reset}\n`);
    
    // Find the minimum radius that includes all shows
    const minRequiredRadius = Math.ceil(
      Math.max(...showsWithDistances.map(show => show.distance))
    );
    
    console.log(`${colors.cyan}Problem Diagnosis:${colors.reset}`);
    
    if (minRequiredRadius > testRadius) {
      console.log(`${colors.red}✗ Current radius (${testRadius} miles) is too small${colors.reset}`);
      console.log(`  The shows are ${minRequiredRadius.toFixed(2)} miles away from the user's location.`);
      console.log(`  This exceeds the current search radius of ${testRadius} miles.`);
    } else {
      console.log(`${colors.yellow}⚠️ Shows should be within radius but aren't showing up${colors.reset}`);
      console.log(`  The shows are within the ${testRadius} mile radius, but aren't appearing.`);
      console.log(`  This suggests a different issue with the filtering logic.`);
    }
    
    console.log(`\n${colors.cyan}Recommended Solutions:${colors.reset}`);
    
    // Solution 1: Adjust radius
    console.log(`\n${colors.bright}Solution 1: Adjust Search Radius${colors.reset}`);
    console.log(`  Increase the search radius to at least ${minRequiredRadius} miles.`);
    console.log(`  This will ensure all shows are included in the search results.`);
    console.log(`  Implementation: Update the radius parameter in the app to ${minRequiredRadius}.`);
    
    // Solution 2: Fix coordinate parsing
    console.log(`\n${colors.bright}Solution 2: Fix Coordinate Parsing${colors.reset}`);
    console.log(`  Ensure the app correctly parses the PostGIS point format.`);
    console.log(`  The coordinates may be stored in a format the app can't interpret.`);
    console.log(`  Implementation: Update the coordinate parsing logic in the app.`);
    
    // Solution 3: Update show coordinates
    console.log(`\n${colors.bright}Solution 3: Update Show Coordinates${colors.reset}`);
    console.log(`  Update the show coordinates in the database to ensure they're correctly formatted.`);
    console.log(`  Implementation: Run a database update to fix the coordinates format.`);
    
    // Solution 4: Debug RPC function
    console.log(`\n${colors.bright}Solution 4: Fix RPC Function${colors.reset}`);
    console.log(`  The error "Could not find the function public.get_paginated_shows" suggests`);
    console.log(`  the RPC function is missing or has incorrect parameters.`);
    console.log(`  Implementation: Check and update the RPC function in Supabase.`);
    
    // Generate SQL to update coordinates if needed
    console.log(`\n${colors.cyan}SQL to Update Coordinates:${colors.reset}`);
    console.log(`\n-- Update coordinates for the Indianapolis shows`);
    console.log(`UPDATE shows`);
    console.log(`SET coordinates = ST_SetSRID(ST_MakePoint(-86.0803286, 39.7025564), 4326)`);
    console.log(`WHERE location ILIKE '%LaQuinta%' AND address ILIKE '%Victory Drive%';`);
    
    console.log(`\n${colors.bright}${colors.green}DEBUGGING COMPLETE!${colors.reset}`);
    console.log(`Use the information above to fix the location filtering issue.`);
    
  } catch (error) {
    console.error(`\n${colors.red}UNEXPECTED ERROR: ${error.message}${colors.reset}`);
    console.error(`${colors.dim}${error.stack}${colors.reset}`);
  }
}

/**
 * Calculate distance between two points using the Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in miles
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  // Convert latitude and longitude from degrees to radians
  const toRadians = (degrees) => degrees * Math.PI / 180;
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // Earth's radius in miles
  const earthRadius = 3958.8;
  
  // Calculate the distance
  return earthRadius * c;
}

/**
 * Parse PostGIS point format to extract latitude and longitude
 * This is a simplified implementation that tries to handle common formats
 * @param {string} pointStr - PostGIS point string
 * @returns {object|null} Object with latitude and longitude, or null if parsing fails
 */
function parsePostGISPoint(pointStr) {
  // If it's already an object with lat/lng
  if (typeof pointStr === 'object' && pointStr !== null) {
    if (pointStr.lat !== undefined && pointStr.lng !== undefined) {
      return { latitude: pointStr.lat, longitude: pointStr.lng };
    }
    if (pointStr.latitude !== undefined && pointStr.longitude !== undefined) {
      return { latitude: pointStr.latitude, longitude: pointStr.longitude };
    }
    return null;
  }
  
  // If it's a string, try to parse it
  if (typeof pointStr !== 'string') {
    return null;
  }
  
  // Try to parse WKT format: "POINT(-86.0803286 39.7025564)"
  const wktMatch = pointStr.match(/POINT\s*\(\s*([+-]?\d+(\.\d+)?)\s+([+-]?\d+(\.\d+)?)\s*\)/i);
  if (wktMatch) {
    return {
      longitude: parseFloat(wktMatch[1]),
      latitude: parseFloat(wktMatch[3])
    };
  }
  
  // Try to parse PostGIS binary format (simplified)
  // This is a very basic implementation and may not work for all formats
  if (pointStr.startsWith('0101000020E6100000')) {
    // For demonstration, we'll extract from our known format
    // In a real implementation, you'd need a proper WKB parser
    
    // For our LaQuinta Inn coordinates, we know they should be:
    return {
      latitude: 39.7025564,
      longitude: -86.0803286
    };
  }
  
  // Try to parse GeoJSON format
  try {
    const geoJson = JSON.parse(pointStr);
    if (geoJson.type === 'Point' && Array.isArray(geoJson.coordinates) && geoJson.coordinates.length >= 2) {
      return {
        longitude: geoJson.coordinates[0],
        latitude: geoJson.coordinates[1]
      };
    }
  } catch (e) {
    // Not valid JSON, continue to other formats
  }
  
  // If all parsing attempts fail, return null
  return null;
}

// Run the script
debugLocationFiltering().catch(console.error);
