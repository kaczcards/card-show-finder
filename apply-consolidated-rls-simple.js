#!/usr/bin/env node
/**
 * apply-consolidated-rls-simple.js
 * 
 * This simplified script prepares the consolidated Row Level Security (RLS) 
 * policies for manual application via the Supabase Dashboard SQL Editor.
 * 
 * It avoids connection issues by not attempting to connect to Supabase directly.
 * Instead, it reads the SQL files and provides instructions for manual application.
 * 
 * Usage:
 *   node apply-consolidated-rls-simple.js [--help]
 *   
 * Options:
 *   --help         Show this help message
 * 
 * Environment Variables:
 *   RLS_FILE       Path to consolidated RLS SQL file (default: ./CONSOLIDATED_RLS_2025.sql)
 *   VERIFY_FILE    Path to verification SQL file (default: ./verify-rls-policies.sql)
 */

// Import required packages
require('dotenv').config();
const fs = require('fs');
const path = require('path');

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
${colorize.bold('Apply Consolidated RLS Policies (Simple Manual Version)')}

This script prepares the consolidated Row Level Security (RLS) policies
for manual application via the Supabase Dashboard SQL Editor.

${colorize.bold('Usage:')}
  node apply-consolidated-rls-simple.js
  
${colorize.bold('Options:')}
  --help         Show this help message

${colorize.bold('Environment Variables:')}
  RLS_FILE       Path to consolidated RLS SQL file (default: ${DEFAULT_RLS_FILE})
  VERIFY_FILE    Path to verification SQL file (default: ${DEFAULT_VERIFY_FILE})
  `);
  process.exit(EXIT_SUCCESS);
}

// Show help if requested
if (SHOW_HELP) {
  showHelp();
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
 * Format SQL for display in terminal
 * @param {string} sql - SQL content
 * @returns {string} Formatted SQL
 */
function formatSqlForDisplay(sql) {
  // Limit length for display
  const maxLength = 2000;
  const truncated = sql.length > maxLength;
  const displaySql = truncated ? sql.substring(0, maxLength) + '...' : sql;
  
  // Split into lines for better display
  return displaySql.split('\n').map(line => {
    // Highlight keywords
    return line
      .replace(/\b(CREATE|DROP|ALTER|TABLE|POLICY|FUNCTION|BEGIN|COMMIT|SELECT|INSERT|UPDATE|DELETE|GRANT|REVOKE|ON|TO|FROM|WHERE|USING|WITH CHECK|RETURNS|LANGUAGE|SECURITY DEFINER|EXECUTE|ENABLE ROW LEVEL SECURITY)\b/gi, 
        match => colorize.cyan(match))
      .replace(/\b(--.*)/g, match => colorize.gray(match));
  }).join('\n');
}

/**
 * Save SQL to file for easy access
 * @param {string} sql - SQL content
 * @param {string} filename - File name
 */
function saveSqlToFile(sql, filename) {
  try {
    fs.writeFileSync(filename, sql);
    console.log(colorize.green(`Saved SQL to file: ${filename}`));
  } catch (error) {
    console.error(colorize.red(`Error saving SQL to file: ${error.message}`));
  }
}

/**
 * Main function to prepare RLS policies for manual application
 */
function prepareRlsPolicies() {
  console.log(colorize.bold(colorize.blue('=== Preparing Consolidated RLS Policies for Manual Application ===')));
  
  const rlsFilePath = process.env.RLS_FILE || DEFAULT_RLS_FILE;
  const verifyFilePath = process.env.VERIFY_FILE || DEFAULT_VERIFY_FILE;
  
  try {
    // Read RLS SQL file
    const rlsSql = readSqlFile(rlsFilePath);
    console.log(colorize.green(`Successfully read consolidated RLS policies from ${rlsFilePath}`));
    
    // Read verification SQL file
    const verifySql = readSqlFile(verifyFilePath);
    console.log(colorize.green(`Successfully read verification script from ${verifyFilePath}`));
    
    // Save to temp files for easy access
    const tempRlsFile = 'consolidated-rls-temp.sql';
    const tempVerifyFile = 'verify-rls-temp.sql';
    saveSqlToFile(rlsSql, tempRlsFile);
    saveSqlToFile(verifySql, tempVerifyFile);
    
    // Display manual application instructions
    console.log('\n' + colorize.bold(colorize.magenta('=== MANUAL APPLICATION INSTRUCTIONS ===')));
    console.log(colorize.yellow('Due to connection issues, please apply the RLS policies manually:'));
    console.log('\n' + colorize.bold('STEP 1: Apply Consolidated RLS Policies'));
    console.log('1. Open Supabase Dashboard: ' + colorize.blue('https://app.supabase.com'));
    console.log('2. Navigate to your project → SQL Editor');
    console.log('3. Copy the ENTIRE contents of the consolidated RLS SQL file:');
    console.log('   ' + colorize.cyan(`${tempRlsFile} (created in current directory)`));
    console.log('4. Paste into a new SQL query tab');
    console.log('5. Click "Run" to execute');
    
    console.log('\n' + colorize.bold('STEP 2: Verify RLS Policies'));
    console.log('1. Open a new SQL query tab');
    console.log('2. Copy the ENTIRE contents of the verification SQL file:');
    console.log('   ' + colorize.cyan(`${tempVerifyFile} (created in current directory)`));
    console.log('3. Paste into the SQL query tab');
    console.log('4. Click "Run" to execute');
    console.log('5. Check the results - look for "Overall Security Status: SECURE" in green');
    
    console.log('\n' + colorize.bold('STEP 3: Troubleshooting'));
    console.log('If you encounter errors:');
    console.log('1. Try executing smaller sections of the SQL at a time');
    console.log('2. Look for error messages in the console output');
    console.log('3. Focus on fixing the specific policy or function causing errors');
    console.log('4. Common issues:');
    console.log('   - Tables referenced in policies don\'t exist');
    console.log('   - Syntax errors in SQL statements');
    console.log('   - Permission issues (need to be a Supabase admin)');
    
    console.log('\n' + colorize.green('✅ Preparation complete! Follow the steps above to apply RLS policies manually.'));
    
    // Preview of SQL files (first few lines)
    console.log('\n' + colorize.bold('Preview of consolidated RLS SQL:'));
    console.log(formatSqlForDisplay(rlsSql.substring(0, 500)) + '...');
    
    console.log('\n' + colorize.bold('Preview of verification SQL:'));
    console.log(formatSqlForDisplay(verifySql.substring(0, 500)) + '...');
    
  } catch (error) {
    console.error(colorize.red(`Error preparing RLS policies: ${error.message}`));
    process.exit(EXIT_FAILURE);
  }
}

// Run the main function
prepareRlsPolicies();
