#!/usr/bin/env node
/**
 * load-env.js
 * 
 * Simple script to load environment variables from scraper/.env file.
 * Run this before other commands to ensure environment variables are set.
 * 
 * Usage:
 *   node load-env.js
 *   
 * After running this script, you can run other commands like:
 *   npm run scraper:inspect
 *   npm run scraper:csv
 */

const fs = require('fs');
const path = require('path');

// Define path to .env file in scraper folder
const envPath = path.join(__dirname, 'scraper', '.env');
const alternateEnvPath = path.join(__dirname, '.env');

console.log('🔍 Looking for environment file...');

// Check if .env file exists
if (!fs.existsSync(envPath) && !fs.existsSync(alternateEnvPath)) {
  console.error('❌ ERROR: No .env file found!');
  console.error('   Expected at: ' + envPath);
  console.error('   Or at: ' + alternateEnvPath);
  console.error('\n📝 Please create a .env file with your credentials:');
  console.error('   1. Copy scraper/.env.example to scraper/.env');
  console.error('   2. Edit scraper/.env and add your API keys');
  process.exit(1);
}

// Determine which file to use
const fileToUse = fs.existsSync(envPath) ? envPath : alternateEnvPath;
console.log(`✅ Found .env file at: ${fileToUse}`);

try {
  // Read the .env file
  const envFile = fs.readFileSync(fileToUse, 'utf8');
  const envLines = envFile.split('\n');
  
  let loadedVars = 0;
  
  // Process each line
  for (const line of envLines) {
    // Skip empty lines and comments
    if (!line || line.trim() === '' || line.startsWith('#')) {
      continue;
    }
    
    // Split line into key and value
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      // Remove quotes if present
      let value = match[2] || '';
      value = value.replace(/^['"]|['"]$/g, '');
      
      // Set environment variable
      process.env[key] = value;
      loadedVars++;
      
      // Show masked value for sensitive keys
      const displayValue = key.includes('KEY') || key.includes('SECRET') || key.includes('PASSWORD')
        ? value.substring(0, 4) + '...' + value.substring(value.length - 4)
        : value;
      
      console.log(`✅ Loaded: ${key}=${displayValue}`);
    }
  }
  
  console.log(`\n🎉 Successfully loaded ${loadedVars} environment variables!`);
  console.log('🚀 You can now run commands like:');
  console.log('   npm run scraper:inspect');
  console.log('   npm run scraper:csv');
  
  // Set a flag to indicate env vars are loaded
  process.env.ENV_LOADED = 'true';
  
} catch (error) {
  console.error(`❌ ERROR: Failed to load environment variables: ${error.message}`);
  process.exit(1);
}
