#!/usr/bin/env node
/**
 * scraper/delete-records.js
 * 
 * Utility to delete records from the scraped_shows_pending table by ID.
 * 
 * Usage:
 *   node scraper/delete-records.js --ids "1,2,3,4,5"
 *   
 * Options:
 *   --ids IDS        Comma-separated list of record IDs to delete
 *   --force          Skip confirmation prompt (use with caution)
 *   --help           Show this help message
 */

const { createClient } = require('@supabase/supabase-js');
const minimist = require('minimist');
const readline = require('readline');

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ['ids'],
  boolean: ['help', 'force'],
  alias: {
    h: 'help',
    i: 'ids',
    f: 'force'
  }
});

// Show help text if requested or no IDs provided
if (argv.help || !argv.ids) {
  showHelp();
  process.exit(0);
}

// Utility functions
function showHelp() {
  console.log(`
Record Deletion Utility
======================

Delete records from the scraped_shows_pending table by ID.

Environment Variables Required:
  SUPABASE_URL                 Your Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY    Your Supabase service role key

Usage:
  node scraper/delete-records.js --ids "1,2,3,4,5"

Options:
  -i, --ids IDS       Comma-separated list of record IDs to delete
  -f, --force         Skip confirmation prompt (use with caution)
  -h, --help          Show this help message

Examples:
  # Delete records with IDs 1, 2, 3, 4, and 5
  node scraper/delete-records.js --ids "1,2,3,4,5"

  # Delete records without confirmation prompt
  node scraper/delete-records.js --ids "1,2,3,4,5" --force
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
function truncate(text, maxLength = 50) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Create readline interface for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Prompt for confirmation
function confirm(message) {
  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Parse and validate IDs
function parseIds(idsString) {
  if (!idsString) return [];
  
  const ids = idsString.split(',')
    .map(id => id.trim())
    .filter(id => id)
    .map(id => parseInt(id, 10))
    .filter(id => !isNaN(id) && id > 0);
  
  return [...new Set(ids)]; // Remove duplicates
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
    
    // Parse IDs
    const ids = parseIds(argv.ids);
    
    if (ids.length === 0) {
      logError('No valid IDs provided', 'Please provide valid numeric IDs');
      process.exit(1);
    }
    
    log(`Preparing to delete ${ids.length} records`, ids);
    
    // Fetch records to show details before deletion
    const { data: records, error: fetchError } = await supabase
      .from('scraped_shows_pending')
      .select('*')
      .in('id', ids);
    
    if (fetchError) {
      logError('Error fetching records', fetchError);
      process.exit(1);
    }
    
    if (records.length === 0) {
      log('No records found with the provided IDs');
      process.exit(0);
    }
    
    log(`Found ${records.length} of ${ids.length} requested records`);
    
    // Show record details
    records.forEach((record, index) => {
      console.log(`\n${index + 1}. Record ID: ${record.id}`);
      console.log(`   Source: ${record.source_url}`);
      console.log(`   Status: ${record.status}`);
      console.log(`   Created: ${formatDate(record.created_at)}`);
      
      if (record.raw_payload) {
        console.log(`   Event: ${record.raw_payload.name || 'N/A'}`);
        console.log(`   Date: ${record.raw_payload.startDate || 'N/A'}`);
        console.log(`   Location: ${[
          record.raw_payload.venueName,
          record.raw_payload.city,
          record.raw_payload.state
        ].filter(Boolean).join(', ') || 'N/A'}`);
        
        if (record.raw_payload.description) {
          console.log(`   Description: ${truncate(record.raw_payload.description)}`);
        }
      }
    });
    
    // Missing IDs
    const foundIds = records.map(r => r.id);
    const missingIds = ids.filter(id => !foundIds.includes(id));
    
    if (missingIds.length > 0) {
      console.log(`\nWarning: ${missingIds.length} IDs not found: ${missingIds.join(', ')}`);
    }
    
    // Confirm deletion
    if (!argv.force) {
      const confirmed = await confirm(`\nAre you sure you want to delete these ${records.length} records?`);
      
      if (!confirmed) {
        log('Deletion cancelled');
        rl.close();
        process.exit(0);
      }
    }
    
    // Delete records one by one
    log(`Deleting ${records.length} records...`);
    
    const results = {
      success: [],
      failure: []
    };
    
    for (const record of records) {
      try {
        const { error } = await supabase
          .from('scraped_shows_pending')
          .delete()
          .eq('id', record.id);
        
        if (error) {
          console.error(`❌ Failed to delete record ${record.id}: ${error.message}`);
          results.failure.push({ id: record.id, error: error.message });
        } else {
          console.log(`✅ Successfully deleted record ${record.id}`);
          results.success.push(record.id);
        }
      } catch (e) {
        console.error(`❌ Exception deleting record ${record.id}: ${e.message}`);
        results.failure.push({ id: record.id, error: e.message });
      }
    }
    
    // Show summary
    log('Deletion Summary', {
      requested: ids.length,
      found: records.length,
      deleted: results.success.length,
      failed: results.failure.length,
      notFound: missingIds.length,
      successIds: results.success,
      failureDetails: results.failure,
      notFoundIds: missingIds
    });
    
    rl.close();
    
  } catch (error) {
    logError('Unhandled error', error);
    rl.close();
    process.exit(1);
  }
}

// Run the main function
main();
