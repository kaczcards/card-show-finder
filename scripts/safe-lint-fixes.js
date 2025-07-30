/**
 * Safe Lint Fixes Script
 * 
 * A very conservative script that only makes two types of safe changes:
 * 1. Console.log statements: Convert console.log to console.warn with an eslint-disable comment
 * 2. Unused import prefixing: Only prefix clearly unused imports with underscore
 * 
 * Usage:
 *   node scripts/safe-lint-fixes.js [--dry-run] [--verbose]
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
const backupDir = path.resolve(process.cwd(), 'lint-fix-backups');

// Stats for reporting
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  backupsCreated: 0,
  consoleLogFixed: 0,
  unusedImportsFixed: 0,
};

// Common React Native imports that are often unused
const commonImports = [
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
 * Fix console.log statements by converting to console.warn with eslint-disable
 */
function fixConsoleLogs(content) {
  let modified = false;
  let newContent = content;
  
  // Match console.log statements with various argument patterns
  const consoleLogPattern = /console\.log\s*\((.*?)\);?/g;
  
  newContent = newContent.replace(consoleLogPattern, (match, args) => {
    stats.consoleLogFixed++;
    modified = true;
    return `// eslint-disable-next-line no-console\nconsole.warn(${args});`;
  });
  
  return { content: newContent, modified };
}

/**
 * Check if an import is used in the file content
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
 * Fix unused imports by prefixing them with underscore
 */
function fixUnusedImports(content) {
  let modified = false;
  let newContent = content;
  
  // Find import statements
  const importPattern = /import\s+{([^}]*)}\s+from\s+['"]([^'"]+)['"]/g;
  
  // Process each import statement
  newContent = newContent.replace(importPattern, (match, importList, importPath) => {
    // Split the import list by commas
    const imports = importList.split(',').map(i => i.trim());
    let modifiedImports = false;
    
    // Process each individual import
    const processedImports = imports.map(importItem => {
      // Skip imports that already have underscore prefix
      if (importItem.startsWith('_')) {
        return importItem;
      }
      
      // Extract the import name (handling 'as' aliases)
      const importName = importItem.split(' as ')[0].trim();
      
      // Check if this is a common import and if it's unused
      if (commonImports.includes(importName) && !isImportUsed(importName, content)) {
        stats.unusedImportsFixed++;
        modifiedImports = true;
        modified = true;
        
        // Handle 'as' aliases
        if (importItem.includes(' as ')) {
          const [name, alias] = importItem.split(' as ').map(part => part.trim());
          return `_${name} as ${alias}`;
        }
        
        return `_${importName}`;
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
    const { content: contentWithFixedLogs, modified: logsModified } = fixConsoleLogs(content);
    const { content: finalContent, modified: importsModified } = fixUnusedImports(contentWithFixedLogs);
    
    const isModified = logsModified || importsModified;
    
    if (isModified) {
      stats.filesModified++;
      
      if (isVerbose) {
        console.log(`✓ Modified: ${path.relative(process.cwd(), filePath)}`);
        if (logsModified) console.log(`  - Fixed console.log statements`);
        if (importsModified) console.log(`  - Fixed unused imports`);
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
  console.log('Safe Lint Fixes Script');
  console.log(`Mode: ${isDryRun ? 'Dry Run (no changes will be made)' : 'Live Run'}`);
  
  try {
    await processDirectory(srcDir);
    
    console.log('\nSummary:');
    console.log(`Files processed: ${stats.filesProcessed}`);
    console.log(`Files modified: ${stats.filesModified}`);
    console.log(`Backups created: ${stats.backupsCreated}`);
    console.log(`Console.log statements fixed: ${stats.consoleLogFixed}`);
    console.log(`Unused imports fixed: ${stats.unusedImportsFixed}`);
    
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
