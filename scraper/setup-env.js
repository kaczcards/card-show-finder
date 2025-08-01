#!/usr/bin/env node
/**
 * scraper/setup-env.js
 * 
 * Environment setup helper for the scraper system.
 * This script:
 * 1. Loads environment variables from .env file
 * 2. Maps them to the correct names used by the scraper
 * 3. Provides functions to set up and validate the environment
 * 
 * Usage:
 *   const setupEnv = require('./scraper/setup-env');
 *   
 *   // Check if environment is valid (throws error if not)
 *   setupEnv.checkEnvironment();
 *   
 *   // Set up environment variables (returns true if successful)
 *   const isSetup = setupEnv.setupEnvironment();
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Define environment variable mappings
const ENV_MAPPINGS = {
  // Supabase credentials
  SUPABASE_URL: 'EXPO_PUBLIC_SUPABASE_URL',
  SUPABASE_SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_KEY',
  
  // API keys
  GOOGLE_MAPS_API_KEY: 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
  GOOGLE_AI_KEY: 'GOOGLE_AI_KEY',  // Keep original name if present
};

// Required environment variables for the scraper
const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

// Optional but recommended variables
const RECOMMENDED_VARS = [
  'GOOGLE_MAPS_API_KEY',  // Required for geocoding
  'GOOGLE_AI_KEY'         // Required for AI-powered extraction
];

/**
 * Load environment variables from .env file
 * @returns {boolean} True if .env file was loaded successfully
 */
function loadEnvFile() {
  try {
    // Try to find .env file in project root
    const envPath = path.resolve(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      console.warn('Warning: .env file not found at:', envPath);
      return false;
    }
    
    // Load .env file
    const result = dotenv.config({ path: envPath });
    
    if (result.error) {
      console.warn('Warning: Error loading .env file:', result.error.message);
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn('Warning: Failed to load .env file:', error.message);
    return false;
  }
}

/**
 * Check if all required environment variables are set
 * @param {boolean} strict If true, throws error for missing variables
 * @returns {object} Object with validation results
 */
function checkEnvironment(strict = true) {
  const missing = [];
  const recommended = [];
  
  // Check required variables
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  // Check recommended variables
  for (const varName of RECOMMENDED_VARS) {
    if (!process.env[varName]) {
      recommended.push(varName);
    }
  }
  
  const isValid = missing.length === 0;
  
  // Handle missing required variables
  if (!isValid && strict) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please set these variables in your .env file or environment.'
    );
  }
  
  // Log warnings for recommended variables
  if (recommended.length > 0) {
    console.warn(
      `Warning: Missing recommended environment variables: ${recommended.join(', ')}\n` +
      'Some features may not work properly without these variables.'
    );
  }
  
  return {
    isValid,
    missing,
    recommended: recommended.length > 0 ? recommended : null
  };
}

/**
 * Set up environment variables for the scraper
 * @param {boolean} verbose If true, logs detailed information
 * @returns {boolean} True if setup was successful
 */
function setupEnvironment(verbose = false) {
  // Load .env file first
  loadEnvFile();
  
  // Map environment variables
  let mappedCount = 0;
  
  for (const [targetVar, sourceVar] of Object.entries(ENV_MAPPINGS)) {
    // Skip if target variable is already set
    if (process.env[targetVar]) {
      if (verbose) {
        console.log(`Environment variable ${targetVar} is already set.`);
      }
      continue;
    }
    
    // Try to map from source variable
    if (process.env[sourceVar]) {
      process.env[targetVar] = process.env[sourceVar];
      mappedCount++;
      
      if (verbose) {
        console.log(`Mapped ${sourceVar} → ${targetVar}`);
      }
    }
  }
  
  if (verbose) {
    console.log(`Mapped ${mappedCount} environment variables.`);
  }
  
  // Check if environment is valid
  try {
    const { isValid, missing, recommended } = checkEnvironment(false);
    
    if (!isValid) {
      console.error(`Error: Missing required environment variables: ${missing.join(', ')}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking environment:', error.message);
    return false;
  }
}

/**
 * Print current environment status
 */
function printEnvironmentStatus() {
  console.log('\nEnvironment Variables Status:');
  console.log('============================');
  
  // Check required variables
  console.log('\nRequired Variables:');
  for (const varName of REQUIRED_VARS) {
    const status = process.env[varName] ? '✓ Set' : '✗ Missing';
    console.log(`  ${varName}: ${status}`);
  }
  
  // Check recommended variables
  console.log('\nRecommended Variables:');
  for (const varName of RECOMMENDED_VARS) {
    const status = process.env[varName] ? '✓ Set' : '⚠ Missing';
    console.log(`  ${varName}: ${status}`);
  }
  
  console.log('\n');
}

// Run setup if this script is executed directly
if (require.main === module) {
  console.log('Setting up environment for scraper...');
  const success = setupEnvironment(true);
  
  if (success) {
    console.log('Environment setup successful.');
    printEnvironmentStatus();
  } else {
    console.error('Environment setup failed.');
    process.exit(1);
  }
}

module.exports = {
  loadEnvFile,
  checkEnvironment,
  setupEnvironment,
  printEnvironmentStatus
};
