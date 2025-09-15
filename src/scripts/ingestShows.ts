#!/usr/bin/env node
/**
 * Ingest Shows Script
 * 
 * This script imports shows from a CSV file, geocodes addresses using Google Maps API,
 * and inserts them into the database with proper coordinates.
 * 
 * Usage:
 * 1. Make sure environment variables are set:
 *    - SUPABASE_URL
 *    - SUPABASE_SERVICE_ROLE_KEY
 *    - GOOGLE_MAPS_API_KEY
 * 2. Run with: npx ts-node src/scripts/ingestShows.ts --file path/to/shows.csv [options]
 *    - --file path/to/shows.csv: Path to CSV file (required)
 *    - --dry-run: Process file but don't save to database
 *    - --batch N: Number of shows to process in each batch (default: 5)
 *    - --delay MS: Delay in milliseconds between requests (default: 1000)
 * 
 * CSV Format:
 *   Required columns: title, address, start_date, end_date
 *   Optional columns: city, state, zip, location, description, entry_fee, website_url
 */

// Load environment variables
import 'dotenv/config';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { promisify } from 'util';

// Import service modules
import { serviceSupabase } from './_supabaseService';
import { geocodeAddress } from '../services/googleGeocoder';

// Type definitions
interface CsvShowRecord {
  title: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  start_date: string;
  end_date: string;
  location?: string;
  description?: string;
  entry_fee?: string;
  website_url?: string;
  [key: string]: string | undefined;
}

interface ProcessingStats {
  total: number;
  processed: number;
  geocoded: number;
  inserted: number;
  failed: number;
  skipped: number;
  startTime: Date;
}

// Constants
const REQUIRED_FIELDS = ['title', 'address', 'start_date', 'end_date'];
const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_DELAY_MS = 1000;
const MAX_RETRIES = 3;

/**
 * Format elapsed time in a human-readable format
 */
const formatElapsedTime = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Calculate and format estimated time remaining
 */
const calculateEta = (stats: ProcessingStats): string => {
  if (stats.processed === 0) return 'calculating...';

  const elapsedMs = new Date().getTime() - stats.startTime.getTime();
  const msPerItem = elapsedMs / stats.processed;
  const remainingItems = stats.total - stats.processed;
  const estimatedRemainingMs = msPerItem * remainingItems;

  return formatElapsedTime(estimatedRemainingMs);
};

/**
 * Sleep/delay function for rate limiting
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Parse command line arguments
 */
const parseCommandLineArgs = (): { 
  filePath: string | null; 
  dryRun: boolean; 
  batchSize: number; 
  delay: number;
} => {
  let filePath: string | null = null;
  let dryRun = false;
  let batchSize = DEFAULT_BATCH_SIZE;
  let delay = DEFAULT_DELAY_MS;

  for (let i = 2; i < process.argv.length; i++) {
    if ((process.argv[i] === '--file' || process.argv[i] === '-f') && i + 1 < process.argv.length) {
      filePath = process.argv[i + 1];
      i++; // Skip the next argument as we've consumed it
    } else if (process.argv[i] === '--dry-run' || process.argv[i] === '-d') {
      dryRun = true;
    } else if (process.argv[i] === '--batch' && i + 1 < process.argv.length) {
      const parsed = parseInt(process.argv[i + 1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        batchSize = parsed;
        i++; // Skip the next argument as we've consumed it
      }
    } else if (process.argv[i] === '--delay' && i + 1 < process.argv.length) {
      const parsed = parseInt(process.argv[i + 1], 10);
      if (!isNaN(parsed) && parsed >= 0) {
        delay = parsed;
        i++; // Skip the next argument as we've consumed it
      }
    }
  }

  return { filePath, dryRun, batchSize, delay };
};

/**
 * Show help information
 */
const showHelp = (): void => {
  console.log(`
Ingest Shows Script
==================

Import shows from a CSV file, geocode addresses, and insert them into the database.

Usage:
  npx ts-node src/scripts/ingestShows.ts --file path/to/shows.csv [options]

Options:
  -f, --file        Path to CSV file (required)
  -d, --dry-run     Process file but don't save to database
  --batch N         Number of shows to process in each batch (default: 5)
  --delay MS        Delay in milliseconds between requests (default: 1000)

CSV Format:
  Required columns: title, address, start_date, end_date
  Optional columns: city, state, zip, location, description, entry_fee, website_url

Example:
  npx ts-node src/scripts/ingestShows.ts --file data/shows.csv --batch 10 --delay 2000
  `);
};

/**
 * Read and parse a CSV file
 */
const readCsvFile = async (filePath: string): Promise<CsvShowRecord[]> => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const parseFile = promisify((input: string, options: any, callback: any) => {
    parse(input, options, (err: any, output: any) => {
      callback(err, output);
    });
  });
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const records = await parseFile(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as Record<string, string>[];
    
    // Normalize column names (case-insensitive)
    const normalizedRecords = records.map(record => {
      const normalizedRecord: Record<string, string> = {};
      
      Object.keys(record).forEach(key => {
        const normalizedKey = key.toLowerCase().trim();
        normalizedRecord[normalizedKey] = record[key];
      });
      
      return normalizedRecord;
    });
    
    // Validate and clean records
    const validRecords: CsvShowRecord[] = [];
    
    for (let i = 0; i < normalizedRecords.length; i++) {
      const record = normalizedRecords[i] as unknown as CsvShowRecord;
      try {
        validateRecord(record, i + 1);
        validRecords.push(record);
      } catch (error: any) {
        console.error(chalk.yellow(`Row ${i + 1}: ${error.message}`));
      }
    }
    
    return validRecords;
  } catch (error: any) {
    throw new Error(`Failed to parse CSV file: ${error.message}`);
  }
};

/**
 * Validate a record has all required fields
 */
const validateRecord = (record: CsvShowRecord, rowNum: number): void => {
  // Check for required fields
  for (const field of REQUIRED_FIELDS) {
    if (!record[field] || record[field].trim() === '') {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Validate date formats
  for (const dateField of ['start_date', 'end_date']) {
    const dateStr = record[dateField];
    if (!dateStr) continue;
    
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Invalid date format for ${dateField}: ${dateStr}`);
    }
  }
  
  // Validate entry_fee is numeric if provided
  if (record.entry_fee && isNaN(Number(record.entry_fee))) {
    throw new Error(`Entry fee must be a number, got: ${record.entry_fee}`);
  }
};

/**
 * Build a full address string from components
 */
const buildFullAddress = (record: CsvShowRecord): string => {
  let fullAddress = record.address.trim();
  
  if (record.city && record.city.trim()) {
    fullAddress += `, ${record.city.trim()}`;
  }
  
  if (record.state && record.state.trim()) {
    fullAddress += `, ${record.state.trim()}`;
  }
  
  if (record.zip && record.zip.trim()) {
    fullAddress += ` ${record.zip.trim()}`;
  }
  
  return fullAddress;
};

/**
 * Process a single show - geocode its address and insert into database
 */
const processShow = async (
  record: CsvShowRecord, 
  dryRun: boolean,
  retryCount: number = 0
): Promise<boolean> => {
  try {
    const title = record.title.trim();
    const fullAddress = buildFullAddress(record);
    
    console.log(chalk.cyan(`Geocoding address for "${title}": ${fullAddress}`));
    
    // Geocode the address
    const geocodeResult = await geocodeAddress(fullAddress);
    
    if (!geocodeResult) {
      console.error(chalk.red(`Failed to geocode address for show "${title}"`));
      
      // Retry logic
      if (retryCount < MAX_RETRIES) {
        console.log(chalk.yellow(`Retrying geocoding (attempt ${retryCount + 1} of ${MAX_RETRIES})...`));
        await sleep(2000);
        return processShow(record, dryRun, retryCount + 1);
      }
      
      return false;
    }
    
    console.log(chalk.green(`Successfully geocoded "${title}" - Coordinates:`), 
      geocodeResult.latitude, geocodeResult.longitude);
    
    // Format dates as ISO strings
    const startDate = new Date(record.start_date).toISOString();
    const endDate = new Date(record.end_date).toISOString();
    
    // Parse entry fee as number or null
    const entryFee = record.entry_fee ? Number(record.entry_fee) : null;
    
    // Prepare show data for insertion
    const showData = {
      p_title: title,
      p_description: record.description || '',
      p_location: record.location || title, // Use title as fallback location name
      p_address: fullAddress,
      p_start_date: startDate,
      p_end_date: endDate,
      p_entry_fee: entryFee,
      p_image_url: '', // No image URL in CSV
      p_latitude: geocodeResult.latitude,
      p_longitude: geocodeResult.longitude,
      p_features: null, // No features in CSV
      p_categories: null, // No categories in CSV
      p_series_id: null // No series ID in CSV
    };
    
    if (dryRun) {
      console.log(chalk.yellow(`[DRY RUN] Would insert show: ${JSON.stringify(showData, null, 2)}`));
      return true;
    }
    
    // Insert the show using RPC
    const { data, error } = await serviceSupabase.rpc(
      'create_show_with_coordinates',
      showData
    );
    
    if (error) {
      console.error(chalk.red(`Failed to insert show "${title}":`), error.message);
      return false;
    }
    
    if (data && data.success) {
      console.log(chalk.green(`Inserted show "${title}" with ID: ${data.id}`));
      return true;
    } else {
      console.error(chalk.red(`Failed to insert show "${title}": Unknown error`));
      return false;
    }
  } catch (error: any) {
    console.error(chalk.red(`Error processing show "${record.title}":`), error.message);
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.log(chalk.yellow(`Retrying due to error (attempt ${retryCount + 1} of ${MAX_RETRIES})...`));
      await sleep(2000);
      return processShow(record, dryRun, retryCount + 1);
    }
    
    return false;
  }
};

/**
 * Process shows in batches with delays to avoid rate limits
 */
const processShowsInBatches = async (
  shows: CsvShowRecord[], 
  dryRun: boolean,
  batchSize: number = DEFAULT_BATCH_SIZE, 
  delayBetweenRequestsMs: number = DEFAULT_DELAY_MS
): Promise<ProcessingStats> => {
  const stats: ProcessingStats = {
    total: shows.length,
    processed: 0,
    geocoded: 0,
    inserted: 0,
    failed: 0,
    skipped: 0,
    startTime: new Date()
  };
  
  const totalBatches = Math.ceil(shows.length / batchSize);
  
  // Process shows in batches
  for (let i = 0; i < shows.length; i += batchSize) {
    const batch = shows.slice(i, i + batchSize);
    const currentBatch = Math.floor(i / batchSize) + 1;
    
    console.log(chalk.bold.blue(`\n--- Processing batch ${currentBatch} of ${totalBatches} ---`));
    
    // Process each show in the batch
    for (const show of batch) {
      const success = await processShow(show, dryRun);
      stats.processed++;
      
      if (success) {
        stats.geocoded++;
        if (!dryRun) {
          stats.inserted++;
        } else {
          stats.skipped++;
        }
      } else {
        stats.failed++;
      }
      
      // Calculate and display progress
      const percentComplete = Math.round((stats.processed / stats.total) * 100);
      const elapsedTime = formatElapsedTime(new Date().getTime() - stats.startTime.getTime());
      const eta = calculateEta(stats);
      
      console.log(chalk.bold(`\nProgress: ${stats.processed}/${stats.total} shows (${percentComplete}%)`));
      console.log(`Elapsed: ${elapsedTime} | Estimated remaining: ${eta}`);
      console.log(`Geocoded: ${chalk.green(stats.geocoded.toString())}, ` + 
                 `Inserted: ${chalk.green(stats.inserted.toString())}, ` + 
                 `Failed: ${chalk.red(stats.failed.toString())}, ` + 
                 `Skipped: ${chalk.yellow(stats.skipped.toString())}`);
      
      // Add delay between requests to avoid rate limits
      if (batch.indexOf(show) < batch.length - 1) {
        console.log(chalk.dim(`Waiting ${delayBetweenRequestsMs}ms before next request...`));
        await sleep(delayBetweenRequestsMs);
      }
    }
    
    // Add delay between batches
    if (i + batchSize < shows.length) {
      const batchDelayMs = 3000;
      console.log(chalk.dim(`\nWaiting ${batchDelayMs}ms before next batch...`));
      await sleep(batchDelayMs);
    }
  }
  
  return stats;
};

/**
 * Main function to ingest shows from CSV
 */
const ingestShows = async (
  filePath: string,
  dryRun: boolean = false,
  batchSize: number = DEFAULT_BATCH_SIZE, 
  delayBetweenRequestsMs: number = DEFAULT_DELAY_MS
): Promise<ProcessingStats> => {
  try {
    console.log(chalk.bold.green('\n=== Starting show ingestion process ==='));
    console.log(chalk.cyan(`File: ${filePath}`));
    console.log(chalk.cyan(`Batch size: ${batchSize}, Delay between requests: ${delayBetweenRequestsMs}ms`));
    if (dryRun) {
      console.log(chalk.yellow('DRY RUN MODE: No data will be saved to the database'));
    }
    
    // Read and parse CSV file
    const shows = await readCsvFile(filePath);
    
    if (shows.length === 0) {
      console.log(chalk.yellow('\nNo valid shows found in the CSV file.'));
      return {
        total: 0,
        processed: 0,
        geocoded: 0,
        inserted: 0,
        failed: 0,
        skipped: 0,
        startTime: new Date()
      };
    }
    
    console.log(chalk.green(`\nFound ${shows.length} valid shows in the CSV file.`));
    
    // Process shows in batches
    const stats = await processShowsInBatches(
      shows, 
      dryRun,
      batchSize, 
      delayBetweenRequestsMs
    );
    
    const elapsedTime = formatElapsedTime(new Date().getTime() - stats.startTime.getTime());
    
    console.log(chalk.bold.green('\n=== Show ingestion process completed ==='));
    console.log(chalk.bold(`Total time: ${elapsedTime}`));
    console.log(chalk.bold(`Total shows: ${stats.total}`));
    console.log(`Processed: ${stats.processed}`);
    console.log(`Geocoded: ${chalk.green(stats.geocoded.toString())}`);
    console.log(`Inserted: ${chalk.green(stats.inserted.toString())}`);
    console.log(`Failed: ${chalk.red(stats.failed.toString())}`);
    console.log(`Skipped: ${chalk.yellow(stats.skipped.toString())}`);
    
    return stats;
  } catch (error: any) {
    console.error(chalk.bold.red('\nError in ingestShows:'), error.message);
    throw error;
  }
};

/**
 * Run the script directly if executed with node/ts-node
 */
if (require.main === module) {
  (async () => {
    try {
      console.log(chalk.bold.magenta('\n=== SHOW INGESTION SCRIPT ==='));
      
      // Parse command line arguments
      const { filePath, dryRun, batchSize, delay } = parseCommandLineArgs();
      
      if (!filePath) {
        console.error(chalk.red('Error: No file path provided.'));
        showHelp();
        process.exit(1);
      }
      
      // Run the ingestion process
      const stats = await ingestShows(filePath, dryRun, batchSize, delay);
      
      console.log(chalk.bold.magenta('\n=== SCRIPT COMPLETED SUCCESSFULLY ==='));
      
      // Exit with code 1 if any shows failed
      if (stats.failed > 0) {
        console.log(chalk.yellow(`\nWarning: ${stats.failed} shows failed to process. Check the logs for details.`));
        process.exit(1);
      } else {
        process.exit(0);
      }
    } catch (error: any) {
      console.error(chalk.bold.red('\nScript failed:'), error.message);
      process.exit(1);
    }
  })();
}

// Export for use in other scripts
export { ingestShows };
