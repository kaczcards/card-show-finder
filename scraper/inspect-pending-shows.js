#!/usr/bin/env node
/**
 * scraper/inspect-pending-shows.js
 * 
 * Utility to inspect records in the scraped_shows_pending table
 * before moving them to the production table.
 * 
 * Usage:
 *   node scraper/inspect-pending-shows.js [options]
 * 
 * Options:
 *   --limit N          Number of records to display (default: 5)
 *   --url URL          Filter by source URL
 *   --state STATE      Filter by state in raw_payload
 *   --since DATE       Filter by created_at >= DATE (YYYY-MM-DD)
 *   --until DATE       Filter by created_at <= DATE (YYYY-MM-DD)
 *   --status STATUS    Filter by status (PENDING, PROCESSED, ERROR)
 *   --stats-only       Only show statistics, no records
 *   --help             Show this help message
 */

const { createClient } = require('@supabase/supabase-js');
const minimist = require('minimist');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ['url', 'state', 'since', 'until', 'status', 'limit'],
  boolean: ['stats-only', 'help'],
  alias: {
    h: 'help',
    l: 'limit',
    u: 'url',
    s: 'state',
    t: 'stats-only'
  },
  default: {
    limit: 5
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
Pending Shows Inspector
======================

Inspect records in the scraped_shows_pending table before moving to production.

Environment Variables Required:
  SUPABASE_URL                 Your Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY    Your Supabase service role key

Usage:
  node scraper/inspect-pending-shows.js [options]

Options:
  -l, --limit N        Number of records to display (default: 5)
  -u, --url URL        Filter by source URL
  -s, --state STATE    Filter by state in raw_payload
  --since DATE         Filter by created_at >= DATE (YYYY-MM-DD)
  --until DATE         Filter by created_at <= DATE (YYYY-MM-DD)
  --status STATUS      Filter by status (PENDING, PROCESSED, ERROR)
  -t, --stats-only     Only show statistics, no records
  -h, --help           Show this help message

Examples:
  # Show first 5 pending records
  node scraper/inspect-pending-shows.js

  # Show 10 records from Indiana
  node scraper/inspect-pending-shows.js --limit 10 --state IN

  # Show records from a specific source
  node scraper/inspect-pending-shows.js --url https://example.com

  # Show records created today
  node scraper/inspect-pending-shows.js --since $(date +%Y-%m-%d)

  # Only show statistics
  node scraper/inspect-pending-shows.js --stats-only
  `);
}

function log(message, data = null) {
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

// Format date for display
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString();
}

// Truncate long text for display
function truncate(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Format raw_payload for display
function formatPayload(payload) {
  if (!payload) return {};
  
  // For table display, we want to flatten and simplify
  return {
    name: payload.name || 'N/A',
    dates: `${payload.startDate || 'N/A'} to ${payload.endDate || 'N/A'}`,
    location: [
      payload.venueName,
      payload.address,
      payload.city,
      payload.state
    ].filter(Boolean).join(', ') || 'N/A',
    entryFee: payload.entryFee || 'N/A',
    description: truncate(payload.description, 50) || 'N/A'
  };
}

// Build query with filters
function buildQuery(supabase) {
  let query = supabase
    .from('scraped_shows_pending')
    .select('*')
    .order('created_at', { ascending: false });
  
  // Apply filters
  if (argv.url) {
    query = query.eq('source_url', argv.url);
  }
  
  if (argv.status) {
    query = query.eq('status', argv.status.toUpperCase());
  } else {
    // Default to PENDING if no status specified
    query = query.eq('status', 'PENDING');
  }
  
  if (argv.since) {
    query = query.gte('created_at', new Date(argv.since).toISOString());
  }
  
  if (argv.until) {
    query = query.lte('created_at', new Date(argv.until).toISOString());
  }
  
  return query;
}

// Main function
async function main() {
  try {
    // Check environment variables
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL) {
      logError('Missing Supabase URL', 'Set SUPABASE_URL environment variable');
      process.exit(1);
    }
    
    if (!SUPABASE_KEY) {
      logError('Missing Supabase service role key', 'Set SUPABASE_SERVICE_ROLE_KEY environment variable');
      process.exit(1);
    }
    
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Build query with filters
    let query = buildQuery(supabase);
    
    // Get total count first
    const { count, error: countError } = await query.count();
    
    if (countError) {
      logError('Error getting count', countError);
      process.exit(1);
    }
    
    // Get statistics by status
    const { data: statusStats, error: statsError } = await supabase
      .from('scraped_shows_pending')
      .select('status, count')
      .group('status');
    
    if (statsError) {
      logError('Error getting statistics', statsError);
    }
    
    // Get statistics by source_url
    const { data: sourceStats, error: sourceError } = await supabase
      .from('scraped_shows_pending')
      .select('source_url, count')
      .group('source_url')
      .order('count', { ascending: false })
      .limit(10);
    
    if (sourceError) {
      logError('Error getting source statistics', sourceError);
    }
    
    // Display statistics
    log('PENDING SHOWS STATISTICS', {
      totalRecords: count,
      filteredBy: {
        url: argv.url || 'All',
        state: argv.state || 'All',
        since: argv.since || 'Any',
        until: argv.until || 'Any',
        status: argv.status || 'PENDING'
      },
      byStatus: statusStats || [],
      topSources: sourceStats || []
    });
    
    // Exit if stats-only
    if (argv.statsOnly) {
      return;
    }
    
    // Get records with limit
    const limit = parseInt(argv.limit, 10) || 5;
    const { data: records, error } = await query.limit(limit);
    
    if (error) {
      logError('Error fetching records', error);
      process.exit(1);
    }
    
    if (records.length === 0) {
      log('No records found matching your criteria');
      return;
    }
    
    // Display records
    log(`SHOWING ${records.length} OF ${count} RECORDS`);
    
    // First, show a summary table
    const summaryTable = records.map(record => ({
      id: record.id,
      source: truncate(record.source_url, 30),
      status: record.status,
      created: formatDate(record.created_at),
      showName: record.raw_payload?.name || 'N/A',
      state: record.raw_payload?.state || 'N/A',
      startDate: record.raw_payload?.startDate || 'N/A'
    }));
    
    console.table(summaryTable);
    
    // Then show detailed records one by one
    records.forEach((record, index) => {
      log(`RECORD ${index + 1}/${records.length} (ID: ${record.id})`);
      
      // Show basic info
      console.log(`Source URL: ${record.source_url}`);
      console.log(`Status: ${record.status}`);
      console.log(`Created: ${formatDate(record.created_at)}`);
      console.log(`Updated: ${formatDate(record.updated_at)}`);
      
      // Show raw_payload in a nice format
      if (record.raw_payload) {
        console.log('\nEvent Details:');
        console.log('-'.repeat(40));
        console.log(`Name: ${record.raw_payload.name || 'N/A'}`);
        console.log(`Dates: ${record.raw_payload.startDate || 'N/A'} to ${record.raw_payload.endDate || 'N/A'}`);
        console.log(`Venue: ${record.raw_payload.venueName || 'N/A'}`);
        console.log(`Address: ${record.raw_payload.address || 'N/A'}`);
        console.log(`City: ${record.raw_payload.city || 'N/A'}`);
        console.log(`State: ${record.raw_payload.state || 'N/A'}`);
        console.log(`Entry Fee: ${record.raw_payload.entryFee || 'N/A'}`);
        console.log(`URL: ${record.raw_payload.url || 'N/A'}`);
        console.log(`Contact: ${record.raw_payload.contactInfo || 'N/A'}`);
        
        if (record.raw_payload.description) {
          console.log('\nDescription:');
          console.log(record.raw_payload.description);
        }
        
        if (record.raw_payload.sourceNotes) {
          console.log('\nSource Notes:');
          console.log(record.raw_payload.sourceNotes);
        }
      }
      
      // Add a separator between records
      if (index < records.length - 1) {
        console.log('\n' + '-'.repeat(80));
      }
    });
    
    // Add a note about filtering by state if state filter is not applied
    if (!argv.state && records.some(r => r.raw_payload?.state)) {
      const states = [...new Set(records
        .filter(r => r.raw_payload?.state)
        .map(r => r.raw_payload.state))];
      
      if (states.length > 0) {
        log(`TIP: Filter by state with --state XX`, {
          availableStates: states.sort().join(', ')
        });
      }
    }
    
  } catch (error) {
    logError('Unhandled error', error);
    process.exit(1);
  }
}

// Run the main function
main();
