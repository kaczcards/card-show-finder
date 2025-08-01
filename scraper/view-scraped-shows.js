#!/usr/bin/env node
/**
 * scraper/view-scraped-shows.js
 * 
 * Utility script to query and display recently scraped shows from the database.
 * 
 * Usage:
 *   node scraper/view-scraped-shows.js
 *   node scraper/view-scraped-shows.js --url https://example.com
 *   node scraper/view-scraped-shows.js --hours 48
 *   node scraper/view-scraped-shows.js --limit 50
 *   node scraper/view-scraped-shows.js --all
 */

// Load environment variables from .env
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const minimist = require('minimist');
const chalk = require('chalk'); // For colorized output

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ['url'],
  boolean: ['help', 'all', 'json'],
  alias: {
    h: 'help',
    u: 'url',
    l: 'limit',
    j: 'json'
  },
  default: {
    hours: 24,
    limit: 100,
    all: false,
    json: false
  }
});

// Show help text if requested
if (argv.help) {
  showHelp();
  process.exit(0);
}

// Utility functions
function showHelp() {
  console.log(`
View Scraped Shows CLI
=====================

A utility script to query and display recently scraped shows from the database.

Environment Variables Required:
  SUPABASE_URL                 Your Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY    Your Supabase service role key

Usage:
  node scraper/view-scraped-shows.js [options]

Options:
  -u, --url URL      Filter shows by source URL
  --hours HOURS      Show entries from last N hours (default: 24)
  -l, --limit N      Limit results to N shows (default: 100)
  --all              Show all shows (ignores hours filter)
  -j, --json         Output in JSON format
  -h, --help         Show this help text

Examples:
  # Show shows from last 24 hours (default)
  node scraper/view-scraped-shows.js

  # Show shows from a specific source
  node scraper/view-scraped-shows.js --url https://example.com

  # Show shows from last 48 hours
  node scraper/view-scraped-shows.js --hours 48

  # Show most recent 10 shows
  node scraper/view-scraped-shows.js --limit 10

  # Show all shows in database
  node scraper/view-scraped-shows.js --all
  `);
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatAddress(show) {
  const parts = [];
  
  if (show.city) parts.push(show.city);
  if (show.state) parts.push(show.state);
  if (show.zipCode) parts.push(show.zipCode);
  
  return parts.join(', ');
}

function formatContact(show) {
  const parts = [];
  
  if (show.contactName) parts.push(show.contactName);
  if (show.contactPhone) parts.push(show.contactPhone);
  if (show.contactEmail) parts.push(show.contactEmail);
  
  return parts.length > 0 ? parts.join(' | ') : 'N/A';
}

// Main function
async function main() {
  // Check environment variables
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!SUPABASE_URL) {
    console.error('Error: Missing Supabase URL. Set SUPABASE_URL environment variable.');
    process.exit(1);
  }
  
  if (!SUPABASE_KEY) {
    console.error('Error: Missing Supabase service role key. Set SUPABASE_SERVICE_ROLE_KEY environment variable.');
    process.exit(1);
  }
  
  // Initialize Supabase client
  let supabase;
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (error) {
    console.error('Error: Failed to initialize Supabase client:', error.message);
    process.exit(1);
  }
  
  try {
    // Build query
    let query = supabase
      .from('scraped_shows_pending')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Apply filters
    if (argv.url) {
      query = query.eq('source_url', argv.url);
    }
    
    if (!argv.all) {
      const hoursAgo = new Date();
      hoursAgo.setHours(hoursAgo.getHours() - argv.hours);
      query = query.gte('created_at', hoursAgo.toISOString());
    }
    
    // Apply limit
    query = query.limit(argv.limit);
    
    // Execute query
    const { data: shows, error } = await query;
    
    if (error) {
      console.error('Error querying database:', error.message);
      process.exit(1);
    }
    
    if (!shows || shows.length === 0) {
      console.log(`No shows found${argv.url ? ` from ${argv.url}` : ''}${!argv.all ? ` in the last ${argv.hours} hours` : ''}.`);
      process.exit(0);
    }
    
    // Process and sort shows
    const processedShows = shows.map(show => {
      const normalizedJson = show.normalized_json || {};
      return {
        id: show.id,
        name: normalizedJson.name || 'Unnamed Show',
        startDate: normalizedJson.startDate || null,
        startDateFormatted: formatDate(normalizedJson.startDate),
        venueName: normalizedJson.venueName || 'Unknown Venue',
        address: formatAddress(normalizedJson),
        contactInfo: formatContact(normalizedJson),
        sourceUrl: show.source_url,
        createdAt: show.created_at
      };
    });
    
    // Sort by start date (if available)
    processedShows.sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate) - new Date(b.startDate);
    });
    
    // Output results
    if (argv.json) {
      console.log(JSON.stringify(processedShows, null, 2));
    } else {
      console.log(`\nFound ${processedShows.length} shows${argv.url ? ` from ${argv.url}` : ''}${!argv.all ? ` in the last ${argv.hours} hours` : ''}:\n`);
      
      processedShows.forEach((show, index) => {
        console.log(chalk.bold(`${index + 1}. ${chalk.green(show.name)}`));
        console.log(`   Date:    ${chalk.yellow(show.startDateFormatted)}`);
        console.log(`   Venue:   ${show.venueName}`);
        console.log(`   Location: ${show.address}`);
        console.log(`   Contact: ${show.contactInfo}`);
        console.log(`   Source:  ${chalk.blue(show.sourceUrl)}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Unhandled error:', error.message);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
