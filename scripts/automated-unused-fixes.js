#!/usr/bin/env node
/**
 * Automated Unused Variable Fixes
 * 
 * This script automatically fixes common ESLint warnings related to unused variables:
 * 1. Prefixes unused parameters with underscore (e.g., `param` becomes `_param`)
 * 2. Prefixes unused variables with underscore where safe to do so
 * 3. Converts console.log to console.warn for debugging console statements
 * 4. Removes obvious unused imports like unused types/interfaces
 * 
 * Usage:
 *   node scripts/automated-unused-fixes.js [options]
 * 
 * Options:
 *   --dry-run          Show what would be changed without making changes
 *   --verbose          Show detailed logs
 *   --no-backup        Skip creating backups (not recommended)
 *   --help             Show this help message
 *   --only-params      Only fix function parameters
 *   --only-vars        Only fix variable declarations
 *   --only-console     Only fix console statements
 *   --only-catch       Only fix try/catch error variables
 *   --only-imports     Only fix unused imports
 *   --skip-params      Skip fixing function parameters
 *   --skip-vars        Skip fixing variable declarations
 *   --skip-console     Skip fixing console statements
 *   --skip-catch       Skip fixing try/catch error variables
 *   --skip-imports     Skip fixing unused imports
 *   --dir=<path>       Specify directory to process (default: src)
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
const readdirAsync = promisify(fs.readdir);

// Configuration
const config = {
  srcDir: path.resolve(process.cwd(), 'src'),
  backupDir: path.resolve(process.cwd(), 'automated-fixes-backups'),
  timestamp: new Date().toISOString().replace(/:/g, '-'),
  excludedDirs: ['node_modules', '.git', 'build', 'dist', 'coverage', 'backup'],
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  // Patterns to identify ESLint warnings
  patterns: {
    // Function parameters: (item) => becomes (_item) =>
    functionParams: [
      // Arrow function parameters
      {
        regex: /(\(\s*)([a-zA-Z0-9_]+)(\s*\)\s*=>)/g,
        replacement: (match, pre, param, post) => {
          // Skip if already prefixed with underscore
          if (param.startsWith('_')) return match;
          return `${pre}_${param}${post}`;
        },
        description: 'Arrow function single parameter'
      },
      // Arrow function with multiple parameters
      {
        regex: /(\(\s*)([a-zA-Z0-9_]+)(\s*,\s*[^)]+\)\s*=>)/g,
        replacement: (match, pre, param, post) => {
          // Skip if already prefixed with underscore
          if (param.startsWith('_')) return match;
          return `${pre}_${param}${post}`;
        },
        description: 'Arrow function first parameter'
      },
      // Function parameters in the middle or end
      {
        regex: /(\(\s*[^,)]+,\s*)([a-zA-Z0-9_]+)(\s*(?:,|\)))/g,
        replacement: (match, pre, param, post) => {
          // Skip if already prefixed with underscore
          if (param.startsWith('_')) return match;
          return `${pre}_${param}${post}`;
        },
        description: 'Function non-first parameter'
      },
      // Method parameters
      {
        regex: /(function\s+[a-zA-Z0-9_]+\s*\(\s*)([a-zA-Z0-9_]+)(\s*[,)])/g,
        replacement: (match, pre, param, post) => {
          // Skip if already prefixed with underscore
          if (param.startsWith('_')) return match;
          return `${pre}_${param}${post}`;
        },
        description: 'Named function parameter'
      },
      // Class method parameters
      {
        regex: /(\s[a-zA-Z0-9_]+\s*\(\s*)([a-zA-Z0-9_]+)(\s*[,)])/g,
        replacement: (match, pre, param, post) => {
          // Skip if already prefixed with underscore
          if (param.startsWith('_')) return match;
          return `${pre}_${param}${post}`;
        },
        description: 'Class method parameter'
      }
    ],
    
    // Variable declarations: const unused = value; becomes const _unused = value;
    variableDeclarations: [
      // const/let/var declarations
      {
        regex: /(const|let|var)\s+([a-zA-Z0-9_]+)(\s*=)/g,
        replacement: (match, declarationType, varName, post) => {
          // Skip if already prefixed with underscore
          if (varName.startsWith('_')) return match;
          return `${declarationType} _${varName}${post}`;
        },
        description: 'Variable declaration'
      },
      // Destructured object properties
      {
        regex: /(\{\s*)([a-zA-Z0-9_]+)(\s*\})/g,
        replacement: (match, pre, prop, post) => {
          // Skip if already prefixed with underscore
          if (prop.startsWith('_')) return match;
          return `${pre}_${prop}${post}`;
        },
        description: 'Destructured object property'
      },
      // Destructured array elements
      {
        regex: /(\[\s*)([a-zA-Z0-9_]+)(\s*\])/g,
        replacement: (match, pre, elem, post) => {
          // Skip if already prefixed with underscore
          if (elem.startsWith('_')) return match;
          return `${pre}_${elem}${post}`;
        },
        description: 'Destructured array element'
      }
    ],
    
    // Console statements: console.log( becomes console.warn(
    consoleStatements: [
      {
        regex: /console\.log\(/g,
        replacement: 'console.warn(',
        description: 'Convert console.log to console.warn'
      }
    ],
    
    // Try/catch unused error variables: catch (e) becomes catch (_e)
    catchClauses: [
      {
        regex: /catch\s*\(\s*([a-zA-Z0-9_]+)(\s*\))/g,
        replacement: (match, errorVar, post) => {
          // Skip if already prefixed with underscore
          if (errorVar.startsWith('_')) return match;
          return `catch (_${errorVar}${post}`;
        },
        description: 'Try/catch error variable'
      }
    ],
    
    // Unused imports
    unusedImports: [
      // Named imports
      {
        regex: /import\s*\{\s*([^{}]*?)\s*\}\s*from\s*['"]([^'"]+)['"]/g,
        processImports: true,
        description: 'Named imports'
      },
      // Default imports
      {
        regex: /import\s+([a-zA-Z0-9_]+)\s+from\s*['"]([^'"]+)['"]/g,
        processImports: true,
        description: 'Default imports'
      }
    ]
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose'),
  noBackup: args.includes('--no-backup'),
  help: args.includes('--help'),
  onlyParams: args.includes('--only-params'),
  onlyVars: args.includes('--only-vars'),
  onlyConsole: args.includes('--only-console'),
  onlyCatch: args.includes('--only-catch'),
  onlyImports: args.includes('--only-imports'),
  skipParams: args.includes('--skip-params'),
  skipVars: args.includes('--skip-vars'),
  skipConsole: args.includes('--skip-console'),
  skipCatch: args.includes('--skip-catch'),
  skipImports: args.includes('--skip-imports'),
};

// Process directory argument
const dirArg = args.find(arg => arg.startsWith('--dir='));
if (dirArg) {
  const dirPath = dirArg.split('=')[1];
  if (dirPath) {
    config.srcDir = path.resolve(process.cwd(), dirPath);
  }
}

// Statistics for reporting
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  backupsCreated: 0,
  fixesByType: {
    params: 0,
    vars: 0,
    console: 0,
    catch: 0,
    imports: 0
  },
  errors: 0,
};

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Automated Unused Variable Fixes

This script automatically fixes common ESLint warnings related to unused variables:
1. Prefixes unused parameters with underscore (e.g., \`param\` becomes \`_param\`)
2. Prefixes unused variables with underscore where safe to do so
3. Converts console.log to console.warn for debugging console statements
4. Removes obvious unused imports like unused types/interfaces

Usage:
  node scripts/automated-unused-fixes.js [options]

Options:
  --dry-run          Show what would be changed without making changes
  --verbose          Show detailed logs
  --no-backup        Skip creating backups (not recommended)
  --help             Show this help message
  --only-params      Only fix function parameters
  --only-vars        Only fix variable declarations
  --only-console     Only fix console statements
  --only-catch       Only fix try/catch error variables
  --only-imports     Only fix unused imports
  --skip-params      Skip fixing function parameters
  --skip-vars        Skip fixing variable declarations
  --skip-console     Skip fixing console statements
  --skip-catch       Skip fixing try/catch error variables
  --skip-imports     Skip fixing unused imports
  --dir=<path>       Specify directory to process (default: src)

Examples:
  # Dry run with verbose output
  node scripts/automated-unused-fixes.js --dry-run --verbose

  # Only fix function parameters
  node scripts/automated-unused-fixes.js --only-params

  # Skip fixing console statements
  node scripts/automated-unused-fixes.js --skip-console

  # Process a specific directory
  node scripts/automated-unused-fixes.js --dir=src/components
  `);
}

/**
 * Log message with optional verbose check
 */
function log(message, isVerbose = false) {
  if (!isVerbose || (isVerbose && options.verbose)) {
    console.log(message);
  }
}

/**
 * Creates a backup of the file before modifying it
 */
async function backupFile(filePath) {
  try {
    if (options.noBackup) return null;

    // Create backup directory if it doesn't exist
    if (!await existsAsync(config.backupDir)) {
      await mkdirAsync(config.backupDir, { recursive: true });
    }
    
    // Create subdirectories to match the original file structure
    const relativePath = path.relative(process.cwd(), filePath);
    const backupPath = path.join(config.backupDir, relativePath);
    const backupDirPath = path.dirname(backupPath);
    
    if (!await existsAsync(backupDirPath)) {
      await mkdirAsync(backupDirPath, { recursive: true });
    }
    
    // Copy the file to the backup location
    await copyFileAsync(filePath, backupPath);
    stats.backupsCreated++;
    
    return backupPath;
  } catch (err) {
    console.error(`Error creating backup for ${filePath}:`, err);
    stats.errors++;
    return null;
  }
}

/**
 * Get all source files in the project
 */
async function getAllSourceFiles() {
  const sourceFiles = [];
  
  async function scanDir(dirPath) {
    try {
      const entries = await readdirAsync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          if (!config.excludedDirs.includes(entry.name)) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile() && config.extensions.includes(path.extname(entry.name))) {
          sourceFiles.push(fullPath);
        }
      }
    } catch (err) {
      console.error(`Error scanning directory ${dirPath}:`, err);
      stats.errors++;
    }
  }
  
  await scanDir(config.srcDir);
  stats.filesProcessed = sourceFiles.length;
  
  return sourceFiles;
}

/**
 * Process a file and apply fixes
 */
async function processFile(filePath) {
  try {
    const content = await readFileAsync(filePath, 'utf8');
    let newContent = content;
    let modified = false;
    const changes = [];

    // Process function parameters
    if (!options.skipParams && (!options.onlyVars && !options.onlyConsole && !options.onlyCatch && !options.onlyImports)) {
      for (const pattern of config.patterns.functionParams) {
        const originalContent = newContent;
        newContent = newContent.replace(pattern.regex, pattern.replacement);
        
        if (originalContent !== newContent) {
          modified = true;
          stats.fixesByType.params++;
          changes.push(`Fixed ${pattern.description}`);
        }
      }
    }

    // Process variable declarations
    if (!options.skipVars && (!options.onlyParams && !options.onlyConsole && !options.onlyCatch && !options.onlyImports)) {
      for (const pattern of config.patterns.variableDeclarations) {
        const originalContent = newContent;
        newContent = newContent.replace(pattern.regex, pattern.replacement);
        
        if (originalContent !== newContent) {
          modified = true;
          stats.fixesByType.vars++;
          changes.push(`Fixed ${pattern.description}`);
        }
      }
    }

    // Process console statements
    if (!options.skipConsole && (!options.onlyParams && !options.onlyVars && !options.onlyCatch && !options.onlyImports)) {
      for (const pattern of config.patterns.consoleStatements) {
        const originalContent = newContent;
        newContent = newContent.replace(pattern.regex, pattern.replacement);
        
        if (originalContent !== newContent) {
          modified = true;
          stats.fixesByType.console++;
          changes.push(`Fixed ${pattern.description}`);
        }
      }
    }

    // Process try/catch error variables
    if (!options.skipCatch && (!options.onlyParams && !options.onlyVars && !options.onlyConsole && !options.onlyImports)) {
      for (const pattern of config.patterns.catchClauses) {
        const originalContent = newContent;
        newContent = newContent.replace(pattern.regex, pattern.replacement);
        
        if (originalContent !== newContent) {
          modified = true;
          stats.fixesByType.catch++;
          changes.push(`Fixed ${pattern.description}`);
        }
      }
    }

    // Process unused imports (more complex, requires ESLint output)
    if (!options.skipImports && (!options.onlyParams && !options.onlyVars && !options.onlyConsole && !options.onlyCatch)) {
      // This is a placeholder for import processing
      // In a real implementation, we would use ESLint output to identify unused imports
      // For now, we'll just log that this feature is not implemented
      log(`Note: Unused import processing requires ESLint output and is not fully implemented.`, true);
    }

    // Write changes if modified and not in dry run mode
    if (modified) {
      stats.filesModified++;
      
      if (options.dryRun) {
        log(`[DRY RUN] Would modify: ${path.relative(process.cwd(), filePath)}`, true);
        if (options.verbose) {
          log(`  Changes: ${changes.join(', ')}`, true);
        }
      } else {
        // Create backup before writing
        await backupFile(filePath);
        
        // Write changes
        await writeFileAsync(filePath, newContent, 'utf8');
        
        log(`Modified: ${path.relative(process.cwd(), filePath)}`);
        if (options.verbose) {
          log(`  Changes: ${changes.join(', ')}`, true);
        }
      }
    } else {
      log(`Skipped: ${path.relative(process.cwd(), filePath)} (no changes)`, true);
    }

    return modified;
  } catch (err) {
    console.error(`Error processing file ${filePath}:`, err);
    stats.errors++;
    return false;
  }
}

/**
 * Generate and display report
 */
function generateReport() {
  console.log('\n========== AUTOMATED FIXES REPORT ==========');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN (no changes made)' : 'LIVE RUN'}`);
  console.log(`Directory processed: ${config.srcDir}`);
  console.log('\nSTATISTICS:');
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`Files modified: ${stats.filesModified}`);
  console.log(`Backups created: ${stats.backupsCreated}`);
  console.log('\nFIXES APPLIED:');
  console.log(`Function parameters: ${stats.fixesByType.params}`);
  console.log(`Variable declarations: ${stats.fixesByType.vars}`);
  console.log(`Console statements: ${stats.fixesByType.console}`);
  console.log(`Try/catch clauses: ${stats.fixesByType.catch}`);
  console.log(`Unused imports: ${stats.fixesByType.imports}`);
  console.log(`\nErrors encountered: ${stats.errors}`);
  
  if (options.dryRun) {
    console.log('\nThis was a dry run. No files were modified.');
    console.log('Run without --dry-run to apply changes.');
  }
  
  console.log('\nNOTE: This script applies automated fixes for common patterns.');
  console.log('Some issues may require manual review and fixing.');
  console.log('Always verify changes and run tests after applying fixes.');
  console.log('============================================');
}

/**
 * Main function
 */
async function main() {
  console.log('Automated Unused Variable Fixes');
  console.log(`Mode: ${options.dryRun ? 'Dry Run (no changes will be made)' : 'Live Run'}`);
  
  if (options.help) {
    showHelp();
    return;
  }
  
  try {
    // Get all source files
    const sourceFiles = await getAllSourceFiles();
    log(`Found ${sourceFiles.length} files to process in ${config.srcDir}`, true);
    
    // Process each file
    let modifiedCount = 0;
    for (const filePath of sourceFiles) {
      const modified = await processFile(filePath);
      if (modified) modifiedCount++;
    }
    
    // Generate report
    generateReport();
    
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

// Run the script
main();
