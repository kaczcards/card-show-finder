#!/usr/bin/env node
/**
 * Fix Import/Export Naming Issues
 * 
 * This script fixes import/export statements where components/functions were 
 * incorrectly prefixed with underscores during the automated cleanup process.
 * 
 * It focuses on:
 * 1. Library imports (React Native, React Navigation, etc.)
 * 2. Component imports that reference actual files
 * 3. Export statements with incorrect underscore prefixes
 * 
 * Usage:
 *   node scripts/fix-import-exports.js [options]
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
const existsAsync = promisify(fs.exists);
const statAsync = promisify(fs.stat);
const readdirAsync = promisify(fs.readdir);

// Configuration
const config = {
  srcDir: path.resolve(process.cwd(), 'src'),
  backupDir: path.resolve(process.cwd(), 'import-export-fixes-backups'),
  timestamp: new Date().toISOString().replace(/:/g, '-'),
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  noBackup: process.argv.includes('--no-backup'),
  help: process.argv.includes('--help'),
  priorityDirs: ['navigation', 'screens', 'components']
};

// Statistics
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  backupsCreated: 0,
  fixesApplied: {
    libraryImports: 0,
    componentImports: 0,
    exportStatements: 0,
    pathCorrections: 0,
    errors: 0,
  },
};

// Common libraries and components that should not have underscores
const commonLibraries = [
  '@react-navigation/native',
  '@react-navigation/native-stack',
  '@react-navigation/bottom-tabs',
  '@react-navigation/stack',
  'react-native',
  '@expo/vector-icons',
  'expo-status-bar',
  'react-native-maps',
];

// Help message
if (config.help) {
  console.log(`
Fix Import/Export Naming Issues

Usage:
  node scripts/fix-import-exports.js [options]

Options:
  --dry-run          Show what would be changed without making changes
  --verbose          Show detailed logs
  --no-backup        Skip creating backups (not recommended)
  --help             Show this help message
  `);
  process.exit(0);
}

// Mode message
console.log(`\nFix Import/Export Naming Issues`);
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
 * Fix import/export statements in a file
 * @param {string} filePath - Path to the file to fix
 * @returns {Promise<boolean>} - Whether the file was modified
 */
async function fixImportExportStatements(filePath) {
  try {
    // Read file content
    const content = await readFileAsync(filePath, 'utf8');
    let newContent = content;
    let modified = false;
    let fixes = {
      libraryImports: 0,
      componentImports: 0,
      exportStatements: 0,
      pathCorrections: 0,
    };

    // 1. Fix library imports (React Native, React Navigation, etc.)
    commonLibraries.forEach(library => {
      // Match imports from common libraries with underscore prefixes
      const libraryImportRegex = new RegExp(`import\\s+{\\s*_([A-Za-z0-9]+)\\s*}\\s+from\\s+['"]${library}['"]`, 'g');
      const libraryNamedImportRegex = new RegExp(`import\\s+{([^}]*)_([A-Za-z0-9]+)([^}]*)}\\s+from\\s+['"]${library}['"]`, 'g');
      
      // Fix simple imports: import { _Component } from 'library'
      if (libraryImportRegex.test(newContent)) {
        const fixedContent = newContent.replace(libraryImportRegex, (match, componentName) => {
          fixes.libraryImports++;
          if (config.verbose) {
            console.log(`  Fixed library import: { _${componentName} } → { ${componentName} }`);
          }
          return `import { ${componentName} } from '${library}'`;
        });
        
        if (fixedContent !== newContent) {
          newContent = fixedContent;
          modified = true;
        }
      }
      
      // Fix imports with multiple components: import { A, _B, C } from 'library'
      if (libraryNamedImportRegex.test(newContent)) {
        const fixedContent = newContent.replace(libraryNamedImportRegex, (match, before, componentName, after) => {
          fixes.libraryImports++;
          if (config.verbose) {
            console.log(`  Fixed library import with multiple components: _${componentName} → ${componentName}`);
          }
          return `import {${before}${componentName}${after}} from '${library}'`;
        });
        
        if (fixedContent !== newContent) {
          newContent = fixedContent;
          modified = true;
        }
      }
    });

    // 2. Fix component imports with incorrect paths
    // Example: import _Component from '../path/_Component' → import Component from '../path/Component'
    const componentPathRegex = /import\s+(_?)([A-Za-z0-9]+)\s+from\s+['"]([^'"]+)_\2['"];?/g;
    if (componentPathRegex.test(newContent)) {
      const fixedContent = newContent.replace(componentPathRegex, (match, underscore, componentName, importPath) => {
        fixes.componentImports++;
        fixes.pathCorrections++;
        if (config.verbose) {
          console.log(`  Fixed component import path: ${match} → import ${componentName} from '${importPath}${componentName}'`);
        }
        return `import ${componentName} from '${importPath}${componentName}';`;
      });
      
      if (fixedContent !== newContent) {
        newContent = fixedContent;
        modified = true;
      }
    }

    // 3. Fix named imports with incorrect paths
    // Example: import { _Component } from '../path' → import { Component } from '../path'
    const namedImportRegex = /import\s+{\s*_([A-Za-z0-9]+)\s*}\s+from\s+['"]([^'"]+)['"];?/g;
    if (namedImportRegex.test(newContent)) {
      const fixedContent = newContent.replace(namedImportRegex, (match, componentName, importPath) => {
        fixes.componentImports++;
        if (config.verbose) {
          console.log(`  Fixed named import: { _${componentName} } → { ${componentName} }`);
        }
        return `import { ${componentName} } from '${importPath}';`;
      });
      
      if (fixedContent !== newContent) {
        newContent = fixedContent;
        modified = true;
      }
    }

    // 4. Fix export statements with incorrect underscore prefixes
    // Example: export { _Component } → export { Component }
    const exportRegex = /export\s+{\s*_([A-Za-z0-9]+)\s*};?/g;
    if (exportRegex.test(newContent)) {
      const fixedContent = newContent.replace(exportRegex, (match, componentName) => {
        fixes.exportStatements++;
        if (config.verbose) {
          console.log(`  Fixed export statement: { _${componentName} } → { ${componentName} }`);
        }
        return `export { ${componentName} };`;
      });
      
      if (fixedContent !== newContent) {
        newContent = fixedContent;
        modified = true;
      }
    }

    // 5. Fix export type statements with incorrect underscore prefixes
    // Example: export type { _ComponentType } → export type { ComponentType }
    const exportTypeRegex = /export\s+type\s+{\s*_([A-Za-z0-9]+)\s*};?/g;
    if (exportTypeRegex.test(newContent)) {
      const fixedContent = newContent.replace(exportTypeRegex, (match, typeName) => {
        fixes.exportStatements++;
        if (config.verbose) {
          console.log(`  Fixed export type statement: { _${typeName} } → { ${typeName} }`);
        }
        return `export type { ${typeName} };`;
      });
      
      if (fixedContent !== newContent) {
        newContent = fixedContent;
        modified = true;
      }
    }

    // 6. Fix default exports with incorrect underscore prefixes
    // Example: export default _Component → export default Component
    const defaultExportRegex = /export\s+default\s+_([A-Za-z0-9]+);?/g;
    if (defaultExportRegex.test(newContent)) {
      const fixedContent = newContent.replace(defaultExportRegex, (match, componentName) => {
        fixes.exportStatements++;
        if (config.verbose) {
          console.log(`  Fixed default export: _${componentName} → ${componentName}`);
        }
        return `export default ${componentName};`;
      });
      
      if (fixedContent !== newContent) {
        newContent = fixedContent;
        modified = true;
      }
    }

    // Update stats
    if (modified) {
      stats.fixesApplied.libraryImports += fixes.libraryImports;
      stats.fixesApplied.componentImports += fixes.componentImports;
      stats.fixesApplied.exportStatements += fixes.exportStatements;
      stats.fixesApplied.pathCorrections += fixes.pathCorrections;
      
      // Write modified content back to file
      if (!config.dryRun) {
        await createBackup(filePath);
        await writeFileAsync(filePath, newContent, 'utf8');
        console.log(`Modified: ${path.relative(process.cwd(), filePath)}`);
        stats.filesModified++;
      } else if (config.verbose) {
        console.log(`Would modify: ${path.relative(process.cwd(), filePath)}`);
      }
    }
    
    return modified;
  } catch (error) {
    console.error(`Error fixing import/export statements in ${filePath}:`, error);
    stats.fixesApplied.errors++;
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Find all source files
    const allFiles = await findSourceFiles(config.srcDir);
    
    // Prioritize navigation and screens directories
    const priorityFiles = allFiles.filter(file => {
      const relativePath = path.relative(config.srcDir, file);
      return config.priorityDirs.some(dir => relativePath.startsWith(dir));
    });
    
    const otherFiles = allFiles.filter(file => {
      const relativePath = path.relative(config.srcDir, file);
      return !config.priorityDirs.some(dir => relativePath.startsWith(dir));
    });
    
    // Process priority files first, then others
    const filesToProcess = [...priorityFiles, ...otherFiles];
    
    console.log(`Found ${filesToProcess.length} source files to process.`);
    console.log(`Priority directories: ${config.priorityDirs.join(', ')}`);
    
    // Process each file
    for (const filePath of filesToProcess) {
      stats.filesProcessed++;
      
      if (config.verbose) {
        console.log(`Processing ${path.relative(process.cwd(), filePath)}`);
      }
      
      await fixImportExportStatements(filePath);
    }
    
    // Print report
    console.log('\n========== FIX IMPORT/EXPORT ISSUES REPORT ==========');
    console.log(`Mode: ${config.dryRun ? 'DRY RUN (no changes made)' : 'LIVE RUN'}`);
    
    console.log('\nSTATISTICS:');
    console.log(`Files processed: ${stats.filesProcessed}`);
    console.log(`Files modified: ${stats.filesModified}`);
    console.log(`Backups created: ${stats.backupsCreated}`);
    
    console.log('\nFIXES APPLIED:');
    console.log(`Library imports: ${stats.fixesApplied.libraryImports}`);
    console.log(`Component imports: ${stats.fixesApplied.componentImports}`);
    console.log(`Export statements: ${stats.fixesApplied.exportStatements}`);
    console.log(`Path corrections: ${stats.fixesApplied.pathCorrections}`);
    console.log(`Total fixes: ${stats.fixesApplied.libraryImports + 
                              stats.fixesApplied.componentImports + 
                              stats.fixesApplied.exportStatements +
                              stats.fixesApplied.pathCorrections}`);
    
    if (stats.fixesApplied.errors > 0) {
      console.log(`\nErrors encountered: ${stats.fixesApplied.errors}`);
    }
    
    if (config.dryRun) {
      console.log('\nThis was a dry run. No files were modified.');
      console.log('Run without --dry-run to apply changes.');
    }
    
    console.log('\nNOTE: This script fixes import/export naming issues caused by automated cleanup.');
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
