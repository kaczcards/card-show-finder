// db_migrations/execute_show_organizer_series_migration.js
// Script to execute the show organizer series implementation SQL migration

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing required environment variables SUPABASE_URL or SUPABASE_SERVICE_KEY');
  console.error('Please create a .env file with these variables or set them in your environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Path to the migration SQL file
const migrationFilePath = path.join(__dirname, 'show_organizer_series_implementation.sql');

/**
 * Reads the SQL migration file and returns its contents
 * @returns {string} SQL file contents
 */
function readMigrationFile() {
  try {
    console.log(`Reading migration file: ${migrationFilePath}`);
    return fs.readFileSync(migrationFilePath, 'utf8');
  } catch (error) {
    console.error(`Error reading migration file: ${error.message}`);
    throw error;
  }
}

/**
 * Executes the SQL migration against the Supabase database
 * @param {string} sql SQL migration content
 * @returns {Promise<object>} Result of the execution
 */
async function executeMigration(sql) {
  try {
    console.log('Executing migration...');
    const { data, error } = await supabase.rpc('pg_query', { query: sql });
    
    if (error) {
      throw new Error(`Migration execution failed: ${error.message}`);
    }
    
    console.log('Migration executed successfully');
    return data;
  } catch (error) {
    console.error(`Error executing migration: ${error.message}`);
    throw error;
  }
}

/**
 * Verifies that the show_series table was created
 * @returns {Promise<boolean>} Whether the table exists
 */
async function verifyShowSeriesTable() {
  try {
    const { data, error } = await supabase
      .from('show_series')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') { // Table doesn't exist
      return false;
    } else if (error) {
      throw new Error(`Error verifying show_series table: ${error.message}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error verifying show_series table: ${error.message}`);
    return false;
  }
}

/**
 * Verifies that the series_id column was added to the shows table
 * @returns {Promise<boolean>} Whether the column exists
 */
async function verifyShowsSeriesIdColumn() {
  try {
    // Query to check if the column exists
    const { data, error } = await supabase.rpc('pg_query', {
      query: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'shows' 
        AND column_name = 'series_id'
      `
    });
    
    if (error) {
      throw new Error(`Error verifying shows.series_id column: ${error.message}`);
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.error(`Error verifying shows.series_id column: ${error.message}`);
    return false;
  }
}

/**
 * Verifies that the series_id column was added to the reviews table
 * @returns {Promise<boolean>} Whether the column exists
 */
async function verifyReviewsSeriesIdColumn() {
  try {
    // Query to check if the column exists
    const { data, error } = await supabase.rpc('pg_query', {
      query: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'reviews' 
        AND column_name = 'series_id'
      `
    });
    
    if (error) {
      throw new Error(`Error verifying reviews.series_id column: ${error.message}`);
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.error(`Error verifying reviews.series_id column: ${error.message}`);
    return false;
  }
}

/**
 * Verifies that the broadcast quota columns were added to the profiles table
 * @returns {Promise<boolean>} Whether the columns exist
 */
async function verifyProfilesBroadcastColumns() {
  try {
    // Query to check if the columns exist
    const { data, error } = await supabase.rpc('pg_query', {
      query: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name IN ('pre_show_broadcasts_remaining', 'post_show_broadcasts_remaining')
      `
    });
    
    if (error) {
      throw new Error(`Error verifying profiles broadcast columns: ${error.message}`);
    }
    
    return data && data.length === 2;
  } catch (error) {
    console.error(`Error verifying profiles broadcast columns: ${error.message}`);
    return false;
  }
}

/**
 * Verifies that the claim_show_series function was created
 * @returns {Promise<boolean>} Whether the function exists
 */
async function verifyClaimShowSeriesFunction() {
  try {
    // Query to check if the function exists
    const { data, error } = await supabase.rpc('pg_query', {
      query: `
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'claim_show_series'
      `
    });
    
    if (error) {
      throw new Error(`Error verifying claim_show_series function: ${error.message}`);
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.error(`Error verifying claim_show_series function: ${error.message}`);
    return false;
  }
}

/**
 * Verifies that the broadcast_logs table was created with the correct schema
 * @returns {Promise<boolean>} Whether the table exists with the correct schema
 */
async function verifyBroadcastLogsTable() {
  try {
    // Query to check if the table exists with broadcast_type column
    const { data, error } = await supabase.rpc('pg_query', {
      query: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'broadcast_logs' 
        AND column_name = 'broadcast_type'
      `
    });
    
    if (error) {
      throw new Error(`Error verifying broadcast_logs table: ${error.message}`);
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.error(`Error verifying broadcast_logs table: ${error.message}`);
    return false;
  }
}

/**
 * Runs all verification checks for the migration
 * @returns {Promise<object>} Results of all verification checks
 */
async function verifyMigration() {
  const results = {
    showSeriesTable: await verifyShowSeriesTable(),
    showsSeriesIdColumn: await verifyShowsSeriesIdColumn(),
    reviewsSeriesIdColumn: await verifyReviewsSeriesIdColumn(),
    profilesBroadcastColumns: await verifyProfilesBroadcastColumns(),
    claimShowSeriesFunction: await verifyClaimShowSeriesFunction(),
    broadcastLogsTable: await verifyBroadcastLogsTable()
  };
  
  const allPassed = Object.values(results).every(result => result === true);
  
  return {
    passed: allPassed,
    results
  };
}

/**
 * Main function to execute the migration and verify it
 */
async function main() {
  try {
    // Read the migration file
    const sql = readMigrationFile();
    
    // Execute the migration
    await executeMigration(sql);
    
    // Verify the migration
    const verification = await verifyMigration();
    
    console.log('\nMigration Verification Results:');
    console.log(JSON.stringify(verification.results, null, 2));
    
    if (verification.passed) {
      console.log('\n✅ Migration was successful! All verification checks passed.');
    } else {
      console.log('\n⚠️ Migration may have issues. Some verification checks failed.');
      console.log('Please check the database manually to ensure all objects were created correctly.');
    }
  } catch (error) {
    console.error(`\n❌ Migration failed: ${error.message}`);
    process.exit(1);
  }
}

// Execute the main function
main();
