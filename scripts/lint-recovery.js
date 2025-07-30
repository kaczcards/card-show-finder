/**
 * Lint Recovery Script
 * 
 * This script fixes common issues caused by overly aggressive lint automation:
 * - Restores React Native imports that were incorrectly prefixed with underscores
 * - Fixes type imports that were broken
 * - Repairs common property access patterns
 * 
 * Usage:
 *   node scripts/lint-recovery.js [--dry-run]
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
const backupDir = path.resolve(process.cwd(), 'lint-recovery-backups');

// Stats for reporting
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  backupsCreated: 0,
  importsFixes: 0,
  propertyFixes: 0,
};

// Common React Native imports that may have been incorrectly prefixed
const reactNativeImports = [
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
];

// Common type imports that may have been broken
const typeImports = [
  'CardCategory',
  'ShowFeature',
  'PaginatedWantLists',
  'User',
  'Show',
  'UserRole',
  'Dealer',
  'Organizer',
  'FilterPreset',
];

// Property access patterns that might be broken
const propertyPatterns = [
  { search: /(\b_?StyleSheet\b)\.create/g, replace: 'StyleSheet.create' },
  { search: /(\b_?StyleSheet\b)\.absoluteFill/g, replace: 'StyleSheet.absoluteFill' },
  { search: /(\b_?StyleSheet\b)\.absoluteFillObject/g, replace: 'StyleSheet.absoluteFillObject' },
  { search: /(\b_?Platform\b)\.OS/g, replace: 'Platform.OS' },
  { search: /(\b_?Dimensions\b)\.get/g, replace: 'Dimensions.get' },
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
 * Fix import statements that were incorrectly prefixed with underscores
 */
function fixImports(content) {
  let modified = false;
  let newContent = content;
  
  // Fix React Native imports
  reactNativeImports.forEach(importName => {
    const pattern = new RegExp(`import\\s+{[^}]*?\\b_${importName}\\b[^}]*?}\\s+from\\s+['"]react-native['"]`, 'g');
    const replacement = (match) => {
      stats.importsFixes++;
      modified = true;
      return match.replace(`_${importName}`, importName);
    };
    
    newContent = newContent.replace(pattern, replacement);
  });
  
  // Fix type imports - more generic pattern since they could be from various modules
  typeImports.forEach(importName => {
    const pattern = new RegExp(`import\\s+{[^}]*?\\b_${importName}\\b[^}]*?}\\s+from\\s+['"][^'"]+['"]`, 'g');
    const replacement = (match) => {
      stats.importsFixes++;
      modified = true;
      return match.replace(`_${importName}`, importName);
    };
    
    newContent = newContent.replace(pattern, replacement);
  });
  
  // Fix commented out imports that should be restored
  const commentedImportPattern = /\/\/\s*Removed unused import:\s*import\s+{\s*(\w+)\s*}\s*from\s+['"]([^'"]+)['"]/g;
  newContent = newContent.replace(commentedImportPattern, (match, importName, importPath) => {
    // Only restore critical imports like supabase
    if (importPath === '../supabase' || 
        reactNativeImports.some(name => importName === name || importName === `_${name}`)) {
      stats.importsFixes++;
      modified = true;
      // Remove underscore prefix if present
      const cleanImportName = importName.startsWith('_') ? importName.substring(1) : importName;
      return `import { ${cleanImportName} } from '${importPath}'`;
    }
    return match;
  });
  
  return { content: newContent, modified };
}

/**
 * Fix property access patterns that were broken
 */
function fixPropertyPatterns(content) {
  let modified = false;
  let newContent = content;
  
  propertyPatterns.forEach(({ search, replace }) => {
    newContent = newContent.replace(search, (match) => {
      stats.propertyFixes++;
      modified = true;
      return replace;
    });
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
    const { content: contentWithFixedImports, modified: importsModified } = fixImports(content);
    const { content: finalContent, modified: patternsModified } = fixPropertyPatterns(contentWithFixedImports);
    
    const isModified = importsModified || patternsModified;
    
    if (isModified) {
      stats.filesModified++;
      
      if (isVerbose) {
        console.log(`✓ Modified: ${path.relative(process.cwd(), filePath)}`);
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
  console.log('Lint Recovery Script');
  console.log(`Mode: ${isDryRun ? 'Dry Run (no changes will be made)' : 'Live Run'}`);
  
  try {
    await processDirectory(srcDir);
    
    console.log('\nSummary:');
    console.log(`Files processed: ${stats.filesProcessed}`);
    console.log(`Files modified: ${stats.filesModified}`);
    console.log(`Backups created: ${stats.backupsCreated}`);
    console.log(`Import fixes: ${stats.importsFixes}`);
    console.log(`Property pattern fixes: ${stats.propertyFixes}`);
    
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
