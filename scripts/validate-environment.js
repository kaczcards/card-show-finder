#!/usr/bin/env node
/**
 * scripts/validate-environment.js
 * 
 * Validates all required environment variables for the Card Show Finder app.
 * This script ensures that all necessary configuration is in place for both
 * development and production environments.
 * 
 * Usage:
 *   node scripts/validate-environment.js [--production]
 *   
 * Options:
 *   --production  Validate against production requirements (stricter checks)
 *   --help        Show this help message
 */

// Import required packages
require('dotenv').config();
const chalk = require('chalk');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Configuration
const REQUIRED_VARS = {
  // Supabase
  EXPO_PUBLIC_SUPABASE_URL: { 
    pattern: /^https:\/\/.+\.supabase\.co$/, 
    description: 'Supabase project URL' 
  },
  EXPO_PUBLIC_SUPABASE_ANON_KEY: { 
    pattern: /^eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\./, 
    description: 'Supabase anonymous key' 
  },
  SUPABASE_SERVICE_KEY: { 
    pattern: /^eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\./, 
    description: 'Supabase service role key (admin access)' 
  },
  
  // Google Maps
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: { 
    pattern: /.+/, 
    description: 'Google Maps API key' 
  },
  
  // Optional but recommended for production
  EXPO_PUBLIC_SENTRY_DSN: { 
    pattern: /^https:\/\/.+@.+\.ingest\.sentry\.io\/.+$/, 
    description: 'Sentry DSN for error tracking',
    optional: true 
  },
  
  // Stripe (required for payment features)
  STRIPE_SECRET_KEY: { 
    pattern: /^(sk_test_|sk_live_)/, 
    description: 'Stripe secret key',
    productionPrefix: 'sk_live_',
    optional: true 
  },
  STRIPE_PUBLISHABLE_KEY: { 
    pattern: /^(pk_test_|pk_live_)/, 
    description: 'Stripe publishable key',
    productionPrefix: 'pk_live_',
    optional: true 
  },
  STRIPE_WEBHOOK_SECRET: { 
    pattern: /^whsec_/, 
    description: 'Stripe webhook signing secret',
    optional: true 
  },
  
  // MFA
  MFA_ENCRYPTION_KEY: { 
    pattern: /.{32,}/, 
    description: 'MFA encryption key (32+ chars)',
    optional: true 
  }
};

// Helper functions
function validateVariable(name, config, isProduction = false) {
  const value = process.env[name];
  
  // Check if variable exists
  if (!value) {
    if (config.optional) {
      return { 
        valid: true, 
        status: 'OPTIONAL', 
        message: `${config.description} not set (optional)` 
      };
    }
    return { 
      valid: false, 
      status: 'MISSING', 
      message: `${config.description} is required but not set` 
    };
  }
  
  // Check pattern
  if (config.pattern && !config.pattern.test(value)) {
    return { 
      valid: false, 
      status: 'INVALID', 
      message: `${config.description} format is invalid` 
    };
  }
  
  // Production-specific checks
  if (isProduction && config.productionPrefix && !value.startsWith(config.productionPrefix)) {
    return { 
      valid: false, 
      status: 'WARNING', 
      message: `${config.description} is not using production prefix (${config.productionPrefix})` 
    };
  }
  
  // Sensitive value - don't show in logs
  const isSensitive = name.includes('KEY') || name.includes('SECRET') || name.includes('PASSWORD');
  const displayValue = isSensitive 
    ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}` 
    : value;
  
  return { 
    valid: true, 
    status: 'OK', 
    message: `${config.description} is properly configured`,
    value: displayValue
  };
}

async function testSupabaseConnection() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!url || !anonKey || !serviceKey) {
    return {
      anon: { valid: false, message: 'Missing Supabase configuration' },
      service: { valid: false, message: 'Missing Supabase configuration' }
    };
  }
  
  // Test results
  const results = {
    anon: { valid: false, message: 'Connection failed' },
    service: { valid: false, message: 'Connection failed' }
  };
  
  try {
    // Test anon key connection
    const anonClient = createClient(url, anonKey);
    const { data: anonData, error: anonError } = await anonClient.from('shows').select('id').limit(1);
    
    if (!anonError) {
      results.anon = { 
        valid: true, 
        message: 'Successfully connected with anon key' 
      };
    } else {
      results.anon = { 
        valid: false, 
        message: `Anon key error: ${anonError.message}` 
      };
    }
  } catch (err) {
    results.anon = { 
      valid: false, 
      message: `Anon key connection error: ${err.message}` 
    };
  }
  
  try {
    // Test service key connection
    const serviceClient = createClient(url, serviceKey);
    const { data: serviceData, error: serviceError } = await serviceClient.from('shows').select('id').limit(1);
    
    if (!serviceError) {
      results.service = { 
        valid: true, 
        message: 'Successfully connected with service key' 
      };
    } else {
      results.service = { 
        valid: false, 
        message: `Service key error: ${serviceError.message}` 
      };
    }
  } catch (err) {
    results.service = { 
      valid: false, 
      message: `Service key connection error: ${err.message}` 
    };
  }
  
  return results;
}

async function testGoogleMapsKey() {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (!key) {
    return { valid: false, message: 'Google Maps API key not set' };
  }
  
  try {
    // Test with a simple geocoding request
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=${key}`
    );
    
    if (response.data.status === 'OK') {
      return { valid: true, message: 'Google Maps API key is valid' };
    } else {
      return { 
        valid: false, 
        message: `Google Maps API error: ${response.data.status}` 
      };
    }
  } catch (err) {
    return { 
      valid: false, 
      message: `Google Maps API request failed: ${err.message}` 
    };
  }
}

async function validateEnvironment(isProduction = false) {
  console.log(chalk.bold(`\n🔍 Validating ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} environment variables\n`));
  
  let hasErrors = false;
  let warnings = 0;
  
  // Check all required variables
  console.log(chalk.bold('📋 Checking required environment variables:'));
  for (const [name, config] of Object.entries(REQUIRED_VARS)) {
    const result = validateVariable(name, config, isProduction);
    
    if (result.valid) {
      if (result.status === 'OPTIONAL') {
        console.log(`  ${chalk.yellow('⚠️')} ${chalk.dim(name)}: ${chalk.yellow(result.status)} - ${result.message}`);
      } else {
        console.log(`  ${chalk.green('✓')} ${chalk.bold(name)}: ${chalk.green(result.status)} - ${result.message} ${result.value ? `(${result.value})` : ''}`);
      }
    } else {
      if (result.status === 'WARNING') {
        warnings++;
        console.log(`  ${chalk.yellow('⚠️')} ${chalk.bold(name)}: ${chalk.yellow(result.status)} - ${result.message}`);
      } else {
        hasErrors = true;
        console.log(`  ${chalk.red('✗')} ${chalk.bold(name)}: ${chalk.red(result.status)} - ${result.message}`);
      }
    }
  }
  
  // Test connections
  console.log(chalk.bold('\n🔌 Testing connections:'));
  
  // Test Supabase connection
  console.log(chalk.bold('  Supabase:'));
  const supabaseResults = await testSupabaseConnection();
  
  if (supabaseResults.anon.valid) {
    console.log(`    ${chalk.green('✓')} Anon Key: ${chalk.green('OK')} - ${supabaseResults.anon.message}`);
  } else {
    hasErrors = true;
    console.log(`    ${chalk.red('✗')} Anon Key: ${chalk.red('FAILED')} - ${supabaseResults.anon.message}`);
  }
  
  if (supabaseResults.service.valid) {
    console.log(`    ${chalk.green('✓')} Service Key: ${chalk.green('OK')} - ${supabaseResults.service.message}`);
  } else {
    hasErrors = true;
    console.log(`    ${chalk.red('✗')} Service Key: ${chalk.red('FAILED')} - ${supabaseResults.service.message}`);
  }
  
  // Test Google Maps API
  console.log(chalk.bold('  Google Maps:'));
  const mapsResult = await testGoogleMapsKey();
  
  if (mapsResult.valid) {
    console.log(`    ${chalk.green('✓')} API Key: ${chalk.green('OK')} - ${mapsResult.message}`);
  } else {
    hasErrors = true;
    console.log(`    ${chalk.red('✗')} API Key: ${chalk.red('FAILED')} - ${mapsResult.message}`);
  }
  
  // Summary
  console.log(chalk.bold('\n📊 Validation Summary:'));
  if (hasErrors) {
    console.log(chalk.red(`  ❌ FAILED: Environment is NOT properly configured for ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`));
    console.log(chalk.red(`  Please fix the errors above before proceeding.`));
  } else if (warnings > 0) {
    console.log(chalk.yellow(`  ⚠️ PASSED WITH WARNINGS: Environment is configured but has ${warnings} warning(s)`));
    if (isProduction) {
      console.log(chalk.yellow(`  Consider addressing warnings before deploying to production.`));
    }
  } else {
    console.log(chalk.green(`  ✅ PASSED: Environment is properly configured for ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`));
  }
  
  return !hasErrors;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Usage: node scripts/validate-environment.js [--production]

Options:
  --production  Validate against production requirements (stricter checks)
  --help        Show this help message
    `);
    process.exit(0);
  }
  
  const isProduction = args.includes('--production');
  
  try {
    const valid = await validateEnvironment(isProduction);
    process.exit(valid ? 0 : 1);
  } catch (error) {
    console.error(chalk.red(`\n❌ Validation failed with error: ${error.message}`));
    if (error.stack) {
      console.error(chalk.dim(error.stack));
    }
    process.exit(1);
  }
}

// Run the script
main();
