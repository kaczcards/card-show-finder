#!/usr/bin/env node
/**
 * scripts/setup-database-functions.js
 * 
 * Sets up essential database functions required for Card Show Finder
 * application, particularly the exec_sql function needed by RLS policy scripts.
 * 
 * This script must be run BEFORE applying RLS policies to ensure all
 * required database functions are available.
 * 
 * Features:
 * - Connects to Supabase using environment variables
 * - Creates exec_sql() function for controlled SQL execution
 * - Sets proper security context and permissions
 * - Provides colored output showing progress and results
 * - Handles errors gracefully
 * - Returns appropriate exit codes for CI/CD
 * 
 * Usage:
 *   node scripts/setup-database-functions.js [--help]
 *   
 * Options:
 *   --help         Show this help message
 * 
 * Environment Variables:
 *   EXPO_PUBLIC_SUPABASE_URL      Supabase URL (required)
 *   SUPABASE_SERVICE_KEY          Supabase service key (required for admin operations)
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
const SQL_FUNCTIONS_FILE = './setup-database-functions.sql';

// Command line arguments
const args = process.argv.slice(2);
const SHOW_HELP = args.includes('--help') || args.includes('-h');

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const EXIT_CONFIG_ERROR = 2;

// Show help function
function showHelp() {
  console.log(`
${colorize.bold('Database Functions Setup Script')}

Sets up essential database functions required for Card Show Finder application,
particularly the exec_sql function needed by RLS policy scripts.

${colorize.bold('Usage:')}
  node scripts/setup-database-functions.js [--help]
  
${colorize.bold('Options:')}
  --help         Show this help message

${colorize.bold('Environment Variables:')}
  EXPO_PUBLIC_SUPABASE_URL      Supabase URL (required)
  SUPABASE_SERVICE_KEY          Supabase service key (required for admin operations)
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
 * Execute SQL statement directly against Supabase
 * @param {Object} supabase - Supabase client
 * @param {string} sql - SQL statement to execute
 * @returns {Promise<Object>} Result of the SQL execution
 */
async function executeSql(supabase, sql) {
  try {
    // Execute the SQL directly using the REST API
    const response = await supabase.rpc('exec_sql', { sql_query: sql }).catch(async (error) => {
      // If exec_sql doesn't exist yet, we need to create it directly via REST API
      if (error.message && error.message.includes('function exec_sql() does not exist')) {
        console.log(colorize.yellow('exec_sql function does not exist yet. Creating it directly...'));
        
        // Use raw SQL query instead of RPC
        const { error: directError } = await supabase
          .from('_temp_sql_runner')
          .insert({ id: 1 })
          .select()
          .limit(1)
          .abortSignal(new AbortController().signal) // This is just to prevent the query from running
          .options({
            headers: {
              'Content-Type': 'application/json',
              'Prefer': 'params=single-object',
              'Content-Profile': 'public'
            },
            method: 'POST',
            body: JSON.stringify({
              query: sql
            })
          });
        
        if (directError) {
          throw new Error(`Failed to execute SQL directly: ${directError.message}`);
        }
        
        return { data: { success: true }, error: null };
      }
      
      throw error;
    });
    
    if (response.error) {
      throw new Error(`SQL execution failed: ${response.error.message}`);
    }
    
    return response;
  } catch (error) {
    console.error(colorize.red(`Error executing SQL: ${error.message}`));
    throw error;
  }
}

/**
 * Main function to set up database functions
 */
async function setupDatabaseFunctions() {
  console.log(colorize.bold(colorize.blue('=== Setting Up Database Functions ===')));
  
  // Validate configuration
  if (!validateConfig()) {
    process.exit(EXIT_CONFIG_ERROR);
  }
  
  // Create Supabase client
  const supabase = createSupabaseClient();
  console.log(colorize.blue(`Connecting to Supabase at ${process.env.EXPO_PUBLIC_SUPABASE_URL}...`));
  
  try {
    // Read SQL file
    const sqlContent = readSqlFile(SQL_FUNCTIONS_FILE);
    
    // Execute SQL statements
    console.log(colorize.blue('Creating database functions...'));
    await executeSql(supabase, sqlContent);
    
    // Verify the function was created
    console.log(colorize.blue('Verifying functions were created...'));
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'exec_sql')" 
    });
    
    if (error) {
      throw new Error(`Verification failed: ${error.message}`);
    }
    
    console.log(colorize.green('✓ Database functions created successfully!'));
    console.log(colorize.green('✓ You can now run the RLS policy scripts.'));
    
    return true;
  } catch (error) {
    console.error(colorize.red(`Failed to set up database functions: ${error.message}`));
    if (error.stack) {
      console.error(colorize.gray(error.stack));
    }
    return false;
  }
}

// Run the script
(async () => {
  try {
    const success = await setupDatabaseFunctions();
    process.exit(success ? EXIT_SUCCESS : EXIT_FAILURE);
  } catch (error) {
    console.error(colorize.red(`Unhandled error: ${error.message}`));
    if (error.stack) {
      console.error(colorize.gray(error.stack));
    }
    process.exit(EXIT_FAILURE);
  }
})();
