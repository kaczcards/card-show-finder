#!/usr/bin/env node
/**
 * Build Verification Script
 * Card-Show-Finder · July 2025
 * 
 * This script verifies that the build configuration is correct for both iOS and Android,
 * focusing on Hermes engine settings and architecture flags. It:
 * 
 * 1. Checks current configuration
 * 2. Runs expo prebuild --clean to regenerate native projects
 * 3. Verifies both iOS and Android have correct settings after regeneration
 * 
 * Usage:
 *   node scripts/test-build-verify.js [options]
 * 
 * Options:
 *   --verbose       Show detailed output
 *   --no-clean      Skip the prebuild clean step (faster, but less thorough)
 *   --fix           Automatically fix issues found
 *   --ci            CI mode (different output formatting)
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const EXPECTED_CONFIG = {
  android: {
    hermesEnabled: 'true',
    newArchEnabled: 'false'
  },
  ios: {
    jsEngine: 'hermes',
    newArchEnabled: 'false'
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  verbose: args.includes('--verbose'),
  noClean: args.includes('--no-clean'),
  fix: args.includes('--fix'),
  ci: args.includes('--ci')
};

// Timing and logging utilities
const startTime = Date.now();
const timers = {};

function startTimer(label) {
  timers[label] = Date.now();
  log(`🕒 Starting: ${label}...`);
}

function endTimer(label) {
  const duration = ((Date.now() - timers[label]) / 1000).toFixed(2);
  log(`✓ Completed: ${label} (${duration}s)`);
  return duration;
}

function log(message, type = 'info') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  
  if (options.ci && type === 'info') {
    console.log(`::debug::${message}`);
    return;
  }
  
  const prefix = {
    'info': '📝',
    'success': '✅',
    'warning': '⚠️',
    'error': '❌',
    'command': '🔧'
  }[type] || '📝';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function logSuccess(message) {
  log(message, 'success');
}

function logWarning(message) {
  log(message, 'warning');
}

function logError(message) {
  log(message, 'error');
  if (options.ci) {
    console.log(`::error::${message}`);
  }
}

function logCommand(command) {
  log(`Running: ${command}`, 'command');
}

// Execute a command and return its output
function execCommand(command, silent = false) {
  if (!silent) {
    logCommand(command);
  }
  
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit'
    });
    return { success: true, output };
  } catch (error) {
    if (!silent) {
      logError(`Command failed: ${command}`);
      logError(error.message);
    }
    return { success: false, error: error.message };
  }
}

// Check if a file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

// Read a property from a properties file
function readProperty(filePath, property) {
  if (!fileExists(filePath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = new RegExp(`${property}\\s*=\\s*([^\\s]+)`, 'i');
    const match = content.match(regex);
    return match ? match[1] : null;
  } catch (error) {
    logError(`Failed to read property ${property} from ${filePath}: ${error.message}`);
    return null;
  }
}

// Read a property from a JSON file
function readJsonProperty(filePath, property) {
  if (!fileExists(filePath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    
    // Handle nested properties like "expo.jsEngine"
    if (property.includes('.')) {
      const [parent, child] = property.split('.');
      return json[parent] ? json[parent][child] : null;
    }
    
    return json[property];
  } catch (error) {
    logError(`Failed to read JSON property ${property} from ${filePath}: ${error.message}`);
    return null;
  }
}

// Fix a property in a properties file
function fixProperty(filePath, property, value) {
  if (!fileExists(filePath)) {
    logError(`Cannot fix property ${property}: File ${filePath} does not exist`);
    return false;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const regex = new RegExp(`${property}\\s*=\\s*([^\\s]+)`, 'i');
    
    if (content.match(regex)) {
      // Replace existing property
      content = content.replace(regex, `${property}=${value}`);
    } else {
      // Add new property
      content += `\n${property}=${value}`;
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    logSuccess(`Fixed property ${property}=${value} in ${filePath}`);
    return true;
  } catch (error) {
    logError(`Failed to fix property ${property} in ${filePath}: ${error.message}`);
    return false;
  }
}

// Fix a property in a JSON file
function fixJsonProperty(filePath, property, value) {
  if (!fileExists(filePath)) {
    logError(`Cannot fix JSON property ${property}: File ${filePath} does not exist`);
    return false;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    
    // Handle nested properties like "expo.jsEngine"
    if (property.includes('.')) {
      const [parent, child] = property.split('.');
      if (!json[parent]) {
        json[parent] = {};
      }
      json[parent][child] = value;
    } else {
      json[property] = value;
    }
    
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
    logSuccess(`Fixed JSON property ${property}=${value} in ${filePath}`);
    return true;
  } catch (error) {
    logError(`Failed to fix JSON property ${property} in ${filePath}: ${error.message}`);
    return false;
  }
}

// Check Android configuration
function checkAndroidConfig() {
  startTimer('Android Configuration Check');
  
  const gradlePropertiesPath = path.join(process.cwd(), 'android', 'gradle.properties');
  
  if (!fileExists(gradlePropertiesPath)) {
    logWarning(`Android project not found at ${gradlePropertiesPath}`);
    return {
      exists: false,
      issues: ['Android project not found']
    };
  }
  
  const issues = [];
  const config = {
    hermesEnabled: readProperty(gradlePropertiesPath, 'hermesEnabled'),
    newArchEnabled: readProperty(gradlePropertiesPath, 'newArchEnabled')
  };
  
  // Check Hermes
  if (config.hermesEnabled !== EXPECTED_CONFIG.android.hermesEnabled) {
    const message = `Android Hermes should be "${EXPECTED_CONFIG.android.hermesEnabled}" but is "${config.hermesEnabled}"`;
    logError(message);
    issues.push(message);
    
    if (options.fix) {
      fixProperty(gradlePropertiesPath, 'hermesEnabled', EXPECTED_CONFIG.android.hermesEnabled);
    }
  } else {
    logSuccess(`Android Hermes correctly set to ${config.hermesEnabled}`);
  }
  
  // Check New Architecture
  if (config.newArchEnabled !== EXPECTED_CONFIG.android.newArchEnabled) {
    const message = `Android New Architecture should be "${EXPECTED_CONFIG.android.newArchEnabled}" but is "${config.newArchEnabled}"`;
    logError(message);
    issues.push(message);
    
    if (options.fix) {
      fixProperty(gradlePropertiesPath, 'newArchEnabled', EXPECTED_CONFIG.android.newArchEnabled);
    }
  } else {
    logSuccess(`Android New Architecture correctly set to ${config.newArchEnabled}`);
  }
  
  endTimer('Android Configuration Check');
  
  return {
    exists: true,
    config,
    issues,
    valid: issues.length === 0
  };
}

// Check iOS configuration
function checkIosConfig() {
  startTimer('iOS Configuration Check');
  
  const podfilePropertiesPath = path.join(process.cwd(), 'ios', 'Podfile.properties.json');
  
  if (!fileExists(podfilePropertiesPath)) {
    logWarning(`iOS project not found at ${podfilePropertiesPath}`);
    return {
      exists: false,
      issues: ['iOS project not found']
    };
  }
  
  const issues = [];
  const config = {
    jsEngine: readJsonProperty(podfilePropertiesPath, 'expo.jsEngine'),
    newArchEnabled: readJsonProperty(podfilePropertiesPath, 'newArchEnabled')
  };
  
  // Check JS Engine
  if (config.jsEngine !== EXPECTED_CONFIG.ios.jsEngine) {
    const message = `iOS JS Engine should be "${EXPECTED_CONFIG.ios.jsEngine}" but is "${config.jsEngine}"`;
    logError(message);
    issues.push(message);
    
    if (options.fix) {
      fixJsonProperty(podfilePropertiesPath, 'expo.jsEngine', EXPECTED_CONFIG.ios.jsEngine);
    }
  } else {
    logSuccess(`iOS JS Engine correctly set to ${config.jsEngine}`);
  }
  
  // Check New Architecture
  if (config.newArchEnabled !== EXPECTED_CONFIG.ios.newArchEnabled) {
    const message = `iOS New Architecture should be "${EXPECTED_CONFIG.ios.newArchEnabled}" but is "${config.newArchEnabled}"`;
    logError(message);
    issues.push(message);
    
    if (options.fix) {
      fixJsonProperty(podfilePropertiesPath, 'newArchEnabled', EXPECTED_CONFIG.ios.newArchEnabled);
    }
  } else {
    logSuccess(`iOS New Architecture correctly set to ${config.newArchEnabled}`);
  }
  
  endTimer('iOS Configuration Check');
  
  return {
    exists: true,
    config,
    issues,
    valid: issues.length === 0
  };
}

// Run expo prebuild --clean
function runPrebuild() {
  startTimer('Expo Prebuild');
  
  const result = execCommand('npx expo prebuild --clean');
  
  endTimer('Expo Prebuild');
  
  return result.success;
}

// Main function
async function main() {
  log('🚀 Starting Build Verification', 'info');
  log(`Mode: ${options.ci ? 'CI' : 'Local'}${options.verbose ? ' (Verbose)' : ''}${options.noClean ? ' (No Clean)' : ''}${options.fix ? ' (Auto-fix)' : ''}`, 'info');
  
  // Step 1: Check current configuration
  log('\n📋 STEP 1: Checking current configuration', 'info');
  const initialAndroidConfig = checkAndroidConfig();
  const initialIosConfig = checkIosConfig();
  
  const initialConfigValid = (
    (initialAndroidConfig.exists && initialAndroidConfig.valid) &&
    (initialIosConfig.exists && initialIosConfig.valid)
  );
  
  if (initialConfigValid) {
    logSuccess('Initial configuration is valid');
  } else {
    logWarning('Initial configuration has issues');
    
    if (options.fix) {
      log('Attempting to fix issues automatically...', 'info');
    } else {
      log('Run with --fix to automatically fix these issues', 'info');
    }
  }
  
  // Step 2: Run prebuild if needed
  if (!options.noClean) {
    log('\n📋 STEP 2: Running expo prebuild --clean', 'info');
    const prebuildSuccess = runPrebuild();
    
    if (!prebuildSuccess) {
      logError('Prebuild failed. Cannot continue verification.');
      process.exit(1);
    }
  } else {
    log('\n📋 STEP 2: Skipping prebuild (--no-clean)', 'info');
  }
  
  // Step 3: Verify configuration after prebuild
  log('\n📋 STEP 3: Verifying configuration after prebuild', 'info');
  const finalAndroidConfig = checkAndroidConfig();
  const finalIosConfig = checkIosConfig();
  
  const finalConfigValid = (
    (finalAndroidConfig.exists && finalAndroidConfig.valid) &&
    (finalIosConfig.exists && finalIosConfig.valid)
  );
  
  // Summary
  log('\n📊 VERIFICATION SUMMARY:', 'info');
  
  if (!options.noClean) {
    log(`Prebuild: ${initialConfigValid ? '✅ Successful' : '❌ Failed'}`, initialConfigValid ? 'success' : 'error');
  }
  
  log(`Android Configuration: ${finalAndroidConfig.valid ? '✅ Valid' : '❌ Invalid'}`, finalAndroidConfig.valid ? 'success' : 'error');
  if (finalAndroidConfig.issues.length > 0) {
    finalAndroidConfig.issues.forEach(issue => logError(`- ${issue}`));
  }
  
  log(`iOS Configuration: ${finalIosConfig.valid ? '✅ Valid' : '❌ Invalid'}`, finalIosConfig.valid ? 'success' : 'error');
  if (finalIosConfig.issues.length > 0) {
    finalIosConfig.issues.forEach(issue => logError(`- ${issue}`));
  }
  
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  log(`\n⏱️ Total verification time: ${totalDuration}s`, 'info');
  
  if (finalConfigValid) {
    logSuccess('\n✅ BUILD VERIFICATION PASSED: Configuration is valid for both platforms');
    process.exit(0);
  } else {
    logError('\n❌ BUILD VERIFICATION FAILED: Configuration issues detected');
    
    if (!options.fix) {
      log('Run with --fix to automatically fix these issues', 'info');
    }
    
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  logError(`Unhandled error: ${error.message}`);
  process.exit(1);
});
