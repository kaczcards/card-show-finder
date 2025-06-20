/**
 * check-show-coordinates.js
 * 
 * This script checks the coordinates of all shows in the database to ensure they are:
 * 1. Properly formatted for PostGIS (POINT format)
 * 2. Within valid ranges (latitude: -90 to 90, longitude: -180 to 180)
 * 3. Not null or undefined
 * 
 * Usage: node check-show-coordinates.js
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

/**
 * Validates coordinates to ensure they're within proper ranges
 * @param {Object} coordinates - The coordinates object to validate
 * @returns {Object} - Validation result with isValid flag and any issues
 */
function validateCoordinates(coordinates) {
  const result = {
    isValid: true,
    issues: []
  };

  // Check if coordinates exist
  if (!coordinates) {
    result.isValid = false;
    result.issues.push('Coordinates are null or undefined');
    return result;
  }

  // Check if coordinates has the expected structure
  if (!coordinates.coordinates || !Array.isArray(coordinates.coordinates)) {
    result.isValid = false;
    result.issues.push('Coordinates are not in the expected POINT format');
    return result;
  }

  // Extract longitude and latitude from PostGIS point format
  // PostGIS POINT format is [longitude, latitude]
  const longitude = coordinates.coordinates[0];
  const latitude = coordinates.coordinates[1];

  // Check if longitude and latitude are numbers
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    result.isValid = false;
    result.issues.push('Longitude or latitude is not a number');
    return result;
  }

  // Check longitude range (-180 to 180)
  if (longitude < -180 || longitude > 180) {
    result.isValid = false;
    result.issues.push(`Longitude ${longitude} is outside valid range (-180 to 180)`);
  }

  // Check latitude range (-90 to 90)
  if (latitude < -90 || latitude > 90) {
    result.isValid = false;
    result.issues.push(`Latitude ${latitude} is outside valid range (-90 to 90)`);
  }

  // Check if longitude and latitude might be swapped
  // Most of the US is in the Western Hemisphere (negative longitude)
  // and Northern Hemisphere (positive latitude)
  if (longitude > 0 && latitude < 0) {
    result.issues.push('WARNING: Longitude is positive and latitude is negative - values might be swapped');
  }

  return result;
}

/**
 * Main function to check all show coordinates
 */
async function checkShowCoordinates() {
  console.log('Checking show coordinates in the database...');
  
  try {
    // Fetch all shows from the database
    const { data: shows, error } = await supabase
      .from('shows')
      .select('id, title, location, coordinates, status');
    
    if (error) {
      throw error;
    }
    
    console.log(`Found ${shows.length} total shows in the database.`);
    
    // Track statistics
    const stats = {
      total: shows.length,
      valid: 0,
      invalid: 0,
      missing: 0,
      active: 0,
      activeWithValidCoords: 0,
      issues: []
    };
    
    // Check each show's coordinates
    shows.forEach(show => {
      const isActive = show.status === 'ACTIVE';
      if (isActive) stats.active++;
      
      if (!show.coordinates) {
        stats.missing++;
        stats.issues.push({
          showId: show.id,
          title: show.title,
          location: show.location,
          status: show.status,
          issue: 'Missing coordinates'
        });
        return;
      }
      
      const validation = validateCoordinates(show.coordinates);
      
      if (validation.isValid) {
        stats.valid++;
        if (isActive) stats.activeWithValidCoords++;
      } else {
        stats.invalid++;
        stats.issues.push({
          showId: show.id,
          title: show.title,
          location: show.location,
          status: show.status,
          coordinates: show.coordinates,
          issues: validation.issues
        });
      }
    });
    
    // Print summary
    console.log('\n--- COORDINATE CHECK SUMMARY ---');
    console.log(`Total shows: ${stats.total}`);
    console.log(`Active shows: ${stats.active}`);
    console.log(`Shows with valid coordinates: ${stats.valid} (${Math.round(stats.valid / stats.total * 100)}%)`);
    console.log(`Shows with invalid coordinates: ${stats.invalid} (${Math.round(stats.invalid / stats.total * 100)}%)`);
    console.log(`Shows missing coordinates: ${stats.missing} (${Math.round(stats.missing / stats.total * 100)}%)`);
    console.log(`Active shows with valid coordinates: ${stats.activeWithValidCoords} (${Math.round(stats.activeWithValidCoords / stats.active * 100)}% of active)`);
    
    // Print issues if any
    if (stats.issues.length > 0) {
      console.log('\n--- ISSUES FOUND ---');
      stats.issues.forEach((issue, index) => {
        console.log(`\n[${index + 1}] Show: "${issue.title}" (ID: ${issue.showId})`);
        console.log(`    Location: ${issue.location}`);
        console.log(`    Status: ${issue.status}`);
        if (issue.coordinates) {
          console.log(`    Coordinates: ${JSON.stringify(issue.coordinates)}`);
        }
        if (issue.issue) {
          console.log(`    Issue: ${issue.issue}`);
        } else if (issue.issues) {
          console.log(`    Issues:`);
          issue.issues.forEach(i => console.log(`      - ${i}`));
        }
      });
    } else {
      console.log('\nNo issues found with coordinates!');
    }

    // Provide recommendations
    console.log('\n--- RECOMMENDATIONS ---');
    if (stats.invalid > 0 || stats.missing > 0) {
      console.log('1. Fix the coordinates for shows with issues');
      console.log('2. Ensure coordinates are stored in the correct PostGIS format: POINT(longitude latitude)');
      console.log('3. Remember that longitude ranges from -180 to 180, and latitude from -90 to 90');
      console.log('4. For US locations, longitude is typically negative (Western Hemisphere)');
    } else {
      console.log('All coordinates appear to be valid. If shows are still not appearing in the app:');
      console.log('1. Check that the user\'s location is being correctly resolved');
      console.log('2. Verify that the date filtering is working correctly');
      console.log('3. Ensure the PostGIS functions are properly implemented and accessible');
    }
    
  } catch (err) {
    console.error('Error checking coordinates:', err);
  }
}

// Run the main function
checkShowCoordinates().catch(err => {
  console.error('Unhandled error:', err);
});
