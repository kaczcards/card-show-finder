#!/usr/bin/env node

// Required modules
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const minimist = require('minimist');
const fetch = require('node-fetch');

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  boolean: ['help', 'dry-run', 'verbose'],
  alias: { h: 'help', d: 'dry-run', l: 'limit', v: 'verbose' },
  default: { limit: 100, 'dry-run': false, verbose: false }
});

// Show help if requested
if (argv.help) {
  console.log(`
Fix DPMS ZIP Addresses
=====================

Updates live shows from dpmsportcards.com by adding ZIP codes to addresses.

Usage:
  node scraper/fix-dpms-zip-address.js [options]

Options:
  -l, --limit N     Limit to N shows (default: 100)
  -d, --dry-run     Preview changes without updating database
  -v, --verbose     Show detailed logs
  -h, --help        Show this help text
`);
  process.exit(0);
}

// Helper function for logging
function log(message, force = false) {
  if (argv.verbose || force) {
    console.log(message);
  }
}

// Delay helper for rate limiting
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Format date as YYYY-MM-DD
function formatDateYYYYMMDD(dateString) {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

// Geocode an address to get ZIP code
async function geocodeAddress(addressQuery) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'card-show-finder/zip-fixer' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data && data.length > 0) {
      const displayName = data[0].display_name;
      const zipMatch = displayName.match(/\b(\d{5})(?:-\d{4})?\b/);
      return zipMatch ? zipMatch[1] : null;
    }
    return null;
  } catch (error) {
    console.error(`Geocoding error: ${error.message}`);
    return null;
  }
}

// Main function
async function main() {
  // Check for required environment variables
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Error: Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    process.exit(1);
  }
  
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  // First, fetch normalized data from scraped_shows_pending
  console.log('Fetching normalized data from scraped_shows_pending...');
  
  const { data: pendingShows, error: pendingError } = await supabase
    .from('scraped_shows_pending')
    .select('id, normalized_json, source_url')
    .ilike('source_url', '%dpmsportcards%')
    .eq('status', 'TRANSFERRED')
    .not('normalized_json', 'is', null)
    .gte('normalized_json->startDate', '2025-08-01')
    .order('created_at', { ascending: false });
  
  if (pendingError) {
    console.error('Error fetching pending shows:', pendingError.message);
    process.exit(1);
  }
  
  // Build map of normalized data keyed by name|startDate
  const normalizedMap = {};
  let normalizedCount = 0;
  
  pendingShows.forEach(pending => {
    if (pending.normalized_json && 
        pending.normalized_json.name && 
        pending.normalized_json.startDate) {
      
      const startDateIso = formatDateYYYYMMDD(pending.normalized_json.startDate);
      const key = `${pending.normalized_json.name}|${startDateIso}`;
      
      normalizedMap[key] = {
        zipCode: pending.normalized_json.zipCode || null,
        city: pending.normalized_json.city || null,
        state: pending.normalized_json.state || 'IN',
        address: pending.normalized_json.address || null
      };
      
      normalizedCount++;
    }
  });
  
  console.log(`Built normalized data map with ${normalizedCount} entries.`);
  
  // Fetch shows that need ZIP codes
  console.log(`Fetching up to ${argv.limit} shows from dpmsportcards.com...`);
  
  const { data: shows, error } = await supabase
    .from('shows')
    .select('id, title, address, location, website_url, start_date')
    .ilike('website_url', '%dpmsportcards%')
    .gte('start_date', '2025-08-01')
    .order('created_at', { ascending: false })
    .limit(argv.limit);
  
  if (error) {
    console.error('Error fetching shows:', error.message);
    process.exit(1);
  }
  
  if (!shows || shows.length === 0) {
    console.log('No shows found matching the criteria.');
    process.exit(0);
  }
  
  console.log(`Found ${shows.length} shows. Processing...`);
  
  // Stats tracking
  const stats = {
    total: shows.length,
    hasZip: 0,
    updatedFromNormalized: 0,
    updatedFromGeocoding: 0,
    skipped: 0,
    errors: 0
  };
  
  // Process each show
  for (let i = 0; i < shows.length; i++) {
    const show = shows[i];
    const address = show.address || '';
    
    console.log(`[${i+1}/${shows.length}] Processing: ${show.title}`);
    
    // Check if address already has ZIP code
    if (address.match(/\b\d{5}(?:-\d{4})?\b/)) {
      log(`  ✓ Address already has ZIP: ${address}`);
      stats.hasZip++;
      continue;
    }
    
    // Try to find matching normalized data
    let zipFromNormalized = null;
    let cityFromNormalized = null;
    
    if (show.start_date) {
      const startDateIso = formatDateYYYYMMDD(show.start_date);
      const lookupKey = `${show.title}|${startDateIso}`;
      
      log(`  Looking up normalized data with key: ${lookupKey}`, argv.verbose);
      
      if (normalizedMap[lookupKey]) {
        zipFromNormalized = normalizedMap[lookupKey].zipCode;
        cityFromNormalized = normalizedMap[lookupKey].city;
        
        if (zipFromNormalized) {
          log(`  ✓ Found ZIP in normalized data: ${zipFromNormalized}`);
          
          // Update address with ZIP from normalized data
          const updatedAddress = address ? `${address} ${zipFromNormalized}` : zipFromNormalized;
          log(`  New address: ${updatedAddress}`);
          
          if (!argv['dry-run']) {
            const { error: updateError } = await supabase
              .from('shows')
              .update({ address: updatedAddress })
              .eq('id', show.id);
            
            if (updateError) {
              console.error(`  ✗ Update error: ${updateError.message}`);
              stats.errors++;
            } else {
              console.log(`  ✓ Updated successfully with normalized ZIP`);
              stats.updatedFromNormalized++;
            }
          } else {
            console.log(`  ✓ Would update with normalized ZIP (dry run)`);
            stats.updatedFromNormalized++;
          }
          
          // Continue to next show
          continue;
        }
      }
    }
    
    // If we get here, we need to geocode
    // Build geocoding query using city from normalized data if available
    let geocodeQuery = '';
    
    if (address) {
      geocodeQuery = address;
      
      if (cityFromNormalized) {
        // Use city from normalized data
        geocodeQuery += `, ${cityFromNormalized}, IN`;
      } else if (show.location) {
        // Try to extract city from location if it's not a venue name
        const locationParts = show.location.split(',');
        const possibleCity = locationParts[0].trim();
        
        // Check if location is likely a city name (not a venue)
        if (possibleCity.split(' ').length <= 2) {
          geocodeQuery += `, ${possibleCity}, IN`;
        } else {
          geocodeQuery += `, IN`;
        }
      } else {
        geocodeQuery += `, IN`;
      }
    } else if (cityFromNormalized) {
      // Use city from normalized data if no address
      geocodeQuery = `${cityFromNormalized}, IN`;
    } else if (show.location) {
      // Use location alone if no address and no city from normalized
      const locationParts = show.location.split(',');
      const possibleCity = locationParts[0].trim();
      
      if (possibleCity.split(' ').length <= 2) {
        geocodeQuery = `${possibleCity}, IN`;
      } else {
        geocodeQuery = show.location.includes('IN') ? show.location : `${show.location}, IN`;
      }
    } else {
      console.log(`  ⚠ Skipping: No address, location, or city data`);
      stats.skipped++;
      continue;
    }
    
    console.log(`  Geocoding: ${geocodeQuery}`);
    
    try {
      const zip = await geocodeAddress(geocodeQuery);
      
      if (!zip) {
        console.log(`  ⚠ No ZIP found from geocoding: ${geocodeQuery}`);
        stats.skipped++;
        continue;
      }
      
      // Update address with ZIP
      const updatedAddress = address ? `${address} ${zip}` : zip;
      console.log(`  Found ZIP from geocoding: ${zip}`);
      console.log(`  New address: ${updatedAddress}`);
      
      if (!argv['dry-run']) {
        const { error: updateError } = await supabase
          .from('shows')
          .update({ address: updatedAddress })
          .eq('id', show.id);
        
        if (updateError) {
          console.error(`  ✗ Update error: ${updateError.message}`);
          stats.errors++;
        } else {
          console.log(`  ✓ Updated successfully with geocoded ZIP`);
          stats.updatedFromGeocoding++;
        }
      } else {
        console.log(`  ✓ Would update with geocoded ZIP (dry run)`);
        stats.updatedFromGeocoding++;
      }
    } catch (err) {
      console.error(`  ✗ Error processing show: ${err.message}`);
      stats.errors++;
    }
    
    // Rate limiting for geocoding requests
    if (i < shows.length - 1) {
      log(`  Waiting 700ms before next request...`);
      await delay(700);
    }
  }
  
  // Print summary
  console.log('\nSummary:');
  console.log(`Total shows processed: ${stats.total}`);
  console.log(`Already had ZIP: ${stats.hasZip}`);
  console.log(`Updated with normalized ZIP: ${stats.updatedFromNormalized}`);
  console.log(`Updated with geocoded ZIP: ${stats.updatedFromGeocoding}`);
  console.log(`Total updated: ${stats.updatedFromNormalized + stats.updatedFromGeocoding}`);
  console.log(`Skipped (no data/ZIP): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  
  if (argv['dry-run']) {
    console.log('\nDRY RUN: No changes were made to the database');
  }
}

// Run main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
