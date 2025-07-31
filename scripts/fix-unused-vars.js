#!/usr/bin/env node
/**
 * Fix Unused Variables Script
 * 
 * This script scans TypeScript/JavaScript files in the src/ directory and fixes
 * unused variable warnings by prefixing them with underscores.
 * 
 * Features:
 * - Handles imports, function parameters, destructured variables, catch blocks
 * - Creates backups before modifying files
 * - Detailed reporting of changes
 * - Dry run mode for testing
 * 
 * Usage:
 *   node scripts/fix-unused-vars.js [--dry-run] [--dir=src]
 * 
 * Options:
 *   --dry-run    Preview changes without modifying files
 *   --dir=path   Specify directory to process (default: src)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const dirArg = args.find(arg => arg.startsWith('--dir='));
const targetDir = dirArg ? dirArg.split('=')[1] : 'src';

// Configuration
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const IGNORED_DIRS = ['node_modules', '.git', 'build', 'dist', '__tests__'];
const BACKUP_DIR = './unused-vars-fixes-backups';

// Statistics
const stats = {
  filesScanned: 0,
  filesWithWarnings: 0,
  filesFixed: 0,
  warningsFixed: 0,
  fixesFailed: 0
};

// Patterns for different types of unused variables
const PATTERNS = {
  // Import patterns
  imports: [
    // Named imports: import { foo } from 'bar';
    { regex: /import\s*\{\s*([^{}]*)\s*\}\s*from\s*['"][^'"]+['"]/g, group: 1 },
    // Default imports: import foo from 'bar';
    { regex: /import\s+([A-Za-z0-9_$]+)\s+from\s*['"][^'"]+['"]/g, group: 1 },
    // Namespace imports: import * as foo from 'bar';
    { regex: /import\s*\*\s*as\s+([A-Za-z0-9_$]+)\s+from\s*['"][^'"]+['"]/g, group: 1 }
  ],
  
  // Variable declaration patterns
  variables: [
    // const/let/var declarations: const foo = bar;
    { regex: /\b(const|let|var)\s+([A-Za-z0-9_$]+)\s*=/g, group: 2 },
    // Destructured object: const { foo, bar } = baz;
    { regex: /\{\s*([^{}]*)\s*\}\s*=\s*/g, group: 1 },
    // Destructured array: const [foo, bar] = baz;
    { regex: /\[\s*([^[\]]*)\s*\]\s*=\s*/g, group: 1 }
  ],
  
  // Function parameters
  parameters: [
    // Function parameters: function foo(bar, baz) {}
    { regex: /function\s+[A-Za-z0-9_$]*\s*\(\s*([^)]*)\s*\)/g, group: 1 },
    // Arrow function parameters: (bar, baz) => {}
    { regex: /\(\s*([^)]*)\s*\)\s*=>/g, group: 1 },
    // Method parameters: foo(bar, baz) {}
    { regex: /\b[A-Za-z0-9_$]+\s*\(\s*([^)]*)\s*\)\s*\{/g, group: 1 }
  ],
  
  // Catch blocks
  catchBlocks: [
    // try/catch: catch(e) {}
    { regex: /catch\s*\(\s*([A-Za-z0-9_$]+)\s*\)/g, group: 1 }
  ]
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
 * Gets ESLint warnings for a file
 * @param {string} filePath - Path to the file
 * @returns {Array} Array of ESLint warnings
 */
function getESLintWarnings(filePath) {
  try {
    const output = execSync(`npx eslint "${filePath}" --format=json 2>/dev/null`, { encoding: 'utf8' });
    const results = JSON.parse(output);
    
    if (results.length === 0) return [];
    
    // Filter for unused variable warnings
    const warnings = results[0].messages.filter(msg => 
      (msg.ruleId === 'no-unused-vars' || msg.ruleId === '@typescript-eslint/no-unused-vars')
    );
    
    return warnings.map(warning => ({
      line: warning.line,
      column: warning.column,
      endLine: warning.endLine || warning.line,
      endColumn: warning.endColumn || warning.column + 1,
      message: warning.message,
      variableName: extractVariableName(warning.message)
    }));
  } catch (error) {
    console.error(`Error getting ESLint warnings for ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Extracts variable name from ESLint warning message
 * @param {string} message - ESLint warning message
 * @returns {string|null} Variable name or null if not found
 */
function extractVariableName(message) {
  // Example: "'foo' is defined but never used"
  const match = message.match(/'([^']+)'/);
  return match ? match[1] : null;
}

/**
 * Recursively finds all files with specified extensions
 * @param {string} dir - Directory to scan
 * @param {Array} extensions - Array of file extensions to include
 * @returns {Array} Array of file paths
 */
function findFiles(dir, extensions) {
  let results = [];
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      if (!IGNORED_DIRS.includes(item)) {
        results = results.concat(findFiles(itemPath, extensions));
      }
    } else if (extensions.includes(path.extname(item))) {
      results.push(itemPath);
    }
  }
  
  return results;
}

/**
 * Fixes unused variables in a file
 * @param {string} filePath - Path to the file
 * @param {Array} warnings - Array of ESLint warnings
 * @param {string} backupDir - Backup directory
 */
function fixUnusedVariables(filePath, warnings, backupDir) {
  if (warnings.length === 0) return;
  
  console.warn(`\nProcessing: ${filePath} (${warnings.length} warnings)`);
  
  try {
    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let modified = false;
    let fixCount = 0;
    
    // Create a map of line numbers to variable names to fix
    const lineVarMap = {};
    warnings.forEach(warning => {
      if (!warning.variableName) return;
      
      if (!lineVarMap[warning.line]) {
        lineVarMap[warning.line] = [];
      }
      lineVarMap[warning.line].push(warning.variableName);
    });
    
    // Process each line
    const newLines = lines.map((line, idx) => {
      const lineNum = idx + 1;
      
      // Skip lines without warnings
      if (!lineVarMap[lineNum]) return line;
      
      const varsToFix = lineVarMap[lineNum];
      let newLine = line;
      
      // Try different patterns for fixing unused variables
      for (const varName of varsToFix) {
        // Skip if already prefixed with underscore
        if (varName.startsWith('_')) continue;
        
        // 1. Handle import statements
        if (line.includes('import') && line.includes('from')) {
          // Named imports: import { foo, bar } from 'module';
          newLine = newLine.replace(
            new RegExp(`\\b${varName}\\b(?!\\s*as\\b)(?!\\s*}\\s*from)`, 'g'), 
            `${varName} as _${varName}`
          );
          
          // Default imports: import foo from 'module';
          newLine = newLine.replace(
            new RegExp(`import\\s+${varName}\\s+from`, 'g'), 
            `import ${varName} as _${varName} from`
          );
          
          // Namespace imports: import * as foo from 'module';
          newLine = newLine.replace(
            new RegExp(`import\\s+\\*\\s+as\\s+${varName}\\s+from`, 'g'), 
            `import * as _${varName} from`
          );
        }
        
        // 2. Handle variable declarations
        else if (line.match(new RegExp(`\\b(const|let|var)\\s+${varName}\\b`))) {
          newLine = newLine.replace(
            new RegExp(`\\b(const|let|var)\\s+${varName}\\b`, 'g'), 
            `$1 _${varName}`
          );
        }
        
        // 3. Handle destructured variables
        else if (line.includes('{') && line.includes('}') && line.includes('=')) {
          newLine = newLine.replace(
            new RegExp(`\\b${varName}\\b(?!\\s*:)(?!\\s*})`, 'g'), 
            `${varName}: _${varName}`
          );
        }
        
        // 4. Handle function parameters
        else if (line.includes('(') && (line.includes(')') || line.includes('=>'))) {
          newLine = newLine.replace(
            new RegExp(`\\b${varName}\\b(?!\\s*:)(?!\\s*[,)])`, 'g'), 
            `_${varName}`
          );
        }
        
        // 5. Handle catch blocks
        else if (line.includes('catch') && line.includes('(')) {
          newLine = newLine.replace(
            new RegExp(`catch\\s*\\(\\s*${varName}\\s*\\)`, 'g'), 
            `catch (_${varName})`
          );
        }
        
        // If line was modified, increment fix count
        if (newLine !== line) {
          fixCount++;
          modified = true;
        }
      }
      
      return newLine;
    });
    
    // Update statistics
    stats.filesWithWarnings++;
    
    if (modified) {
      stats.filesFixed++;
      stats.warningsFixed += fixCount;
      
      if (isDryRun) {
        console.warn(`  🔍 Would fix: ${filePath} (${fixCount}/${warnings.length} warnings) [dry run]`);
      } else {
        // Create backup
        backupFile(filePath, backupDir);
        
        // Write modified content
        fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
        console.warn(`  ✅ Fixed: ${filePath} (${fixCount}/${warnings.length} warnings)`);
      }
    } else {
      console.warn(`  ⚠️ Could not automatically fix: ${filePath} (0/${warnings.length} warnings)`);
      stats.fixesFailed++;
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
  console.warn('\n========== Unused Variables Fix Statistics ==========');
  console.warn(`Files scanned:       ${stats.filesScanned}`);
  console.warn(`Files with warnings: ${stats.filesWithWarnings}`);
  console.warn(`Files fixed:         ${stats.filesFixed}`);
  console.warn(`Warnings fixed:      ${stats.warningsFixed}`);
  console.warn(`Fixes failed:        ${stats.fixesFailed}`);
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
  console.warn('=== Fix Unused Variables Script ===');
  console.warn(`Mode: ${isDryRun ? 'Dry Run (preview only)' : 'Live Run (will modify files)'}`);
  console.warn(`Target directory: ${targetDir}`);
  
  // Create backup directory
  const backupDir = createBackupDir();
  
  // Find all files
  const files = findFiles(targetDir, FILE_EXTENSIONS);
  stats.filesScanned = files.length;
  
  console.warn(`Found ${files.length} files to process`);
  
  // Process each file
  for (const filePath of files) {
    const warnings = getESLintWarnings(filePath);
    
    if (warnings.length > 0) {
      fixUnusedVariables(filePath, warnings, backupDir);
    }
  }
  
  // Print statistics
  printStats();
  
  // Run ESLint to check remaining issues
  if (!isDryRun) {
    console.warn('\nRemaining issues can be checked by running:');
    console.warn(`  npx eslint ${targetDir} --ext .js,.jsx,.ts,.tsx`);
  }
}

// Run the script
main();
