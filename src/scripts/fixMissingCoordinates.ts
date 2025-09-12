#!/usr/bin/env node
/**
 * Fix Missing Coordinates Script
 * 
 * This script finds all shows in the database that have addresses but missing
 * coordinates (null) and geocodes them using Google Maps API.
 * 
 * Usage:
 * 1. Make sure environment variables are set:
 *    - SUPABASE_URL
 *    - SUPABASE_SERVICE_ROLE_KEY
 *    - GOOGLE_MAPS_API_KEY
 * 2. Run with: npx ts-node src/scripts/fixMissingCoordinates.ts [--batch N] [--delay MS]
 *    - --batch N: Number of shows to process in each batch (default: 5)
 *    - --delay MS: Delay in milliseconds between requests (default: 1000)
 */

// Load environment variables
import 'dotenv/config';
import chalk from 'chalk';

// Import service modules
import { serviceSupabase } from './_supabaseService';
import { geocodeAddress } from '../services/googleGeocoder';

// Type definitions
interface Show {
  id: string;
  title: string;
  address: string;
}

interface ProcessingStats {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  startTime: Date;
}

// Maximum number of retries for geocoding requests
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
 * Parse command line arguments
 */
const parseCommandLineArgs = (): { batchSize: number; delay: number } => {
  let batchSize = 5;
  let delay = 1000;

  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--batch' && i + 1 < process.argv.length) {
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

  return { batchSize, delay };
};

/**
 * Fetch all shows with missing coordinates
 */
const fetchShowsWithMissingCoordinates = async (): Promise<Show[]> => {
  console.log(chalk.cyan('Fetching shows with missing coordinates...'));
  
  try {
    const { data, error } = await serviceSupabase
      .from('shows')
      .select('id, title, address')
      .is('coordinates', null)
      .not('address', 'is', null)
      .not('address', 'eq', '')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Error fetching shows: ${error.message}`);
    }
    
    if (!data || !Array.isArray(data)) {
      console.log(chalk.yellow('No shows found with missing coordinates.'));
      return [];
    }
    
    console.log(chalk.green(`Found ${data.length} shows with missing coordinates`));
    return data as Show[];
  } catch (error) {
    console.error(chalk.red('Failed to fetch shows:'), error);
    throw error;
  }
};

/**
 * Process a single show - geocode its address and update coordinates
 */
const processShow = async (show: Show, retryCount: number = 0): Promise<boolean> => {
  if (!show.address) {
    console.log(chalk.yellow(`Skipping show "${show.title}" (ID: ${show.id}) - No address provided`));
    return false;
  }
  
  try {
    console.log(chalk.cyan(`Geocoding address for "${show.title}" (ID: ${show.id}): ${show.address}`));
    
    const coordinates = await geocodeAddress(show.address);
    
    if (!coordinates) {
      console.error(chalk.red(`Failed to geocode address for show "${show.title}" (ID: ${show.id})`));
      
      // Retry logic
      if (retryCount < MAX_RETRIES) {
        console.log(chalk.yellow(`Retrying geocoding (attempt ${retryCount + 1} of ${MAX_RETRIES})...`));
        await new Promise(resolve => setTimeout(resolve, 2000));
        return processShow(show, retryCount + 1);
      }
      
      return false;
    }
    
    console.log(chalk.green(`Successfully geocoded "${show.title}" - Coordinates:`), 
      coordinates.latitude, coordinates.longitude);
    
    // Update the show with new coordinates using RPC function
    const { data, error } = await serviceSupabase.rpc('set_show_coordinates', {
      show_id: show.id,
      p_lat: coordinates.latitude,
      p_lng: coordinates.longitude
    });
    
    if (error) {
      console.error(chalk.red(`Failed to update coordinates for show "${show.title}" (ID: ${show.id}):`), error.message);
      return false;
    }
    
    if (data === true) {
      console.log(chalk.green(`Updated coordinates for show "${show.title}" (ID: ${show.id})`));
      return true;
    } else {
      console.error(chalk.red(`Failed to update coordinates for show "${show.title}" (ID: ${show.id}): No rows updated`));
      return false;
    }
  } catch (error: any) {
    console.error(chalk.red(`Error processing show "${show.title}" (ID: ${show.id}):`), error.message);
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.log(chalk.yellow(`Retrying due to error (attempt ${retryCount + 1} of ${MAX_RETRIES})...`));
      await new Promise(resolve => setTimeout(resolve, 2000));
      return processShow(show, retryCount + 1);
    }
    
    return false;
  }
};

/**
 * Process shows in batches with delays to avoid rate limits
 */
const processShowsInBatches = async (
  shows: Show[], 
  batchSize: number = 5, 
  delayBetweenRequestsMs: number = 1000
): Promise<ProcessingStats> => {
  const stats: ProcessingStats = {
    total: shows.length,
    processed: 0,
    succeeded: 0,
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
      if (!show.address) {
        console.log(chalk.yellow(`Skipping show "${show.title}" - No address provided`));
        stats.skipped++;
        continue;
      }
      
      const success = await processShow(show);
      stats.processed++;
      
      if (success) {
        stats.succeeded++;
      } else {
        stats.failed++;
      }
      
      // Calculate and display progress
      const percentComplete = Math.round((stats.processed / stats.total) * 100);
      const elapsedTime = formatElapsedTime(new Date().getTime() - stats.startTime.getTime());
      const eta = calculateEta(stats);
      
      console.log(chalk.bold(`\nProgress: ${stats.processed}/${stats.total} shows (${percentComplete}%)`));
      console.log(`Elapsed: ${elapsedTime} | Estimated remaining: ${eta}`);
      console.log(`Success: ${chalk.green(stats.succeeded.toString())}, Failed: ${chalk.red(stats.failed.toString())}, Skipped: ${chalk.yellow(stats.skipped.toString())}`);
      
      // Add delay between requests to avoid rate limits
      if (batch.indexOf(show) < batch.length - 1) {
        console.log(chalk.dim(`Waiting ${delayBetweenRequestsMs}ms before next request...`));
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequestsMs));
      }
    }
    
    // Add delay between batches
    if (i + batchSize < shows.length) {
      const batchDelayMs = 3000;
      console.log(chalk.dim(`\nWaiting ${batchDelayMs}ms before next batch...`));
      await new Promise(resolve => setTimeout(resolve, batchDelayMs));
    }
  }
  
  return stats;
};

/**
 * Main function to fix shows with missing coordinates
 */
const fixMissingCoordinates = async (
  batchSize: number = 5, 
  delayBetweenRequestsMs: number = 1000
): Promise<ProcessingStats> => {
  try {
    console.log(chalk.bold.green('\n=== Starting geocoding process for shows with missing coordinates ==='));
    console.log(chalk.cyan(`Batch size: ${batchSize}, Delay between requests: ${delayBetweenRequestsMs}ms`));
    
    // Fetch all shows with missing coordinates
    const showsToProcess = await fetchShowsWithMissingCoordinates();
    
    if (showsToProcess.length === 0) {
      console.log(chalk.green('\nNo shows need geocoding. All done!'));
      return {
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        startTime: new Date()
      };
    }
    
    // Process shows in batches
    const stats = await processShowsInBatches(
      showsToProcess, 
      batchSize, 
      delayBetweenRequestsMs
    );
    
    const elapsedTime = formatElapsedTime(new Date().getTime() - stats.startTime.getTime());
    
    console.log(chalk.bold.green('\n=== Geocoding process completed ==='));
    console.log(chalk.bold(`Total time: ${elapsedTime}`));
    console.log(chalk.bold(`Total shows: ${stats.total}`));
    console.log(`Processed: ${stats.processed}`);
    console.log(`Succeeded: ${chalk.green(stats.succeeded.toString())}`);
    console.log(`Failed: ${chalk.red(stats.failed.toString())}`);
    console.log(`Skipped: ${chalk.yellow(stats.skipped.toString())}`);
    
    return stats;
  } catch (error) {
    console.error(chalk.bold.red('\nError in fixMissingCoordinates:'), error);
    throw error;
  }
};

/**
 * Run the script directly if executed with node/ts-node
 */
if (require.main === module) {
  (async () => {
    try {
      console.log(chalk.bold.magenta('\n=== FIX MISSING COORDINATES ==='));
      
      // Parse command line arguments
      const { batchSize, delay } = parseCommandLineArgs();
      
      // Run the geocoding process
      const stats = await fixMissingCoordinates(batchSize, delay);
      
      console.log(chalk.bold.magenta('\n=== SCRIPT COMPLETED SUCCESSFULLY ==='));
      
      // Exit with code 1 if any shows failed
      if (stats.failed > 0) {
        console.log(chalk.yellow(`\nWarning: ${stats.failed} shows failed to update. You may want to run the script again.`));
        process.exit(1);
      } else {
        process.exit(0);
      }
    } catch (error) {
      console.error(chalk.bold.red('\nScript failed:'), error);
      process.exit(1);
    }
  })();
}

// Export for use in other scripts
export { fixMissingCoordinates };
