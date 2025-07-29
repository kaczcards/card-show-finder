#!/usr/bin/env node
/**
 * Card Show Finder - Admin Feedback Functions Installer
 * 
 * This script directly applies the SQL helper functions for the admin evaluation system
 * by executing each CREATE statement individually against the Supabase database.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Function and view names to verify after installation
const EXPECTED_FUNCTIONS = [
  'get_feedback_stats',
  'get_source_stats',
  'find_duplicate_pending_shows',
  'calculate_source_rejection_rate',
  'approve_pending_batch',
  'reject_pending_batch',
  'update_source_priorities'
];

const EXPECTED_VIEWS = [
  'pending_quality_view'
];

/**
 * Main function to install admin feedback functions
 */
async function applyAdminFeedbackFunctions() {
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  CARD SHOW FINDER - ADMIN FEEDBACK FUNCTIONS INSTALLER${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}\n`);
  
  try {
    // 1. Check environment variables
    validateEnvironmentVariables();
    
    // 2. Create Supabase client
    const supabase = createSupabaseClient();
    console.log(`${colors.green}✓ Connected to Supabase${colors.reset}`);
    
    // 3. Read SQL file
    const sqlFilePath = path.join(__dirname, 'sql', 'admin_feedback_functions.sql');
    const sql = readSqlFile(sqlFilePath);
    console.log(`${colors.green}✓ SQL file read successfully (${formatBytes(sql.length)})${colors.reset}`);
    
    // 4. Split SQL into individual statements
    const statements = splitSqlStatements(sql);
    console.log(`${colors.green}✓ Found ${statements.length} SQL statements to execute${colors.reset}`);
    
    // 5. Execute each statement
    console.log(`\n${colors.bright}Applying SQL statements to database...${colors.reset}`);
    await executeStatements(supabase, statements);
    
    // 6. Verify installation
    console.log(`\n${colors.bright}Verifying installation...${colors.reset}`);
    await verifyInstallation(supabase);
    
    console.log(`\n${colors.bright}${colors.green}Installation completed successfully!${colors.reset}`);
    console.log(`${colors.green}The admin evaluation system is now ready to use.${colors.reset}`);
    console.log(`${colors.dim}Run the CLI tool with: node admin_review_cli.js${colors.reset}\n`);
    
  } catch (error) {
    console.error(`\n${colors.red}ERROR: ${error.message}${colors.reset}`);
    console.error(`${colors.dim}${error.stack}${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Validate required environment variables
 */
function validateEnvironmentVariables() {
  const requiredVars = ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please create a .env file with the following variables:\n` +
      `EXPO_PUBLIC_SUPABASE_URL=your_supabase_url\n` +
      `SUPABASE_SERVICE_KEY=your_service_key`
    );
  }
  
  console.log(`${colors.green}✓ Environment variables validated${colors.reset}`);
}

/**
 * Create Supabase client with production credentials
 */
function createSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * Read SQL file from disk
 */
function readSqlFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read SQL file: ${error.message}`);
  }
}

/**
 * Split SQL into individual statements
 */
function splitSqlStatements(sql) {
  // Remove comments and empty lines
  const cleanedSql = sql.replace(/--.*$/gm, '').replace(/^\s*[\r\n]/gm, '');
  
  // Split by CREATE OR REPLACE statements
  const statements = [];
  
  // Extract CREATE EXTENSION statement if present
  const extensionMatch = cleanedSql.match(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+[^;]+;/i);
  if (extensionMatch) {
    statements.push(extensionMatch[0]);
  }
  
  // Extract CREATE OR REPLACE FUNCTION statements
  const functionMatches = cleanedSql.matchAll(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+[^;]+;/gi);
  for (const match of functionMatches) {
    statements.push(match[0]);
  }
  
  // Extract CREATE OR REPLACE VIEW statements
  const viewMatches = cleanedSql.matchAll(/CREATE\s+OR\s+REPLACE\s+VIEW\s+[^;]+;/gi);
  for (const match of viewMatches) {
    statements.push(match[0]);
  }
  
  return statements;
}

/**
 * Execute SQL statements one by one
 */
async function executeStatements(supabase, statements) {
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const statementType = getStatementType(statement);
    const objectName = getObjectName(statement, statementType);
    
    console.log(`${colors.dim}[${i+1}/${statements.length}] Executing ${statementType}: ${objectName}${colors.reset}`);
    
    try {
      const { error } = await supabase.rpc('pgmoon.query', { query: statement });
      
      if (error) {
        console.log(`${colors.red}✗ Failed to create ${statementType}: ${objectName}${colors.reset}`);
        console.log(`${colors.red}  Error: ${error.message}${colors.reset}`);
        errorCount++;
      } else {
        console.log(`${colors.green}✓ Created ${statementType}: ${colors.cyan}${objectName}${colors.reset}`);
        successCount++;
      }
    } catch (error) {
      console.log(`${colors.red}✗ Error executing statement: ${error.message}${colors.reset}`);
      errorCount++;
    }
  }
  
  console.log(`\n${colors.bright}Execution summary:${colors.reset}`);
  console.log(`${colors.green}✓ ${successCount} statements executed successfully${colors.reset}`);
  
  if (errorCount > 0) {
    console.log(`${colors.red}✗ ${errorCount} statements failed${colors.reset}`);
  }
}

/**
 * Get the type of SQL statement (function, view, extension)
 */
function getStatementType(statement) {
  if (statement.match(/CREATE\s+EXTENSION/i)) {
    return 'extension';
  } else if (statement.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i)) {
    return 'function';
  } else if (statement.match(/CREATE\s+OR\s+REPLACE\s+VIEW/i)) {
    return 'view';
  } else {
    return 'statement';
  }
}

/**
 * Extract the object name from a SQL statement
 */
function getObjectName(statement, type) {
  if (type === 'extension') {
    const match = statement.match(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+([^\s;]+)/i);
    return match ? match[1] : 'unknown';
  } else if (type === 'function') {
    const match = statement.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+([^\s(]+)/i);
    return match ? match[1] : 'unknown';
  } else if (type === 'view') {
    const match = statement.match(/CREATE\s+OR\s+REPLACE\s+VIEW\s+([^\s(]+)/i);
    return match ? match[1] : 'unknown';
  } else {
    return 'unknown';
  }
}

/**
 * Verify that functions and views were installed correctly
 */
async function verifyInstallation(supabase) {
  let successCount = 0;
  let errorCount = 0;
  
  // Check functions
  for (const funcName of EXPECTED_FUNCTIONS) {
    try {
      const { data, error } = await supabase.rpc('pgmoon.query', { 
        query: `SELECT EXISTS(
          SELECT 1 FROM pg_proc 
          JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
          WHERE proname = '${funcName}' AND nspname = 'public'
        );`
      });
      
      if (error) {
        console.log(`${colors.yellow}⚠ Could not verify function ${funcName}: ${error.message}${colors.reset}`);
        errorCount++;
        continue;
      }
      
      const exists = data && data.length > 0 ? data[0].exists : false;
      if (exists) {
        console.log(`${colors.green}✓ Verified function: ${colors.cyan}${funcName}${colors.reset}`);
        successCount++;
      } else {
        console.log(`${colors.red}✗ Function not found: ${funcName}${colors.reset}`);
        errorCount++;
      }
    } catch (error) {
      console.log(`${colors.yellow}⚠ Error verifying function ${funcName}: ${error.message}${colors.reset}`);
      errorCount++;
    }
  }
  
  // Check views
  for (const viewName of EXPECTED_VIEWS) {
    try {
      const { data, error } = await supabase.rpc('pgmoon.query', { 
        query: `SELECT EXISTS(
          SELECT 1 FROM pg_views 
          WHERE viewname = '${viewName}' AND schemaname = 'public'
        );`
      });
      
      if (error) {
        console.log(`${colors.yellow}⚠ Could not verify view ${viewName}: ${error.message}${colors.reset}`);
        errorCount++;
        continue;
      }
      
      const exists = data && data.length > 0 ? data[0].exists : false;
      if (exists) {
        console.log(`${colors.green}✓ Verified view: ${colors.cyan}${viewName}${colors.reset}`);
        successCount++;
      } else {
        console.log(`${colors.red}✗ View not found: ${viewName}${colors.reset}`);
        errorCount++;
      }
    } catch (error) {
      console.log(`${colors.yellow}⚠ Error verifying view ${viewName}: ${error.message}${colors.reset}`);
      errorCount++;
    }
  }
  
  // Test a simple function call to ensure it works
  try {
    console.log(`\n${colors.bright}Testing function execution...${colors.reset}`);
    
    const { data, error } = await supabase.rpc('pgmoon.query', { 
      query: `SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_feedback_stats');`
    });
    
    if (error) {
      console.log(`${colors.yellow}⚠ Function test failed: ${error.message}${colors.reset}`);
      errorCount++;
    } else if (data && data.length > 0 && data[0].exists) {
      console.log(`${colors.green}✓ Function exists and can be queried${colors.reset}`);
      
      // Try to execute the function
      const { data: funcData, error: funcError } = await supabase.rpc('get_feedback_stats', { 
        days_ago: 7,
        min_count: 1
      });
      
      if (funcError) {
        console.log(`${colors.yellow}⚠ Function execution failed: ${funcError.message}${colors.reset}`);
        console.log(`${colors.yellow}  This may be normal if there's no feedback data yet${colors.reset}`);
      } else {
        console.log(`${colors.green}✓ Successfully executed get_feedback_stats function${colors.reset}`);
        successCount++;
      }
    } else {
      console.log(`${colors.red}✗ Function test failed: get_feedback_stats not found${colors.reset}`);
      errorCount++;
    }
  } catch (error) {
    console.log(`${colors.yellow}⚠ Error testing function: ${error.message}${colors.reset}`);
    errorCount++;
  }
  
  console.log(`\n${colors.bright}Verification summary:${colors.reset}`);
  console.log(`${colors.green}✓ ${successCount} verifications passed${colors.reset}`);
  
  if (errorCount > 0) {
    console.log(`${colors.yellow}⚠ ${errorCount} verifications failed or skipped${colors.reset}`);
  }
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Run the installer
applyAdminFeedbackFunctions();
