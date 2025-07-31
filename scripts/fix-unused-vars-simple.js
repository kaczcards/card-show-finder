#!/usr/bin/env node
/**
 * Fix Unused Variables Script
 * 
 * This script automatically identifies and fixes unused variable warnings by
 * prefixing them with an underscore (_) to follow the project's convention.
 * 
 * Usage:
 *   node scripts/fix-unused-vars-simple.js [--dry-run]
 * 
 * Options:
 *   --dry-run    Preview changes without modifying files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  // Source directory to process
  srcDir: 'src',
  // Backup directory
  backupDir: 'unused-vars-backups',
  // File extensions to process
  fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  // Directories to exclude
  excludeDirs: [
    'node_modules',
    '__tests__',
    'e2e',
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
    'debug-app-exact.js',
    'debug-app-flow.js',
  ],
  // ESLint rule ID for unused variables
  unusedVarRuleId: '@typescript-eslint/no-unused-vars',
};

// Command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// Statistics
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  varsFixed: 0,
  catchVarsFixed: 0,
  destructuredVarsFixed: 0,
  importVarsFixed: 0,
};

/**
 * Creates a timestamped backup directory
 * @returns {string} Path to the backup directory
 */
function createBackupDir() {
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
  for (const dir of CONFIG.excludeDirs) {
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
  if (!CONFIG.fileExtensions.includes(ext)) {
    return true;
  }
  
  return false;
}

/**
 * Runs ESLint on a file and returns the results
 * @param {string} filePath - Path to the file
 * @returns {Array} - Array of ESLint messages
 */
function runESLintOnFile(filePath) {
  try {
    const output = execSync(
      `npx eslint --format=json "${filePath}"`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    
    const results = JSON.parse(output);
    if (results && results.length > 0) {
      return results[0].messages || [];
    }
    
    return [];
  } catch (error) {
    // If ESLint exits with non-zero code, parse the output from stderr
    try {
      const output = error.stdout || '';
      const results = JSON.parse(output);
      if (results && results.length > 0) {
        return results[0].messages || [];
      }
    } catch (parseError) {
      console.error(`Error parsing ESLint output for ${filePath}:`, parseError);
    }
    
    return [];
  }
}

/**
 * Fixes unused variables in a file
 * @param {string} filePath - Path to the file
 * @param {string} backupDir - Backup directory
 */
function fixUnusedVarsInFile(filePath, backupDir) {
  console.warn(`Processing: ${filePath}`);
  
  // Get ESLint messages for the file
  const messages = runESLintOnFile(filePath);
  
  // Filter for unused variable warnings
  const unusedVarMessages = messages.filter(msg => 
    msg.ruleId === CONFIG.unusedVarRuleId && 
    msg.message.includes('is defined but never used')
  );
  
  if (unusedVarMessages.length === 0) {
    console.warn(`  ✓ No unused variables found in: ${filePath}`);
    stats.filesProcessed++;
    return;
  }
  
  // Read file content
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = content;
  let varsFixed = 0;
  let catchVarsFixed = 0;
  let destructuredVarsFixed = 0;
  let importVarsFixed = 0;
  
  // Process each unused variable
  for (const msg of unusedVarMessages) {
    const varNameMatch = msg.message.match(/'([^']+)' is defined but never used/);
    if (!varNameMatch) continue;
    
    const varName = varNameMatch[1];
    
    // Skip if already prefixed with underscore
    if (varName.startsWith('_')) {
      continue;
    }
    
    // Get the line where the variable is defined
    const line = content.split('\n')[msg.line - 1];
    
    // Check if this is a catch block variable
    if (line.includes('catch') && line.includes(`(${varName})`)) {
      // Replace catch(varName) with catch(_varName)
      const newLine = line.replace(`(${varName})`, `(_${varName})`);
      modified = modified.replace(line, newLine);
      varsFixed++;
      catchVarsFixed++;
      continue;
    }
    
    // Check if this is a destructured variable
    const destructureMatch = line.match(new RegExp(`\\{[^}]*\\b${varName}\\b[^}]*\\}`));
    if (destructureMatch) {
      // This is trickier - we need to be careful not to break the destructuring
      // Only fix if it's a simple case like { varName } or { varName, ... }
      const destructurePattern = new RegExp(`(\\{[^}]*\\b)(${varName})(\\b[^}]*\\})`);
      if (destructurePattern.test(line)) {
        const newLine = line.replace(destructurePattern, `$1_${varName}$3`);
        modified = modified.replace(line, newLine);
        varsFixed++;
        destructuredVarsFixed++;
        continue;
      }
    }
    
    // Check if this is an import variable
    if (line.includes('import') && line.includes('from')) {
      // Handle named imports like: import { X } from 'module'
      const namedImportPattern = new RegExp(`(import\\s+\\{[^}]*\\b)(${varName})(\\b[^}]*\\}\\s+from)`);
      if (namedImportPattern.test(line)) {
        const newLine = line.replace(namedImportPattern, `$1${varName} as _${varName}$3`);
        modified = modified.replace(line, newLine);
        varsFixed++;
        importVarsFixed++;
        continue;
      }
      
      // Handle default imports like: import X from 'module'
      const defaultImportPattern = new RegExp(`(import\\s+)(${varName})(\\s+from)`);
      if (defaultImportPattern.test(line)) {
        const newLine = line.replace(defaultImportPattern, `$1${varName} as _${varName}$3`);
        modified = modified.replace(line, newLine);
        varsFixed++;
        importVarsFixed++;
        continue;
      }
    }
    
    // Handle normal variable declarations
    // This is a simplified approach - a more robust solution would use AST parsing
    const varPattern = new RegExp(`\\b(const|let|var|function|class|interface)\\s+${varName}\\b`);
    if (varPattern.test(line)) {
      const newLine = line.replace(
        new RegExp(`\\b(const|let|var|function|class|interface)\\s+${varName}\\b`), 
        `$1 _${varName}`
      );
      modified = modified.replace(line, newLine);
      varsFixed++;
      continue;
    }
    
    // Handle function parameters
    const paramPattern = new RegExp(`\\(([^)]*)\\b${varName}\\b([^)]*)\\)`);
    if (paramPattern.test(line)) {
      // This is a simplified approach - we need to be careful with function parameters
      // Only fix if it's a simple case
      const newLine = line.replace(
        new RegExp(`\\b${varName}\\b(?=\\s*[,):])`, 'g'), 
        `_${varName}`
      );
      modified = modified.replace(line, newLine);
      varsFixed++;
      continue;
    }
  }
  
  // Update statistics
  stats.filesProcessed++;
  stats.varsFixed += varsFixed;
  stats.catchVarsFixed += catchVarsFixed;
  stats.destructuredVarsFixed += destructuredVarsFixed;
  stats.importVarsFixed += importVarsFixed;
  
  if (varsFixed > 0) {
    stats.filesModified++;
    
    if (isDryRun) {
      console.warn(`  🔍 Would fix ${varsFixed} unused variables in: ${filePath} (dry run)`);
    } else {
      // Create backup
      backupFile(filePath, backupDir);
      
      // Write modified content
      fs.writeFileSync(filePath, modified, 'utf8');
      console.warn(`  ✅ Fixed ${varsFixed} unused variables in: ${filePath}`);
    }
  } else {
    console.warn(`  ✓ No fixable unused variables found in: ${filePath}`);
  }
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
 * Prints statistics
 */
function printStats() {
  console.warn('\n========== Unused Variables Fix Statistics ==========');
  console.warn(`Files processed:           ${stats.filesProcessed}`);
  console.warn(`Files modified:            ${stats.filesModified}`);
  console.warn(`Total variables fixed:     ${stats.varsFixed}`);
  console.warn(`  - Catch variables:       ${stats.catchVarsFixed}`);
  console.warn(`  - Destructured variables: ${stats.destructuredVarsFixed}`);
  console.warn(`  - Import variables:      ${stats.importVarsFixed}`);
  console.warn(`  - Other variables:       ${
    stats.varsFixed - stats.catchVarsFixed - stats.destructuredVarsFixed - stats.importVarsFixed
  }`);
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
  
  // Create backup directory
  const backupDir = createBackupDir();
  
  // Find all files in src directory
  console.warn(`Finding files in ${CONFIG.srcDir}...`);
  const files = findFiles(CONFIG.srcDir);
  console.warn(`Found ${files.length} files to process.`);
  
  // Process each file
  for (const file of files) {
    fixUnusedVarsInFile(file, backupDir);
  }
  
  // Process App.tsx separately as it's in the root
  if (fs.existsSync('App.tsx')) {
    fixUnusedVarsInFile('App.tsx', backupDir);
  }
  
  // Print statistics
  printStats();
  
  // Run ESLint to check remaining issues
  if (!isDryRun) {
    console.warn('\nRunning ESLint to check remaining unused variable warnings...');
    try {
      const output = execSync(
        `npx eslint --rule "@typescript-eslint/no-unused-vars: error" ${CONFIG.srcDir} App.tsx --quiet | grep -c "${CONFIG.unusedVarRuleId}"`,
        { encoding: 'utf8', stdio: 'pipe' }
      );
      console.warn(`\nRemaining unused variable warnings: ${output.trim()}`);
    } catch (error) {
      console.warn('\nNo remaining unused variable warnings found!');
    }
  }
}

// Run the script
main();
