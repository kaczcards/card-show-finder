#!/usr/bin/env node

/**
 * geocode-shows.js
 * 
 * CLI wrapper for geocodeExistingShows.ts script
 * This script geocodes all shows in the database that have addresses but missing coordinates
 * 
 * Usage:
 *   node geocode-shows.js [options]
 * 
 * Options:
 *   --batch-size, -b    Number of shows to process in each batch (default: 5)
 *   --delay, -d         Delay in milliseconds between requests (default: 1000)
 *   --help, -h          Show this help message
 */

// Import required modules
const path = require('path');
const chalk = require('chalk');
const { spawn } = require('child_process');
require('ts-node/register');

// Parse command line arguments
const args = process.argv.slice(2);
let batchSize = 5;
let delay = 1000;
let showHelp = false;

// Process arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--help' || arg === '-h') {
    showHelp = true;
  } else if (arg === '--batch-size' || arg === '-b') {
    if (i + 1 < args.length) {
      const value = parseInt(args[i + 1], 10);
      if (!isNaN(value) && value > 0) {
        batchSize = value;
        i++; // Skip the next argument as we've already processed it
      } else {
        console.error(chalk.red('Error: Batch size must be a positive number'));
        process.exit(1);
      }
    }
  } else if (arg === '--delay' || arg === '-d') {
    if (i + 1 < args.length) {
      const value = parseInt(args[i + 1], 10);
      if (!isNaN(value) && value >= 0) {
        delay = value;
        i++; // Skip the next argument as we've already processed it
      } else {
        console.error(chalk.red('Error: Delay must be a non-negative number'));
        process.exit(1);
      }
    }
  }
}

// Show help message if requested or if no arguments provided
if (showHelp) {
  console.log(chalk.bold('\nCard Show Finder - Geocode Existing Shows\n'));
  console.log('This script geocodes all shows in the database that have addresses but missing coordinates.\n');
  console.log(chalk.yellow('Usage:'));
  console.log('  node geocode-shows.js [options]\n');
  console.log(chalk.yellow('Options:'));
  console.log('  --batch-size, -b    Number of shows to process in each batch (default: 5)');
  console.log('  --delay, -d         Delay in milliseconds between requests (default: 1000)');
  console.log('  --help, -h          Show this help message\n');
  console.log(chalk.yellow('Examples:'));
  console.log('  node geocode-shows.js');
  console.log('  node geocode-shows.js --batch-size 10 --delay 2000\n');
  process.exit(0);
}

// Display execution parameters
console.log(chalk.bold('\n=== Card Show Finder - Geocoding Existing Shows ===\n'));
console.log(chalk.cyan('Parameters:'));
console.log(`  Batch Size: ${chalk.green(batchSize)}`);
console.log(`  Delay: ${chalk.green(delay)}ms\n`);

// Path to the TypeScript script
const scriptPath = path.join(__dirname, 'src', 'scripts', 'geocodeExistingShows.ts');

// Execute the TypeScript script with ts-node
console.log(chalk.cyan('Starting geocoding process...\n'));

// Use ts-node to execute the TypeScript file directly
try {
  // Create a new process for the TypeScript script
  const tsProcess = spawn('npx', ['ts-node', scriptPath, batchSize.toString(), delay.toString()], {
    stdio: 'inherit',
    shell: true
  });

  // Handle process completion
  tsProcess.on('close', (code) => {
    if (code === 0) {
      console.log(chalk.green.bold('\n✅ Geocoding process completed successfully!'));
    } else {
      console.error(chalk.red.bold(`\n❌ Geocoding process failed with code ${code}`));
    }
  });

  // Handle process errors
  tsProcess.on('error', (err) => {
    console.error(chalk.red.bold('\n❌ Failed to start geocoding process:'), err);
  });
} catch (error) {
  console.error(chalk.red.bold('\n❌ Error executing TypeScript script:'), error);
  process.exit(1);
}
