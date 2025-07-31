#!/usr/bin/env node
/**
 * Simple Console.log Fixer
 * 
 * This script automatically converts console.log statements to console.warn or console.error
 * based on the context of the message in TypeScript files within the src/ directory.
 * 
 * Usage:
 *   node scripts/fix-console-logs-simple.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SRC_DIR = 'src';
const BACKUP_DIR = 'console-logs-backups';
const FILE_EXTENSIONS = ['.ts', '.tsx'];
const EXCLUDE_DIRS = [
  'node_modules',
  'automated-fixes-backups',
  'backups',
  'console-logs-backups',
  'import-export-fixes-backups',
  'lint-fix-backups',
  'lint-recovery-backups',
  'unused-cleanup-backups'
];

// Error keywords to identify error-related console.logs
const ERROR_KEYWORDS = [
  'error', 'exception', 'fail', 'failed', 'failure', 'crash', 'crashed',
  'critical', 'severe', 'fatal', 'panic', 'unexpected', 'invalid',
  'err:', 'error:', 'exception:', 'failed:', 'failure:'
];

// Statistics
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  consoleLogsToWarn: 0,
  consoleLogsToError: 0
};

/**
 * Creates a timestamped backup directory
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
 * Checks if a directory should be excluded
 */
function shouldExcludeDir(dirPath) {
  const dirName = path.basename(dirPath);
  return EXCLUDE_DIRS.includes(dirName);
}

/**
 * Finds all TypeScript files in a directory recursively
 */
function findTypeScriptFiles(dir, result = []) {
  if (!fs.existsSync(dir)) return result;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!shouldExcludeDir(fullPath)) {
        findTypeScriptFiles(fullPath, result);
      }
    } else if (entry.isFile() && FILE_EXTENSIONS.includes(path.extname(entry.name))) {
      result.push(fullPath);
    }
  }
  
  return result;
}

/**
 * Converts console.log to console.warn or console.error based on context
 */
function fixConsoleLogs(content) {
  let modified = content;
  let consoleLogToWarn = 0;
  let consoleLogToError = 0;
  
  // Regular expression to match console.log statements
  // This regex is designed to be conservative and only match clear console.log calls
  const consoleLogRegex = /console\.log\((.*?)(\);?)/g;
  
  // Replace console.log with console.warn or console.error based on context
  modified = modified.replace(consoleLogRegex, (match, args, ending) => {
    // Skip if it doesn't look like a standard console.log call
    if (!match.startsWith('console.log')) {
      return match;
    }
    
    // Check if this is an error-related log by looking for error keywords
    const isError = ERROR_KEYWORDS.some(keyword => 
      args.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (isError) {
      consoleLogToError++;
      return `console.error(${args}${ending}`;
    }
    
    // Otherwise, convert to warning
    consoleLogToWarn++;
    return `console.warn(${args}${ending}`;
  });
  
  stats.consoleLogsToWarn += consoleLogToWarn;
  stats.consoleLogsToError += consoleLogToError;
  
  return { 
    modified, 
    wasModified: consoleLogToWarn > 0 || consoleLogToError > 0 
  };
}

/**
 * Processes a single file
 */
function processFile(filePath, backupDir) {
  console.log(`Processing: ${filePath}`);
  
  // Read file content
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Apply fixes
  const { modified, wasModified } = fixConsoleLogs(content);
  
  // Update statistics
  stats.filesProcessed++;
  if (wasModified) {
    stats.filesModified++;
    
    // Create backup
    backupFile(filePath, backupDir);
    
    // Write modified content
    fs.writeFileSync(filePath, modified, 'utf8');
    console.log(`  ✅ Fixed console.log statements in: ${filePath}`);
  } else {
    console.log(`  ✓ No console.log issues found in: ${filePath}`);
  }
}

/**
 * Prints statistics
 */
function printStats() {
  console.log('\n========== Console.log Fix Statistics ==========');
  console.log(`Files processed:        ${stats.filesProcessed}`);
  console.log(`Files modified:         ${stats.filesModified}`);
  console.log(`console.log → warn:     ${stats.consoleLogsToWarn}`);
  console.log(`console.log → error:    ${stats.consoleLogsToError}`);
  console.log(`Total fixes:            ${stats.consoleLogsToWarn + stats.consoleLogsToError}`);
  console.log('===============================================');
}

/**
 * Main function
 */
function main() {
  console.log('=== Simple Console.log Fixer ===');
  
  // Create backup directory
  const backupDir = createBackupDir();
  
  // Find all TypeScript files in src directory
  console.log(`Finding TypeScript files in ${SRC_DIR}...`);
  const files = findTypeScriptFiles(SRC_DIR);
  console.log(`Found ${files.length} TypeScript files.`);
  
  // Process files
  for (const file of files) {
    processFile(file, backupDir);
  }
  
  // Print statistics
  printStats();
}

// Run the script
main();
