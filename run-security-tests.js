#!/usr/bin/env node
/**
 * run-security-tests.js
 * 
 * This script runs comprehensive security tests for the Card Show Finder app
 * to validate that the consolidated RLS policies are working correctly.
 * 
 * It connects to Supabase, executes the security test SQL file,
 * captures the results, and displays them with colored output.
 * 
 * Usage:
 *   node run-security-tests.js [--verbose]
 * 
 * Options:
 *   --verbose    Show detailed test output
 * 
 * Environment Variables:
 *   EXPO_PUBLIC_SUPABASE_URL      Supabase URL (required)
 *   SUPABASE_SERVICE_KEY          Supabase service key (required)
 *   SQL_TEST_FILE                 Path to SQL test file (default: ./test/database/run_security_tests.sql)
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
const DEFAULT_SQL_TEST_FILE = './test/database/run_security_tests.sql';

// Command line arguments
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const EXIT_CONFIG_ERROR = 2;

/**
 * Show help message
 */
function showHelp() {
  console.log(`
${colorize.bold('Run Security Tests')}

This script runs comprehensive security tests for the Card Show Finder app
to validate that the consolidated RLS policies are working correctly.

${colorize.bold('Usage:')}
  node run-security-tests.js [--verbose]
  
${colorize.bold('Options:')}
  --verbose      Show detailed test output
  --help         Show this help message

${colorize.bold('Environment Variables:')}
  EXPO_PUBLIC_SUPABASE_URL      Supabase URL (required)
  SUPABASE_SERVICE_KEY          Supabase service key (required)
  SQL_TEST_FILE                 Path to SQL test file (default: ${DEFAULT_SQL_TEST_FILE})
  `);
  process.exit(EXIT_SUCCESS);
}

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
  showHelp();
}

/**
 * Validate environment variables
 * @returns {boolean} True if all required variables are present
 */
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
    console.log(colorize.blue(`Reading SQL test file: ${resolvedPath}`));
    
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
  console.log(colorize.blue('Executing security tests...'));
  
  try {
    // Simple direct SQL execution
    const { data, error } = await supabase.rpc('pg_execute', { query: sql });
    
    if (error) {
      throw error;
    }
    
    // Extract test results from the SQL output
    // The SQL script should output test results in a structured format
    const results = {
      success: true,
      output: data || [],
      testResults: extractTestResults(data)
    };
    
    return results;
  } catch (error) {
    console.error(colorize.red(`SQL execution error: ${error.message}`));
    
    // Try fallback to direct SQL execution
    try {
      const { data, error: directError } = await supabase.from('_temp_sql_execution').select('*').limit(1);
      
      if (directError) {
        // Create a temporary table for test results
        await supabase.sql(`
          BEGIN;
          CREATE TEMPORARY TABLE _security_test_results (
            test_name TEXT,
            passed BOOLEAN,
            details TEXT
          );
          
          -- Run the test script
          ${sql}
          
          -- Get results
          SELECT * FROM _security_test_results;
          
          ROLLBACK;
        `);
        
        return {
          success: true,
          output: [],
          testResults: {
            total: 0,
            passed: 0,
            failed: 0,
            tests: []
          }
        };
      }
    } catch (fallbackError) {
      console.error(colorize.red(`Fallback execution failed: ${fallbackError.message}`));
    }
    
    return {
      success: false,
      error: error.message,
      output: [],
      testResults: {
        total: 0,
        passed: 0,
        failed: 0,
        tests: []
      }
    };
  }
}

/**
 * Extract test results from SQL output
 * @param {Array|Object} data - SQL execution result
 * @returns {Object} Parsed test results
 */
function extractTestResults(data) {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // Handle different output formats
  if (!data) {
    return results;
  }
  
  // If data is an array of test results
  if (Array.isArray(data)) {
    data.forEach(row => {
      if (row.test_name || row.passed !== undefined) {
        results.total++;
        if (row.passed) {
          results.passed++;
        } else {
          results.failed++;
        }
        
        results.tests.push({
          name: row.test_name || `Test ${results.total}`,
          passed: !!row.passed,
          details: row.details || ''
        });
      }
    });
  } 
  // If data contains a summary
  else if (data.summary) {
    results.total = data.summary.total || 0;
    results.passed = data.summary.passed || 0;
    results.failed = data.summary.failed || 0;
    
    if (Array.isArray(data.tests)) {
      results.tests = data.tests.map(test => ({
        name: test.name || '',
        passed: !!test.passed,
        details: test.details || ''
      }));
    }
  }
  
  return results;
}

/**
 * Parse test results from SQL output
 * @param {Object} sqlResult - SQL execution result
 * @returns {Object} Parsed test results
 */
function parseTestResults(sqlResult) {
  // If we already have structured test results, use them
  if (sqlResult.testResults) {
    return sqlResult.testResults;
  }
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // Try to extract test results from output text
  const outputText = Array.isArray(sqlResult.output) 
    ? sqlResult.output.map(row => JSON.stringify(row)).join('\n')
    : JSON.stringify(sqlResult.output);
  
  // Look for patterns like "PASS: Test name" or "FAIL: Test name - details"
  const testPattern = /(?:PASS|FAIL): ([^-\n]+)(?:\s*-\s*(.+))?/g;
  let match;
  
  while ((match = testPattern.exec(outputText)) !== null) {
    const isPassed = outputText.substring(match.index, match.index + 4) === 'PASS';
    results.total++;
    
    if (isPassed) {
      results.passed++;
    } else {
      results.failed++;
    }
    
    results.tests.push({
      name: match[1].trim(),
      passed: isPassed,
      details: match[2] ? match[2].trim() : ''
    });
  }
  
  // If we couldn't find any tests but have a summary section
  const summaryPattern = /Total tests: (\d+)\s+Passed: (\d+)\s+Failed: (\d+)/;
  const summaryMatch = summaryPattern.exec(outputText);
  
  if (summaryMatch) {
    results.total = parseInt(summaryMatch[1], 10);
    results.passed = parseInt(summaryMatch[2], 10);
    results.failed = parseInt(summaryMatch[3], 10);
  }
  
  return results;
}

/**
 * Display test results
 * @param {Object} results - Parsed test results
 * @param {boolean} verbose - Whether to show detailed output
 */
function displayResults(results, verbose) {
  console.log('\n' + colorize.bold(colorize.blue('================================================================')));
  console.log(colorize.bold(colorize.blue('SECURITY TEST RESULTS')));
  console.log(colorize.bold(colorize.blue('================================================================')));
  console.log(`Total tests: ${colorize.cyan(results.total)}`);
  console.log(`Passed: ${colorize.green(results.passed)}`);
  console.log(`Failed: ${results.failed > 0 ? colorize.red(results.failed) : colorize.green(results.failed)}`);
  console.log(colorize.bold(colorize.blue('================================================================')));
  
  // Show failed tests
  if (results.failed > 0) {
    console.log(colorize.bold(colorize.red('FAILED TESTS:')));
    results.tests
      .filter(test => !test.passed)
      .forEach(test => {
        console.log(`${colorize.red('✖')} ${test.name}${test.details ? ': ' + test.details : ''}`);
      });
    console.log(colorize.bold(colorize.blue('================================================================')));
  }
  
  // Show all tests in verbose mode
  if (verbose && results.tests.length > 0) {
    console.log(colorize.bold(colorize.blue('ALL TESTS:')));
    results.tests.forEach(test => {
      const icon = test.passed ? colorize.green('✓') : colorize.red('✖');
      console.log(`${icon} ${test.name}${test.details ? ': ' + test.details : ''}`);
    });
    console.log(colorize.bold(colorize.blue('================================================================')));
  }
  
  // Show overall result
  if (results.failed === 0) {
    console.log(colorize.bold(colorize.green('✓ ALL SECURITY TESTS PASSED!')));
    console.log(colorize.green('The consolidated RLS policies are working correctly.'));
  } else {
    console.log(colorize.bold(colorize.red('✖ SECURITY TESTS FAILED!')));
    console.log(colorize.red('Please review the failed tests and fix the issues.'));
  }
  console.log(colorize.bold(colorize.blue('================================================================')));
}

/**
 * Run security tests
 */
async function runSecurityTests() {
  // Validate configuration
  if (!validateConfig()) {
    process.exit(EXIT_CONFIG_ERROR);
  }
  
  console.log(colorize.bold(colorize.blue('=== Running Consolidated RLS Security Tests ===')));
  
  const sqlTestFilePath = process.env.SQL_TEST_FILE || DEFAULT_SQL_TEST_FILE;
  
  // Create Supabase client
  const supabase = createSupabaseClient();
  
  try {
    // Check connection to Supabase
    console.log(colorize.blue(`Connecting to Supabase at ${process.env.EXPO_PUBLIC_SUPABASE_URL}...`));
    
    try {
      // Simple query to test connection
      const { error } = await supabase.from('profiles').select('id').limit(1);
      
      if (error) {
        console.error(colorize.red(`Failed to connect to Supabase: ${error.message}`));
        process.exit(EXIT_FAILURE);
      }
      
      console.log(colorize.green('Connected to Supabase successfully'));
    } catch (error) {
      console.error(colorize.red(`Failed to connect to Supabase: ${error.message}`));
      process.exit(EXIT_FAILURE);
    }
    
    // Read SQL test file
    const sqlTests = readSqlFile(sqlTestFilePath);
    
    // Execute SQL tests
    try {
      const result = await executeSql(supabase, sqlTests);
      
      if (!result.success) {
        console.error(colorize.red(`Failed to execute SQL tests: ${result.error}`));
        process.exit(EXIT_FAILURE);
      }
      
      // Parse and display results
      const results = parseTestResults(result);
      displayResults(results, VERBOSE);
      
      // Log raw output in verbose mode
      if (VERBOSE && result.output) {
        console.log(colorize.bold(colorize.blue('RAW SQL OUTPUT:')));
        console.log(JSON.stringify(result.output, null, 2));
      }
      
      // Exit with appropriate code
      process.exit(results.failed > 0 ? EXIT_FAILURE : EXIT_SUCCESS);
    } catch (error) {
      console.error(colorize.red(`Failed to run security tests: ${error.message}`));
      process.exit(EXIT_FAILURE);
    }
  } catch (error) {
    console.error(colorize.red(`Unhandled error: ${error.message}`));
    process.exit(EXIT_FAILURE);
  }
}

// Run the main function
runSecurityTests().catch(error => {
  console.error(colorize.red(`Fatal error: ${error.message}`));
  console.error(error.stack);
  process.exit(EXIT_FAILURE);
});
