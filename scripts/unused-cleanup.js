#!/usr/bin/env node
/**
 * Unused Code Cleanup Script
 * 
 * This script helps identify and clean up:
 * 1. Unused imports in files
 * 2. Potentially unused files in the codebase
 * 
 * Features:
 * - Uses ESLint with unused-imports plugin to identify unused imports
 * - Automatically fixes unused import issues
 * - Identifies potentially unused files by analyzing import statements
 * - Creates detailed reports
 * - Creates backups before making changes
 * - Supports dry-run mode and verbose output
 * 
 * Usage:
 *   node scripts/unused-cleanup.js [options]
 * 
 * Options:
 *   --dry-run          Show what would be changed without making changes
 *   --verbose          Show detailed logs
 *   --fix-imports      Automatically fix unused imports
 *   --report-files     Report potentially unused files
 *   --clean-files      Remove unused files (use with caution)
 *   --no-backup        Skip creating backups (not recommended)
 *   --help             Show this help message
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { execSync, spawn } = require('child_process');

// Promisify fs functions
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const copyFileAsync = promisify(fs.copyFile);
const existsAsync = promisify(fs.exists);
const statAsync = promisify(fs.stat);
const readdirAsync = promisify(fs.readdir);
const unlinkAsync = promisify(fs.unlink);

// Configuration
const config = {
  srcDir: path.resolve(process.cwd(), 'src'),
  backupDir: path.resolve(process.cwd(), 'unused-cleanup-backups'),
  timestamp: new Date().toISOString().replace(/:/g, '-'),
  excludedDirs: ['node_modules', '.git', 'build', 'dist', 'coverage', 'backup'],
  excludedFiles: [
    'index.ts', 'index.js', 'index.tsx', 'index.jsx',  // Entry points
    'App.tsx', 'App.js',                               // Main app files
    'types.ts', 'constants.ts',                        // Common type/constant files
    'setupTests.js', 'jest.setup.js'                   // Test setup files
  ],
  // Files that should never be considered unused
  criticalFiles: [
    'App.tsx', 'index.ts', 'index.js', 'index.tsx',
    'navigation/index.ts', 'navigation/index.tsx',
    'contexts/index.ts', 'contexts/index.tsx',
    'services/index.ts', 'hooks/index.ts'
  ],
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose'),
  fixImports: args.includes('--fix-imports'),
  reportFiles: args.includes('--report-files'),
  cleanFiles: args.includes('--clean-files'),
  noBackup: args.includes('--no-backup'),
  help: args.includes('--help'),
};

// Statistics for reporting
const stats = {
  filesProcessed: 0,
  filesWithUnusedImports: 0,
  unusedImportsFixed: 0,
  backupsCreated: 0,
  potentiallyUnusedFiles: 0,
  filesRemoved: 0,
  errors: 0,
};

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Unused Code Cleanup Script

Usage:
  node scripts/unused-cleanup.js [options]

Options:
  --dry-run          Show what would be changed without making changes
  --verbose          Show detailed logs
  --fix-imports      Automatically fix unused imports
  --report-files     Report potentially unused files
  --clean-files      Remove unused files (use with caution)
  --no-backup        Skip creating backups (not recommended)
  --help             Show this help message

Examples:
  # Dry run with verbose output
  node scripts/unused-cleanup.js --dry-run --verbose

  # Fix unused imports and report potentially unused files
  node scripts/unused-cleanup.js --fix-imports --report-files

  # Fix imports and remove unused files (use with caution)
  node scripts/unused-cleanup.js --fix-imports --clean-files
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
 * Run ESLint to identify unused imports
 */
async function findUnusedImports() {
  log('Finding unused imports...', true);
  
  try {
    // Run ESLint to get unused imports report
    const eslintCmd = `npx eslint src --ext .js,.jsx,.ts,.tsx --no-error-on-unmatched-pattern -f json`;
    const eslintOutput = execSync(eslintCmd, { encoding: 'utf8' });
    const eslintResults = JSON.parse(eslintOutput);
    
    // Filter for unused imports
    const filesWithUnusedImports = eslintResults
      .filter(result => {
        // We rely solely on TypeScript's unused-vars rule
        return result.messages.some(
          msg => msg.ruleId === '@typescript-eslint/no-unused-vars',
        );
      })
      .map(result => ({
        filePath: result.filePath,
        unusedImports: result.messages
          .filter(msg => msg.ruleId === '@typescript-eslint/no-unused-vars')
          .map(msg => msg.message)
      }));
    
    stats.filesWithUnusedImports = filesWithUnusedImports.length;
    
    return filesWithUnusedImports;
  } catch (err) {
    console.error('Error finding unused imports:', err);
    stats.errors++;
    return [];
  }
}

/**
 * Fix unused imports using ESLint's --fix flag
 */
async function fixUnusedImports() {
  log('Fixing unused imports...', true);
  
  if (options.dryRun) {
    log('DRY RUN: Would fix unused imports', true);
    return;
  }
  
  try {
    // Create backups first if needed
    if (!options.noBackup) {
      log('Creating backups before fixing imports...', true);
      const sourceFiles = await getAllSourceFiles();
      
      for (const filePath of sourceFiles) {
        await backupFile(filePath);
      }
    }
    
    // Run ESLint with --fix flag
    const eslintFixCmd = `npx eslint src --ext .js,.jsx,.ts,.tsx --fix --no-error-on-unmatched-pattern`;
    execSync(eslintFixCmd, { stdio: options.verbose ? 'inherit' : 'ignore' });
    
    // Get count of fixed imports (approximate)
    const filesWithUnusedImports = await findUnusedImports();
    stats.unusedImportsFixed = stats.filesWithUnusedImports - filesWithUnusedImports.length;
    
    log(`Fixed unused imports in ${stats.unusedImportsFixed} files`);
  } catch (err) {
    console.error('Error fixing unused imports:', err);
    stats.errors++;
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
 * Extract imports from a file
 */
async function extractImports(filePath) {
  try {
    const content = await readFileAsync(filePath, 'utf8');
    const imports = [];
    
    // Match ES6 imports
    const es6ImportRegex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = es6ImportRegex.exec(content)) !== null) {
      const importPath = match[1];
      imports.push(importPath);
    }
    
    // Match require statements
    const requireRegex = /(?:const|let|var)\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+=\s+require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    while ((match = requireRegex.exec(content)) !== null) {
      const importPath = match[1];
      imports.push(importPath);
    }
    
    return imports;
  } catch (err) {
    console.error(`Error extracting imports from ${filePath}:`, err);
    stats.errors++;
    return [];
  }
}

/**
 * Resolve import path to actual file path
 */
function resolveImportPath(importPath, fromFilePath) {
  try {
    // Handle node_modules imports
    if (importPath.startsWith('@') || !importPath.startsWith('.')) {
      return null; // External module, not a local file
    }
    
    const fromDir = path.dirname(fromFilePath);
    let resolvedPath = path.resolve(fromDir, importPath);
    
    // Check if path exists with extensions
    for (const ext of config.extensions) {
      const pathWithExt = `${resolvedPath}${ext}`;
      if (fs.existsSync(pathWithExt)) {
        return pathWithExt;
      }
    }
    
    // Check for index files
    for (const ext of config.extensions) {
      const indexPath = path.join(resolvedPath, `index${ext}`);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }
    
    return null;
  } catch (err) {
    console.error(`Error resolving import path ${importPath} from ${fromFilePath}:`, err);
    stats.errors++;
    return null;
  }
}

/**
 * Build dependency graph of files
 */
async function buildDependencyGraph() {
  log('Building dependency graph...', true);
  
  const sourceFiles = await getAllSourceFiles();
  const dependencyGraph = {
    // Map of file paths to the files that import them
    importedBy: {},
    // Map of file paths to the files they import
    imports: {}
  };
  
  for (const filePath of sourceFiles) {
    const imports = await extractImports(filePath);
    dependencyGraph.imports[filePath] = [];
    
    for (const importPath of imports) {
      const resolvedPath = resolveImportPath(importPath, filePath);
      
      if (resolvedPath) {
        dependencyGraph.imports[filePath].push(resolvedPath);
        
        if (!dependencyGraph.importedBy[resolvedPath]) {
          dependencyGraph.importedBy[resolvedPath] = [];
        }
        
        dependencyGraph.importedBy[resolvedPath].push(filePath);
      }
    }
  }
  
  return dependencyGraph;
}

/**
 * Find potentially unused files
 */
async function findPotentiallyUnusedFiles() {
  log('Finding potentially unused files...', true);
  
  const dependencyGraph = await buildDependencyGraph();
  const sourceFiles = await getAllSourceFiles();
  const potentiallyUnusedFiles = [];
  
  for (const filePath of sourceFiles) {
    // Skip critical files
    if (config.criticalFiles.some(criticalPath => filePath.includes(criticalPath))) {
      continue;
    }
    
    // Skip excluded files
    if (config.excludedFiles.some(excludedFile => path.basename(filePath) === excludedFile)) {
      continue;
    }
    
    // Check if file is imported anywhere
    if (!dependencyGraph.importedBy[filePath] || dependencyGraph.importedBy[filePath].length === 0) {
      potentiallyUnusedFiles.push(filePath);
    }
  }
  
  stats.potentiallyUnusedFiles = potentiallyUnusedFiles.length;
  
  return potentiallyUnusedFiles;
}

/**
 * Remove unused files
 */
async function removeUnusedFiles(unusedFiles) {
  log('Removing unused files...', true);
  
  if (options.dryRun) {
    log('DRY RUN: Would remove these files:');
    unusedFiles.forEach(file => log(`  - ${path.relative(process.cwd(), file)}`));
    return;
  }
  
  try {
    // Create backups first
    if (!options.noBackup) {
      log('Creating backups before removing files...', true);
      for (const filePath of unusedFiles) {
        await backupFile(filePath);
      }
    }
    
    // Remove files
    for (const filePath of unusedFiles) {
      await unlinkAsync(filePath);
      stats.filesRemoved++;
      log(`Removed: ${path.relative(process.cwd(), filePath)}`);
    }
  } catch (err) {
    console.error('Error removing unused files:', err);
    stats.errors++;
  }
}

/**
 * Generate and display report
 */
function generateReport(filesWithUnusedImports, potentiallyUnusedFiles) {
  console.log('\n========== UNUSED CODE CLEANUP REPORT ==========');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN (no changes made)' : 'LIVE RUN'}`);
  console.log('\nSTATISTICS:');
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`Files with unused imports: ${stats.filesWithUnusedImports}`);
  console.log(`Unused imports fixed: ${stats.unusedImportsFixed}`);
  console.log(`Potentially unused files: ${stats.potentiallyUnusedFiles}`);
  console.log(`Files removed: ${stats.filesRemoved}`);
  console.log(`Backups created: ${stats.backupsCreated}`);
  console.log(`Errors encountered: ${stats.errors}`);
  
  if (options.verbose) {
    if (filesWithUnusedImports && filesWithUnusedImports.length > 0) {
      console.log('\nFILES WITH UNUSED IMPORTS:');
      filesWithUnusedImports.forEach(file => {
        console.log(`  - ${path.relative(process.cwd(), file.filePath)}`);
        if (options.verbose) {
          file.unusedImports.forEach(msg => console.log(`      ${msg}`));
        }
      });
    }
    
    if (potentiallyUnusedFiles && potentiallyUnusedFiles.length > 0) {
      console.log('\nPOTENTIALLY UNUSED FILES:');
      potentiallyUnusedFiles.forEach(file => {
        console.log(`  - ${path.relative(process.cwd(), file)}`);
      });
    }
  }
  
  console.log('\nRECOMMENDATIONS:');
  if (filesWithUnusedImports && filesWithUnusedImports.length > 0) {
    console.log('- Run with --fix-imports to automatically fix unused imports');
  } else {
    console.log('- No unused imports found or all have been fixed');
  }
  
  if (potentiallyUnusedFiles && potentiallyUnusedFiles.length > 0) {
    console.log('- Review potentially unused files and run with --clean-files to remove them');
    console.log('  (Always run with --dry-run first to verify what will be removed)');
  } else {
    console.log('- No potentially unused files found');
  }
  
  console.log('\nNOTE: Files may be used in ways not detectable by static analysis.');
  console.log('Always verify before removing files, especially for:');
  console.log('- Files dynamically imported or required');
  console.log('- Files used in build processes or configurations');
  console.log('- Component files that might be referenced in JSX without imports');
  console.log('===============================================');
}

/**
 * Main function
 */
async function main() {
  console.log('Unused Code Cleanup Script');
  console.log(`Mode: ${options.dryRun ? 'Dry Run (no changes will be made)' : 'Live Run'}`);
  
  if (options.help) {
    showHelp();
    return;
  }
  
  try {
    // Find unused imports
    const filesWithUnusedImports = await findUnusedImports();
    
    // Fix unused imports if requested
    if (options.fixImports) {
      await fixUnusedImports();
    }
    
    // Find potentially unused files
    let potentiallyUnusedFiles = [];
    if (options.reportFiles || options.cleanFiles) {
      potentiallyUnusedFiles = await findPotentiallyUnusedFiles();
    }
    
    // Remove unused files if requested
    if (options.cleanFiles && potentiallyUnusedFiles.length > 0) {
      await removeUnusedFiles(potentiallyUnusedFiles);
    }
    
    // Generate report
    generateReport(filesWithUnusedImports, potentiallyUnusedFiles);
    
    if (options.dryRun) {
      console.log('\nThis was a dry run. No files were modified.');
      console.log('Run without --dry-run to apply changes.');
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

// Run the script
main();
