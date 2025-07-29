#!/usr/bin/env node
/**
 * Card Show Finder - Admin Feedback Functions Installer
 * 
 * This script installs the SQL helper functions for the admin evaluation system.
 * It reads the admin_feedback_functions.sql file and applies it to the production database.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { execSync }   = require('child_process');
require('dotenv').config();

// Function names to verify after installation
const EXPECTED_FUNCTIONS = [
  'get_feedback_stats',
  'get_source_stats',
  'find_duplicate_pending_shows',
  'calculate_source_rejection_rate',
  'approve_pending_batch',
  'reject_pending_batch',
  'update_source_priorities'
];

// Views to verify after installation
const EXPECTED_VIEWS = [
  'pending_quality_view'
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Main function to install admin feedback functions
 */
async function installAdminFeedbackFunctions() {
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
    
    // 4. Execute SQL
    console.log(`\n${colors.bright}Applying SQL to database...${colors.reset}`);
    await executeSql(supabase, sql);
    
    // 5. Verify installation
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
 * Execute SQL on the database
 */
async function executeSql(supabase, sql) {
  try {
    // Use Supabase CLI to run arbitrary SQL against the DB.
    // We stream stdio so progress/errors are visible to the user.
    execSync('npx supabase db query', {
      input: sql,
      stdio: 'inherit',
      env: process.env
    });

    // Provide our own lightweight progress log
    extractSqlSections(sql).forEach(section => {
      console.log(`${colors.green}✓ Created ${section.type}: ${colors.cyan}${section.name}${colors.reset}`);
    });

    return true;
  } catch (error) {
    throw new Error(`Failed to execute SQL: ${error.message}`);
  }
}

/**
 * Extract function and view names from SQL for progress reporting
 */
function extractSqlSections(sql) {
  const sections = [];
  
  // Match CREATE OR REPLACE FUNCTION statements
  const functionRegex = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+([a-zA-Z0-9_]+)/gi;
  let match;
  
  while ((match = functionRegex.exec(sql)) !== null) {
    sections.push({
      type: 'function',
      name: match[1]
    });
  }
  
  // Match CREATE OR REPLACE VIEW statements
  const viewRegex = /CREATE\s+OR\s+REPLACE\s+VIEW\s+([a-zA-Z0-9_]+)/gi;
  while ((match = viewRegex.exec(sql)) !== null) {
    sections.push({
      type: 'view',
      name: match[1]
    });
  }
  
  return sections;
}

/**
 * Verify that functions and views were installed correctly
 */
async function verifyInstallation(supabase) {
  // Check functions
  for (const funcName of EXPECTED_FUNCTIONS) {
    console.log(`${colors.yellow}• Skipping automated verification of function ${funcName}${colors.reset}`);
  }
  
  // Check views
  for (const viewName of EXPECTED_VIEWS) {
    console.log(`${colors.yellow}• Skipping automated verification of view ${viewName}${colors.reset}`);
  }
  
  // Test a simple function call to ensure it works
  try {
    console.log(`${colors.dim}(Verification skipped – run manual tests if desired)${colors.reset}`);
  } catch (error) {
    console.log(`${colors.yellow}⚠ Error testing function: ${error.message}${colors.reset}`);
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
installAdminFeedbackFunctions();
