#!/usr/bin/env node
/**
 * Supabase Database Backup Status Verification Script
 * ==================================================
 * 
 * This script verifies the backup status of your Supabase project by
 * querying the Supabase Management API. It checks both standard backups
 * and Point-in-Time Recovery (PITR) status if enabled.
 * 
 * Prerequisites:
 * -------------
 * 1. Node.js installed (v14+)
 * 2. Supabase access token with admin privileges
 * 3. Your Supabase project reference ID
 * 
 * Setup:
 * ------
 * 1. Create a personal access token:
 *    - Go to https://app.supabase.com/account/tokens
 *    - Click "Generate New Token"
 *    - Give it a name like "backup-verification"
 *    - Copy the token immediately (it won't be shown again)
 * 
 * 2. Find your project reference ID:
 *    - Go to your project dashboard
 *    - Click "Project Settings" in the sidebar
 *    - The reference ID is shown at the top (format: abcdefghijklm)
 * 
 * Usage:
 * ------
 * Run directly:
 *   SUPABASE_ACCESS_TOKEN=your_token PROJECT_REF=your_project_ref node verify_backup_status.js
 * 
 * Or save credentials in .env file and run:
 *   node verify_backup_status.js
 * 
 * Output:
 * -------
 * The script will output backup status information including:
 * - Last successful backup time
 * - Backup configuration details
 * - PITR status and retention period (if enabled)
 * - Any warnings or errors detected
 */

// Import required modules
const https = require('https');
const fs = require('fs');
const path = require('path');

// Try to load environment variables from .env file if it exists
try {
  if (fs.existsSync(path.join(__dirname, '.env'))) {
    require('dotenv').config();
  }
} catch (err) {
  console.log('No .env file found, using environment variables');
}

// Configuration - get from environment variables
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.PROJECT_REF;
const MANAGEMENT_API_URL = 'api.supabase.com';

// Validate required environment variables
if (!SUPABASE_ACCESS_TOKEN || !PROJECT_REF) {
  console.error('\x1b[31mError: Missing required environment variables\x1b[0m');
  console.error('Please set the following environment variables:');
  console.error('  - SUPABASE_ACCESS_TOKEN: Your Supabase access token');
  console.error('  - PROJECT_REF: Your Supabase project reference ID');
  console.error('\nExample usage:');
  console.error('  SUPABASE_ACCESS_TOKEN=your_token PROJECT_REF=your_project_ref node verify_backup_status.js');
  console.error('\nOr create a .env file with these variables.');
  process.exit(1);
}

/**
 * Make an authenticated request to the Supabase Management API
 * @param {string} path - API endpoint path
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @returns {Promise<Object>} - Response data as JSON
 */
function makeApiRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: MANAGEMENT_API_URL,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`Failed to parse API response: ${err.message}`));
          }
        } else {
          reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`API request error: ${error.message}`));
    });
    
    req.end();
  });
}

/**
 * Format a date string for display
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date string
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return date.toLocaleString();
}

/**
 * Check standard backup status
 * @returns {Promise<Object>} - Backup status information
 */
async function checkStandardBackups() {
  try {
    const backups = await makeApiRequest(`/v1/projects/${PROJECT_REF}/database/backups`);
    
    if (!backups || !Array.isArray(backups)) {
      return { error: 'Invalid response from backups API' };
    }
    
    // Sort backups by creation date (newest first)
    const sortedBackups = backups.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
    
    const latestBackup = sortedBackups[0];
    
    return {
      enabled: backups.length > 0,
      count: backups.length,
      latest: latestBackup ? {
        id: latestBackup.id,
        created_at: formatDate(latestBackup.created_at),
        status: latestBackup.status
      } : null,
      all_backups: sortedBackups.map(backup => ({
        id: backup.id,
        created_at: formatDate(backup.created_at),
        status: backup.status
      }))
    };
  } catch (error) {
    return { error: `Failed to check standard backups: ${error.message}` };
  }
}

/**
 * Check PITR (Point-in-Time Recovery) status
 * @returns {Promise<Object>} - PITR status information
 */
async function checkPitrStatus() {
  try {
    const config = await makeApiRequest(`/v1/projects/${PROJECT_REF}/database/recovery`);
    
    if (!config) {
      return { error: 'Invalid response from PITR API' };
    }
    
    return {
      enabled: config.point_in_time_recovery_enabled === true,
      retention_days: config.wal_retention_days || 0,
      earliest_recovery_time: formatDate(config.earliest_recovery_time)
    };
  } catch (error) {
    return { error: `Failed to check PITR status: ${error.message}` };
  }
}

/**
 * Check project details to verify it exists and is accessible
 * @returns {Promise<Object>} - Project information
 */
async function checkProjectDetails() {
  try {
    const project = await makeApiRequest(`/v1/projects/${PROJECT_REF}`);
    
    if (!project || !project.id) {
      return { error: 'Invalid response from projects API' };
    }
    
    return {
      name: project.name,
      organization_id: project.organization_id,
      region: project.region,
      status: project.status
    };
  } catch (error) {
    return { error: `Failed to check project details: ${error.message}` };
  }
}

/**
 * Main function to run all checks
 */
async function runBackupVerification() {
  console.log('\x1b[36m=== Supabase Backup Status Verification ===\x1b[0m');
  console.log(`Project Reference: ${PROJECT_REF}`);
  console.log('Checking backup status...\n');
  
  try {
    // Check if project exists and is accessible
    const projectDetails = await checkProjectDetails();
    if (projectDetails.error) {
      console.error(`\x1b[31mProject check failed: ${projectDetails.error}\x1b[0m`);
      console.error('Please verify your PROJECT_REF and access token permissions.');
      process.exit(1);
    }
    
    console.log('\x1b[32m✓ Project accessible\x1b[0m');
    console.log(`  Name: ${projectDetails.name}`);
    console.log(`  Region: ${projectDetails.region}`);
    console.log(`  Status: ${projectDetails.status}`);
    console.log('');
    
    // Check standard backups
    const standardBackups = await checkStandardBackups();
    if (standardBackups.error) {
      console.error(`\x1b[31mStandard backup check failed: ${standardBackups.error}\x1b[0m`);
    } else {
      console.log('\x1b[36m=== Standard Backups ===\x1b[0m');
      console.log(`  Enabled: ${standardBackups.enabled ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'}`);
      console.log(`  Total backups: ${standardBackups.count}`);
      
      if (standardBackups.latest) {
        console.log('  Latest backup:');
        console.log(`    Created: ${standardBackups.latest.created_at}`);
        console.log(`    Status: ${standardBackups.latest.status === 'COMPLETED' ? 
          '\x1b[32m' + standardBackups.latest.status + '\x1b[0m' : 
          '\x1b[31m' + standardBackups.latest.status + '\x1b[0m'}`);
      } else {
        console.log('  \x1b[33mWarning: No backups found\x1b[0m');
      }
      
      // Alert if no recent backup (within 48 hours)
      if (standardBackups.latest) {
        const latestBackupTime = new Date(standardBackups.latest.created_at).getTime();
        const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
        
        if (latestBackupTime < twoDaysAgo) {
          console.log('  \x1b[33mWarning: Latest backup is more than 48 hours old\x1b[0m');
        }
      }
    }
    
    console.log('');
    
    // Check PITR status
    const pitrStatus = await checkPitrStatus();
    if (pitrStatus.error) {
      console.error(`\x1b[31mPITR check failed: ${pitrStatus.error}\x1b[0m`);
    } else {
      console.log('\x1b[36m=== Point-in-Time Recovery (PITR) ===\x1b[0m');
      console.log(`  Enabled: ${pitrStatus.enabled ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'}`);
      
      if (pitrStatus.enabled) {
        console.log(`  Retention period: ${pitrStatus.retention_days} days`);
        console.log(`  Earliest recovery point: ${pitrStatus.earliest_recovery_time}`);
        
        // Check if retention meets requirements (30 days)
        if (pitrStatus.retention_days < 30) {
          console.log(`  \x1b[33mWarning: Retention period (${pitrStatus.retention_days} days) is less than required (30 days)\x1b[0m`);
        }
      } else {
        console.log('  \x1b[33mWarning: PITR is not enabled. Weekly backups with 30-day retention requires PITR.\x1b[0m');
        console.log('  Consider upgrading to Pro plan and enabling PITR for better backup coverage.');
      }
    }
    
    console.log('\n\x1b[36m=== Summary ===\x1b[0m');
    
    // Determine overall status
    const hasStandardBackups = standardBackups.enabled && standardBackups.latest && standardBackups.latest.status === 'COMPLETED';
    const hasPitr = pitrStatus.enabled && pitrStatus.retention_days >= 30;
    
    if (hasPitr) {
      console.log('\x1b[32m✓ Backup configuration meets requirements (PITR enabled with 30+ days retention)\x1b[0m');
    } else if (hasStandardBackups) {
      console.log('\x1b[33m⚠ Basic backups available but may not meet requirements (standard backups only)\x1b[0m');
      console.log('  Recommendation: Enable PITR with 30-day retention for full compliance with backup policy');
    } else {
      console.log('\x1b[31m✗ Backup configuration does not meet requirements\x1b[0m');
      console.log('  Action required: Enable PITR with 30-day retention');
    }
    
    console.log('\nVerification completed at:', new Date().toLocaleString());
    
  } catch (error) {
    console.error('\x1b[31mVerification failed with an unexpected error:\x1b[0m', error);
    process.exit(1);
  }
}

// Run the verification
runBackupVerification();
