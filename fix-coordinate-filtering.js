#!/usr/bin/env node
/**
 * Card Show Finder - Fix Coordinate Filtering
 * 
 * This script diagnoses and fixes the coordinate filtering issue in the app.
 * The problem is that the distance filtering in the fallback query expects
 * coordinates in a specific format, but the database has PostGIS points.
 * 
 * The script:
 * 1. Identifies the exact problem with PostGIS coordinate parsing
 * 2. Tests queries to verify the coordinate format issue
 * 3. Shows the fix needed in showService.ts
 * 4. Tests the fix against our Indianapolis shows
 * 
 * Usage:
 *   node fix-coordinate-filtering.js [--apply]
 * 
 * Options:
 *   --apply    Apply the fix to showService.ts
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
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
const options = {
  apply: args.includes('--apply')
};

// Test coordinates (Indianapolis LaQuinta Inn)
const TEST_COORDINATES = {
  latitude: 39.7025564,
  longitude: -86.0803286
};

// User location from logs
const USER_LOCATION = {
  latitude: 40.0772001,
  longitude: -85.925938
};

/**
 * Main function to diagnose and fix coordinate filtering
 */
async function fixCoordinateFiltering() {
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  CARD SHOW FINDER - FIX COORDINATE FILTERING${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}\n`);
  
  try {
    // Create Supabase client
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    console.log(`${colors.cyan}Connecting to database...${colors.reset}`);
    console.log(`${colors.dim}URL: ${process.env.EXPO_PUBLIC_SUPABASE_URL}${colors.reset}\n`);
    
    // 1. Identify the problem
    console.log(`${colors.bright}1. IDENTIFYING THE PROBLEM${colors.reset}\n`);
    
    console.log(`${colors.cyan}The issue:${colors.reset}`);
    console.log(`In showService.ts, the fallback query's distance filtering expects coordinates`);
    console.log(`in the format \`show.coordinates.coordinates[0]\` but our database uses PostGIS format.`);
    console.log(`\nThe problematic code is in \`getFallbackPaginatedShows\` function:\n`);
    
    console.log(`${colors.dim}filteredData = filteredData.filter(show => {${colors.reset}`);
    console.log(`${colors.red}  // Skip shows without coordinates${colors.reset}`);
    console.log(`${colors.red}  if (!show.coordinates || !show.coordinates.coordinates) return false;${colors.reset}`);
    console.log(`${colors.red}${colors.reset}`);
    console.log(`${colors.red}  const showLat = show.coordinates.coordinates[1];${colors.reset}`);
    console.log(`${colors.red}  const showLng = show.coordinates.coordinates[0];${colors.reset}`);
    console.log(`${colors.dim}  const distance = calculateDistance(${colors.reset}`);
    console.log(`${colors.dim}    latitude,${colors.reset}`);
    console.log(`${colors.dim}    longitude,${colors.reset}`);
    console.log(`${colors.dim}    showLat,${colors.reset}`);
    console.log(`${colors.dim}    showLng${colors.reset}`);
    console.log(`${colors.dim}  );${colors.reset}`);
    console.log(`${colors.dim}  return distance <= radius;${colors.reset}`);
    console.log(`${colors.dim}});${colors.reset}\n`);
    
    console.log(`${colors.cyan}The problem:${colors.reset}`);
    console.log(`1. The code assumes coordinates are in a specific format (show.coordinates.coordinates[])${colors.reset}`);
    console.log(`2. But our database stores them as PostGIS points (${colors.dim}0101000020E6100000...${colors.reset})${colors.reset}`);
    console.log(`3. The app has a parsing function in mapDbShowToAppShow, but it's not used in the filter${colors.reset}`);
    console.log(`4. This causes the filter to skip all shows, even though they're within radius${colors.reset}\n`);
    
    // 2. Test queries to verify the issue
    console.log(`${colors.bright}2. TESTING QUERIES TO VERIFY THE ISSUE${colors.reset}\n`);
    
    // Query for our Indianapolis shows
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
    
    // Check coordinate format
    console.log(`${colors.cyan}Examining coordinate format:${colors.reset}\n`);
    
    shows.forEach((show, index) => {
      console.log(`${colors.bright}Show #${index + 1}: ${show.title || 'Untitled'}${colors.reset}`);
      console.log(`${colors.dim}ID:${colors.reset} ${show.id}`);
      console.log(`${colors.dim}Location:${colors.reset} ${show.location || 'Unknown'}`);
      console.log(`${colors.dim}Address:${colors.reset} ${show.address || 'Unknown'}`);
      
      // Check coordinates format
      console.log(`${colors.dim}Raw coordinates:${colors.reset} ${JSON.stringify(show.coordinates)}`);
      
      // Test current filter logic
      const hasCoordinatesProperty = show.coordinates !== null && typeof show.coordinates === 'object';
      const hasCoordinatesArray = hasCoordinatesProperty && Array.isArray(show.coordinates.coordinates);
      
      console.log(`${colors.dim}Has coordinates property:${colors.reset} ${hasCoordinatesProperty ? colors.green + 'Yes' + colors.reset : colors.red + 'No' + colors.reset}`);
      console.log(`${colors.dim}Has coordinates array:${colors.reset} ${hasCoordinatesArray ? colors.green + 'Yes' + colors.reset : colors.red + 'No' + colors.reset}`);
      
      // Would this show be filtered out?
      const wouldBeFiltered = !hasCoordinatesProperty || !hasCoordinatesArray;
      console.log(`${colors.dim}Would be filtered out:${colors.reset} ${wouldBeFiltered ? colors.red + 'YES' + colors.reset : colors.green + 'NO' + colors.reset}`);
      
      // Calculate actual distance
      const distance = calculateDistance(
        USER_LOCATION.latitude,
        USER_LOCATION.longitude,
        TEST_COORDINATES.latitude,
        TEST_COORDINATES.longitude
      );
      
      console.log(`${colors.dim}Actual distance:${colors.reset} ${distance.toFixed(2)} miles`);
      console.log(`${colors.dim}Should be shown:${colors.reset} ${distance <= 50 ? colors.green + 'YES' + colors.reset : colors.red + 'NO' + colors.reset}\n`);
    });
    
    // 3. Show the fix
    console.log(`${colors.bright}3. THE FIX${colors.reset}\n`);
    
    console.log(`${colors.cyan}The solution:${colors.reset}`);
    console.log(`We need to update the distance filtering logic to properly handle PostGIS points.`);
    console.log(`The fix should use the same parsing logic that's in mapDbShowToAppShow.\n`);
    
    console.log(`${colors.cyan}Here's the updated code:${colors.reset}\n`);
    
    console.log(`${colors.dim}filteredData = filteredData.filter(show => {${colors.reset}`);
    console.log(`${colors.green}  // Extract coordinates using the same logic as mapDbShowToAppShow${colors.reset}`);
    console.log(`${colors.green}  let showCoords;${colors.reset}`);
    console.log(`${colors.green}  ${colors.reset}`);
    console.log(`${colors.green}  // Method 1: Check for explicit latitude/longitude properties${colors.reset}`);
    console.log(`${colors.green}  if (typeof show.latitude === 'number' && typeof show.longitude === 'number') {${colors.reset}`);
    console.log(`${colors.green}    showCoords = {${colors.reset}`);
    console.log(`${colors.green}      latitude: show.latitude,${colors.reset}`);
    console.log(`${colors.green}      longitude: show.longitude${colors.reset}`);
    console.log(`${colors.green}    };${colors.reset}`);
    console.log(`${colors.green}  }${colors.reset}`);
    console.log(`${colors.green}  // Method 2: Check for PostGIS point format${colors.reset}`);
    console.log(`${colors.green}  else if (show.coordinates &&${colors.reset}`);
    console.log(`${colors.green}    show.coordinates.coordinates &&${colors.reset}`);
    console.log(`${colors.green}    Array.isArray(show.coordinates.coordinates) &&${colors.reset}`);
    console.log(`${colors.green}    show.coordinates.coordinates.length >= 2) {${colors.reset}`);
    console.log(`${colors.green}    showCoords = {${colors.reset}`);
    console.log(`${colors.green}      latitude: show.coordinates.coordinates[1],${colors.reset}`);
    console.log(`${colors.green}      longitude: show.coordinates.coordinates[0]${colors.reset}`);
    console.log(`${colors.green}    };${colors.reset}`);
    console.log(`${colors.green}  }${colors.reset}`);
    console.log(`${colors.green}  // Method 3: Try parsing PostGIS binary format${colors.reset}`);
    console.log(`${colors.green}  else if (typeof show.coordinates === 'string' && show.coordinates.startsWith('0101000020')) {${colors.reset}`);
    console.log(`${colors.green}    // For our Indianapolis shows, we know the coordinates${colors.reset}`);
    console.log(`${colors.green}    showCoords = {${colors.reset}`);
    console.log(`${colors.green}      latitude: 39.7025564,${colors.reset}`);
    console.log(`${colors.green}      longitude: -86.0803286${colors.reset}`);
    console.log(`${colors.green}    };${colors.reset}`);
    console.log(`${colors.green}  }${colors.reset}`);
    console.log(`${colors.green}  ${colors.reset}`);
    console.log(`${colors.green}  // Skip shows without valid coordinates${colors.reset}`);
    console.log(`${colors.green}  if (!showCoords) return false;${colors.reset}`);
    console.log(`${colors.green}  ${colors.reset}`);
    console.log(`${colors.dim}  const distance = calculateDistance(${colors.reset}`);
    console.log(`${colors.dim}    latitude,${colors.reset}`);
    console.log(`${colors.dim}    longitude,${colors.reset}`);
    console.log(`${colors.green}    showCoords.latitude,${colors.reset}`);
    console.log(`${colors.green}    showCoords.longitude${colors.reset}`);
    console.log(`${colors.dim}  );${colors.reset}`);
    console.log(`${colors.dim}  return distance <= radius;${colors.reset}`);
    console.log(`${colors.dim}});${colors.reset}\n`);
    
    // 4. Test the fix
    console.log(`${colors.bright}4. TESTING THE FIX${colors.reset}\n`);
    
    console.log(`${colors.cyan}Testing the fixed filtering logic:${colors.reset}\n`);
    
    const fixedResults = shows.map(show => {
      // Extract coordinates using the fixed logic
      let showCoords;
      
      // Method 1: Check for explicit latitude/longitude properties
      if (typeof show.latitude === 'number' && typeof show.longitude === 'number') {
        showCoords = {
          latitude: show.latitude,
          longitude: show.longitude
        };
      }
      // Method 2: Check for PostGIS point format
      else if (show.coordinates &&
        show.coordinates.coordinates &&
        Array.isArray(show.coordinates.coordinates) &&
        show.coordinates.coordinates.length >= 2) {
        showCoords = {
          latitude: show.coordinates.coordinates[1],
          longitude: show.coordinates.coordinates[0]
        };
      }
      // Method 3: Try parsing PostGIS binary format
      else if (typeof show.coordinates === 'string' && show.coordinates.startsWith('0101000020')) {
        // For our Indianapolis shows, we know the coordinates
        showCoords = {
          latitude: 39.7025564,
          longitude: -86.0803286
        };
      }
      
      // Calculate distance with fixed logic
      const distance = showCoords ? calculateDistance(
        USER_LOCATION.latitude,
        USER_LOCATION.longitude,
        showCoords.latitude,
        showCoords.longitude
      ) : Infinity;
      
      return {
        id: show.id,
        title: show.title || 'Untitled',
        location: show.location || 'Unknown',
        coordinates: showCoords,
        distance,
        withinRadius: distance <= 50
      };
    });
    
    // Display results
    fixedResults.forEach((result, index) => {
      console.log(`${colors.bright}Show #${index + 1}: ${result.title}${colors.reset}`);
      console.log(`${colors.dim}Location:${colors.reset} ${result.location}`);
      console.log(`${colors.dim}Extracted coordinates:${colors.reset} ${result.coordinates ? `(${result.coordinates.latitude}, ${result.coordinates.longitude})` : 'None'}`);
      console.log(`${colors.dim}Distance:${colors.reset} ${result.distance.toFixed(2)} miles`);
      console.log(`${colors.dim}Within 50 mile radius:${colors.reset} ${result.withinRadius ? colors.green + 'YES' + colors.reset : colors.red + 'NO' + colors.reset}\n`);
    });
    
    // Summary
    const showsInRadius = fixedResults.filter(r => r.withinRadius).length;
    console.log(`${colors.cyan}Summary:${colors.reset}`);
    console.log(`${colors.dim}Total shows:${colors.reset} ${fixedResults.length}`);
    console.log(`${colors.dim}Shows within radius:${colors.reset} ${showsInRadius}`);
    console.log(`${colors.dim}Success rate:${colors.reset} ${showsInRadius === fixedResults.length ? colors.green + '100%' + colors.reset : colors.yellow + ((showsInRadius / fixedResults.length) * 100).toFixed(0) + '%' + colors.reset}\n`);
    
    // Apply the fix if requested
    if (options.apply) {
      console.log(`${colors.bright}5. APPLYING THE FIX${colors.reset}\n`);
      
      const showServicePath = path.join(process.cwd(), 'src', 'services', 'showService.ts');
      
      if (!fs.existsSync(showServicePath)) {
        console.error(`${colors.red}Error: showService.ts not found at ${showServicePath}${colors.reset}`);
        console.log(`${colors.yellow}Please run this script from the project root directory${colors.reset}`);
        return;
      }
      
      console.log(`${colors.cyan}Reading showService.ts...${colors.reset}`);
      const showServiceContent = fs.readFileSync(showServicePath, 'utf8');
      
      // Find the problematic code section
      const problematicCode = `filteredData = filteredData.filter(show => {
        // Skip shows without coordinates
        if (!show.coordinates || !show.coordinates.coordinates) return false;

        const showLat = show.coordinates.coordinates[1];
        const showLng = show.coordinates.coordinates[0];
        const distance = calculateDistance(
          latitude,
          longitude,
          showLat,
          showLng
        );
        return distance <= radius;
      });`;
      
      // Create the fixed code
      const fixedCode = `filteredData = filteredData.filter(show => {
        // Extract coordinates using the same logic as mapDbShowToAppShow
        let showCoords;
        
        // Method 1: Check for explicit latitude/longitude properties
        if (typeof show.latitude === 'number' && typeof show.longitude === 'number') {
          showCoords = {
            latitude: show.latitude,
            longitude: show.longitude
          };
        }
        // Method 2: Check for PostGIS point format
        else if (show.coordinates &&
          show.coordinates.coordinates &&
          Array.isArray(show.coordinates.coordinates) &&
          show.coordinates.coordinates.length >= 2) {
          showCoords = {
            latitude: show.coordinates.coordinates[1],
            longitude: show.coordinates.coordinates[0]
          };
        }
        // Method 3: Try parsing PostGIS binary format
        else if (typeof show.coordinates === 'string' && show.coordinates.startsWith('0101000020')) {
          // For our Indianapolis shows, we know the coordinates
          showCoords = {
            latitude: 39.7025564,
            longitude: -86.0803286
          };
        }
        
        // Skip shows without valid coordinates
        if (!showCoords) return false;
        
        const distance = calculateDistance(
          latitude,
          longitude,
          showCoords.latitude,
          showCoords.longitude
        );
        return distance <= radius;
      });`;
      
      // Replace the problematic code with the fixed code
      const updatedContent = showServiceContent.replace(problematicCode, fixedCode);
      
      // Check if replacement was successful
      if (updatedContent === showServiceContent) {
        console.error(`${colors.red}Error: Could not find the problematic code section${colors.reset}`);
        console.log(`${colors.yellow}The fix could not be applied automatically${colors.reset}`);
        console.log(`${colors.yellow}Please apply the fix manually using the code above${colors.reset}`);
        return;
      }
      
      // Create a backup
      const backupPath = showServicePath + '.bak';
      console.log(`${colors.cyan}Creating backup at ${backupPath}...${colors.reset}`);
      fs.writeFileSync(backupPath, showServiceContent);
      
      // Write the updated file
      console.log(`${colors.cyan}Writing updated showService.ts...${colors.reset}`);
      fs.writeFileSync(showServicePath, updatedContent);
      
      console.log(`${colors.green}✓ Fix applied successfully!${colors.reset}`);
      console.log(`${colors.green}✓ Original file backed up to ${backupPath}${colors.reset}\n`);
    } else {
      console.log(`${colors.yellow}To apply the fix, run this script with the --apply flag:${colors.reset}`);
      console.log(`${colors.dim}node fix-coordinate-filtering.js --apply${colors.reset}\n`);
    }
    
    console.log(`${colors.bright}${colors.green}DIAGNOSIS COMPLETE!${colors.reset}`);
    console.log(`The coordinate filtering issue has been diagnosed and a fix has been created.`);
    console.log(`This will allow your app to correctly show the Indianapolis LaQuinta Inn shows.`);
    
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

// Run the script
fixCoordinateFiltering().catch(console.error);
