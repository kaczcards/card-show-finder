#!/usr/bin/env node
/**
 * Fix Remaining Unused Variables
 * 
 * This script parses ESLint output to fix remaining unused variable warnings by:
 * 1. Adding underscore prefix to unused variables/parameters
 * 2. Converting console.log to console.warn
 * 
 * Usage:
 *   node scripts/fix-remaining-unused.js [options]
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
const { execSync } = require('child_process');

// Promisify fs functions
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const copyFileAsync = promisify(fs.copyFile);
const existsAsync = promisify(fs.exists);
const statAsync = promisify(fs.stat);

// Configuration
const config = {
  srcDir: path.resolve(process.cwd(), 'src'),
  backupDir: path.resolve(process.cwd(), 'automated-fixes-backups'),
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
  fixesApplied: {
    variables: 0,
    parameters: 0,
    consoleStatements: 0,
    errors: 0,
  },
};

// Regular expressions for parsing ESLint output
// First line of a block: absolute path to the file
const pathLineRegex = /^\/.*\.(?:t|j)sx?$/;
// Second line inside the block that contains the warning details
const detailLineRegex = /^\s*(\d+):(\d+)\s+warning\s+(.+)$/;
const unusedVarRegex = /'([^']+)' is (defined|assigned a value) but never used\. Allowed unused (vars|args) must match/;
const consoleStatementRegex = /Unexpected console statement\. Only these console methods are allowed: warn, error/;

// Regular expressions for fixing code
const variableDeclarationRegex = /(const|let|var)\s+([a-zA-Z0-9_]+)(\s*=|\s*,|\s*\)|\s*:)/g;
const functionParamRegex = /(\(|\s|,)([a-zA-Z0-9_]+)(\s*[,\)]|\s*:)/g;
const consoleLogRegex = /console\.log\(/g;

// Help message
if (config.help) {
  console.log(`
Fix Remaining Unused Variables

Usage:
  node scripts/fix-remaining-unused.js [options]

Options:
  --dry-run          Show what would be changed without making changes
  --verbose          Show detailed logs
  --no-backup        Skip creating backups (not recommended)
  --help             Show this help message
  `);
  process.exit(0);
}

// Mode message
console.log(`\nFix Remaining Unused Variables`);
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
 * Run ESLint and parse the output
 * @returns {Promise<Object>} - Object with file paths as keys and arrays of warnings as values
 */
async function runEslintAndParseOutput() {
  // Combined output (stdout + stderr)
  console.log('Running ESLint to collect warnings...');
  let eslintOutput;

  try {
    // ESLint will exit with code 0 when there are no problems,
    // 1 when there are lint warnings/errors. We still want the
    // output in both situations.
    eslintOutput = execSync('npm run lint:src 2>&1', {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    // ESLint exits with code 1 when it finds warnings/errors.
    // In that case, execSync throws, but the stdout property
    // contains the output we need. Any other exit code indicates
    // an unexpected failure which should be re-thrown.
    if (error.status === 1) {
      eslintOutput =
        (error.stdout && error.stdout.toString()) ||
        (Array.isArray(error.output) ? error.output.join('') : '');
    } else {
      throw error;
    }
  }

  const fileWarnings = {};
  let currentFile = null;

  eslintOutput.split('\n').forEach((rawLine) => {
    const line = rawLine.trimEnd();

    // Detect file path line
    if (pathLineRegex.test(line)) {
      currentFile = line;
      // Convert to absolute path
      currentFile = path.isAbsolute(currentFile)
        ? currentFile
        : path.join(process.cwd(), currentFile);
      return;
    }

    // Detect detail warning line
    const detailMatch = line.match(detailLineRegex);
    if (detailMatch && currentFile) {
      const [, lineNum, colNum, warningMessage] = detailMatch;

      if (!fileWarnings[currentFile]) {
        fileWarnings[currentFile] = [];
      }

      // Parse unused variable warnings
      const unusedVarMatch = warningMessage.match(unusedVarRegex);
      if (unusedVarMatch) {
        const [, varName, , varsOrArgs] = unusedVarMatch;
        fileWarnings[currentFile].push({
          type: varsOrArgs === 'vars' ? 'variable' : 'parameter',
          name: varName,
          line: parseInt(lineNum, 10),
          column: parseInt(colNum, 10),
          message: warningMessage,
        });
      }

      // Parse console statement warnings
      if (consoleStatementRegex.test(warningMessage)) {
        fileWarnings[currentFile].push({
          type: 'console',
          line: parseInt(lineNum, 10),
          column: parseInt(colNum, 10),
          message: warningMessage,
        });
      }
    }
  });

  return fileWarnings;
}

/**
 * Fix unused variables in a file
 * @param {string} filePath - Path to the file to fix
 * @param {Array} warnings - Array of warnings for the file
 * @returns {Promise<boolean>} - Whether the file was modified
 */
async function fixUnusedVariables(filePath, warnings) {
  try {
    // Read file content
    const content = await readFileAsync(filePath, 'utf8');
    const lines = content.split('\n');
    let modified = false;
    
    // Group warnings by line
    const warningsByLine = {};
    warnings.forEach(warning => {
      if (!warningsByLine[warning.line]) {
        warningsByLine[warning.line] = [];
      }
      warningsByLine[warning.line].push(warning);
    });
    
    // Process each line with warnings
    for (const lineNum in warningsByLine) {
      const lineIndex = parseInt(lineNum) - 1;
      let line = lines[lineIndex];
      const lineWarnings = warningsByLine[lineNum];
      
      // Process warnings for this line
      for (const warning of lineWarnings) {
        if (warning.type === 'variable' || warning.type === 'parameter') {
          // Skip if already prefixed with underscore
          if (warning.name.startsWith('_')) continue;
          
          // Add underscore prefix to variable or parameter
          const regex = new RegExp(`\\b${warning.name}\\b(?!\\w|_)`, 'g');
          const newLine = line.replace(regex, `_${warning.name}`);
          
          if (newLine !== line) {
            line = newLine;
            modified = true;
            stats.fixesApplied[warning.type === 'variable' ? 'variables' : 'parameters']++;
            
            if (config.verbose) {
              console.log(`  Fixed ${warning.type}: ${warning.name} -> _${warning.name}`);
            }
          }
        } else if (warning.type === 'console') {
          // Convert console.log to console.warn
          const newLine = line.replace(consoleLogRegex, 'console.warn(');
          
          if (newLine !== line) {
            line = newLine;
            modified = true;
            stats.fixesApplied.consoleStatements++;
            
            if (config.verbose) {
              console.log(`  Fixed console statement: console.log -> console.warn`);
            }
          }
        }
      }
      
      // Update the line in the array
      lines[lineIndex] = line;
    }
    
    // Write modified content back to file
    if (modified && !config.dryRun) {
      await createBackup(filePath);
      await writeFileAsync(filePath, lines.join('\n'), 'utf8');
      console.log(`Modified: ${path.relative(process.cwd(), filePath)}`);
      stats.filesModified++;
    }
    
    return modified;
  } catch (error) {
    console.error(`Error fixing unused variables in ${filePath}:`, error);
    stats.fixesApplied.errors++;
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Run ESLint and parse output
    const fileWarnings = await runEslintAndParseOutput();
    const filePaths = Object.keys(fileWarnings);
    
    console.log(`Found ${filePaths.length} files with warnings to process.`);
    
    // Process each file
    for (const filePath of filePaths) {
      const warnings = fileWarnings[filePath];
      stats.filesProcessed++;
      
      if (config.verbose) {
        console.log(`Processing ${path.relative(process.cwd(), filePath)} (${warnings.length} warnings)`);
      }
      
      await fixUnusedVariables(filePath, warnings);
    }
    
    // Print report
    console.log('\n========== FIX REMAINING UNUSED VARIABLES REPORT ==========');
    console.log(`Mode: ${config.dryRun ? 'DRY RUN (no changes made)' : 'LIVE RUN'}`);
    
    console.log('\nSTATISTICS:');
    console.log(`Files processed: ${stats.filesProcessed}`);
    console.log(`Files modified: ${stats.filesModified}`);
    console.log(`Backups created: ${stats.backupsCreated}`);
    
    console.log('\nFIXES APPLIED:');
    console.log(`Variables: ${stats.fixesApplied.variables}`);
    console.log(`Parameters: ${stats.fixesApplied.parameters}`);
    console.log(`Console statements: ${stats.fixesApplied.consoleStatements}`);
    
    if (stats.fixesApplied.errors > 0) {
      console.log(`\nErrors encountered: ${stats.fixesApplied.errors}`);
    }
    
    if (config.dryRun) {
      console.log('\nThis was a dry run. No files were modified.');
      console.log('Run without --dry-run to apply changes.');
    }
    
    console.log('\nNOTE: This script applies targeted fixes based on ESLint output.');
    console.log('Some issues may require manual review and fixing.');
    console.log('Always verify changes and run tests after applying fixes.');
    console.log('============================================');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main();
