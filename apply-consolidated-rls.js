#!/usr/bin/env node
/**
 * apply-consolidated-rls.js
 * 
 * This script applies the consolidated Row Level Security (RLS) policies
 * to a Supabase database and runs verification to ensure proper application.
 * 
 * Features:
 * - Connects to Supabase using environment variables
 * - Applies consolidated RLS policies from SQL file
 * - Runs verification script to check policy application
 * - Reports results with colored output
 * - Exits with appropriate status codes for CI/CD integration
 * - Handles errors gracefully
 * - Provides detailed logging
 * 
 * Usage:
 *   node apply-consolidated-rls.js [--verify-only] [--apply-only]
 *   
 * Options:
 *   --verify-only  Only run the verification script, don't apply policies
 *   --apply-only   Only apply the policies, don't run verification
 *   --help         Show this help message
 * 
 * Environment Variables:
 *   EXPO_PUBLIC_SUPABASE_URL      Supabase URL (required)
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY Supabase anonymous key (for public operations)
 *   SUPABASE_SERVICE_KEY          Supabase service key (required for admin operations)
 *   RLS_FILE                      Path to consolidated RLS SQL file (default: ./CONSOLIDATED_RLS_2025.sql)
 *   VERIFY_FILE                   Path to verification SQL file (default: ./verify-rls-policies.sql)
 */

// Import required packages
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ANSI color codes for terminal output
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
const DEFAULT_RLS_FILE = './CONSOLIDATED_RLS_2025.sql';
const DEFAULT_VERIFY_FILE = './verify-rls-policies.sql';

// Command line arguments
const args = process.argv.slice(2);
const VERIFY_ONLY = args.includes('--verify-only');
const APPLY_ONLY = args.includes('--apply-only');
const SHOW_HELP = args.includes('--help') || args.includes('-h');

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const EXIT_CONFIG_ERROR = 2;

/**
 * Show help message
 */
function showHelp() {
  console.log(`
${colorize.bold('Apply Consolidated RLS Policies')}

This script applies the consolidated Row Level Security (RLS) policies
to a Supabase database and runs verification to ensure proper application.

${colorize.bold('Usage:')}
  node apply-consolidated-rls.js [--verify-only] [--apply-only]
  
${colorize.bold('Options:')}
  --verify-only  Only run the verification script, don't apply policies
  --apply-only   Only apply the policies, don't run verification
  --help         Show this help message

${colorize.bold('Environment Variables:')}
  EXPO_PUBLIC_SUPABASE_URL      Supabase URL (required)
  EXPO_PUBLIC_SUPABASE_ANON_KEY Supabase anonymous key (for public operations)
  SUPABASE_SERVICE_KEY          Supabase service key (required for admin operations)
  RLS_FILE                      Path to consolidated RLS SQL file (default: ${DEFAULT_RLS_FILE})
  VERIFY_FILE                   Path to verification SQL file (default: ${DEFAULT_VERIFY_FILE})
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
 * Execute SQL script and capture output
 * @param {Object} supabase - Supabase client
 * @param {string} sql - SQL script to execute
 * @returns {Promise<Object>} Query result
 */
async function executeSql(supabase, sql) {
  console.log(colorize.blue('Executing SQL script...'));
  
  try {
    // Split the SQL into statements by semicolons, but respect string literals and comments
    const statements = splitSqlStatements(sql);
    
    console.log(colorize.blue(`Found ${statements.length} SQL statements to execute`));
    
    let results = [];
    let notices = [];
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;
      
      try {
        // Use Supabase RPC to execute SQL
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: stmt });
        
        if (error) {
          console.error(colorize.red(`Error executing statement ${i + 1}/${statements.length}:`));
          console.error(colorize.yellow(stmt.substring(0, 100) + (stmt.length > 100 ? '...' : '')));
          throw error;
        }
        
        results.push(data);
        
        // Extract notices from the SQL output
        if (data && data.notices) {
          notices = notices.concat(data.notices);
          
          // Log notices as they come in
          data.notices.forEach(notice => {
            const coloredMessage = colorizeNotice(notice);
            console.log(`${colorize.gray('NOTICE:')} ${coloredMessage}`);
          });
        }
        
        // If statement contains RAISE NOTICE, check for message in the response
        if (stmt.includes('RAISE NOTICE') && data && data.message) {
          notices.push(data.message);
          console.log(`${colorize.gray('NOTICE:')} ${colorizeNotice(data.message)}`);
        }
        
      } catch (error) {
        // If the exec_sql RPC doesn't exist yet, create it
        if (error.message && error.message.includes('function exec_sql() does not exist')) {
          console.log(colorize.yellow('Creating exec_sql function...'));
          
          // Create a helper function to execute SQL
          const createFunctionSql = `
            CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
            RETURNS JSONB
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            DECLARE
              result JSONB;
              notice_text TEXT;
              notices TEXT[] := '{}';
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
            GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;
          `;
          
          // Execute the create function SQL directly
          const { error: fnError } = await supabase.rpc('exec_sql', { sql_query: createFunctionSql });
          
          if (fnError) {
            console.error(colorize.red(`Failed to create exec_sql function: ${fnError.message}`));
            throw fnError;
          }
          
          // Retry the original statement
          const { data: retryData, error: retryError } = await supabase.rpc('exec_sql', { sql_query: stmt });
          
          if (retryError) {
            throw retryError;
          }
          
          results.push(retryData);
          continue;
        }
        
        // Try direct SQL execution for simple statements
        try {
          const { data: directData, error: directError } = await supabase.from('_sql').select('*').execute(stmt);
          
          if (directError) {
            throw directError;
          }
          
          results.push(directData);
        } catch (directError) {
          console.error(colorize.red(`Error executing statement ${i + 1}/${statements.length}: ${error.message}`));
          throw error;
        }
      }
    }
    
    return { results, notices };
  } catch (error) {
    console.error(colorize.red(`SQL execution error: ${error.message}`));
    throw error;
  }
}

/**
 * Split SQL into individual statements, respecting string literals and comments
 * @param {string} sql - SQL script
 * @returns {string[]} Array of SQL statements
 */
function splitSqlStatements(sql) {
  const statements = [];
  let currentStatement = '';
  let inStringLiteral = false;
  let stringLiteralChar = '';
  let inLineComment = false;
  let inBlockComment = false;
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1] || '';
    
    // Handle string literals
    if ((char === "'" || char === '"') && !inLineComment && !inBlockComment) {
      if (!inStringLiteral) {
        inStringLiteral = true;
        stringLiteralChar = char;
      } else if (char === stringLiteralChar) {
        inStringLiteral = false;
      }
    }
    
    // Handle comments
    if (!inStringLiteral) {
      // Line comment
      if (char === '-' && nextChar === '-' && !inLineComment && !inBlockComment) {
        inLineComment = true;
      }
      
      // End of line comment
      if (inLineComment && (char === '\n' || char === '\r')) {
        inLineComment = false;
      }
      
      // Block comment start
      if (char === '/' && nextChar === '*' && !inLineComment && !inBlockComment) {
        inBlockComment = true;
      }
      
      // Block comment end
      if (char === '*' && nextChar === '/' && inBlockComment) {
        inBlockComment = false;
        i++; // Skip the next character
        continue;
      }
    }
    
    // Handle statement termination
    if (char === ';' && !inStringLiteral && !inLineComment && !inBlockComment) {
      statements.push(currentStatement + ';');
      currentStatement = '';
      continue;
    }
    
    // Add character to current statement
    currentStatement += char;
  }
  
  // Add the last statement if it exists and doesn't end with semicolon
  if (currentStatement.trim()) {
    statements.push(currentStatement);
  }
  
  return statements;
}

/**
 * Colorize notice message based on content
 * @param {string} message - Notice message
 * @returns {string} Colorized message
 */
function colorizeNotice(message) {
  // Color based on message content
  if (message.includes('CRITICAL') || message.includes('FAIL')) {
    return colorize.red(message);
  } else if (message.includes('WARNING')) {
    return colorize.yellow(message);
  } else if (message.includes('PASS') || message.includes('SECURE')) {
    return colorize.green(message);
  } else if (message.includes('Created policy') || message.includes('Created function')) {
    return colorize.cyan(message);
  } else if (message.includes('Dropped policy') || message.includes('Skipping')) {
    return colorize.gray(message);
  } else {
    return message;
  }
}

/**
 * Parse verification results to determine overall status
 * @param {string[]} notices - Array of notice messages
 * @returns {Object} Verification status object
 */
function parseVerificationResults(notices) {
  const status = {
    overall: 'UNKNOWN',
    criticalCount: 0,
    highCount: 0,
    warningCount: 0,
    passCount: 0,
    tablesWithRls: 0,
    totalTables: 0,
    rlsCoverage: 0
  };
  
  // Extract counts from notices
  for (const notice of notices) {
    // Extract overall status
    const overallMatch = notice.match(/Overall Security Status: (\w+)/);
    if (overallMatch) {
      status.overall = overallMatch[1];
    }
    
    // Extract critical issues count
    if (notice.includes('CRITICAL ISSUES:')) {
      const lines = notice.split('\n').filter(line => line.trim());
      status.criticalCount = lines.length - 2; // Subtract header and separator
    }
    
    // Extract high risk issues count
    if (notice.includes('HIGH RISK ISSUES:')) {
      const lines = notice.split('\n').filter(line => line.trim());
      status.highCount = lines.length - 2; // Subtract header and separator
    }
    
    // Extract RLS coverage
    const rlsMatch = notice.match(/(\d+) of (\d+) tables have RLS enabled \(([0-9.]+)%\)/);
    if (rlsMatch) {
      status.tablesWithRls = parseInt(rlsMatch[1], 10);
      status.totalTables = parseInt(rlsMatch[2], 10);
      status.rlsCoverage = parseFloat(rlsMatch[3]);
    }
  }
  
  return status;
}

/**
 * Apply consolidated RLS policies
 */
async function applyRlsPolicies() {
  // Validate configuration
  if (!validateConfig()) {
    process.exit(EXIT_CONFIG_ERROR);
  }
  
  console.log(colorize.bold(colorize.blue('=== Applying Consolidated RLS Policies ===')));
  
  const rlsFilePath = process.env.RLS_FILE || DEFAULT_RLS_FILE;
  const verifyFilePath = process.env.VERIFY_FILE || DEFAULT_VERIFY_FILE;
  
  // Create Supabase client
  const supabase = createSupabaseClient();
  
  try {
    // Check connection to Supabase using a simple query that doesn't depend on tables or RLS
    console.log(colorize.blue(`Connecting to Supabase at ${process.env.EXPO_PUBLIC_SUPABASE_URL}...`));
    
    try {
      // Simple query that should work regardless of RLS policies
      const { data, error } = await supabase.rpc('version', {});
      
      if (error) {
        // If version() function doesn't exist, try a direct SQL query
        const { error: sqlError } = await supabase.from('_sqlquery').select('*').eq('query', 'SELECT 1 as connected').single();
        
        if (sqlError) {
          // Last resort: try to create and use a simple function
          const { error: createError } = await supabase.rpc('exec_sql', { 
            sql_query: "SELECT 1 as connected;"
          });
          
          if (createError) {
            throw new Error(createError.message);
          }
        }
      }
      
      console.log(colorize.green('Connected to Supabase successfully'));
    } catch (error) {
      console.error(colorize.red(`Failed to connect to Supabase: ${error.message}`));
      process.exit(EXIT_FAILURE);
    }
    
    let verificationStatus = null;
    
    // Apply RLS policies if not in verify-only mode
    if (!VERIFY_ONLY) {
      const rlsSql = readSqlFile(rlsFilePath);
      console.log(colorize.blue(`Applying consolidated RLS policies from ${rlsFilePath}...`));
      
      try {
        const { notices } = await executeSql(supabase, rlsSql);
        console.log(colorize.green('RLS policies applied successfully'));
        
        // Log summary of changes
        const policiesCreated = notices.filter(n => n.includes('Created')).length;
        const policiesDropped = notices.filter(n => n.includes('Dropped')).length;
        console.log(colorize.cyan(`Summary: ${policiesCreated} policies created, ${policiesDropped} policies dropped`));
      } catch (error) {
        console.error(colorize.red(`Failed to apply RLS policies: ${error.message}`));
        process.exit(EXIT_FAILURE);
      }
    }
    
    // Run verification if not in apply-only mode
    if (!APPLY_ONLY) {
      const verifySql = readSqlFile(verifyFilePath);
      console.log(colorize.blue(`Running verification from ${verifyFilePath}...`));
      
      try {
        const { notices } = await executeSql(supabase, verifySql);
        
        // Parse verification results
        verificationStatus = parseVerificationResults(notices);
        
        // Print verification summary
        console.log(colorize.bold(colorize.blue('\n=== Verification Summary ===')));
        console.log(`Overall Security Status: ${getStatusColor(verificationStatus.overall, verificationStatus.overall)}`);
        console.log(`Tables with RLS: ${colorize.cyan(verificationStatus.tablesWithRls)} of ${colorize.cyan(verificationStatus.totalTables)} (${colorize.cyan(verificationStatus.rlsCoverage.toFixed(1))}%)`);
        console.log(`Critical Issues: ${verificationStatus.criticalCount > 0 ? colorize.red(verificationStatus.criticalCount) : colorize.green(verificationStatus.criticalCount)}`);
        console.log(`High Risk Issues: ${verificationStatus.highCount > 0 ? colorize.yellow(verificationStatus.highCount) : colorize.green(verificationStatus.highCount)}`);
        
        // Determine exit code based on verification results
        const exitCode = (verificationStatus.overall === 'SECURE' || verificationStatus.overall === 'MEDIUM RISK') 
          ? EXIT_SUCCESS 
          : EXIT_FAILURE;
          
        if (exitCode === EXIT_SUCCESS) {
          console.log(colorize.green('\n✅ Verification passed. Database security is in good state.'));
        } else {
          console.log(colorize.red('\n❌ Verification failed. Please fix the issues and run again.'));
        }
        
        // Exit with appropriate code
        process.exit(exitCode);
      } catch (error) {
        console.error(colorize.red(`Failed to run verification: ${error.message}`));
        process.exit(EXIT_FAILURE);
      }
    } else {
      // If only applying policies, exit with success
      console.log(colorize.green('\n✅ RLS policies applied successfully. Run with --verify-only to check security status.'));
      process.exit(EXIT_SUCCESS);
    }
  } catch (error) {
    console.error(colorize.red(`Unhandled error: ${error.message}`));
    process.exit(EXIT_FAILURE);
  }
}

/**
 * Get color function based on status
 * @param {string} status - Status string
 * @param {string} text - Text to colorize
 * @returns {string} Colorized text
 */
function getStatusColor(status, text) {
  switch (status) {
    case 'SECURE':
      return colorize.green(text);
    case 'MEDIUM RISK':
      return colorize.yellow(text);
    case 'HIGH RISK':
    case 'CRITICAL':
      return colorize.red(text);
    default:
      return colorize.white(text);
  }
}

// Run the main function
applyRlsPolicies().catch(error => {
  console.error(colorize.red(`Fatal error: ${error.message}`));
  console.error(error.stack);
  process.exit(EXIT_FAILURE);
});
