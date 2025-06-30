/**
 * execute_show_organizer_migration.js
 * 
 * This script executes the show_organizer_phase1.sql migration file using the Supabase client.
 * It handles connection to the database, executes the SQL, and logs the results or errors.
 * 
 * Usage: 
 * 1. Ensure .env file exists with SUPABASE_URL and SUPABASE_SERVICE_KEY variables
 * 2. Run: node execute_show_organizer_migration.js
 */

require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs/promises');
const path = require('path');

// Supabase connection details
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file');
  process.exit(1);
}

// Create Supabase client with service role key for full database access
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Execute the SQL migration file
 */
async function executeMigration() {
  console.log('Starting Show Organizer Phase 1 migration...');
  
  try {
    // Read the SQL file
    const migrationFilePath = path.join(__dirname, 'show_organizer_phase1.sql');
    const sql = await fs.readFile(migrationFilePath, 'utf8');
    
    console.log(`Migration file loaded: ${migrationFilePath}`);
    console.log('Executing SQL migration...');
    
    // Execute the SQL using Supabase's rpc call to pg_query
    // This allows executing multiple SQL statements in one call
    const { data, error } = await supabase.rpc('pg_query', {
      query_text: sql
    });
    
    if (error) {
      console.error('Error executing migration:', error);
      process.exit(1);
    }
    
    console.log('Migration executed successfully!');
    console.log('Result:', data);
    
    // Verify some of the key changes
    console.log('Verifying migration changes...');
    
    // Check if shows table has the new columns
    const { data: showsColumns, error: showsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'shows')
      .in('column_name', ['parent_show_id', 'is_series_parent', 'extra_details']);
    
    if (showsError) {
      console.error('Error verifying shows table changes:', showsError);
    } else {
      console.log('Shows table changes verified:', showsColumns.length === 3 ? 'OK' : 'INCOMPLETE');
    }
    
    // Check if broadcast_logs table exists
    const { data: tablesData, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'broadcast_logs')
      .eq('table_schema', 'public');
    
    if (tablesError) {
      console.error('Error verifying broadcast_logs table:', tablesError);
    } else {
      console.log('Broadcast logs table verified:', tablesData.length > 0 ? 'OK' : 'MISSING');
    }
    
    // Check if functions exist
    const { data: functionsData, error: functionsError } = await supabase
      .from('information_schema.routines')
      .select('routine_name')
      .eq('routine_schema', 'public')
      .in('routine_name', ['claim_show', 'get_aggregate_review_score']);
    
    if (functionsError) {
      console.error('Error verifying functions:', functionsError);
    } else {
      console.log('Functions verified:', functionsData.length === 2 ? 'OK' : 'INCOMPLETE');
    }
    
    console.log('Migration verification complete.');
    console.log('IMPORTANT: Please review the data migration notes in the SQL file for manual steps that may be required.');
    
  } catch (err) {
    console.error('Unexpected error during migration:', err);
    process.exit(1);
  }
}

// Execute the migration
executeMigration()
  .then(() => {
    console.log('Migration process completed.');
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
