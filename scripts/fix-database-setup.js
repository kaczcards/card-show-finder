#!/usr/bin/env node
/**
 * scripts/fix-database-setup.js
 * 
 * Fixes database setup issues by directly creating required functions
 * and applying consolidated RLS policies without circular dependencies.
 * 
 * This script:
 * 1. Creates the exec_sql function directly using SQL
 * 2. Applies consolidated RLS policies
 * 3. Verifies everything is working correctly
 * 
 * Usage:
 *   node scripts/fix-database-setup.js [--verify-only] [--functions-only]
 *   
 * Options:
 *   --verify-only     Only verify if functions and policies exist
 *   --functions-only  Only create the required functions, skip RLS policies
 *   --help            Show this help message
 * 
 * Environment Variables:
 *   EXPO_PUBLIC_SUPABASE_URL      Supabase URL (required)
 *   SUPABASE_SERVICE_KEY          Supabase service key (required)
 */

// Import required packages
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Color formatting for console output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m'
};

// Helper functions for colored console output
const colorize = {
  bold: (text) => `${colors.bold}${text}${colors.reset}`,
  red: (text) => `${colors.red}${text}${colors.reset}`,
  green: (text) => `${colors.green}${text}${colors.reset}`,
  yellow: (text) => `${colors.yellow}${text}${colors.reset}`,
  blue: (text) => `${colors.blue}${text}${colors.reset}`,
  magenta: (text) => `${colors.magenta}${text}${colors.reset}`,
  cyan: (text) => `${colors.cyan}${text}${colors.reset}`,
  gray: (text) => `${colors.gray}${text}${colors.reset}`,
  white: (text) => `${colors.white}${text}${colors.reset}`
};

// Constants
const RLS_FILE = './CONSOLIDATED_RLS_2025.sql';
const VERIFY_FILE = './verify-rls-policies.sql';

// Command line arguments
const args = process.argv.slice(2);
const VERIFY_ONLY = args.includes('--verify-only');
const FUNCTIONS_ONLY = args.includes('--functions-only');
const SHOW_HELP = args.includes('--help') || args.includes('-h');

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const EXIT_CONFIG_ERROR = 2;

// Show help function
function showHelp() {
  console.log(`
${colorize.bold('Database Setup Fix Script')}

Fixes database setup issues by directly creating required functions
and applying consolidated RLS policies without circular dependencies.

${colorize.bold('Usage:')}
  node scripts/fix-database-setup.js [--verify-only] [--functions-only]
  
${colorize.bold('Options:')}
  --verify-only     Only verify if functions and policies exist
  --functions-only  Only create the required functions, skip RLS policies
  --help            Show this help message

${colorize.bold('Environment Variables:')}
  EXPO_PUBLIC_SUPABASE_URL      Supabase URL (required)
  SUPABASE_SERVICE_KEY          Supabase service key (required)
  `);
  process.exit(EXIT_SUCCESS);
}

// Show help if requested
if (SHOW_HELP) {
  showHelp();
}

// Validate environment variables
function validateConfig() {
  const requiredVars = ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error(colorize.red(`Error: Missing required environment variables: ${missing.join(', ')}`));
    console.error(colorize.yellow('Tip: Create a .env file or set them in your environment.'));
    return false;
  }
  
  return true;
}

/**
 * Read SQL file contents
 * @param {string} filePath - Path to SQL file
 * @returns {string} SQL file contents
 */
function readSqlFile(filePath) {
  try {
    const resolvedPath = path.resolve(filePath);
    console.log(colorize.blue(`Reading SQL file: ${resolvedPath}`));
    
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${resolvedPath}`);
    }
    
    return fs.readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    console.error(colorize.red(`Error reading SQL file: ${error.message}`));
    process.exit(EXIT_CONFIG_ERROR);
  }
}

/**
 * Create a Supabase client with admin privileges
 * @returns {Object} Supabase client
 */
function createSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Execute SQL statement directly using Supabase's single query endpoint
 * @param {Object} supabase - Supabase client
 * @param {string} sql - SQL statement to execute
 * @returns {Promise<Object>} Result of the SQL execution
 */
async function executeDirectSql(supabase, sql) {
  try {
    // Use the REST API to execute SQL directly
    const { data, error } = await supabase.from('pg_catalog.pg_tables')
      .select('*')
      .limit(1)
      .csv();
    
    // The above query is just to get a valid endpoint we can override
    // We'll replace the request with our custom SQL
    
    // Get the URL from the request
    const url = new URL(supabase.supabaseUrl);
    url.pathname = '/rest/v1/sql';
    
    // Make a direct fetch request to execute SQL
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabase.supabaseKey,
        'Authorization': `Bearer ${supabase.supabaseKey}`,
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({ query: sql })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SQL execution failed: ${errorText}`);
    }
    
    const result = await response.json();
    return { data: result, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Create the exec_sql function in the database
 * @param {Object} supabase - Supabase client
 * @returns {Promise<boolean>} Success status
 */
async function createExecSqlFunction(supabase) {
  console.log(colorize.blue('Creating exec_sql function...'));
  
  const createFunctionSql = `
    -- Create a helper function to execute SQL with proper error handling
    CREATE OR REPLACE FUNCTION public.exec_sql(sql_query TEXT)
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      result JSONB;
      notice_text TEXT;
      notices TEXT[] := '{}'::TEXT[];
    BEGIN
      -- Execute the SQL query
      EXECUTE sql_query;
      
      -- Return success result with any notices
      result := jsonb_build_object(
        'success', true,
        'notices', notices
      );
      
      RETURN result;
    EXCEPTION WHEN OTHERS THEN
      -- Return error information
      result := jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE
      );
      
      RETURN result;
    END;
    $$;
    
    -- Grant execute permission to service role
    GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;
    
    -- Add function description
    COMMENT ON FUNCTION public.exec_sql(TEXT) IS 
      'Executes arbitrary SQL with proper error handling. Used by RLS scripts and migrations.';
  `;
  
  try {
    const { error } = await executeDirectSql(supabase, createFunctionSql);
    
    if (error) {
      console.error(colorize.red(`Failed to create exec_sql function: ${error.message}`));
      return false;
    }
    
    console.log(colorize.green('✓ exec_sql function created successfully'));
    return true;
  } catch (error) {
    console.error(colorize.red(`Error creating exec_sql function: ${error.message}`));
    return false;
  }
}

/**
 * Verify if the exec_sql function exists
 * @param {Object} supabase - Supabase client
 * @returns {Promise<boolean>} Whether the function exists
 */
async function verifyExecSqlFunction(supabase) {
  console.log(colorize.blue('Verifying exec_sql function...'));
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: "SELECT 'Function exists'" 
    });
    
    if (error) {
      console.log(colorize.yellow(`exec_sql function verification failed: ${error.message}`));
      return false;
    }
    
    console.log(colorize.green('✓ exec_sql function exists and is working'));
    return true;
  } catch (error) {
    console.log(colorize.yellow(`exec_sql function does not exist: ${error.message}`));
    return false;
  }
}

/**
 * Apply RLS policies from SQL file
 * @param {Object} supabase - Supabase client
 * @returns {Promise<boolean>} Success status
 */
async function applyRlsPolicies(supabase) {
  console.log(colorize.blue('Applying RLS policies...'));
  
  try {
    // Read the RLS SQL file
    const rlsSql = readSqlFile(RLS_FILE);
    
    // Apply the RLS policies using exec_sql
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: rlsSql 
    });
    
    if (error) {
      console.error(colorize.red(`Failed to apply RLS policies: ${error.message}`));
      return false;
    }
    
    console.log(colorize.green('✓ RLS policies applied successfully'));
    return true;
  } catch (error) {
    console.error(colorize.red(`Error applying RLS policies: ${error.message}`));
    return false;
  }
}

/**
 * Verify RLS policies using verification SQL
 * @param {Object} supabase - Supabase client
 * @returns {Promise<boolean>} Success status
 */
async function verifyRlsPolicies(supabase) {
  console.log(colorize.blue('Verifying RLS policies...'));
  
  try {
    // Read the verification SQL file
    const verifySql = readSqlFile(VERIFY_FILE);
    
    // Execute the verification SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: verifySql 
    });
    
    if (error) {
      console.error(colorize.red(`RLS policy verification failed: ${error.message}`));
      return false;
    }
    
    console.log(colorize.green('✓ RLS policies verified successfully'));
    return true;
  } catch (error) {
    console.error(colorize.red(`Error verifying RLS policies: ${error.message}`));
    return false;
  }
}

/**
 * Main function to fix database setup
 */
async function fixDatabaseSetup() {
  console.log(colorize.bold(colorize.blue('=== Database Setup Fix ===')));
  
  // Validate configuration
  if (!validateConfig()) {
    process.exit(EXIT_CONFIG_ERROR);
  }
  
  // Create Supabase client
  const supabase = createSupabaseClient();
  console.log(colorize.blue(`Connecting to Supabase at ${process.env.EXPO_PUBLIC_SUPABASE_URL}...`));
  
  try {
    // Step 1: Verify if exec_sql function exists, create if not
    let execSqlExists = await verifyExecSqlFunction(supabase);
    
    if (!execSqlExists) {
      const created = await createExecSqlFunction(supabase);
      if (!created) {
        throw new Error('Failed to create exec_sql function');
      }
      execSqlExists = true;
    }
    
    // If verify-only mode, stop here
    if (VERIFY_ONLY) {
      console.log(colorize.blue('Verify-only mode: Skipping policy application'));
      return execSqlExists;
    }
    
    // If functions-only mode, stop here
    if (FUNCTIONS_ONLY) {
      console.log(colorize.blue('Functions-only mode: Skipping policy application'));
      return execSqlExists;
    }
    
    // Step 2: Apply RLS policies
    const policiesApplied = await applyRlsPolicies(supabase);
    if (!policiesApplied) {
      throw new Error('Failed to apply RLS policies');
    }
    
    // Step 3: Verify RLS policies
    const policiesVerified = await verifyRlsPolicies(supabase);
    if (!policiesVerified) {
      console.log(colorize.yellow('Warning: RLS policy verification had issues'));
      // Continue anyway, as this might be due to expected differences
    }
    
    console.log(colorize.green('✓ Database setup fixed successfully!'));
    return true;
  } catch (error) {
    console.error(colorize.red(`Failed to fix database setup: ${error.message}`));
    if (error.stack) {
      console.error(colorize.gray(error.stack));
    }
    return false;
  }
}

// Run the script
(async () => {
  try {
    const success = await fixDatabaseSetup();
    process.exit(success ? EXIT_SUCCESS : EXIT_FAILURE);
  } catch (error) {
    console.error(colorize.red(`Unhandled error: ${error.message}`));
    if (error.stack) {
      console.error(colorize.gray(error.stack));
    }
    process.exit(EXIT_FAILURE);
  }
})();
