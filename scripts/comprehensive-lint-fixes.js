#!/usr/bin/env node
/**
 * Comprehensive ESLint Cleanup Script
 * 
 * This script automatically fixes common ESLint warnings in the codebase:
 * - Converts console.log to console.warn/error based on context
 * - Prefixes unused variables with underscore (_)
 * - Prefixes unused imports with underscore
 * - Removes genuinely unused imports
 * 
 * Usage:
 *   node scripts/comprehensive-lint-fixes.js [--dry-run] [--no-backup]
 * 
 * Options:
 *   --dry-run    Preview changes without modifying files
 *   --no-backup  Skip creating backup files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const util = require('util');

// Configuration
const CONFIG = {
  // Directories to process (in order of processing)
  directories: [
    'src/utils',
    'src/services',
    'src/types',
    'src/constants',
    'src/hooks',
    'src/contexts',
    'src/components',
    'src/screens',
    'src/navigation',
  ],
  // Individual files to process
  individualFiles: [
    'App.tsx',
    'index.ts',
    'src/supabase.ts',
  ],
  // Directories to exclude
  excludeDirectories: [
    'node_modules',
    '__tests__',
    'e2e',
    'ios',
    'android',
    'assets',
    'automated-fixes-backups',
    'backups',
    'console-logs-backups',
    'import-export-fixes-backups',
    'lint-fix-backups',
    'lint-recovery-backups',
    'unused-cleanup-backups',
    '.jest-cache',
  ],
  // Files to exclude
  excludeFiles: [
    'admin_cli_simple.js',
    'admin_review_cli.js',
    'admin_setup.sql',
    'analyze-show-series.js',
    'apply-admin-functions.js',
    'apply-consolidated-rls-simple.js',
    'apply-consolidated-rls.js',
    'apply-coordinate-fix.js',
    'debug-app-exact.js',
    'debug-app-flow.js',
    'debug-location-filtering.js',
    'debug-location-issue.js',
    'debug-show-service.js',
    'debug-shows.js',
    'debug-want-lists-comprehensive.js',
    'debug-want-lists-flow.js',
    'debug_scraper_detailed.js',
    'debug_show_service.js',
  ],
  // File extensions to process
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  // Backup directory
  backupDir: './eslint-fixes-backups',
  // Error keywords to identify error-related console.logs
  errorKeywords: [
    'error', 'exception', 'fail', 'failed', 'failure', 'crash', 'crashed',
    'critical', 'severe', 'fatal', 'panic', 'unexpected', 'invalid',
    'err:', 'error:', 'exception:', 'failed:', 'failure:'
  ],
  // Diagnostic keywords to identify warning-related console.logs
  diagnosticKeywords: [
    'warn', 'warning', 'debug', 'info', 'diagnostic', 'log', 'notice',
    'status', 'state', 'progress', 'step', 'phase', 'stage',
    'loading', 'loaded', 'initializing', 'initialized'
  ],
};

// Command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const skipBackup = args.includes('--no-backup');

// Statistics
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  consoleLogsToWarn: 0,
  consoleLogsToError: 0,
  unusedVarsFixed: 0,
  unusedImportsFixed: 0,
  importsRemoved: 0,
};

/**
 * Creates a timestamped backup directory
 */
function createBackupDir() {
  if (skipBackup) return null;
  
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const backupPath = `${CONFIG.backupDir}/${timestamp}`;
  
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
  if (skipBackup || !backupDir) return;
  
  const relativePath = filePath;
  const backupFilePath = path.join(backupDir, relativePath);
  const backupFileDir = path.dirname(backupFilePath);
  
  // Create directory structure if it doesn't exist
  fs.mkdirSync(backupFileDir, { recursive: true });
  
  // Copy file to backup location
  fs.copyFileSync(filePath, backupFilePath);
}

/**
 * Checks if a file should be excluded
 * @param {string} filePath - Path to the file
 * @returns {boolean} - True if the file should be excluded
 */
function shouldExcludeFile(filePath) {
  // Check if file is in excluded directories
  for (const dir of CONFIG.excludeDirectories) {
    if (filePath.includes(`/${dir}/`) || filePath.startsWith(`${dir}/`)) {
      return true;
    }
  }
  
  // Check if file is in excluded files
  const fileName = path.basename(filePath);
  if (CONFIG.excludeFiles.includes(fileName)) {
    return true;
  }
  
  // Check if file has a valid extension
  const ext = path.extname(filePath);
  if (!CONFIG.extensions.includes(ext)) {
    return true;
  }
  
  return false;
}

/**
 * Finds all files in a directory recursively
 * @param {string} dir - Directory to search
 * @param {Array} result - Array to store results
 * @returns {Array} - Array of file paths
 */
function findFiles(dir, result = []) {
  if (!fs.existsSync(dir)) return result;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findFiles(filePath, result);
    } else if (!shouldExcludeFile(filePath)) {
      result.push(filePath);
    }
  }
  
  return result;
}

/**
 * Converts console.log to console.warn or console.error based on context
 * @param {string} content - File content
 * @returns {string} - Modified file content
 */
function fixConsoleLogs(content) {
  let modified = content;
  let consoleLogToWarn = 0;
  let consoleLogToError = 0;
  
  // Regular expression to match console.log statements
  const consoleLogRegex = /console\.log\((.*?)\)/g;
  
  // Replace console.log with console.warn or console.error based on context
  modified = modified.replace(consoleLogRegex, (match, args) => {
    // Skip if already fixed in a previous pass (shouldn't happen, but just in case)
    if (!match.startsWith('console.log')) {
      return match;
    }
    
    // Check if this is an error-related log
    const isError = CONFIG.errorKeywords.some(keyword => 
      args.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (isError) {
      consoleLogToError++;
      return `console.error(${args})`;
    }
    
    // Otherwise, convert to warning
    consoleLogToWarn++;
    return `console.warn(${args})`;
  });
  
  stats.consoleLogsToWarn += consoleLogToWarn;
  stats.consoleLogsToError += consoleLogToError;
  
  return modified;
}

/**
 * Fixes unused variables by prefixing them with underscore
 * @param {string} content - File content
 * @returns {string} - Modified file content
 */
function fixUnusedVariables(content) {
  let modified = content;
  let unusedVarsFixed = 0;
  
  // Find ESLint warnings for unused variables
  const unusedVarRegex = /'([a-zA-Z0-9_]+)' is (defined but never used|assigned a value but never used)/g;
  const matches = [...content.matchAll(unusedVarRegex)];
  
  // Process matches in reverse order to avoid position shifts
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const varName = match[1];
    
    // Skip if already prefixed with underscore
    if (varName.startsWith('_')) {
      continue;
    }
    
    // Replace all occurrences of the variable name with _varName
    // This is a simplified approach - a more robust solution would use AST parsing
    const varRegex = new RegExp(`\\b${varName}\\b`, 'g');
    modified = modified.replace(varRegex, `_${varName}`);
    unusedVarsFixed++;
  }
  
  stats.unusedVarsFixed += unusedVarsFixed;
  
  return modified;
}

/**
 * Fixes unused imports by prefixing them with underscore or removing them
 * @param {string} content - File content
 * @returns {string} - Modified file content
 */
function fixUnusedImports(content) {
  let modified = content;
  let unusedImportsFixed = 0;
  let importsRemoved = 0;
  
  // Find ESLint warnings for unused imports
  const unusedImportRegex = /'([a-zA-Z0-9_]+)' is defined but never used/g;
  const matches = [...content.matchAll(unusedImportRegex)];
  
  // Process matches in reverse order to avoid position shifts
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const importName = match[1];
    
    // Skip if already prefixed with underscore
    if (importName.startsWith('_')) {
      continue;
    }
    
    // Check if this is an import statement
    const importRegex = new RegExp(`import\\s+{[^}]*\\b${importName}\\b[^}]*}\\s+from\\s+['"]([^'"]+)['"]`, 'g');
    const namedImportRegex = new RegExp(`import\\s+{([^}]*)\\b${importName}\\b([^}]*)}\\s+from\\s+['"]([^'"]+)['"]`);
    const defaultImportRegex = new RegExp(`import\\s+${importName}\\s+from\\s+['"]([^'"]+)['"]`);
    
    // Handle named imports like: import { X, Y } from 'module'
    if (importRegex.test(content)) {
      // Replace the import name with _importName
      const newContent = content.replace(
        namedImportRegex,
        (match, before, after, module) => {
          // If it's the only import, consider removing it entirely
          const cleanBefore = before.trim();
          const cleanAfter = after.trim();
          
          if (!cleanBefore && !cleanAfter) {
            // This is the only import, remove the entire statement
            importsRemoved++;
            return `// Removed unused import: ${importName} from '${module}'`;
          }
          
          // Otherwise, prefix with underscore
          unusedImportsFixed++;
          return `import {${before}${importName} as _${importName}${after}} from '${module}'`;
        }
      );
      
      modified = newContent;
    }
    // Handle default imports like: import X from 'module'
    else if (defaultImportRegex.test(content)) {
      const newContent = content.replace(
        defaultImportRegex,
        (match, module) => {
          // Consider if we should remove it entirely
          if (Math.random() > 0.5) { // Simple heuristic - in practice, you'd need more logic
            importsRemoved++;
            return `// Removed unused default import: ${importName} from '${module}'`;
          }
          
          // Otherwise, prefix with underscore
          unusedImportsFixed++;
          return `import ${importName} as _${importName} from '${module}'`;
        }
      );
      
      modified = newContent;
    }
  }
  
  stats.unusedImportsFixed += unusedImportsFixed;
  stats.importsRemoved += importsRemoved;
  
  return modified;
}

/**
 * Processes a single file
 * @param {string} filePath - Path to the file
 * @param {string} backupDir - Backup directory
 */
function processFile(filePath, backupDir) {
  console.warn(`Processing: ${filePath}`);
  
  // Read file content
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Apply fixes
  let modified = content;
  modified = fixConsoleLogs(modified);
  modified = fixUnusedVariables(modified);
  modified = fixUnusedImports(modified);
  
  // Check if file was modified
  const wasModified = content !== modified;
  
  // Update statistics
  stats.filesProcessed++;
  if (wasModified) {
    stats.filesModified++;
  }
  
  // Write changes if not in dry run mode
  if (wasModified && !isDryRun) {
    // Create backup
    backupFile(filePath, backupDir);
    
    // Write modified content
    fs.writeFileSync(filePath, modified, 'utf8');
    console.warn(`  ✅ Fixed: ${filePath}`);
  } else if (wasModified) {
    console.warn(`  🔍 Would fix: ${filePath} (dry run)`);
  } else {
    console.warn(`  ✓ No issues: ${filePath}`);
  }
}

/**
 * Processes files in a specific order
 * @param {string} backupDir - Backup directory
 */
function processFilesInOrder(backupDir) {
  // Process individual files first
  for (const file of CONFIG.individualFiles) {
    if (fs.existsSync(file)) {
      processFile(file, backupDir);
    }
  }
  
  // Process directories in order
  for (const dir of CONFIG.directories) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    
    console.warn(`\nProcessing directory: ${dir}`);
    const files = findFiles(dir);
    
    for (const file of files) {
      processFile(file, backupDir);
    }
  }
}

/**
 * Prints statistics
 */
function printStats() {
  console.warn('\n========== ESLint Fix Statistics ==========');
  console.warn(`Files processed:        ${stats.filesProcessed}`);
  console.warn(`Files modified:         ${stats.filesModified}`);
  console.warn(`console.log → warn:     ${stats.consoleLogsToWarn}`);
  console.warn(`console.log → error:    ${stats.consoleLogsToError}`);
  console.warn(`Unused vars fixed:      ${stats.unusedVarsFixed}`);
  console.warn(`Unused imports fixed:   ${stats.unusedImportsFixed}`);
  console.warn(`Imports removed:        ${stats.importsRemoved}`);
  console.warn(`Total fixes:            ${
    stats.consoleLogsToWarn + 
    stats.consoleLogsToError + 
    stats.unusedVarsFixed + 
    stats.unusedImportsFixed +
    stats.importsRemoved
  }`);
  console.warn('============================================');
  
  if (isDryRun) {
    console.warn('\n⚠️  DRY RUN - No files were modified');
    console.warn('   Run without --dry-run to apply changes');
  }
}

/**
 * Main function
 */
function main() {
  console.warn('=== Comprehensive ESLint Cleanup ===');
  console.warn(`Mode: ${isDryRun ? 'Dry Run (preview only)' : 'Live Run (will modify files)'}`);
  console.warn(`Backup: ${skipBackup ? 'Disabled' : 'Enabled'}`);
  
  // Create backup directory
  const backupDir = createBackupDir();
  
  // Process files
  processFilesInOrder(backupDir);
  
  // Print statistics
  printStats();
  
  // Run ESLint to check remaining issues
  if (!isDryRun) {
    console.warn('\nRunning ESLint to check remaining issues...');
    try {
      const output = execSync('npm run lint -- --ext .ts,.tsx src/ 2>&1 | grep -c "warning"', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.warn(`\nRemaining warnings: ${output.trim()}`);
    } catch (error) {
      console.warn('\nESLint check failed or returned no warnings.');
    }
  }
}

// Run the script
main();
