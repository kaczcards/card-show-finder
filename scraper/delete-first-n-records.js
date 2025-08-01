#!/usr/bin/env node
/**
 * scraper/delete-first-n-records.js
 * 
 * Utility to delete the first N records from the scraped_shows_pending table.
 * 
 * Usage:
 *   node scraper/delete-first-n-records.js [options]
 *   
 * Options:
 *   --count N         Number of records to delete (default: 5)
 *   --force          Skip confirmation prompt (use with caution)
 *   --help           Show this help message
 */

const { createClient } = require('@supabase/supabase-js');
const minimist = require('minimist');
const readline = require('readline');
const path = require('path');
const { spawn } = require('child_process');

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ['count'],
  boolean: ['help', 'force'],
  alias: {
    h: 'help',
    c: 'count',
    f: 'force'
  },
  default: {
    count: 5
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
Delete First N Records Utility
=============================

Delete the first N records from the scraped_shows_pending table.

Environment Variables Required:
  SUPABASE_URL                 Your Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY    Your Supabase service role key

Usage:
  node scraper/delete-first-n-records.js [options]

Options:
  -c, --count N       Number of records to delete (default: 5)
  -f, --force         Skip confirmation prompt (use with caution)
  -h, --help          Show this help message

Examples:
  # Delete the first 5 records
  node scraper/delete-first-n-records.js

  # Delete the first 10 records
  node scraper/delete-first-n-records.js --count 10

  # Delete the first 3 records without confirmation prompt
  node scraper/delete-first-n-records.js --count 3 --force
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
    
    // Parse count
    const count = parseInt(argv.count, 10);
    
    if (isNaN(count) || count <= 0) {
      logError('Invalid count', 'Please provide a positive number for --count');
      process.exit(1);
    }
    
    log(`Fetching first ${count} records from scraped_shows_pending...`);
    
    // Fetch the first N records ordered by created_at
    const { data: records, error } = await supabase
      .from('scraped_shows_pending')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(count);
    
    if (error) {
      logError('Error fetching records', error);
      process.exit(1);
    }
    
    if (records.length === 0) {
      log('No records found in the scraped_shows_pending table');
      process.exit(0);
    }
    
    log(`Found ${records.length} records`);
    
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
    
    // Extract IDs for deletion
    const ids = records.map(record => record.id);
    
    // Confirm deletion
    if (!argv.force) {
      const confirmed = await confirm(`\nAre you sure you want to delete these ${records.length} records?`);
      
      if (!confirmed) {
        log('Deletion cancelled');
        rl.close();
        process.exit(0);
      }
    }
    
    // Call delete-records.js with the extracted IDs
    log(`Deleting ${records.length} records...`);
    
    // Build the command to execute delete-records.js
    const deleteArgs = [
      path.join(__dirname, 'delete-records.js'),
      '--ids', ids.join(',')
    ];
    
    if (argv.force) {
      deleteArgs.push('--force');
    }
    
    // Execute the delete-records.js script
    const deleteProcess = spawn('node', deleteArgs, {
      stdio: 'inherit',
      env: process.env
    });
    
    deleteProcess.on('close', (code) => {
      if (code !== 0) {
        logError(`delete-records.js exited with code ${code}`);
        process.exit(code);
      }
      
      log(`Successfully deleted ${records.length} records`);
      rl.close();
      process.exit(0);
    });
    
  } catch (error) {
    logError('Unhandled error', error);
    rl.close();
    process.exit(1);
  }
}

// Run the main function
main();
