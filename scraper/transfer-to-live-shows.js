#!/usr/bin/env node
/**
 * scraper/transfer-to-live-shows.js
 * 
 * Transfers shows from scraped_shows_pending table to the live shows table.
 * 
 * Usage:
 *   node scraper/transfer-to-live-shows.js
 *   node scraper/transfer-to-live-shows.js --dry-run
 *   node scraper/transfer-to-live-shows.js --url https://example.com
 *   node scraper/transfer-to-live-shows.js --limit 10
 *   node scraper/transfer-to-live-shows.js --force
 */

// Load environment variables from .env
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const minimist = require('minimist');
const readline = require('readline');

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ['url', 'start-date', 'end-date'],
  boolean: ['help', 'dry-run', 'force', 'verbose'],
  alias: {
    h: 'help',
    u: 'url',
    l: 'limit',
    d: 'dry-run',
    f: 'force',
    v: 'verbose'
  },
  default: {
    limit: 100,
    'dry-run': false,
    force: false,
    verbose: false
  }
});

// Show help text if requested
if (argv.help) {
  showHelp();
  process.exit(0);
}

// Create readline interface for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Utility functions
function showHelp() {
  console.log(`
Transfer to Live Shows CLI
=========================

Transfers shows from scraped_shows_pending table to the live shows table.

Environment Variables Required:
  SUPABASE_URL                 Your Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY    Your Supabase service role key

Usage:
  node scraper/transfer-to-live-shows.js [options]

Options:
  -u, --url URL          Filter by source URL
  --start-date DATE      Filter by start date (YYYY-MM-DD)
  --end-date DATE        Filter by end date (YYYY-MM-DD)
  -l, --limit N          Limit to N shows (default: 100)
  -d, --dry-run          Preview without making changes
  -f, --force            Skip confirmation prompts
  -v, --verbose          Show detailed logs
  -h, --help             Show this help text

Examples:
  # Preview transfer of up to 10 shows
  node scraper/transfer-to-live-shows.js --dry-run --limit 10

  # Transfer shows from a specific source
  node scraper/transfer-to-live-shows.js --url https://example.com

  # Transfer shows with a date range
  node scraper/transfer-to-live-shows.js --start-date 2025-08-01 --end-date 2025-12-31

  # Transfer all shows without confirmation
  node scraper/transfer-to-live-shows.js --force
  `);
}

function log(message, data = null, force = false) {
  if (!argv.verbose && !force) return;
  
  console.log('\n' + '='.repeat(80));
  console.log(message);
  console.log('='.repeat(80));
  if (data) {
    console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
}

function logError(message, error) {
  console.error('\n' + '!'.repeat(80));
  console.error(`ERROR: ${message}`);
  console.error(error?.message || error);
  console.error('!'.repeat(80));
}

// Prompt for confirmation
function confirm(message) {
  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Map normalized_json to shows table schema
function mapToShowSchema(pendingShow) {
  const normalizedJson = pendingShow.normalized_json || {};
  const geocodedJson = pendingShow.geocoded_json || {};
  
  // Extract coordinates if available
  let coordinates = null;
  if (geocodedJson && geocodedJson.coordinates) {
    const { latitude, longitude } = geocodedJson.coordinates;
    if (latitude && longitude) {
      // Create a PostGIS point
      coordinates = {
        latitude,
        longitude
      };
    }
  }
  
  // Build location from venueName or city/state
  let location = normalizedJson.venueName || '';
  if (!location && normalizedJson.city) {
    location = normalizedJson.city;
    if (normalizedJson.state) {
      location += `, ${normalizedJson.state}`;
    }
  }
  
  // Convert features to JSONB object
  let features = {};
  
  // Add any extracted features
  if (normalizedJson.description) {
    // Check for common features in description
    if (/free admission|no admission|no entry fee/i.test(normalizedJson.description)) {
      features.freeAdmission = true;
    }
    if (/food|refreshment|concession/i.test(normalizedJson.description)) {
      features.foodAvailable = true;
    }
    if (/autograph|signing/i.test(normalizedJson.description)) {
      features.autographs = true;
    }
  }
  
  // ------------------------------------------------------------------
  // Merge ZIP into address if missing
  // ------------------------------------------------------------------
  let mergedAddress = normalizedJson.address || '';
  if (normalizedJson.zipCode) {
    const zipPattern = /\b\d{5}(?:-\d{4})?\b/;
    if (!zipPattern.test(mergedAddress)) {
      mergedAddress = mergedAddress
        ? `${mergedAddress} ${normalizedJson.zipCode}`
        : normalizedJson.zipCode;
    }
  }

  // Determine entry fee: null when free/unspecified
  const entryFeeValue =
    normalizedJson.entryFeeAmount === null ||
    normalizedJson.entryFeeAmount === undefined
      ? null
      : normalizedJson.entryFeeAmount;

  // Map to shows table schema
  return {
    title: normalizedJson.name || 'Unnamed Card Show',
    description: normalizedJson.description || '',
    location: location,
    address: mergedAddress,
    start_date: normalizedJson.startDate || null,
    end_date: normalizedJson.endDate || normalizedJson.startDate || null,
    entry_fee: entryFeeValue,
    image_url: null, // No image in scraped data
    website_url: normalizedJson.url || pendingShow.source_url,
    coordinates: coordinates,
    features: features,
    categories: [], // Default empty array
    start_time: normalizedJson.startTime || null,
    end_time: normalizedJson.endTime || null,
    status: 'ACTIVE'
  };
}

// Main function
async function main() {
  try {
    const startTime = Date.now();
    
    // Check environment variables
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL) {
      logError('Missing Supabase URL', 'Set SUPABASE_URL environment variable');
      rl.close();
      process.exit(1);
    }
    
    if (!SUPABASE_KEY) {
      logError('Missing Supabase service role key', 'Set SUPABASE_SERVICE_ROLE_KEY environment variable');
      rl.close();
      process.exit(1);
    }
    
    // Initialize Supabase client
    let supabase;
    try {
      supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (error) {
      logError('Failed to initialize Supabase client', error);
      rl.close();
      process.exit(1);
    }
    
    // Build query for pending shows
    let query = supabase
      .from('scraped_shows_pending')
      .select('*')
      .eq('status', 'PENDING')
    // Exclude records that have not yet been run through normalization
    .not('normalized_json', 'is', null)
      .order('created_at', { ascending: false });
    
    // Apply filters
    if (argv.url) {
      query = query.eq('source_url', argv.url);
      log(`Filtering by source URL: ${argv.url}`, null, true);
    }
    
    if (argv['start-date']) {
      const startDate = new Date(argv['start-date']);
      if (isNaN(startDate.getTime())) {
        logError('Invalid start date format', 'Use YYYY-MM-DD format');
        rl.close();
        process.exit(1);
      }
      
      query = query.gte('created_at', startDate.toISOString());
      log(`Filtering by start date: ${argv['start-date']}`, null, true);
    }
    
    if (argv['end-date']) {
      const endDate = new Date(argv['end-date']);
      if (isNaN(endDate.getTime())) {
        logError('Invalid end date format', 'Use YYYY-MM-DD format');
        rl.close();
        process.exit(1);
      }
      
      query = query.lte('created_at', endDate.toISOString());
      log(`Filtering by end date: ${argv['end-date']}`, null, true);
    }
    
    // Apply limit
    query = query.limit(argv.limit);
    
    // Execute query
    const { data: pendingShows, error } = await query;
    
    if (error) {
      logError('Error querying pending shows', error);
      rl.close();
      process.exit(1);
    }
    
    if (!pendingShows || pendingShows.length === 0) {
      log('No pending shows found matching the criteria', null, true);
      rl.close();
      process.exit(0);
    }
    
    log(`Found ${pendingShows.length} pending shows to transfer`, null, true);
    
    // ---------------------------------------------------------------
    // Filter out records missing normalized_json or startDate
    // ---------------------------------------------------------------
    const validPendingShows = pendingShows.filter((p) => {
      return (
        p.normalized_json &&
        p.normalized_json.startDate
      );
    });

    const skippedCount = pendingShows.length - validPendingShows.length;
    if (skippedCount > 0) {
      log(
        `Skipping ${skippedCount} pending shows missing normalized_json or startDate`,
        null,
        true
      );
    }

    if (validPendingShows.length === 0) {
      log('No valid pending shows remain after filtering', null, true);
      rl.close();
      process.exit(0);
    }

    // Map valid pending shows to live show schema
    const pairs = validPendingShows.map(p => ({
      pending: p,
      mapped: mapToShowSchema(p)
    }));
    
    // Preview shows to transfer
    if (argv.dryRun) {
      console.log('\n' + '='.repeat(80));
      console.log(`DRY RUN: ${pairs.length} shows would be transferred`);
      console.log('='.repeat(80));
      
      // Display a summary of each show
      pairs.forEach((pair, index) => {
        const show = pair.mapped;
        console.log(`\n${index + 1}. ${show.title}`);
        console.log(`   Date: ${show.start_date ? new Date(show.start_date).toLocaleDateString() : 'N/A'}`);
        console.log(`   Location: ${show.location}`);
        console.log(`   Address: ${show.address}`);
        if (show.coordinates) {
          console.log(`   Coordinates: ${show.coordinates.latitude}, ${show.coordinates.longitude}`);
        }
      });
      
      console.log('\n' + '='.repeat(80));
      console.log('DRY RUN: No changes were made to the database');
      console.log('='.repeat(80));
      
      rl.close();
      process.exit(0);
    }
    
    // Confirm transfer unless --force is used
    if (!argv.force) {
      const confirmed = await confirm(`Transfer ${pairs.length} shows to the live shows table?`);
      if (!confirmed) {
        log('Transfer cancelled', null, true);
        rl.close();
        process.exit(0);
      }
    }
    
    // Track statistics
    const stats = {
      total: pairs.length,
      success: 0,
      failed: 0,
      errors: []
    };
    
    // Transfer shows one by one for better error handling
    for (let i = 0; i < pairs.length; i++) {
      const { mapped: show, pending: pendingShow } = pairs[i];

      // Guard against bad mapping (missing start_date)
      if (!show.start_date) {
        log(`Skipping show with missing start_date: ${show.title}`, null, true);
        stats.failed++;
        stats.errors.push({
          show: show.title,
          error: 'start_date missing after mapping'
        });
        continue;
      }
      
      try {
        log(`Processing show ${i+1}/${pairs.length}: ${show.title}`);
        
        // Insert into shows table
        let insertQuery = supabase.from('shows').insert({
          title: show.title,
          description: show.description,
          location: show.location,
          address: show.address,
          start_date: show.start_date,
          end_date: show.end_date,
          entry_fee: show.entry_fee,
          image_url: show.image_url,
          website_url: show.website_url,
          features: show.features,
          categories: show.categories,
          start_time: show.start_time,
          end_time: show.end_time,
          status: show.status
        });
        
        // If coordinates are available, add them using PostGIS
        if (show.coordinates) {
          // Use a raw query to properly set coordinates using PostGIS
          const { latitude, longitude } = show.coordinates;
          
          // Use the create_geography_point function to set coordinates
          insertQuery = supabase.rpc('create_show_with_coordinates', {
            p_title: show.title,
            p_description: show.description,
            p_location: show.location,
            p_address: show.address,
            p_start_date: show.start_date,
            p_end_date: show.end_date,
            p_entry_fee: show.entry_fee,
            p_image_url: show.image_url,
            p_latitude: latitude,
            p_longitude: longitude,
            p_features: show.features,
            p_categories: show.categories
          });
        }
        
        const { data: insertedShow, error: insertError } = await insertQuery;
        
        if (insertError) {
          throw new Error(`Insert error: ${insertError.message}`);
        }
        
        // Update pending show status to TRANSFERRED
        const { error: updateError } = await supabase
          .from('scraped_shows_pending')
          .update({ status: 'TRANSFERRED' })
          .eq('id', pendingShow.id);
        
        if (updateError) {
          throw new Error(`Status update error: ${updateError.message}`);
        }
        
        log(`Successfully transferred show: ${show.title}`);
        stats.success++;
        
      } catch (err) {
        logError(`Failed to transfer show: ${show.title}`, err);
        stats.failed++;
        stats.errors.push({
          show: show.title,
          error: err.message
        });
      }
    }
    
    // Display summary
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log(`Transfer completed in ${elapsedSeconds}s`, {
      total: stats.total,
      successful: stats.success,
      failed: stats.failed,
      errors: stats.errors
    }, true);
    
    rl.close();
    // Force exit after successful completion
    setTimeout(() => process.exit(0), 100);
    
  } catch (error) {
    logError('Unhandled error in main process', error);
    rl.close();
    process.exit(1);
  }
}

// Run the main function and ensure proper error handling
main().catch(error => {
  logError('Critical error in main process', error);
  rl.close();
  // Force exit on error
  setTimeout(() => process.exit(1), 100);
});
