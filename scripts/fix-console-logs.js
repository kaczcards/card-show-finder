#!/usr/bin/env node
/**
 * Fix Console Logs
 * 
 * This script replaces all console.log statements with console.warn:
 * - Finds all TypeScript and JavaScript files in src/
 * - Replaces console.log( with console.warn(
 * - Creates backups before modifying files
 * 
 * Usage:
 *   node scripts/fix-console-logs.js [options]
 * 
 * Options:
 *   --dry-run          Show what would be changed without making changes
 *   --verbose          Show detailed logs
 *   --no-backup        Skip creating backups (not recommended)
 *   --help             Show this help message
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

// Promisify fs functions
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const copyFileAsync = promisify(fs.copyFile);
const statAsync = promisify(fs.stat);
const readdirAsync = promisify(fs.readdir);

// Configuration
const config = {
  srcDir: path.resolve(process.cwd(), 'src'),
  backupDir: path.resolve(process.cwd(), 'console-logs-backups'),
  timestamp: new Date().toISOString().replace(/:/g, '-'),
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  noBackup: process.argv.includes('--no-backup'),
  help: process.argv.includes('--help'),
};

// Statistics
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  backupsCreated: 0,
  replacementsCount: 0,
};

// Help message
if (config.help) {
  console.log(`
Fix Console Logs

Usage:
  node scripts/fix-console-logs.js [options]

Options:
  --dry-run          Show what would be changed without making changes
  --verbose          Show detailed logs
  --no-backup        Skip creating backups (not recommended)
  --help             Show this help message
  `);
  process.exit(0);
}

// Mode message
console.log(`\nFix Console Logs`);
console.log(`Mode: ${config.dryRun ? 'Dry Run (no changes will be made)' : 'Live Run'}`);

/**
 * Create a backup of a file
 * @param {string} filePath - Path to the file to backup
 * @returns {Promise<string>} - Path to the backup file
 */
async function createBackup(filePath) {
  if (config.noBackup || config.dryRun) {
    return null;
  }

  const backupDirWithTimestamp = path.join(config.backupDir, config.timestamp);
  const relativeFilePath = path.relative(process.cwd(), filePath);
  const backupFilePath = path.join(backupDirWithTimestamp, relativeFilePath);
  const backupFileDir = path.dirname(backupFilePath);

  try {
    // Create backup directory if it doesn't exist
    await mkdirAsync(backupDirWithTimestamp, { recursive: true });
    await mkdirAsync(backupFileDir, { recursive: true });

    // Copy file to backup
    await copyFileAsync(filePath, backupFilePath);
    stats.backupsCreated++;
    
    if (config.verbose) {
      console.log(`Backup created: ${backupFilePath}`);
    }
    
    return backupFilePath;
  } catch (error) {
    console.error(`Error creating backup for ${filePath}:`, error);
    return null;
  }
}

/**
 * Find all TypeScript and JavaScript files in a directory recursively
 * @param {string} dir - Directory to search
 * @returns {Promise<string[]>} - Array of file paths
 */
async function findSourceFiles(dir) {
  const files = [];
  
  async function walk(directory) {
    const entries = await readdirAsync(directory);
    
    for (const entry of entries) {
      const entryPath = path.join(directory, entry);
      const stat = await statAsync(entryPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and hidden directories
        if (entry !== 'node_modules' && !entry.startsWith('.')) {
          await walk(entryPath);
        }
      } else if (stat.isFile()) {
        // Only include TypeScript and JavaScript files
        const ext = path.extname(entry).toLowerCase();
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
          files.push(entryPath);
        }
      }
    }
  }
  
  await walk(dir);
  return files;
}

/**
 * Fix console.log statements in a file
 * @param {string} filePath - Path to the file to fix
 * @returns {Promise<boolean>} - Whether the file was modified
 */
async function fixConsoleStatements(filePath) {
  try {
    // Read file content
    const content = await readFileAsync(filePath, 'utf8');

    // Regex that matches any console.<method>(  where <method> is NOT warn or error
    // Negative look-ahead ensures we skip warn / error
    const consoleRegex = /console\.(?!warn\b|error\b)[a-zA-Z_]+\(/g;

    // Quick check to avoid unnecessary work
    if (!consoleRegex.test(content)) {
      return false;
    }

    // Replace all non-warn/error console calls with console.warn
    const newContent = content.replace(consoleRegex, 'console.warn(');

    // Count replacements (regex needs reset)
    const replacementCount = (content.match(consoleRegex) || []).length;
    
    // Update stats
    stats.replacementsCount += replacementCount;
    
    if (config.verbose) {
      console.log(`Found ${replacementCount} console.log statements in ${path.relative(process.cwd(), filePath)}`);
    }
    
    // Write modified content back to file
    if (!config.dryRun) {
      await createBackup(filePath);
      await writeFileAsync(filePath, newContent, 'utf8');
      console.log(`Modified: ${path.relative(process.cwd(), filePath)}`);
      stats.filesModified++;
    }
    
    return true;
  } catch (error) {
    console.error(`Error fixing console statements in ${filePath}:`, error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Find all source files
    const files = await findSourceFiles(config.srcDir);
    console.log(`Found ${files.length} source files to process.`);
    
    // Process each file
    for (const filePath of files) {
      stats.filesProcessed++;
      await fixConsoleStatements(filePath);
    }
    
    // Print report
    console.log('\n========== FIX CONSOLE LOGS REPORT ==========');
    console.log(`Mode: ${config.dryRun ? 'DRY RUN (no changes made)' : 'LIVE RUN'}`);
    
    console.log('\nSTATISTICS:');
    console.log(`Files processed: ${stats.filesProcessed}`);
    console.log(`Files modified: ${stats.filesModified}`);
    console.log(`Backups created: ${stats.backupsCreated}`);
    console.log(`Console.log statements replaced: ${stats.replacementsCount}`);
    
    if (config.dryRun) {
      console.log('\nThis was a dry run. No files were modified.');
      console.log('Run without --dry-run to apply changes.');
    }
    
    console.log('\nNOTE: This script replaces console.log with console.warn.');
    console.log('Some console statements may need to be manually reviewed.');
    console.log('Always verify changes and run tests after applying fixes.');
    console.log('============================================');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main();
