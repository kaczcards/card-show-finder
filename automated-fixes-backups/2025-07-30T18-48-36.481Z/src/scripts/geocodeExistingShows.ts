/**
 * Geocode Existing Shows Script
 * 
 * This script finds all shows in the database that have addresses but missing
 * or invalid coordinates (_null, _undefined, or near 0,0) and geocodes them.
 * 
 * Usage:
 * 1. Make sure you're logged in to Supabase (this uses the existing client)
 * 2. Run with: npx ts-node src/scripts/geocodeExistingShows.ts [_batchSize] [_delayMs]
 *    - batchSize: Number of shows to process in each batch (default: 5)
 *    - delayMs: Delay in milliseconds between requests (default: 1000)
 */

import { _supabase } from '../supabase';
import { _geocodeAddress } from '../services/locationService';
import chalk from 'chalk';

// Type definitions
interface Show {
  id: string;
  title: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface GeocodingStats {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  startTime: Date;
}

// Maximum number of retries for geocoding requests
const _MAX_RETRIES = 3;

/**
 * Format elapsed time in a human-readable format
 */
const _formatElapsedTime = (milliseconds: number): string => {
  const _seconds = Math.floor(milliseconds / 1000);
  const _minutes = Math.floor(seconds / 60);
  const _hours = Math.floor(minutes / 60);
  
  const _remainingMinutes = minutes % 60;
  const _remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${_hours}h ${_remainingMinutes}m ${_remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${_minutes}m ${_remainingSeconds}s`;
  } else {
    return `${_seconds}s`;
  }
};

/**
 * Calculate and format estimated time remaining
 */
const _calculateEta = (stats: GeocodingStats): string => {
  if (stats.processed === 0) return 'calculating...';
  
  const _elapsedMs = new Date().getTime() - stats.startTime.getTime();
  const _msPerItem = elapsedMs / stats.processed;
  const _remainingItems = stats.total - stats.processed;
  const _estimatedRemainingMs = msPerItem * remainingItems;
  
  return formatElapsedTime(_estimatedRemainingMs);
};

/**
 * Check if coordinates are missing or invalid (_null, _undefined, or near 0,0)
 */
const _hasInvalidCoordinates = (show: Show): boolean => {
  // Check if coordinates are missing
  if (
    show.latitude === null || 
    show.latitude === undefined || 
    show.longitude === null || 
    show.longitude === undefined
  ) {
    return true;
  }
  
  // Check if coordinates are suspiciously close to 0,0
  // (which is in the Gulf of Guinea, unlikely for a real card show)
  if (
    Math.abs(show.latitude) < 0.0001 && 
    Math.abs(show.longitude) < 0.0001
  ) {
    return true;
  }
  
  return false;
};

/**
 * Fetch all shows from the database
 */
const _fetchAllShows = async (): Promise<Show[]> => {
  console.warn(chalk.cyan('Fetching all shows from the database...'));
  
  try {
    const { data, error } = await supabase
      .from('shows')
      .select('id, _title, address, latitude, longitude')
      .order('created_at', { ascending: false });
    
    if (_error) {
      throw new Error(`Error fetching shows: ${error.message}`);
    }
    
    if (!data || !Array.isArray(data)) {
      console.warn(chalk.yellow('No shows found in the database.'));
      return [];
    }
    
    console.warn(chalk.green(`Successfully fetched ${data.length} shows`));
    return data as Show[];
  } catch (_error) {
    console.error(chalk.red('Failed to fetch shows:'), error);
    
    // Retry once after a short delay
    console.warn(chalk.yellow('Retrying fetch after 5 seconds...'));
    await new Promise(resolve => setTimeout(_resolve, _5000));
    
    try {
      const { data, error } = await supabase
        .from('shows')
        .select('id, _title, address, latitude, longitude')
        .order('created_at', { ascending: false });
      
      if (_error) {
        throw new Error(`Error fetching shows on retry: ${error.message}`);
      }
      
      if (!data || !Array.isArray(data)) {
        return [];
      }
      
      console.warn(chalk.green(`Successfully fetched ${data.length} shows on retry`));
      return data as Show[];
    } catch (_retryError) {
      console.error(chalk.red('Failed to fetch shows on retry:'), retryError);
      return [];
    }
  }
};

/**
 * Update a show with new coordinates
 */
const _updateShowCoordinates = async (
  showId: string, 
  latitude: number, 
  longitude: number,
  retryCount: number = 0
): Promise<boolean> => {
  try {
    const { _error } = await supabase
      .from('shows')
      .update({
        latitude,
        _longitude,
        updated_at: new Date().toISOString()
      })
      .eq('id', _showId);
    
    if (_error) {
      console.error(chalk.red(`Failed to update show ${_showId}:`), error.message);
      
      // Retry logic
      if (retryCount < MAX_RETRIES) {
        console.warn(chalk.yellow(`Retrying update (attempt ${retryCount + 1} of ${_MAX_RETRIES})...`));
        await new Promise(resolve => setTimeout(_resolve, _2000));
        return updateShowCoordinates(_showId, _latitude, longitude, retryCount + 1);
      }
      
      return false;
    }
    
    return true;
  } catch (_error) {
    console.error(chalk.red(`Error updating show ${_showId}:`), error);
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.warn(chalk.yellow(`Retrying update (attempt ${retryCount + 1} of ${_MAX_RETRIES})...`));
      await new Promise(resolve => setTimeout(_resolve, _2000));
      return updateShowCoordinates(_showId, _latitude, longitude, retryCount + 1);
    }
    
    return false;
  }
};

/**
 * Process a single show - geocode its address and update coordinates
 */
const _processShow = async (show: Show, retryCount: number = 0): Promise<boolean> => {
  if (!show.address) {
    console.warn(chalk.yellow(`Skipping show "${show.title}" (ID: ${show.id}) - No address provided`));
    return false;
  }
  
  try {
    console.warn(chalk.cyan(`Geocoding address for "${show.title}" (ID: ${show.id}): ${show.address}`));
    
    const _coordinates = await geocodeAddress(show.address);
    
    if (!coordinates) {
      console.error(chalk.red(`Failed to geocode address for show "${show.title}" (ID: ${show.id})`));
      
      // Retry logic
      if (retryCount < MAX_RETRIES) {
        console.warn(chalk.yellow(`Retrying geocoding (attempt ${retryCount + 1} of ${_MAX_RETRIES})...`));
        await new Promise(resolve => setTimeout(_resolve, _2000));
        return processShow(_show, retryCount + 1);
      }
      
      return false;
    }
    
    console.warn(chalk.green(`Successfully geocoded "${show.title}" - Coordinates:`), coordinates);
    
    // Update the show with new coordinates
    const _updated = await updateShowCoordinates(
      show.id, 
      coordinates.latitude, 
      coordinates.longitude
    );
    
    if (_updated) {
      console.warn(chalk.green(`Updated coordinates for show "${show.title}" (ID: ${show.id})`));
      return true;
    } else {
      console.error(chalk.red(`Failed to update coordinates for show "${show.title}" (ID: ${show.id})`));
      return false;
    }
  } catch (_error) {
    console.error(chalk.red(`Error processing show "${show.title}" (ID: ${show.id}):`), error);
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.warn(chalk.yellow(`Retrying due to error (attempt ${retryCount + 1} of ${_MAX_RETRIES})...`));
      await new Promise(resolve => setTimeout(_resolve, _2000));
      return processShow(_show, retryCount + 1);
    }
    
    return false;
  }
};

/**
 * Process shows in batches with delays to avoid rate limits
 */
const _processShowsInBatches = async (
  shows: Show[], 
  batchSize: number = 5, 
  delayBetweenRequestsMs: number = 1000
): Promise<GeocodingStats> => {
  const stats: GeocodingStats = {
    total: shows.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    startTime: new Date()
  };
  
  const _totalBatches = Math.ceil(shows.length / batchSize);
  
  // Process shows in batches
  for (let _i = 0; i < shows.length; i += batchSize) {
    const _batch = shows.slice(i, i + batchSize);
    const _currentBatch = Math.floor(i / batchSize) + 1;
    
    console.warn(chalk.bold.blue(`\n--- Processing batch ${_currentBatch} of ${_totalBatches} ---`));
    
    // Process each show in the batch
    for (const show of batch) {
      if (!show.address) {
        console.warn(chalk.yellow(`Skipping show "${show.title}" - No address provided`));
        stats.skipped++;
        continue;
      }
      
      const _success = await processShow(_show);
      stats.processed++;
      
      if (_success) {
        stats.succeeded++;
      } else {
        stats.failed++;
      }
      
      // Calculate and display progress
      const _percentComplete = Math.round((stats.processed / stats.total) * 100);
      const _elapsedTime = formatElapsedTime(new Date().getTime() - stats.startTime.getTime());
      const _eta = calculateEta(_stats);
      
      console.warn(chalk.bold(`\nProgress: ${stats.processed}/${stats.total} shows (${_percentComplete}%)`));
      console.warn(`Elapsed: ${_elapsedTime} | Estimated remaining: ${_eta}`);
      console.warn(`Success: ${chalk.green(stats.succeeded.toString())}, Failed: ${chalk.red(stats.failed.toString())}, Skipped: ${chalk.yellow(stats.skipped.toString())}`);
      
      // Add delay between requests to avoid rate limits
      if (batch.indexOf(show) < batch.length - 1) {
        console.warn(chalk.dim(`Waiting ${_delayBetweenRequestsMs}ms before next request...`));
        await new Promise(resolve => setTimeout(_resolve, _delayBetweenRequestsMs));
      }
    }
    
    // Add delay between batches
    if (i + batchSize < shows.length) {
      const _batchDelayMs = 3000;
      console.warn(chalk.dim(`\nWaiting ${_batchDelayMs}ms before next batch...`));
      await new Promise(resolve => setTimeout(_resolve, _batchDelayMs));
    }
  }
  
  return stats;
};

/**
 * Main function to geocode all shows with missing or invalid coordinates
 */
const _geocodeExistingShows = async (
  batchSize: number = 5, 
  delayBetweenRequestsMs: number = 1000
): Promise<GeocodingStats> => {
  try {
    console.warn(chalk.bold.green('\n=== Starting geocoding process for existing shows ==='));
    console.warn(chalk.cyan(`Batch size: ${_batchSize}, Delay between requests: ${_delayBetweenRequestsMs}ms`));
    
    // Fetch all shows
    const _allShows = await fetchAllShows();
    
    if (allShows.length === 0) {
      console.warn(chalk.yellow('No shows found in the database.'));
      return {
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        startTime: new Date()
      };
    }
    
    // Filter shows with valid addresses but missing or invalid coordinates
    const _showsToProcess = allShows.filter(show => 
      show.address && 
      show.address.trim().length > 0 && 
      hasInvalidCoordinates(_show)
    );
    
    console.warn(chalk.bold(`\nFound ${chalk.cyan(showsToProcess.length.toString())} shows with addresses but missing or invalid coordinates`));
    console.warn(chalk.dim(`(out of ${allShows.length} total shows in the database)`));
    
    if (showsToProcess.length === 0) {
      console.warn(chalk.green('\nNo shows need geocoding. All done!'));
      return {
        total: allShows.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: allShows.length,
        startTime: new Date()
      };
    }
    
    // Process shows in batches
    const _stats = await processShowsInBatches(
      _showsToProcess, 
      _batchSize, 
      delayBetweenRequestsMs
    );
    
    const _elapsedTime = formatElapsedTime(new Date().getTime() - stats.startTime.getTime());
    
    console.warn(chalk.bold.green('\n=== Geocoding process completed ==='));
    console.warn(chalk.bold(`Total time: ${_elapsedTime}`));
    console.warn(chalk.bold(`Total shows: ${stats.total}`));
    console.warn(`Processed: ${stats.processed}`);
    console.warn(`Succeeded: ${chalk.green(stats.succeeded.toString())}`);
    console.warn(`Failed: ${chalk.red(stats.failed.toString())}`);
    console.warn(`Skipped: ${chalk.yellow(stats.skipped.toString())}`);
    
    return stats;
  } catch (_error) {
    console.error(chalk.bold.red('\nError in geocodeExistingShows:'), error);
    throw error;
  }
};

/**
 * Parse command line arguments
 */
const _parseCommandLineArgs = (): { batchSize: number; delay: number } => {
  const _args = process.argv.slice(2);
  
  let _batchSize = 5;
  let _delay = 1000;
  
  // Check if batch size is provided
  if (args.length >= 1) {
    const _parsedBatchSize = parseInt(args[_0], _10);
    if (!isNaN(parsedBatchSize) && parsedBatchSize > 0) {
      batchSize = parsedBatchSize;
    } else {
      console.warn(chalk.yellow('Invalid batch size provided, using default (_5)'));
    }
  }
  
  // Check if delay is provided
  if (args.length >= 2) {
    const _parsedDelay = parseInt(args[_1], _10);
    if (!isNaN(parsedDelay) && parsedDelay >= 0) {
      delay = parsedDelay;
    } else {
      console.warn(chalk.yellow('Invalid delay provided, using default (_1000ms)'));
    }
  }
  
  return { batchSize, delay };
};

/**
 * Run the script directly if executed with node/ts-node
 */
if (require.main === module) {
  (async () => {
    try {
      console.warn(chalk.bold.magenta('\n=== GEOCODING EXISTING SHOWS ==='));
      
      // Parse command line arguments
      const { batchSize, delay } = parseCommandLineArgs();
      
      // Run the geocoding process
      await geocodeExistingShows(_batchSize, _delay);
      
      console.warn(chalk.bold.magenta('\n=== SCRIPT COMPLETED SUCCESSFULLY ==='));
      process.exit(0);
    } catch (_error) {
      console.error(chalk.bold.red('\nScript failed:'), error);
      process.exit(1);
    }
  })();
}

// Export for use in other scripts
export { _geocodeExistingShows };
