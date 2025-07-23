#!/usr/bin/env node
/**
 * test-hermes-persistence.js
 * 
 * This script tests whether Hermes configuration persists after prebuild operations.
 * It verifies that the correct Hermes and New Architecture settings are maintained
 * for both iOS and Android platforms after running `expo prebuild`.
 * 
 * Usage:
 *   node scripts/test-hermes-persistence.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m'
};

// Helper functions for colored console output
const format = {
  header: (text) => `${colors.bold}${colors.blue}${text}${colors.reset}`,
  success: (text) => `${colors.green}✓ ${text}${colors.reset}`,
  error: (text) => `${colors.red}✗ ${text}${colors.reset}`,
  warning: (text) => `${colors.yellow}⚠ ${text}${colors.reset}`,
  info: (text) => `${colors.cyan}ℹ ${text}${colors.reset}`,
  bold: (text) => `${colors.bold}${text}${colors.reset}`,
  path: (text) => `${colors.dim}${text}${colors.reset}`,
  result: (passed) => passed 
    ? `${colors.bgGreen}${colors.bold} PASS ${colors.reset}` 
    : `${colors.bgRed}${colors.bold} FAIL ${colors.reset}`
};

// Expected configuration values
const expectedConfig = {
  ios: {
    'expo.jsEngine': 'hermes',
    'newArchEnabled': 'false'
  },
  android: {
    'hermesEnabled': 'true',
    'newArchEnabled': 'false'
  }
};

// File paths
const configPaths = {
  ios: path.resolve(process.cwd(), 'ios/Podfile.properties.json'),
  android: path.resolve(process.cwd(), 'android/gradle.properties')
};

// Track test results
let allTestsPassed = true;
const testResults = [];

/**
 * Run a prebuild command for the specified platform
 * @param {string} platform - 'ios' or 'android'
 */
function runPrebuild(platform) {
  console.log(format.header(`\n=== Running prebuild for ${platform} ===`));
  
  try {
    console.log(format.info(`Executing: npx expo prebuild --platform ${platform} --clean`));
    execSync(`npx expo prebuild --platform ${platform} --clean`, { 
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8' 
    });
    console.log(format.success(`Successfully completed prebuild for ${platform}`));
    return true;
  } catch (error) {
    console.error(format.error(`Failed to run prebuild for ${platform}:`));
    console.error(error.message || error);
    return false;
  }
}

/**
 * Verify iOS configuration
 * @returns {boolean} Whether verification passed
 */
function verifyIosConfig() {
  console.log(format.header('\n=== Verifying iOS Hermes Configuration ==='));
  
  try {
    // Check if the file exists
    if (!fs.existsSync(configPaths.ios)) {
      console.error(format.error(`iOS configuration file not found at ${format.path(configPaths.ios)}`));
      return false;
    }

    // Read and parse the JSON file
    const configContent = fs.readFileSync(configPaths.ios, 'utf8');
    const config = JSON.parse(configContent);
    
    console.log(format.info(`Reading configuration from ${format.path(configPaths.ios)}`));
    
    // Check each expected value
    let allChecksPass = true;
    for (const [key, expectedValue] of Object.entries(expectedConfig.ios)) {
      const actualValue = config[key];
      const passed = actualValue === expectedValue;
      
      if (passed) {
        console.log(format.success(`${key}: ${actualValue} (Expected: ${expectedValue})`));
      } else {
        console.log(format.error(`${key}: ${actualValue} (Expected: ${expectedValue})`));
        allChecksPass = false;
      }
      
      testResults.push({
        platform: 'ios',
        check: key,
        expected: expectedValue,
        actual: actualValue,
        passed
      });
    }
    
    return allChecksPass;
  } catch (error) {
    console.error(format.error(`Error verifying iOS configuration:`));
    console.error(error.message || error);
    return false;
  }
}

/**
 * Verify Android configuration
 * @returns {boolean} Whether verification passed
 */
function verifyAndroidConfig() {
  console.log(format.header('\n=== Verifying Android Hermes Configuration ==='));
  
  try {
    // Check if the file exists
    if (!fs.existsSync(configPaths.android)) {
      console.error(format.error(`Android configuration file not found at ${format.path(configPaths.android)}`));
      return false;
    }

    // Read the properties file
    const configContent = fs.readFileSync(configPaths.android, 'utf8');
    console.log(format.info(`Reading configuration from ${format.path(configPaths.android)}`));
    
    // Check each expected value
    let allChecksPass = true;
    for (const [key, expectedValue] of Object.entries(expectedConfig.android)) {
      // Use regex to find the property value
      const regex = new RegExp(`${key}\\s*=\\s*(\\S+)`, 'i');
      const match = configContent.match(regex);
      
      if (match && match[1]) {
        const actualValue = match[1];
        const passed = actualValue === expectedValue;
        
        if (passed) {
          console.log(format.success(`${key}=${actualValue} (Expected: ${expectedValue})`));
        } else {
          console.log(format.error(`${key}=${actualValue} (Expected: ${expectedValue})`));
          allChecksPass = false;
        }
        
        testResults.push({
          platform: 'android',
          check: key,
          expected: expectedValue,
          actual: actualValue,
          passed
        });
      } else {
        console.log(format.error(`${key} not found in configuration`));
        allChecksPass = false;
        
        testResults.push({
          platform: 'android',
          check: key,
          expected: expectedValue,
          actual: 'not found',
          passed: false
        });
      }
    }
    
    return allChecksPass;
  } catch (error) {
    console.error(format.error(`Error verifying Android configuration:`));
    console.error(error.message || error);
    return false;
  }
}

/**
 * Print a summary of all test results
 */
function printSummary() {
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  
  console.log(format.header('\n=== Hermes Configuration Persistence Test Summary ==='));
  console.log(`Total tests: ${format.bold(totalTests.toString())}`);
  console.log(`Passed: ${format.success(passedTests.toString())}`);
  console.log(`Failed: ${failedTests > 0 ? format.error(failedTests.toString()) : format.success('0')}`);
  
  if (failedTests > 0) {
    console.log(format.header('\nFailed Tests:'));
    testResults.filter(r => !r.passed).forEach(result => {
      console.log(format.error(`- ${result.platform} / ${result.check}: Expected "${result.expected}", got "${result.actual}"`));
    });
    
    console.log(format.warning('\nPossible Fixes:'));
    console.log('1. Update app.config.js to set the correct jsEngine and newArchEnabled values:');
    console.log(`   ${format.dim('ios: { jsEngine: "hermes" }, android: { jsEngine: "hermes" }, newArchEnabled: false')}`);
    console.log('2. Ensure app.json and app.config.js have consistent configurations');
    console.log('3. Run prebuild again with clean flag to regenerate platform files');
  }
  
  console.log('\n' + format.result(allTestsPassed) + ` Hermes configuration ${allTestsPassed ? 'persists correctly' : 'has inconsistencies'}\n`);
}

/**
 * Main function
 */
async function main() {
  console.log(format.header('=== Hermes Configuration Persistence Test ==='));
  console.log(format.info('Testing if Hermes configuration persists after prebuild operations'));
  
  // Run iOS tests
  if (runPrebuild('ios')) {
    const iosResult = verifyIosConfig();
    if (!iosResult) allTestsPassed = false;
  } else {
    allTestsPassed = false;
  }
  
  // Run Android tests
  if (runPrebuild('android')) {
    const androidResult = verifyAndroidConfig();
    if (!androidResult) allTestsPassed = false;
  } else {
    allTestsPassed = false;
  }
  
  // Print summary
  printSummary();
  
  // Exit with appropriate code
  process.exit(allTestsPassed ? 0 : 1);
}

// Run the main function
main().catch(error => {
  console.error(format.error('Unexpected error:'));
  console.error(error);
  process.exit(1);
});
