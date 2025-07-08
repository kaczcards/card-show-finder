// db_migrations/migrate_shows_to_series.js
// Script to migrate existing shows to the new show_series structure

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const chalk = require('chalk'); // For colorized console output

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(chalk.red('Error: Missing required environment variables SUPABASE_URL or SUPABASE_SERVICE_KEY'));
  console.error(chalk.yellow('Please create a .env file with these variables or set them in your environment'));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Statistics for the migration
const stats = {
  seriesCreated: 0,
  showsLinked: 0,
  reviewsMigrated: 0,
  organizersUpdated: 0,
  quotasSet: 0,
  errors: 0
};

/**
 * Main migration function
 */
async function migrateShowsToSeries() {
  console.log(chalk.blue('='.repeat(80)));
  console.log(chalk.blue('Starting migration of shows to show_series structure'));
  console.log(chalk.blue('='.repeat(80)));

  try {
    // Step 1: Identify recurring shows (shows with the same title/location)
    const recurringShows = await identifyRecurringShows();
    
    // Step 2: Create show_series entries for recurring shows
    const seriesMap = await createShowSeries(recurringShows);
    
    // Step 3: Link individual shows to their series
    await linkShowsToSeries(seriesMap);
    
    // Step 4: Migrate reviews to link to series instead of individual shows
    await migrateReviews();
    
    // Step 5: Update organizer information
    await updateOrganizerInfo();
    
    // Step 6: Set default quotas for show organizers
    await setOrganizerQuotas();
    
    // Print migration summary
    printMigrationSummary();
  } catch (error) {
    console.error(chalk.red(`Migration failed: ${error.message}`));
    console.error(error);
    process.exit(1);
  }
}

/**
 * Step 1: Identify recurring shows by looking for shows with the same title/location
 */
async function identifyRecurringShows() {
  console.log(chalk.cyan('\nStep 1: Identifying recurring shows...'));
  
  try {
    // Find shows that share the same title and address (likely recurring shows)
    const { data, error } = await supabase.rpc('pg_query', {
      query: `
        WITH recurring_shows AS (
          SELECT 
              title, 
              address, 
              COUNT(*) as instance_count
          FROM 
              public.shows
          GROUP BY 
              title, address
          HAVING 
              COUNT(*) > 1
        )
        SELECT 
          rs.title, 
          rs.address, 
          rs.instance_count,
          ARRAY_AGG(s.id) as show_ids
        FROM 
          recurring_shows rs
        JOIN 
          public.shows s ON rs.title = s.title AND rs.address = s.address
        GROUP BY 
          rs.title, rs.address, rs.instance_count
        ORDER BY 
          rs.instance_count DESC;
      `
    });
    
    if (error) {
      throw new Error(`Failed to identify recurring shows: ${error.message}`);
    }
    
    console.log(chalk.green(`Found ${data.length} recurring show groups`));
    
    // Log detailed information about each recurring show group
    data.forEach((group, index) => {
      console.log(chalk.yellow(`\nRecurring Show Group #${index + 1}:`));
      console.log(`  Title: ${group.title}`);
      console.log(`  Address: ${group.address}`);
      console.log(`  Instances: ${group.instance_count}`);
      console.log(`  Show IDs: ${group.show_ids.slice(0, 3).join(', ')}${group.show_ids.length > 3 ? '...' : ''}`);
    });
    
    return data;
  } catch (error) {
    stats.errors++;
    console.error(chalk.red(`Error in identifyRecurringShows: ${error.message}`));
    throw error;
  }
}

/**
 * Step 2: Create show_series entries for recurring shows
 */
async function createShowSeries(recurringShows) {
  console.log(chalk.cyan('\nStep 2: Creating show_series entries...'));
  
  // Map to store the relationship between show title/address and series ID
  const seriesMap = new Map();
  
  try {
    for (const group of recurringShows) {
      const { title, address } = group;
      
      // Create a new show_series entry
      const { data, error } = await supabase
        .from('show_series')
        .insert({
          name: title,
          description: `Recurring show at ${address}`
        })
        .select('id, name')
        .single();
      
      if (error) {
        console.error(chalk.red(`Failed to create series for "${title}": ${error.message}`));
        stats.errors++;
        continue;
      }
      
      // Store the mapping of title/address to series ID
      const key = `${title}|${address}`;
      seriesMap.set(key, data.id);
      
      console.log(chalk.green(`Created series "${data.name}" with ID: ${data.id}`));
      stats.seriesCreated++;
    }
    
    console.log(chalk.green(`Successfully created ${stats.seriesCreated} show series`));
    return seriesMap;
  } catch (error) {
    stats.errors++;
    console.error(chalk.red(`Error in createShowSeries: ${error.message}`));
    throw error;
  }
}

/**
 * Step 3: Link individual shows to their series
 */
async function linkShowsToSeries(seriesMap) {
  console.log(chalk.cyan('\nStep 3: Linking shows to their series...'));
  
  try {
    // Get all shows
    const { data: shows, error: fetchError } = await supabase
      .from('shows')
      .select('id, title, address');
    
    if (fetchError) {
      throw new Error(`Failed to fetch shows: ${fetchError.message}`);
    }
    
    // Group shows by title and address
    const showsByKey = {};
    shows.forEach(show => {
      const key = `${show.title}|${show.address}`;
      if (!showsByKey[key]) {
        showsByKey[key] = [];
      }
      showsByKey[key].push(show.id);
    });
    
    // Update each show to link to its series
    for (const [key, seriesId] of seriesMap.entries()) {
      const showIds = showsByKey[key] || [];
      if (showIds.length === 0) {
        console.warn(chalk.yellow(`No shows found for key: ${key}`));
        continue;
      }
      
      // Update all shows with this title/address to link to the series
      const { data, error } = await supabase
        .from('shows')
        .update({ series_id: seriesId })
        .in('id', showIds)
        .select('id, title');
      
      if (error) {
        console.error(chalk.red(`Failed to link shows to series ${seriesId}: ${error.message}`));
        stats.errors++;
        continue;
      }
      
      console.log(chalk.green(`Linked ${data.length} shows to series ${seriesId}`));
      stats.showsLinked += data.length;
    }
    
    console.log(chalk.green(`Successfully linked ${stats.showsLinked} shows to their series`));
  } catch (error) {
    stats.errors++;
    console.error(chalk.red(`Error in linkShowsToSeries: ${error.message}`));
    throw error;
  }
}

/**
 * Step 4: Migrate reviews to link to series instead of individual shows
 */
async function migrateReviews() {
  console.log(chalk.cyan('\nStep 4: Migrating reviews to link to series...'));
  
  try {
    // Update reviews to reference the show's series
    const { data, error } = await supabase.rpc('pg_query', {
      query: `
        WITH reviews_to_update AS (
          SELECT 
            r.id as review_id,
            s.series_id
          FROM 
            public.reviews r
          JOIN 
            public.shows s ON r.show_id = s.id
          WHERE 
            s.series_id IS NOT NULL
            AND r.series_id IS NULL
        )
        UPDATE public.reviews r
        SET series_id = rtu.series_id
        FROM reviews_to_update rtu
        WHERE r.id = rtu.review_id
        RETURNING r.id;
      `
    });
    
    if (error) {
      throw new Error(`Failed to migrate reviews: ${error.message}`);
    }
    
    stats.reviewsMigrated = data.length;
    console.log(chalk.green(`Successfully migrated ${stats.reviewsMigrated} reviews to reference their show series`));
  } catch (error) {
    stats.errors++;
    console.error(chalk.red(`Error in migrateReviews: ${error.message}`));
    throw error;
  }
}

/**
 * Step 5: Update organizer information for series based on existing show claims
 */
async function updateOrganizerInfo() {
  console.log(chalk.cyan('\nStep 5: Updating organizer information...'));
  
  try {
    // Update show_series to set organizer_id based on existing show claims
    const { data, error } = await supabase.rpc('pg_query', {
      query: `
        WITH series_organizers AS (
          SELECT DISTINCT
            s.series_id,
            s.organizer_id
          FROM 
            public.shows s
          WHERE 
            s.series_id IS NOT NULL
            AND s.organizer_id IS NOT NULL
        )
        UPDATE public.show_series ss
        SET organizer_id = so.organizer_id
        FROM series_organizers so
        WHERE ss.id = so.series_id
          AND ss.organizer_id IS NULL
        RETURNING ss.id, ss.name, ss.organizer_id;
      `
    });
    
    if (error) {
      throw new Error(`Failed to update organizer information: ${error.message}`);
    }
    
    stats.organizersUpdated = data.length;
    console.log(chalk.green(`Successfully updated organizer information for ${stats.organizersUpdated} show series`));
  } catch (error) {
    stats.errors++;
    console.error(chalk.red(`Error in updateOrganizerInfo: ${error.message}`));
    throw error;
  }
}

/**
 * Step 6: Set default quotas for show organizers
 */
async function setOrganizerQuotas() {
  console.log(chalk.cyan('\nStep 6: Setting default quotas for show organizers...'));
  
  try {
    // Set default quotas for all show organizers
    const { data, error } = await supabase
      .from('profiles')
      .update({
        pre_show_broadcasts_remaining: 2,
        post_show_broadcasts_remaining: 1
      })
      .eq('role', 'SHOW_ORGANIZER')
      .select('id, role');
    
    if (error) {
      throw new Error(`Failed to set organizer quotas: ${error.message}`);
    }
    
    stats.quotasSet = data.length;
    console.log(chalk.green(`Successfully set default quotas for ${stats.quotasSet} show organizers`));
  } catch (error) {
    stats.errors++;
    console.error(chalk.red(`Error in setOrganizerQuotas: ${error.message}`));
    throw error;
  }
}

/**
 * Print a summary of the migration
 */
function printMigrationSummary() {
  console.log(chalk.blue('\n='.repeat(80)));
  console.log(chalk.blue('Migration Summary'));
  console.log(chalk.blue('='.repeat(80)));
  console.log(chalk.green(`Series Created: ${stats.seriesCreated}`));
  console.log(chalk.green(`Shows Linked: ${stats.showsLinked}`));
  console.log(chalk.green(`Reviews Migrated: ${stats.reviewsMigrated}`));
  console.log(chalk.green(`Organizers Updated: ${stats.organizersUpdated}`));
  console.log(chalk.green(`Quotas Set: ${stats.quotasSet}`));
  
  if (stats.errors > 0) {
    console.log(chalk.red(`Errors Encountered: ${stats.errors}`));
    console.log(chalk.yellow('Please review the logs above for details on the errors.'));
  } else {
    console.log(chalk.green('\nMigration completed successfully with no errors!'));
  }
}

// Run the migration
migrateShowsToSeries().catch(error => {
  console.error(chalk.red(`Unhandled error in migration: ${error.message}`));
  console.error(error);
  process.exit(1);
});
