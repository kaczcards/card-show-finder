#!/usr/bin/env node
/**
 * simple-security-test-runner.js
 * 
 * A simple script to run security tests for Card Show Finder app.
 * This script connects to Supabase, executes the security test SQL file,
 * and displays a simple colored summary of the results.
 * 
 * Usage:
 *   node simple-security-test-runner.js
 * 
 * Environment Variables:
 *   EXPO_PUBLIC_SUPABASE_URL      Supabase URL
 *   SUPABASE_SERVICE_KEY          Supabase service key
 */

// Import required packages
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Default SQL test file path
const SQL_TEST_FILE = './test/database/run_security_tests.sql';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Helper functions for colored console output
const colorize = {
  bold: (text) => `${colors.bold}${text}${colors.reset}`,
  red: (text) => `${colors.red}${text}${colors.reset}`,
  green: (text) => `${colors.green}${text}${colors.reset}`,
  yellow: (text) => `${colors.yellow}${text}${colors.reset}`,
  blue: (text) => `${colors.blue}${text}${colors.reset}`
};

// Main function to run security tests
async function runSecurityTests() {
  console.log(colorize.bold(colorize.blue('=== Running Security Tests ===')));
  
  // Check for required environment variables
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error(colorize.red('Error: Missing required environment variables.'));
    console.error(colorize.yellow('Required: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY'));
    process.exit(1);
  }
  
  // Create Supabase client
  const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  try {
    // Test connection
    console.log(colorize.blue(`Connecting to Supabase at ${process.env.EXPO_PUBLIC_SUPABASE_URL}...`));
    const { error: connectionError } = await supabase.from('profiles').select('id').limit(1);
    
    if (connectionError) {
      console.error(colorize.red(`Connection failed: ${connectionError.message}`));
      process.exit(1);
    }
    
    console.log(colorize.green('Connected successfully'));
    
    // Read SQL file
    const sqlFilePath = path.resolve(process.env.SQL_TEST_FILE || SQL_TEST_FILE);
    console.log(colorize.blue(`Reading SQL file: ${sqlFilePath}`));
    
    if (!fs.existsSync(sqlFilePath)) {
      console.error(colorize.red(`Error: SQL file not found at ${sqlFilePath}`));
      process.exit(1);
    }
    
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute SQL directly
    console.log(colorize.blue('Executing security tests...'));
    const { data, error } = await supabase.sql(sqlContent);
    
    if (error) {
      console.error(colorize.red(`SQL execution error: ${error.message}`));
      process.exit(1);
    }
    
    // Parse results from the output
    const output = JSON.stringify(data);
    
    // Look for summary pattern in output
    const summaryMatch = output.match(/Total tests: (\d+)\s+Passed: (\d+)\s+Failed: (\d+)/);
    
    if (summaryMatch) {
      const total = parseInt(summaryMatch[1], 10);
      const passed = parseInt(summaryMatch[2], 10);
      const failed = parseInt(summaryMatch[3], 10);
      
      // Display results
      console.log('\n' + colorize.bold(colorize.blue('================================================================')));
      console.log(colorize.bold(colorize.blue('SECURITY TEST RESULTS')));
      console.log(colorize.bold(colorize.blue('================================================================')));
      console.log(`Total tests: ${total}`);
      console.log(`Passed: ${colorize.green(passed)}`);
      console.log(`Failed: ${failed > 0 ? colorize.red(failed) : colorize.green(failed)}`);
      console.log(colorize.bold(colorize.blue('================================================================')));
      
      if (failed === 0) {
        console.log(colorize.bold(colorize.green('✅ ALL SECURITY TESTS PASSED!')));
        console.log(colorize.green('The consolidated RLS policies are working correctly.'));
      } else {
        console.log(colorize.bold(colorize.red('❌ SECURITY TESTS FAILED!')));
        console.log(colorize.red('Please review the failed tests and fix the issues.'));
      }
      console.log(colorize.bold(colorize.blue('================================================================')));
      
      // Exit with appropriate code
      process.exit(failed > 0 ? 1 : 0);
    } else {
      // If we can't find a summary, just check if there are any failures in the output
      const hasFailed = output.includes('FAIL:') || output.includes('❌');
      
      console.log('\n' + colorize.bold(colorize.blue('================================================================')));
      console.log(colorize.bold(colorize.blue('SECURITY TEST RESULTS')));
      console.log(colorize.bold(colorize.blue('================================================================')));
      
      if (hasFailed) {
        console.log(colorize.bold(colorize.red('❌ SECURITY TESTS FAILED!')));
        console.log(colorize.red('Please review the SQL output for details.'));
      } else {
        console.log(colorize.bold(colorize.green('✅ SECURITY TESTS COMPLETED!')));
        console.log(colorize.green('No explicit failures detected.'));
      }
      console.log(colorize.bold(colorize.blue('================================================================')));
      
      // Exit with appropriate code
      process.exit(hasFailed ? 1 : 0);
    }
  } catch (error) {
    console.error(colorize.red(`Unexpected error: ${error.message}`));
    process.exit(1);
  }
}

// Run the main function
runSecurityTests().catch(error => {
  console.error(colorize.red(`Fatal error: ${error.message}`));
  process.exit(1);
});
