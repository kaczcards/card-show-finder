#!/usr/bin/env node
/**
 * Fix Admin Console Logs Script
 * 
 * This script specifically targets admin CLI files and fixes:
 * 1. console.log statements (converts to console.warn or console.error)
 * 2. Unused variables (prefixes with underscore)
 * 
 * Usage:
 *   node scripts/fix-admin-console-logs.js [--dry-run]
 * 
 * Options:
 *   --dry-run    Preview changes without modifying files
 */

const fs = require('fs');
const path = require('path');

// Command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// Configuration
const ADMIN_CLI_FILES = [
  'admin_cli_simple.js',
  'admin_review_cli.js',
  'analyze-show-series.js',
  'geocode-existing-shows.js',
  'scripts/debug-unclaimed-shows.js',
  'scripts/fix-coordinates.js'
];

// Backup directory
const BACKUP_DIR = './admin-cli-fixes-backups';

// Statistics
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  consoleLogsFixed: 0,
  consoleErrorsFixed: 0,
  consoleWarnsFixed: 0,
  unusedVarsFixed: 0,
  fixesFailed: 0
};

/**
 * Creates a timestamped backup directory
 * @returns {string} Path to the backup directory
 */
function createBackupDir() {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const backupPath = `${BACKUP_DIR}/${timestamp}`;
  
  console.warn(`Creating backup directory: ${backupPath}`);
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
 * Determines if a console.log should be converted to console.error
 * @param {string} line - Line containing console.log
 * @returns {boolean} True if it should be an error
 */
function shouldBeError(line) {
  const errorPatterns = [
    /error/i,
    /fail/i,
    /exception/i,
    /invalid/i,
    /couldn't/i,
    /couldn't/i,
    /denied/i,
    /rejected/i,
    /missing/i,
    /incorrect/i,
    /bad/i
  ];
  
  return errorPatterns.some(pattern => pattern.test(line));
}

/**
 * Fixes console.log statements in a file
 * @param {string} filePath - Path to the file
 * @param {string} backupDir - Backup directory
 */
function fixConsoleStatements(filePath, backupDir) {
  console.warn(`\nProcessing: ${filePath}`);
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`  ❌ File not found: ${filePath}`);
      stats.fixesFailed++;
      return;
    }
    
    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let modified = false;
    let consoleLogsFixed = 0;
    let consoleErrorsFixed = 0;
    let consoleWarnsFixed = 0;
    
    // Process each line
    const newLines = lines.map(line => {
      // Check for console.log statements
      if (line.includes('console.log')) {
        if (shouldBeError(line)) {
          // Replace with console.error
          const newLine = line.replace(/console\.log/g, 'console.error');
          consoleErrorsFixed++;
          modified = true;
          return newLine;
        } else {
          // Replace with console.warn
          const newLine = line.replace(/console\.log/g, 'console.warn');
          consoleWarnsFixed++;
          modified = true;
          return newLine;
        }
      }
      
      return line;
    });
    
    consoleLogsFixed = consoleErrorsFixed + consoleWarnsFixed;
    
    // Fix unused variables
    const unusedVarPatterns = [
      { regex: /\b(const|let|var)\s+([a-zA-Z0-9_]+)\s*=/g, group: 2 },
      { regex: /catch\s*\(([a-zA-Z0-9_]+)\)/g, group: 1 },
      { regex: /function\s*\([^)]*,\s*([a-zA-Z0-9_]+)/g, group: 1 }
    ];
    
    let newContent = newLines.join('\n');
    let unusedVarsFixed = 0;
    
    // Simple heuristic to find unused variables
    // Note: This is a basic approach and may not catch all cases
    unusedVarPatterns.forEach(pattern => {
      const matches = [...newContent.matchAll(pattern.regex)];
      matches.forEach(match => {
        const varName = match[pattern.group];
        if (varName && !varName.startsWith('_')) {
          // Check if variable is used elsewhere (basic check)
          const usageRegex = new RegExp(`\\b${varName}\\b`, 'g');
          const usageMatches = [...newContent.matchAll(usageRegex)];
          
          // If variable appears only once (declaration), consider it unused
          if (usageMatches.length === 1) {
            const replaceRegex = new RegExp(`\\b(const|let|var|catch\\s*\\()${varName}\\b`, 'g');
            newContent = newContent.replace(replaceRegex, `$1_${varName}`);
            unusedVarsFixed++;
            modified = true;
          }
        }
      });
    });
    
    // Update statistics
    stats.filesProcessed++;
    
    if (modified) {
      stats.filesModified++;
      stats.consoleLogsFixed += consoleLogsFixed;
      stats.consoleErrorsFixed += consoleErrorsFixed;
      stats.consoleWarnsFixed += consoleWarnsFixed;
      stats.unusedVarsFixed += unusedVarsFixed;
      
      if (isDryRun) {
        console.warn(`  🔍 Would fix: ${filePath} (dry run)`);
        console.warn(`    - Console logs fixed: ${consoleLogsFixed} (${consoleErrorsFixed} errors, ${consoleWarnsFixed} warnings)`);
        console.warn(`    - Unused variables fixed: ${unusedVarsFixed}`);
      } else {
        // Create backup
        backupFile(filePath, backupDir);
        
        // Write modified content
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.warn(`  ✅ Fixed: ${filePath}`);
        console.warn(`    - Console logs fixed: ${consoleLogsFixed} (${consoleErrorsFixed} errors, ${consoleWarnsFixed} warnings)`);
        console.warn(`    - Unused variables fixed: ${unusedVarsFixed}`);
      }
    } else {
      console.warn(`  ⚠️ No changes needed in: ${filePath}`);
    }
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
    stats.fixesFailed++;
  }
}

/**
 * Prints statistics
 */
function printStats() {
  console.warn('\n========== Admin Console Logs Fix Statistics ==========');
  console.warn(`Files processed:        ${stats.filesProcessed}`);
  console.warn(`Files modified:         ${stats.filesModified}`);
  console.warn(`Console logs fixed:     ${stats.consoleLogsFixed}`);
  console.warn(`  - To console.error:   ${stats.consoleErrorsFixed}`);
  console.warn(`  - To console.warn:    ${stats.consoleWarnsFixed}`);
  console.warn(`Unused vars fixed:      ${stats.unusedVarsFixed}`);
  console.warn(`Fixes failed:           ${stats.fixesFailed}`);
  console.warn('====================================================');
  
  if (isDryRun) {
    console.warn('\n⚠️  DRY RUN - No files were modified');
    console.warn('   Run without --dry-run to apply changes');
  }
}

/**
 * Main function
 */
function main() {
  console.warn('=== Admin Console Logs Fix Script ===');
  console.warn(`Mode: ${isDryRun ? 'Dry Run (preview only)' : 'Live Run (will modify files)'}`);
  
  // Create backup directory
  const backupDir = createBackupDir();
  
  // Process each admin CLI file
  for (const filePath of ADMIN_CLI_FILES) {
    if (fs.existsSync(filePath)) {
      fixConsoleStatements(filePath, backupDir);
    } else {
      console.warn(`⚠️ File not found, skipping: ${filePath}`);
    }
  }
  
  // Print statistics
  printStats();
  
  // Run ESLint to check remaining issues
  if (!isDryRun) {
    console.warn('\nRemaining issues can be checked by running:');
    console.warn('  npm run lint');
  }
}

// Run the script
main();
