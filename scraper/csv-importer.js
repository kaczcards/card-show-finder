#!/usr/bin/env node
/**
 * scraper/csv-importer.js
 * 
 * CSV import tool for card show data.
 * Reads CSV files and imports them into the database.
 * Compatible with the existing scraper architecture.
 * 
 * Usage:
 *   node scraper/csv-importer.js --file path/to/shows.csv
 *   node scraper/csv-importer.js --file path/to/shows.csv --state TX
 *   
 * CSV Format:
 *   Required columns: name,date,venue,address,city,state,zip,website
 *   Optional columns: description,admission,hours,tables,contact,phone,email
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { parse } = require('csv-parse');
const { promisify } = require('util');

// ------------------------------------------------------------------
// Load environment variables from `.env` (if present)
// This keeps configuration simple: no extra setup script required.
// ------------------------------------------------------------------
require('dotenv').config();

// ------------------------------------------------------------------
// Supabase client setup
// ------------------------------------------------------------------
// Prefer service-role credentials prepared by scraper/setup-env.js.
// Fallback to the public Expo vars so older .env files still work.
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||          // preferred (service role)
  process.env.SUPABASE_SERVICE_ROLE_KEY ||     // legacy name
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;   // last-resort (limited perms)

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '❌  Missing Supabase credentials.\n' +
      '   • EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_KEY are required.\n' +
      '   • Set them in your .env file or export them in your shell.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
// Required and optional fields in CSV
const REQUIRED_FIELDS = ['name', 'date', 'venue', 'address', 'city', 'state', 'zip'];
const OPTIONAL_FIELDS = ['website', 'description', 'admission', 'hours', 'tables', 'contact', 'phone', 'email'];
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ['file', 'state', 'output'],
  boolean: ['help', 'dry-run', 'verbose'],
  alias: {
    h: 'help',
    f: 'file',
    s: 'state',
    o: 'output',
    d: 'dry-run',
    v: 'verbose'
  }
});

// Show help text if requested or no file provided
if (argv.help || !argv.file) {
  showHelp();
  process.exit(argv.help ? 0 : 1);
}

/**
 * Main function to process CSV file
 */
async function main() {
  try {
    const filePath = argv.file;
    const stateFilter = argv.state ? argv.state.toUpperCase() : null;
    const dryRun = argv['dry-run'] || false;
    const verbose = argv.verbose || false;
    
    console.log(`Reading CSV file: ${filePath}`);
    
    // Read and parse the CSV file
    const shows = await readCsvFile(filePath);
    
    if (shows.length === 0) {
      console.error('No valid show data found in CSV file');
      process.exit(1);
    }
    
    console.log(`Found ${shows.length} shows in CSV file`);
    
    // Apply state filter if provided
    let filteredShows = shows;
    if (stateFilter) {
      filteredShows = shows.filter(show => show.state.toUpperCase() === stateFilter);
      console.log(`Filtered to ${filteredShows.length} shows in ${stateFilter}`);
    }
    
    // Process each show
    const results = {
      success: 0,
      failed: 0,
      skipped: 0
    };
    
    for (const show of filteredShows) {
      try {
        // Transform the show data to database format
        const transformedShow = transformShowData(show);
        
        if (verbose) {
          console.log(`Processing show: ${transformedShow.name} (${transformedShow.show_date})`);
        }
        
        // Save to database unless dry run
        if (!dryRun) {
          await saveShowToDatabase(transformedShow);
          results.success++;
          if (verbose) {
            console.log(`✅ Saved: ${transformedShow.name}`);
          }
        } else {
          results.skipped++;
          if (verbose) {
            console.log(`⏭️ Skipped (dry run): ${transformedShow.name}`);
          }
        }
      } catch (error) {
        results.failed++;
        console.error(`❌ Error processing show: ${show.name || 'Unknown'}`);
        console.error(`   ${error.message}`);
      }
    }
    
    // Output summary
    console.log('\nImport Summary:');
    console.log(`- Total shows processed: ${filteredShows.length}`);
    console.log(`- Successfully imported: ${results.success}`);
    console.log(`- Failed: ${results.failed}`);
    console.log(`- Skipped (dry run): ${results.skipped}`);
    
    // Write to output file if specified
    if (argv.output) {
      fs.writeFileSync(
        argv.output, 
        JSON.stringify(filteredShows, null, 2), 
        'utf8'
      );
      console.log(`\nOutput written to: ${argv.output}`);
    }
    
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Read and parse a CSV file
 * @param {string} filePath - Path to the CSV file
 * @returns {Promise<Array>} - Array of objects representing shows
 */
async function readCsvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const parseFile = promisify((input, options, callback) => {
    parse(input, options, (err, output) => {
      callback(err, output);
    });
  });
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const records = await parseFile(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    // Validate and clean records
    const validRecords = [];
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        validateRecord(record, i + 1);
        validRecords.push(record);
      } catch (error) {
        console.error(`Row ${i + 1}: ${error.message}`);
      }
    }
    
    return validRecords;
  } catch (error) {
    throw new Error(`Failed to parse CSV file: ${error.message}`);
  }
}

/**
 * Parse CSV content from a string
 * @param {string} csvContent - CSV content as a string
 * @returns {Promise<Array>} - Array of objects representing shows
 */
async function parseCsvContent(csvContent) {
  const parseContent = promisify((input, options, callback) => {
    parse(input, options, (err, output) => {
      callback(err, output);
    });
  });
  
  try {
    const records = await parseContent(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    // Validate and clean records
    const validRecords = [];
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        validateRecord(record, i + 1);
        validRecords.push(record);
      } catch (error) {
        console.error(`Row ${i + 1}: ${error.message}`);
      }
    }
    
    return validRecords;
  } catch (error) {
    throw new Error(`Failed to parse CSV content: ${error.message}`);
  }
}

/**
 * Validate a record has all required fields
 * @param {Object} record - Record to validate
 * @param {number} rowNum - Row number for error reporting
 */
function validateRecord(record, rowNum) {
  // Check for required fields
  for (const field of REQUIRED_FIELDS) {
    if (!record[field] || record[field].trim() === '') {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Validate date format (basic check)
  const dateStr = record.date;
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  
  // Validate state (2-letter code)
  if (record.state.length !== 2) {
    throw new Error(`State should be a 2-letter code, got: ${record.state}`);
  }
  
  // Validate ZIP code (basic check)
  const zipRegex = /^\d{5}(-\d{4})?$/;
  if (!zipRegex.test(record.zip)) {
    throw new Error(`Invalid ZIP code format: ${record.zip}`);
  }
}

/**
 * Transform CSV show data to database format
 * @param {Object} show - Show data from CSV
 * @returns {Object} - Transformed show data ready for database
 */
function transformShowData(show) {
  // Parse date string to ISO format
  const dateObj = new Date(show.date);
  const isoDate = dateObj.toISOString().split('T')[0];
  
  // Create transformed object with database field names
  const transformed = {
    name: show.name,
    show_date: isoDate,
    venue_name: show.venue,
    address: show.address,
    city: show.city,
    state: show.state.toUpperCase(),
    zip_code: show.zip,
    description: show.description || '',
    admission_fee: show.admission || '',
    hours: show.hours || '',
    tables: show.tables || '',
    contact_name: show.contact || '',
    contact_phone: show.phone || '',
    contact_email: show.email || '',
    website: show.website || '',
    source: 'csv_import',
    source_url: show.website || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active'
  };
  
  return transformed;
}

/**
 * Save show data to the database
 * @param {Object} show - Show data in database format
 * @returns {Promise<Object>} - Result of the database operation
 */
async function saveShowToDatabase(show) {
  try {
    // Check if show already exists to avoid duplicates
    const { data: existingShows, error: queryError } = await supabase
      .from('shows')
      .select('id')
      .eq('name', show.name)
      .eq('show_date', show.show_date)
      .eq('venue_name', show.venue_name);
    
    if (queryError) {
      throw new Error(`Database query error: ${queryError.message}`);
    }
    
    if (existingShows && existingShows.length > 0) {
      // Show already exists, update it
      const { data, error } = await supabase
        .from('shows')
        .update(show)
        .eq('id', existingShows[0].id)
        .select();
      
      if (error) {
        throw new Error(`Failed to update show: ${error.message}`);
      }
      
      return { updated: true, data };
    } else {
      // New show, insert it
      const { data, error } = await supabase
        .from('shows')
        .insert([show])
        .select();
      
      if (error) {
        throw new Error(`Failed to insert show: ${error.message}`);
      }
      
      return { inserted: true, data };
    }
  } catch (error) {
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Display help information
 */
function showHelp() {
  console.log(`
CSV Importer for Card Show Finder
=================================

Import card show data from CSV files into the database.

Usage:
  node scraper/csv-importer.js --file path/to/shows.csv [options]

Options:
  -h, --help        Show this help text
  -f, --file        Path to CSV file (required)
  -s, --state       Filter shows by state (e.g., TX)
  -o, --output      Write processed data to JSON file
  -d, --dry-run     Process file but don't save to database
  -v, --verbose     Show detailed processing information

CSV Format:
  Required columns: name,date,venue,address,city,state,zip
  Optional columns: website,description,admission,hours,tables,contact,phone,email

Example:
  node scraper/csv-importer.js --file data/shows.csv --state TX --verbose
  `);
}

// Export functions for use in other modules
module.exports = {
  readCsvFile,
  parseCsvContent,
  validateRecord,
  transformShowData,
  saveShowToDatabase
};

// Run main function if script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}
