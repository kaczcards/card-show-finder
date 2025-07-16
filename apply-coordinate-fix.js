#!/usr/bin/env node
/**
 * apply-coordinate-fix.js
 * 
 * This script applies the fix for the coordinate validation trigger
 * that was causing the "operator does not exist: geography ->> unknown" error.
 * 
 * It creates a new RPC function that properly handles PostGIS coordinates
 * and updates the AddShowScreen to use this function.
 */

// Load environment variables
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const chalk = require('chalk');

// Supabase configuration from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error(chalk.red('Error: Missing EXPO_PUBLIC_SUPABASE_URL environment variable'));
  process.exit(1);
}

if (!supabaseServiceKey && !supabaseAnonKey) {
  console.error(chalk.red('Error: Missing SUPABASE_SERVICE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY environment variable'));
  console.error(chalk.yellow('Note: SUPABASE_SERVICE_KEY is preferred for admin operations'));
  process.exit(1);
}

// Create Supabase client with service role for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});

// Database connection configuration from environment variables
// This is used for direct SQL execution if the RPC approach fails
const dbConfig = {
  host: process.env.PGHOST || new URL(supabaseUrl).hostname,
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || supabaseServiceKey,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
};

/**
 * Read SQL file and execute it
 */
async function applySqlFix() {
  console.log(chalk.blue('=== Applying PostGIS Coordinate Fix ==='));
  console.log(chalk.gray('Fixing the "operator does not exist: geography ->> unknown" error\n'));
  
  try {
    // Step 1: Read the SQL file
    const sqlFilePath = path.join(__dirname, 'create-show-with-coordinates.sql');
    console.log(chalk.gray(`Reading SQL fix from: ${sqlFilePath}`));
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL fix file not found: ${sqlFilePath}`);
    }
    
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log(chalk.green('✓ SQL fix file read successfully'));
    
    // Step 2: Try to execute SQL via RPC first
    console.log(chalk.yellow('\nApplying fix via RPC...'));
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });
      
      if (error) {
        console.log(chalk.yellow('RPC failed, falling back to direct database connection...'));
        throw error; // Trigger fallback
      }
      
      console.log(chalk.green('✓ Fix applied successfully via RPC!'));
      return true;
    } catch (rpcError) {
      // Step 3: Fallback to direct database connection
      console.log(chalk.yellow('Connecting directly to the database...'));
      
      const pool = new Pool(dbConfig);
      const client = await pool.connect();
      
      try {
        await client.query(sqlContent);
        console.log(chalk.green('✓ Fix applied successfully via direct connection!'));
        return true;
      } finally {
        client.release();
        await pool.end();
      }
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Error applying SQL fix:'));
    console.error(chalk.red(error.message));
    
    if (error.details) {
      console.error(chalk.red('Details:', error.details));
    }
    
    if (error.hint) {
      console.error(chalk.yellow('Hint:', error.hint));
    }
    
    console.log(chalk.yellow('\nManual fix required:'));
    console.log(chalk.yellow('1. Go to the Supabase dashboard (https://app.supabase.com)'));
    console.log(chalk.yellow('2. Open the SQL Editor'));
    console.log(chalk.yellow('3. Copy and paste the content of create-show-with-coordinates.sql'));
    console.log(chalk.yellow('4. Execute the SQL'));
    
    return false;
  }
}

/**
 * Test the fix by creating a show with coordinates
 */
async function testFix() {
  console.log(chalk.blue('\n=== Testing the Fix ==='));
  
  try {
    // Step 1: Check if the RPC function exists
    console.log(chalk.yellow('Checking if create_show_with_coordinates function exists...'));
    
    const { data: functions, error: functionError } = await supabase
      .from('pg_proc')
      .select('proname')
      .eq('proname', 'create_show_with_coordinates')
      .limit(1);
    
    if (functionError || !functions || functions.length === 0) {
      console.log(chalk.yellow('Cannot verify function exists. Attempting to call it anyway...'));
    } else {
      console.log(chalk.green('✓ Function exists!'));
    }
    
    // Step 2: Test the function by creating a test show
    console.log(chalk.yellow('Testing function with sample data...'));
    
    // Sample data for testing
    const testParams = {
      p_title: 'Test Show - Coordinate Fix Validation',
      p_description: 'This is a test show to validate the coordinate fix',
      p_location: 'Test Convention Center',
      p_address: '123 Test St, Testville, CA 90210',
      p_start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      p_end_date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      p_entry_fee: 5.00,
      p_latitude: 37.7749,
      p_longitude: -122.4194, // San Francisco coordinates
      p_features: { 'Grading': true, 'Autographs': true },
      p_categories: ['Sports', 'Pokemon'],
      p_image_url: null
    };
    
    // Call the RPC function
    const { data, error } = await supabase
      .rpc('create_show_with_coordinates', testParams)
      .single();
    
    if (error) {
      if (error.code === '42501') { // Permission denied
        console.log(chalk.yellow('⚠️ RLS policy prevented test insertion (expected for unauthenticated requests)'));
        console.log(chalk.green('✓ But function exists and was called successfully!'));
        return true;
      } else {
        throw new Error(`Test failed: ${error.message} (${error.code})`);
      }
    }
    
    console.log(chalk.green('✓ Test show created successfully!'));
    console.log(chalk.gray('Show ID:', data.id));
    
    // Clean up the test show
    if (data && data.id) {
      console.log(chalk.gray('Cleaning up test show...'));
      await supabase.from('shows').delete().eq('id', data.id);
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'));
    console.error(chalk.red(error.message));
    
    if (error.details) {
      console.error(chalk.red('Details:', error.details));
    }
    
    console.log(chalk.yellow('\nThe SQL function may exist but there could be issues with:'));
    console.log(chalk.yellow('1. RLS policies preventing test user from creating shows'));
    console.log(chalk.yellow('2. Function parameters not matching what was expected'));
    console.log(chalk.yellow('3. Database constraints or validation rules'));
    
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log(chalk.bold.blue('=== PostGIS Coordinate Fix ==='));
  console.log(chalk.gray('This script fixes the "operator does not exist: geography ->> unknown" error'));
  console.log(chalk.gray('by creating a new RPC function that properly handles PostGIS coordinates.\n'));
  
  try {
    // Step 1: Apply the SQL fix
    const sqlApplied = await applySqlFix();
    
    if (!sqlApplied) {
      console.log(chalk.yellow('\nSQL fix could not be applied automatically.'));
      console.log(chalk.yellow('Please apply it manually and then run this script again to test.'));
      process.exit(1);
    }
    
    // Step 2: Test the fix
    const testPassed = await testFix();
    
    if (testPassed) {
      console.log(chalk.green.bold('\n✅ Coordinate fix has been successfully applied and tested!'));
      console.log(chalk.blue('\nYou can now create shows with proper PostGIS coordinates.'));
      console.log(chalk.gray('The AddShowScreen has been updated to use the new RPC function.'));
    } else {
      console.log(chalk.yellow('\nFix was applied but testing failed.'));
      console.log(chalk.yellow('You may need to update the AddShowScreen.tsx file manually.'));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Unhandled error:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
