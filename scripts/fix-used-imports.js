/**
 * Fix Used Imports Script
 * 
 * This script fixes incorrectly prefixed imports that are actually used in the file.
 * It specifically targets React Native imports that were incorrectly prefixed with underscore.
 * 
 * Usage:
 *   node scripts/fix-used-imports.js [--dry-run] [--verbose]
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const copyFileAsync = promisify(fs.copyFile);
const existsAsync = promisify(fs.exists);
const mkdirAsync = promisify(fs.mkdir);

// Command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

// Directory to process
const srcDir = path.resolve(process.cwd(), 'src');
const backupDir = path.resolve(process.cwd(), 'import-fix-backups');

// Stats for reporting
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  backupsCreated: 0,
  importsFixed: 0,
};

// Common React Native imports that might have been incorrectly prefixed
const commonReactNativeImports = [
  'StyleSheet',
  'TouchableOpacity',
  'ActivityIndicator',
  'Alert',
  'Platform',
  'ViewStyle',
  'TextStyle',
  'ImageStyle',
  'Dimensions',
  'FlatList',
  'ScrollView',
  'View',
  'Text',
  'Image',
  'Button',
  'Pressable',
  'Modal',
  'SafeAreaView',
  'TextInput',
  'KeyboardAvoidingView',
  'Switch',
  'Animated',
  'Easing',
];

// Common imports from other modules that might have been incorrectly prefixed
const otherCommonImports = [
  'Sentry',
  'supabase',
  'CardCategory',
  'ShowFeature',
  'PaginatedWantLists',
  'User',
  'Show',
  'UserRole',
  'Dealer',
  'Organizer',
  'FilterPreset',
  'Marker',
];

/**
 * Creates a backup of the file before modifying it
 */
async function backupFile(filePath) {
  try {
    // Create backup directory if it doesn't exist
    if (!await existsAsync(backupDir)) {
      await mkdirAsync(backupDir, { recursive: true });
    }
    
    // Create subdirectories to match the original file structure
    const relativePath = path.relative(process.cwd(), filePath);
    const backupPath = path.join(backupDir, relativePath);
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
    return null;
  }
}

/**
 * Check if an import is actually used in the file content
 */
function isImportUsed(importName, content) {
  // Skip the import declaration section to avoid false positives
  const contentAfterImports = content.split(/import.*?from.*?;/s).pop() || '';
  
  // Create a regex that looks for the import name as a standalone identifier
  // This avoids matching partial names (e.g., "Alert" shouldn't match "AlertDialog")
  const usagePattern = new RegExp(`\\b${importName}\\b`, 'g');
  
  return usagePattern.test(contentAfterImports);
}

/**
 * Fix incorrectly prefixed imports that are actually used
 */
function fixIncorrectlyPrefixedImports(content) {
  let modified = false;
  let newContent = content;
  
  // Find import statements from react-native
  const reactNativeImportPattern = /import\s+{([^}]*)}\s+from\s+['"]react-native['"]/g;
  
  // Process each import statement from react-native
  newContent = newContent.replace(reactNativeImportPattern, (match, importList) => {
    // Split the import list by commas
    const imports = importList.split(',').map(i => i.trim());
    let modifiedImports = false;
    
    // Process each individual import
    const processedImports = imports.map(importItem => {
      // Check if it's a prefixed import
      if (importItem.startsWith('_')) {
        const importName = importItem.substring(1); // Remove underscore
        
        // Check if it's a common React Native import and if it's used in the file
        if (commonReactNativeImports.includes(importName) && isImportUsed(importName, content)) {
          stats.importsFixed++;
          modifiedImports = true;
          modified = true;
          
          // Handle 'as' aliases
          if (importItem.includes(' as ')) {
            const [name, alias] = importItem.split(' as ').map(part => part.trim());
            return `${name.substring(1)} as ${alias}`;
          }
          
          return importName;
        }
      }
      
      return importItem;
    });
    
    // Only modify the import statement if we changed something
    if (modifiedImports) {
      return `import { ${processedImports.join(', ')} } from 'react-native'`;
    }
    
    return match;
  });
  
  // Find import statements from other modules
  const otherImportPattern = /import\s+{([^}]*)}\s+from\s+['"]([^'"]+)['"]/g;
  
  // Process each import statement from other modules
  newContent = newContent.replace(otherImportPattern, (match, importList, importPath) => {
    // Skip react-native imports as they were handled above
    if (importPath === 'react-native') {
      return match;
    }
    
    // Split the import list by commas
    const imports = importList.split(',').map(i => i.trim());
    let modifiedImports = false;
    
    // Process each individual import
    const processedImports = imports.map(importItem => {
      // Check if it's a prefixed import
      if (importItem.startsWith('_')) {
        const importName = importItem.substring(1); // Remove underscore
        
        // Check if it's a common import and if it's used in the file
        if (otherCommonImports.includes(importName) && isImportUsed(importName, content)) {
          stats.importsFixed++;
          modifiedImports = true;
          modified = true;
          
          // Handle 'as' aliases
          if (importItem.includes(' as ')) {
            const [name, alias] = importItem.split(' as ').map(part => part.trim());
            return `${name.substring(1)} as ${alias}`;
          }
          
          return importName;
        }
      }
      
      return importItem;
    });
    
    // Only modify the import statement if we changed something
    if (modifiedImports) {
      return `import { ${processedImports.join(', ')} } from '${importPath}'`;
    }
    
    return match;
  });
  
  return { content: newContent, modified };
}

/**
 * Process a single file
 */
async function processFile(filePath) {
  try {
    // Skip non-JS/TS files
    if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) {
      return;
    }
    
    stats.filesProcessed++;
    
    // Read the file content
    const content = await readFileAsync(filePath, 'utf8');
    
    // Apply fixes
    const { content: finalContent, modified } = fixIncorrectlyPrefixedImports(content);
    
    if (modified) {
      stats.filesModified++;
      
      if (isVerbose) {
        console.log(`✓ Fixed imports in: ${path.relative(process.cwd(), filePath)}`);
      }
      
      if (!isDryRun) {
        // Create backup before modifying
        await backupFile(filePath);
        
        // Write the modified content back to the file
        await writeFileAsync(filePath, finalContent, 'utf8');
      }
    }
  } catch (err) {
    console.error(`Error processing file ${filePath}:`, err);
  }
}

/**
 * Recursively process all files in a directory
 */
async function processDirectory(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await processDirectory(fullPath);
      } else {
        await processFile(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error processing directory ${dirPath}:`, err);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Fix Used Imports Script');
  console.log(`Mode: ${isDryRun ? 'Dry Run (no changes will be made)' : 'Live Run'}`);
  
  try {
    await processDirectory(srcDir);
    
    console.log('\nSummary:');
    console.log(`Files processed: ${stats.filesProcessed}`);
    console.log(`Files modified: ${stats.filesModified}`);
    console.log(`Backups created: ${stats.backupsCreated}`);
    console.log(`Imports fixed: ${stats.importsFixed}`);
    
    if (isDryRun) {
      console.log('\nThis was a dry run. No files were actually modified.');
      console.log('Run without --dry-run to apply changes.');
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

// Run the script
main();
