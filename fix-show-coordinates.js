/**
 * fix-show-coordinates.js
 * 
 * This script fixes coordinates for shows in the database by:
 * 1. Geocoding locations for shows missing coordinates
 * 2. Fixing incorrectly formatted coordinates
 * 
 * Usage: node fix-show-coordinates.js [--dry-run]
 */

// Load environment variables from .env file
require('dotenv').config();

// Import required packages
const { createClient } = require('@supabase/supabase-js');
const NodeGeocoder = require('node-geocoder');
const { v4: uuidv4 } = require('uuid');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Check for dry run flag
const isDryRun = process.argv.includes('--dry-run');
if (isDryRun) {
  console.log('🔍 DRY RUN MODE: No changes will be made to the database');
}

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration. Please check your .env file.');
  process.exit(1);
}

if (!googleMapsApiKey) {
  console.error('Missing Google Maps API key. Please check your .env file.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize geocoder
const geocoder = NodeGeocoder({
  provider: 'google',
  apiKey: googleMapsApiKey,
  formatter: null
});

/**
 * Convert latitude and longitude to PostGIS POINT format
 * @param {number} longitude - Longitude coordinate
 * @param {number} latitude - Latitude coordinate
 * @returns {string} - PostGIS POINT string
 */
function toPostGisPoint(longitude, latitude) {
  return `POINT(${longitude} ${latitude})`;
}

/**
 * Attempt to extract coordinates from a WKB hex string
 * This is a simplified approach that won't work for all cases
 * but might help identify some issues
 * @param {string} wkbHex - WKB hex string from PostGIS
 * @returns {Object|null} - Extracted coordinates or null if extraction failed
 */
function attemptExtractFromWkbHex(wkbHex) {
  try {
    // This is a very simplified approach and won't work for all WKB formats
    // For a proper solution, a WKB parser library would be needed
    console.log(`Cannot extract coordinates from WKB hex: ${wkbHex}`);
    return null;
  } catch (err) {
    console.error('Error extracting coordinates from WKB hex:', err);
    return null;
  }
}

/**
 * Geocode an address or location name
 * @param {string} address - Address or location to geocode
 * @param {string} city - Optional city name to append
 * @returns {Object|null} - Geocoded coordinates or null if geocoding failed
 */
async function geocodeLocation(address, city = null) {
  try {
    const searchText = city ? `${address}, ${city}` : address;
    
    // Add ", USA" if not already present and not international
    const searchQuery = searchText.toLowerCase().includes('usa') || 
                        searchText.toLowerCase().includes('united states') ||
                        searchText.toLowerCase().includes('south africa') ||
                        searchText.toLowerCase().includes('germany') ||
                        searchText.toLowerCase().includes('italy')
      ? searchText
      : `${searchText}, USA`;
    
    console.log(`Geocoding: "${searchQuery}"`);
    
    const results = await geocoder.geocode(searchQuery);
    
    if (results && results.length > 0) {
      return {
        latitude: results[0].latitude,
        longitude: results[0].longitude,
        formattedAddress: results[0].formattedAddress
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error geocoding "${address}":`, err);
    return null;
  }
}

/**
 * Update show coordinates in the database
 * @param {string} showId - ID of the show to update
 * @param {number} longitude - Longitude coordinate
 * @param {number} latitude - Latitude coordinate
 * @returns {boolean} - Success status
 */
async function updateShowCoordinates(showId, longitude, latitude) {
  try {
    if (isDryRun) {
      console.log(`Would update show ${showId} with coordinates: ${longitude}, ${latitude}`);
      return true;
    }
    
    // Create the PostGIS POINT string
    const pointStr = toPostGisPoint(longitude, latitude);
    
    // Update the show in the database
    const { error } = await supabase
      .from('shows')
      .update({
        coordinates: pointStr
      })
      .eq('id', showId);
    
    if (error) {
      console.error(`Error updating show ${showId}:`, error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`Error updating show ${showId}:`, err);
    return false;
  }
}

/**
 * Process a batch of shows to fix or add coordinates
 * @param {Array} shows - Array of show objects to process
 * @returns {Object} - Statistics about the processing
 */
async function processShows(shows) {
  const stats = {
    total: shows.length,
    geocoded: 0,
    fixed: 0,
    failed: 0,
    skipped: 0,
    details: []
  };
  
  for (const show of shows) {
    console.log(`\nProcessing show: "${show.title}" (${show.id})`);
    console.log(`  Location: ${show.location}`);
    console.log(`  Status: ${show.status}`);
    
    let result = {
      id: show.id,
      title: show.title,
      location: show.location,
      status: show.status,
      action: null,
      success: false,
      details: null
    };
    
    // Case 1: Missing coordinates - need to geocode
    if (!show.coordinates) {
      console.log('  Missing coordinates - attempting to geocode...');
      
      // Extract city from location if it's a simple "City, State" format
      const locationParts = show.location.split(',');
      const city = locationParts[0].trim();
      
      // Try to geocode the location
      const geocodeResult = await geocodeLocation(show.location);
      
      if (geocodeResult) {
        console.log(`  ✓ Successfully geocoded to: ${geocodeResult.formattedAddress}`);
        console.log(`    Coordinates: ${geocodeResult.longitude}, ${geocodeResult.latitude}`);
        
        const updateSuccess = await updateShowCoordinates(
          show.id, 
          geocodeResult.longitude, 
          geocodeResult.latitude
        );
        
        if (updateSuccess) {
          stats.geocoded++;
          result.action = 'geocoded';
          result.success = true;
          result.details = {
            coordinates: {
              longitude: geocodeResult.longitude,
              latitude: geocodeResult.latitude
            },
            formattedAddress: geocodeResult.formattedAddress
          };
        } else {
          stats.failed++;
          result.action = 'geocode_update_failed';
          result.success = false;
        }
      } else {
        console.log('  ✗ Geocoding failed');
        stats.failed++;
        result.action = 'geocode_failed';
        result.success = false;
      }
    }
    // Case 2: Malformed coordinates - need to fix
    else if (typeof show.coordinates === 'string' && show.coordinates.startsWith('0101')) {
      console.log('  Malformed coordinates (WKB hex) - attempting to fix...');
      
      // For WKB hex strings, we need to re-geocode since we can't easily extract coordinates
      const geocodeResult = await geocodeLocation(show.location);
      
      if (geocodeResult) {
        console.log(`  ✓ Successfully re-geocoded to: ${geocodeResult.formattedAddress}`);
        console.log(`    New coordinates: ${geocodeResult.longitude}, ${geocodeResult.latitude}`);
        
        const updateSuccess = await updateShowCoordinates(
          show.id, 
          geocodeResult.longitude, 
          geocodeResult.latitude
        );
        
        if (updateSuccess) {
          stats.fixed++;
          result.action = 'fixed_wkb';
          result.success = true;
          result.details = {
            coordinates: {
              longitude: geocodeResult.longitude,
              latitude: geocodeResult.latitude
            },
            formattedAddress: geocodeResult.formattedAddress
          };
        } else {
          stats.failed++;
          result.action = 'fix_update_failed';
          result.success = false;
        }
      } else {
        console.log('  ✗ Re-geocoding failed');
        stats.failed++;
        result.action = 'regeocoding_failed';
        result.success = false;
      }
    }
    // Case 3: Already has valid coordinates
    else {
      console.log('  Already has valid coordinates - skipping');
      stats.skipped++;
      result.action = 'skipped';
      result.success = true;
    }
    
    stats.details.push(result);
  }
  
  return stats;
}

/**
 * Generate a report of the processing results
 * @param {Object} stats - Statistics from processing
 */
function generateReport(stats) {
  console.log('\n\n========================================');
  console.log('COORDINATE FIXING REPORT');
  console.log('========================================');
  console.log(`Total shows processed: ${stats.total}`);
  console.log(`Shows geocoded: ${stats.geocoded}`);
  console.log(`Shows fixed: ${stats.fixed}`);
  console.log(`Shows failed: ${stats.failed}`);
  console.log(`Shows skipped: ${stats.skipped}`);
  
  if (stats.failed > 0) {
    console.log('\nFailed shows:');
    stats.details
      .filter(detail => !detail.success)
      .forEach((detail, i) => {
        console.log(`\n[${i+1}] "${detail.title}" (${detail.id})`);
        console.log(`    Location: ${detail.location}`);
        console.log(`    Action attempted: ${detail.action}`);
      });
  }
  
  console.log('\n========================================');
  
  if (isDryRun) {
    console.log('🔍 DRY RUN COMPLETE - No changes were made to the database');
  } else {
    console.log(`✅ COMPLETE - Fixed ${stats.geocoded + stats.fixed} shows`);
  }
  
  console.log('========================================');
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    console.log('Starting coordinate fixing process...');
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE: No changes will be made to the database');
    }
    
    // Fetch all shows from the database
    const { data: shows, error } = await supabase
      .from('shows')
      .select('id, title, location, coordinates, status');
    
    if (error) {
      throw error;
    }
    
    console.log(`Found ${shows.length} total shows in the database.`);
    
    // Process active shows first, then others
    const activeShows = shows.filter(show => show.status === 'ACTIVE');
    const otherShows = shows.filter(show => show.status !== 'ACTIVE');
    
    console.log(`Processing ${activeShows.length} active shows first...`);
    const activeStats = await processShows(activeShows);
    
    console.log(`\nProcessing ${otherShows.length} other shows...`);
    const otherStats = await processShows(otherShows);
    
    // Combine stats
    const combinedStats = {
      total: activeStats.total + otherStats.total,
      geocoded: activeStats.geocoded + otherStats.geocoded,
      fixed: activeStats.fixed + otherStats.fixed,
      failed: activeStats.failed + otherStats.failed,
      skipped: activeStats.skipped + otherStats.skipped,
      details: [...activeStats.details, ...otherStats.details]
    };
    
    // Generate report
    generateReport(combinedStats);
    
  } catch (err) {
    console.error('Error in main process:', err);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
}

module.exports = {
  geocodeLocation,
  updateShowCoordinates,
  processShows
};
