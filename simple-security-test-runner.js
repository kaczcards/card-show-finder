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
const { execSync } = require('child_process');

// Default SQL test file path
const SIMPLE_SQL_TEST_FILE = './test/database/simple_security_test.sql';
const FULL_SQL_TEST_FILE   = './test/database/run_security_tests.sql';

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
  
  // Resolve SQL file path early (allow override via env, otherwise use simple test)
  let sqlFilePath = path.resolve(process.env.SQL_TEST_FILE || SIMPLE_SQL_TEST_FILE);
  console.log(colorize.blue(`Reading SQL file: ${sqlFilePath}`));
  if (!fs.existsSync(sqlFilePath)) {
    console.error(colorize.red(`Error: SQL file not found at ${sqlFilePath}`));
    process.exit(1);
  }
  
  try {
    // Build psql command
    const pgConfig = {
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT || '5432',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'card_show_finder_test'
    };

    console.log(
      colorize.blue(
        `Executing security tests against postgres://${pgConfig.user}@${pgConfig.host}:${pgConfig.port}/${pgConfig.database}`
      )
    );

    const env = {
      ...process.env,
      PGPASSWORD: pgConfig.password
    };

    const runSqlFile = (file) => {
      const cmd = `psql -h ${pgConfig.host} -p ${pgConfig.port} -U ${pgConfig.user} -d ${pgConfig.database} -v ON_ERROR_STOP=1 -f "${file}"`;
      return execSync(cmd, { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    };

    let stdout;
    try {
      stdout = runSqlFile(sqlFilePath);
    } catch (err) {
      // If simple test fails and fallback exists, try full test
      if (sqlFilePath.endsWith('simple_security_test.sql') && fs.existsSync(FULL_SQL_TEST_FILE)) {
        console.warn(colorize.yellow('Simple test failed, attempting full security test suite...'));
        sqlFilePath = path.resolve(FULL_SQL_TEST_FILE);
        stdout = runSqlFile(sqlFilePath);
      } else {
        throw err;
      }
    }

    // Parse results from stdout
    const output = stdout.toString();
    
    // Look for summary pattern in output
    const summaryMatch = output.match(/Total tests: (\\d+)/i) &&
                         output.match(/Passed tests?: (\\d+)/i) &&
                         output.match(/Failed tests?: (\\d+)/i)
      ? [
          null,
          output.match(/Total tests: (\\d+)/i)[1],
          output.match(/Passed tests?: (\\d+)/i)[1],
          output.match(/Failed tests?: (\\d+)/i)[1]
        ]
      : null;
    
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
    const stderr = error.stderr ? error.stderr.toString() : '';
    console.error(colorize.red('Unexpected error executing security tests:\n'));
    if (stderr) console.error(colorize.red(stderr));
    console.error(colorize.red(error.message || error));
    process.exit(1);
  }
}

// Run the main function
runSecurityTests().catch(error => {
  console.error(colorize.red(`Fatal error: ${error.message}`));
  process.exit(1);
});
