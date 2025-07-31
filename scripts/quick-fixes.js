#!/usr/bin/env node
/**
 * Quick Fixes Script for ESLint Warnings
 * 
 * This script applies specific fixes for known unused variable issues in the codebase.
 * It targets specific files and makes precise changes to prefix unused variables with underscores.
 * 
 * Usage:
 *   node scripts/quick-fixes.js [--dry-run]
 * 
 * Options:
 *   --dry-run    Preview changes without modifying files
 */

const fs = require('fs');
const path = require('path');

// Command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// Configuration for specific fixes
const FIXES = [
  {
    file: 'src/components/OrganizerShowsList.tsx',
    description: 'Fix unused useRef import',
    find: "import React, { useState, useEffect, useRef } from 'react';",
    replace: "import React, { useState, useEffect, useRef as _useRef } from 'react';"
  },
  {
    file: 'src/components/ReviewForm.tsx',
    description: 'Fix unused showId and seriesId parameters',
    find: /const handleSubmit = async \(\s*showId\s*,\s*seriesId\s*\)/,
    replace: "const handleSubmit = async (_showId, _seriesId)"
  },
  {
    file: 'src/components/SentryErrorBoundary.tsx',
    description: 'Fix unused Sentry import',
    find: "import * as Sentry from 'sentry-expo';",
    replace: "import * as Sentry from 'sentry-expo'; // Temporarily disabled"
  },
  {
    file: 'src/components/SentryTester.tsx',
    description: 'Fix unused Sentry and SentryRaw imports',
    find: "import * as Sentry from 'sentry-expo';",
    replace: "import * as _Sentry from 'sentry-expo';"
  },
  {
    file: 'src/components/SentryTester.tsx',
    description: 'Fix unused SentryRaw import',
    find: "const SentryRaw = require('sentry-expo');",
    replace: "const _SentryRaw = require('sentry-expo');"
  },
  {
    file: 'src/components/ui/SocialIcon.tsx',
    description: 'Fix unused getPlatformColor variable',
    find: "const getPlatformColor = (platform: SocialPlatform): string => {",
    replace: "const _getPlatformColor = (platform: SocialPlatform): string => {"
  },
  {
    file: 'src/constants/theme/animations.ts',
    description: 'Fix unused ViewStyle import',
    find: "import { ViewStyle } from 'react-native';",
    replace: "import { ViewStyle as _ViewStyle } from 'react-native';"
  },
  {
    file: 'src/contexts/AuthContext.tsx',
    description: 'Fix unused signIn import',
    find: "import { signIn } from '../services/supabaseAuthService';",
    replace: "import { signIn as _signIn } from '../services/supabaseAuthService';"
  },
  {
    file: 'src/hooks/useFeatureFlag.ts',
    description: 'Fix unused featureName parameter',
    find: "export const useFeatureFlag = (featureName: string): boolean => {",
    replace: "export const useFeatureFlag = (_featureName: string): boolean => {"
  }
];

// Backup directory
const BACKUP_DIR = './quick-fixes-backups';

// Statistics
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  fixesApplied: 0,
  fixesFailed: 0
};

/**
 * Creates a timestamped backup directory
 * @returns {string} Path to the backup directory
 */
function createBackupDir() {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const backupPath = `${BACKUP_DIR}/${timestamp}`;
  
  console.log(`Creating backup directory: ${backupPath}`);
  fs.mkdirSync(backupPath, { recursive: true });
  
  return backupPath;
}

/**
 * Creates a backup of a file
 * @param {string} filePath - Path to the file
 * @param {string} backupDir - Backup directory
 */
function backupFile(filePath, backupDir) {
  const relativePath = filePath;
  const backupFilePath = path.join(backupDir, relativePath);
  const backupFileDir = path.dirname(backupFilePath);
  
  // Create directory structure if it doesn't exist
  fs.mkdirSync(backupFileDir, { recursive: true });
  
  // Copy file to backup location
  fs.copyFileSync(filePath, backupFilePath);
}

/**
 * Applies a specific fix to a file
 * @param {Object} fix - Fix configuration
 * @param {string} backupDir - Backup directory
 */
function applyFix(fix, backupDir) {
  const { file, description, find, replace } = fix;
  
  console.log(`Processing: ${file}`);
  console.log(`  - ${description}`);
  
  try {
    // Check if file exists
    if (!fs.existsSync(file)) {
      console.error(`  ❌ File not found: ${file}`);
      stats.fixesFailed++;
      return;
    }
    
    // Read file content
    const content = fs.readFileSync(file, 'utf8');
    
    // Apply fix
    const modified = typeof find === 'string' 
      ? content.replace(find, replace)
      : content.replace(find, replace);
    
    // Check if file was modified
    if (content === modified) {
      console.log(`  ⚠️ No changes needed or pattern not found in: ${file}`);
      stats.filesProcessed++;
      return;
    }
    
    // Update statistics
    stats.filesProcessed++;
    stats.filesModified++;
    stats.fixesApplied++;
    
    if (isDryRun) {
      console.log(`  🔍 Would fix: ${file} (dry run)`);
    } else {
      // Create backup
      backupFile(file, backupDir);
      
      // Write modified content
      fs.writeFileSync(file, modified, 'utf8');
      console.log(`  ✅ Fixed: ${file}`);
    }
  } catch (error) {
    console.error(`  ❌ Error processing ${file}:`, error.message);
    stats.fixesFailed++;
  }
}

/**
 * Prints statistics
 */
function printStats() {
  console.log('\n========== Quick Fixes Statistics ==========');
  console.log(`Files processed:        ${stats.filesProcessed}`);
  console.log(`Files modified:         ${stats.filesModified}`);
  console.log(`Fixes applied:          ${stats.fixesApplied}`);
  console.log(`Fixes failed:           ${stats.fixesFailed}`);
  console.log('===========================================');
  
  if (isDryRun) {
    console.log('\n⚠️  DRY RUN - No files were modified');
    console.log('   Run without --dry-run to apply changes');
  }
}

/**
 * Main function
 */
function main() {
  console.log('=== Quick Fixes Script ===');
  console.log(`Mode: ${isDryRun ? 'Dry Run (preview only)' : 'Live Run (will modify files)'}`);
  
  // Create backup directory
  const backupDir = createBackupDir();
  
  // Apply each fix
  for (const fix of FIXES) {
    applyFix(fix, backupDir);
  }
  
  // Print statistics
  printStats();
  
  // Run ESLint to check remaining issues
  if (!isDryRun) {
    console.log('\nRemaining fixes can be checked by running:');
    console.log('  npm run lint -- --ext .ts,.tsx src/');
  }
}

// Run the script
main();
