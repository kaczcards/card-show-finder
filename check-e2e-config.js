#!/usr/bin/env node
/**
 * E2E Configuration Validator
 * 
 * This script validates the E2E test configuration files to ensure they are
 * syntactically correct and properly set up before attempting to run tests.
 * 
 * Usage:
 *   node check-e2e-config.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Root project directory
// This script lives in the project root, so `__dirname` already *is*
// the correct root directory.  Resolving `..` moves us one level up
// and breaks all path checks when the script is executed from within
// the repository.  Use `__dirname` directly instead.
const rootDir = __dirname;
const e2eDir = path.join(rootDir, 'e2e');

// Configuration files to check
const configFiles = {
  jest: path.join(e2eDir, 'jest.config.js'),
  detox: path.join(rootDir, '.detoxrc.js'),
  setup: path.join(e2eDir, 'setup.js'),
  teardown: path.join(e2eDir, 'teardown.js'),
  init: path.join(e2eDir, 'init.js'),
  batches: path.join(e2eDir, 'config', 'batches.js'),
  reporter: path.join(e2eDir, 'reporters', 'detox-reporter.js')
};

// Required test files to check
const requiredTestFiles = [
  path.join(e2eDir, 'tests', 'auth', 'registration.test.js'),
  path.join(e2eDir, 'tests', 'auth', 'login.test.js'),
  path.join(e2eDir, 'tests', 'auth', 'logout.test.js')
];

// Required environment variables or fallbacks
const requiredEnvVars = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'
];

// Test .env files
const envFiles = [
  path.join(rootDir, '.env.test'),
  path.join(rootDir, '.env')
];

// Results tracking
const results = {
  passed: [],
  failed: [],
  warnings: []
};

/**
 * Main validation function
 */
async function validateE2EConfig() {
  console.log('🧪 E2E Configuration Validator');
  console.log('==============================\n');
  
  // Check configuration files
  console.log('📋 Checking configuration files...');
  await checkConfigFiles();
  
  // Check test files
  console.log('\n📄 Checking test files...');
  await checkTestFiles();
  
  // Check environment variables
  console.log('\n🔑 Checking environment variables...');
  await checkEnvironmentVariables();
  
  // Check iOS build requirements
  console.log('\n🛠️  Checking build requirements...');
  await checkBuildRequirements();
  
  // Print summary
  printSummary();
}

/**
 * Check configuration files
 */
async function checkConfigFiles() {
  for (const [name, filePath] of Object.entries(configFiles)) {
    process.stdout.write(`  Checking ${name} configuration... `);
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ MISSING');
      results.failed.push(`${name} configuration file not found at: ${filePath}`);
      continue;
    }
    
    try {
      // Try to require the file to check syntax
      const config = require(filePath);
      
      // Additional validation for specific configs
      if (name === 'jest') {
        if (config.testEnvironment !== 'detox/runners/jest/testEnvironment') {
          results.warnings.push(`Jest testEnvironment should be 'detox/runners/jest/testEnvironment'`);
          console.log('⚠️  WARNING');
          continue;
        }
      }
      
      if (name === 'detox') {
        if (config.testRunner?.jest?.testEnvironment === 'node') {
          results.warnings.push(`Detox config has conflicting testEnvironment setting with Jest config`);
          console.log('⚠️  WARNING');
          continue;
        }
      }
      
      console.log('✅ VALID');
      results.passed.push(`${name} configuration is valid`);
    } catch (error) {
      console.log('❌ ERROR');
      results.failed.push(`Error loading ${name} configuration: ${error.message}`);
    }
  }
}

/**
 * Check test files
 */
async function checkTestFiles() {
  for (const filePath of requiredTestFiles) {
    const relativePath = path.relative(rootDir, filePath);
    process.stdout.write(`  Checking ${relativePath}... `);
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ MISSING');
      results.failed.push(`Test file not found: ${relativePath}`);
      continue;
    }
    
    try {
      // Read file content
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Basic syntax check (this won't catch all errors, but will catch obvious ones)
      new Function(content);
      
      // Check for common patterns in test files
      if (!content.includes('describe(') || !content.includes('it(')) {
        results.warnings.push(`Test file ${relativePath} may not contain proper Jest test structure`);
        console.log('⚠️  WARNING');
        continue;
      }
      
      console.log('✅ VALID');
      results.passed.push(`Test file ${relativePath} is valid`);
    } catch (error) {
      console.log('❌ ERROR');
      results.failed.push(`Error parsing test file ${relativePath}: ${error.message}`);
    }
  }
}

/**
 * Check environment variables
 */
async function checkEnvironmentVariables() {
  // Check .env files
  let envFileFound = false;
  
  for (const envFile of envFiles) {
    const relativePath = path.relative(rootDir, envFile);
    process.stdout.write(`  Checking ${relativePath}... `);
    
    if (fs.existsSync(envFile)) {
      console.log('✅ FOUND');
      results.passed.push(`Environment file ${relativePath} exists`);
      envFileFound = true;
      
      // Basic check of .env file content
      const content = fs.readFileSync(envFile, 'utf8');
      const missingVars = [];
      
      for (const envVar of requiredEnvVars) {
        if (!content.includes(envVar)) {
          missingVars.push(envVar);
        }
      }
      
      if (missingVars.length > 0) {
        results.warnings.push(`Environment file ${relativePath} is missing variables: ${missingVars.join(', ')}`);
        console.log(`  ⚠️  Missing variables: ${missingVars.join(', ')}`);
      }
    } else {
      console.log('❓ NOT FOUND');
    }
  }
  
  if (!envFileFound) {
    results.warnings.push('No .env or .env.test file found. Environment variables might be missing.');
  }
  
  // Check for fallbacks in setup.js
  process.stdout.write('  Checking environment variable fallbacks in setup.js... ');
  try {
    const setupPath = configFiles.setup;
    if (fs.existsSync(setupPath)) {
      const content = fs.readFileSync(setupPath, 'utf8');
      
      const hasFallbacks = requiredEnvVars.every(envVar => {
        return content.includes(`process.env.${envVar}`) && 
               (content.includes('mock') || content.includes('fallback') || 
                content.includes('placeholder') || content.includes('credentials not found'));
      });
      
      if (hasFallbacks) {
        console.log('✅ FOUND');
        results.passed.push('Setup script contains fallbacks for missing environment variables');
      } else {
        console.log('⚠️  LIMITED');
        results.warnings.push('Setup script may not handle missing environment variables gracefully');
      }
    } else {
      console.log('❌ MISSING');
      results.failed.push('Setup script not found, cannot check for environment variable fallbacks');
    }
  } catch (error) {
    console.log('❌ ERROR');
    results.failed.push(`Error checking environment variable fallbacks: ${error.message}`);
  }
}

/**
 * Check build requirements
 */
async function checkBuildRequirements() {
  // Check for Xcode (macOS only)
  if (process.platform === 'darwin') {
    process.stdout.write('  Checking for Xcode... ');
    try {
      const xcodeOutput = execSync('xcodebuild -version', { encoding: 'utf8' });
      const xcodeVersion = xcodeOutput.split('\n')[0];
      console.log(`✅ ${xcodeVersion}`);
      results.passed.push(`Xcode found: ${xcodeVersion}`);
    } catch (error) {
      console.log('❌ NOT FOUND');
      results.failed.push('Xcode not found or not properly configured');
    }
    
    // Check for iOS simulator
    process.stdout.write('  Checking for iOS simulator... ');
    try {
      const simulatorOutput = execSync('xcrun simctl list devices available', { encoding: 'utf8' });
      
      // Look for iPhone simulators
      if (simulatorOutput.includes('iPhone')) {
        console.log('✅ FOUND');
        results.passed.push('iOS simulators are available');
      } else {
        console.log('❌ NOT FOUND');
        results.failed.push('No iOS simulators found');
      }
    } catch (error) {
      console.log('❌ ERROR');
      results.failed.push('Error checking iOS simulators');
    }
  } else {
    console.log('  ⚠️  Not running on macOS, skipping Xcode and iOS simulator checks');
    results.warnings.push('Not running on macOS - iOS E2E tests require macOS');
  }
  
  // Check for Node modules
  process.stdout.write('  Checking for node_modules... ');
  const nodeModulesPath = path.join(rootDir, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    console.log('✅ FOUND');
    results.passed.push('node_modules directory exists');
    
    // Check for key dependencies
    const detoxPath = path.join(nodeModulesPath, 'detox');
    const jestPath = path.join(nodeModulesPath, 'jest');
    
    if (!fs.existsSync(detoxPath)) {
      results.warnings.push('Detox dependency not found in node_modules');
    }
    
    if (!fs.existsSync(jestPath)) {
      results.warnings.push('Jest dependency not found in node_modules');
    }
  } else {
    console.log('❌ MISSING');
    results.failed.push('node_modules directory not found. Run npm install first.');
  }
  
  // Check for iOS build directory
  process.stdout.write('  Checking for iOS build directory... ');
  const iosBuildPath = path.join(rootDir, 'ios', 'build');
  if (fs.existsSync(iosBuildPath)) {
    console.log('✅ FOUND');
    results.passed.push('iOS build directory exists');
    
    // Check for app binary
    const appBinaryPath = path.join(iosBuildPath, 'Build', 'Products', 'Debug-iphonesimulator', 'cardshowfinder.app');
    if (fs.existsSync(appBinaryPath)) {
      results.passed.push('iOS app binary exists');
    } else {
      results.warnings.push('iOS app binary not found. Run npm run test:e2e:build first.');
    }
  } else {
    console.log('❓ NOT FOUND');
    results.warnings.push('iOS build directory not found. App may need to be built first.');
  }
}

/**
 * Print summary of validation results
 */
function printSummary() {
  console.log('\n📊 Validation Summary');
  console.log('===================');
  console.log(`✅ Passed: ${results.passed.length} checks`);
  
  if (results.warnings.length > 0) {
    console.log(`⚠️  Warnings: ${results.warnings.length}`);
    console.log('\nWarnings:');
    results.warnings.forEach((warning, index) => {
      console.log(`  ${index + 1}. ${warning}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log(`❌ Failed: ${results.failed.length} checks`);
    console.log('\nFailed Checks:');
    results.failed.forEach((failure, index) => {
      console.log(`  ${index + 1}. ${failure}`);
    });
    
    console.log('\n⚠️  E2E configuration has issues that need to be fixed before running tests.');
    process.exit(1);
  } else if (results.warnings.length > 0) {
    console.log('\n⚠️  E2E configuration has warnings but may still work.');
    process.exit(0);
  } else {
    console.log('\n✅ E2E configuration looks good! You can now run the tests.');
    process.exit(0);
  }
}

// Run the validation
validateE2EConfig().catch(error => {
  console.error('Error running validation:', error);
  process.exit(1);
});
