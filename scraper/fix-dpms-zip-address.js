#!/usr/bin/env node

// Required modules
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const minimist = require('minimist');
const fetch = require('node-fetch');

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  boolean: ['help', 'dry-run'],
  alias: { h: 'help', d: 'dry-run', l: 'limit' },
  default: { limit: 100, 'dry-run': false }
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
  -h, --help        Show this help text
`);
  process.exit(0);
}

// Delay helper for rate limiting
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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
  
  // Fetch shows
  console.log(`Fetching up to ${argv.limit} shows from dpmsportcards.com...`);
  
  const { data: shows, error } = await supabase
    .from('shows')
    .select('id, title, address, location, website_url')
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
    updated: 0,
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
      console.log(`  ✓ Address already has ZIP: ${address}`);
      stats.hasZip++;
      continue;
    }
    
    // Build geocoding query
    let geocodeQuery = '';
    if (address) {
      geocodeQuery = address;
      if (show.location) {
        // Don't duplicate state if already in location
        if (show.location.includes('IN')) {
          geocodeQuery += `, ${show.location}`;
        } else {
          geocodeQuery += `, ${show.location}, IN`;
        }
      } else {
        geocodeQuery += `, IN`;
      }
    } else if (show.location) {
      // Use location alone if no address
      geocodeQuery = show.location.includes('IN') ? show.location : `${show.location}, IN`;
    } else {
      console.log(`  ⚠ Skipping: No address or location data`);
      stats.skipped++;
      continue;
    }
    
    console.log(`  Geocoding: ${geocodeQuery}`);
    
    try {
      const zip = await geocodeAddress(geocodeQuery);
      
      if (!zip) {
        console.log(`  ⚠ No ZIP found for: ${geocodeQuery}`);
        stats.skipped++;
        continue;
      }
      
      // Update address with ZIP
      const updatedAddress = address ? `${address} ${zip}` : zip;
      console.log(`  Found ZIP: ${zip}`);
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
          console.log(`  ✓ Updated successfully`);
          stats.updated++;
        }
      } else {
        console.log(`  ✓ Would update (dry run)`);
        stats.updated++;
      }
    } catch (err) {
      console.error(`  ✗ Error processing show: ${err.message}`);
      stats.errors++;
    }
    
    // Rate limiting
    if (i < shows.length - 1) {
      console.log(`  Waiting 700ms before next request...`);
      await delay(700);
    }
  }
  
  // Print summary
  console.log('\nSummary:');
  console.log(`Total shows processed: ${stats.total}`);
  console.log(`Already had ZIP: ${stats.hasZip}`);
  console.log(`Updated with ZIP: ${stats.updated}`);
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
