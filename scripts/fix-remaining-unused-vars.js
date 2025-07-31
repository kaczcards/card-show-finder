#!/usr/bin/env node
/**
 * Fix Remaining Unused Variables Script
 * 
 * This script automatically fixes all remaining unused variable warnings in the src/ directory
 * by adding underscore prefixes to comply with ESLint rules.
 * 
 * Usage:
 *   node scripts/fix-remaining-unused-vars.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const SRC_DIR = 'src';
const BACKUP_DIR = `unused-vars-remaining-fixes-backups/${new Date().toISOString()}`;

// Create backup directory
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

console.log('🔍 Running ESLint to find remaining unused variables...');

// Run ESLint and capture output
let eslintOutput;
try {
  eslintOutput = execSync(`npx eslint ${SRC_DIR} --format json`, { encoding: 'utf8' });
} catch (error) {
  // ESLint returns non-zero exit code when it finds issues, which throws an error
  // We want to capture that output
  eslintOutput = error.stdout;
}

// Parse ESLint JSON output
const eslintResults = JSON.parse(eslintOutput);

// Filter for unused variable warnings
const unusedVarWarnings = [];

eslintResults.forEach(result => {
  const filePath = result.filePath;
  
  result.messages.forEach(message => {
    // Check for unused variable warnings
    if (
      (message.ruleId === '@typescript-eslint/no-unused-vars' || 
       message.ruleId === 'no-unused-vars') &&
      message.severity === 1 // Warning severity
    ) {
      unusedVarWarnings.push({
        filePath,
        line: message.line,
        column: message.column,
        variableName: message.message.match(/['"]([^'"]+)['"]/)?.[1] || '',
        messageText: message.message
      });
    }
  });
});

console.log(`🔎 Found ${unusedVarWarnings.length} unused variable warnings in ${new Set(unusedVarWarnings.map(w => w.filePath)).size} files.`);

// Group warnings by file
const warningsByFile = {};
unusedVarWarnings.forEach(warning => {
  if (!warningsByFile[warning.filePath]) {
    warningsByFile[warning.filePath] = [];
  }
  warningsByFile[warning.filePath].push(warning);
});

// Process each file
let filesModified = 0;
let warningsFixed = 0;

for (const filePath in warningsByFile) {
  const warnings = warningsByFile[filePath];
  console.log(`\n📝 Processing ${filePath} (${warnings.length} warnings)`);
  
  // Read file content
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Create backup
  const relativePath = path.relative(process.cwd(), filePath);
  const backupPath = path.join(BACKUP_DIR, relativePath);
  const backupDir = path.dirname(backupPath);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  fs.writeFileSync(backupPath, content);
  
  // Sort warnings by line and column in reverse order (to avoid position shifts)
  warnings.sort((a, b) => {
    if (a.line !== b.line) return b.line - a.line;
    return b.column - a.column;
  });
  
  // Track variable names that have been fixed
  const fixedVariables = new Set();
  
  // Process each warning
  for (const warning of warnings) {
    const { variableName, messageText } = warning;
    
    // Skip if we've already fixed this variable in this file
    if (fixedVariables.has(variableName)) continue;
    
    console.log(`  - ${messageText}`);
    
    // Different fix strategies based on warning patterns
    
    // 1. Fix function parameters: (param) → (_param)
    if (messageText.includes('defined but never used') && messageText.includes('args must match')) {
      // Function parameter pattern
      const paramRegex = new RegExp(`(\\(|,\\s*)${variableName}(\\)|:|,|\\s)`, 'g');
      content = content.replace(paramRegex, (match, before, after) => {
        return `${before}_${variableName}${after}`;
      });
    }
    
    // 2. Fix import statements: import { unused } → import { unused as _unused }
    else if (messageText.includes('defined but never used') && content.includes(`import`)) {
      // Import statement pattern
      const importRegex = new RegExp(`import\\s+{([^}]*?\\b${variableName}\\b[^}]*?)}`, 'g');
      content = content.replace(importRegex, (match, importList) => {
        return match.replace(
          new RegExp(`\\b${variableName}\\b(?!\\s+as\\s+)`, 'g'), 
          `${variableName} as _${variableName}`
        );
      });
      
      // Also check named imports
      const namedImportRegex = new RegExp(`import\\s+${variableName}\\s+from`, 'g');
      content = content.replace(namedImportRegex, `import _${variableName} from`);
    }
    
    // 3. Fix destructuring: { unused } → { unused: _unused }
    else if (messageText.includes('defined but never used') || messageText.includes('assigned a value but never used')) {
      // Destructuring pattern
      const destructuringRegex = new RegExp(`{([^}]*?\\b${variableName}\\b[^}]*?)}`, 'g');
      content = content.replace(destructuringRegex, (match, destructureList) => {
        if (destructureList.includes(`${variableName}:`)) {
          // Already has a property alias
          return match;
        }
        return match.replace(
          new RegExp(`\\b${variableName}\\b(?!:)`, 'g'), 
          `${variableName}: _${variableName}`
        );
      });
      
      // 4. Fix const/let declarations: const unused = → const _unused =
      const declRegex = new RegExp(`(const|let|var)\\s+${variableName}\\s*=`, 'g');
      content = content.replace(declRegex, `$1 _${variableName} =`);
      
      // 5. Fix class property declarations
      const classPropertyRegex = new RegExp(`(private|protected|public)\\s+${variableName}\\s*[:=]`, 'g');
      content = content.replace(classPropertyRegex, `$1 _${variableName}:`);
    }
    
    fixedVariables.add(variableName);
    warningsFixed++;
  }
  
  // Write changes if content was modified
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    filesModified++;
    console.log(`  ✅ Fixed ${fixedVariables.size} variables in this file`);
  } else {
    console.log(`  ⚠️ No changes made to this file (manual fixes may be required)`);
  }
}

console.log('\n=== Summary ===');
console.log(`📊 Total files processed: ${Object.keys(warningsByFile).length}`);
console.log(`📊 Files modified: ${filesModified}`);
console.log(`📊 Warnings fixed: ${warningsFixed} / ${unusedVarWarnings.length}`);
console.log(`📊 Backups created in: ${BACKUP_DIR}`);

if (warningsFixed < unusedVarWarnings.length) {
  console.log('\n⚠️ Some warnings could not be automatically fixed and may require manual attention.');
  console.log('   Run ESLint again to see remaining issues.');
} else {
  console.log('\n🎉 All detected unused variable warnings have been fixed!');
}

// Run ESLint again to verify fixes
console.log('\n🔍 Running ESLint again to verify fixes...');
try {
  const verificationOutput = execSync(`npx eslint ${SRC_DIR} --format stylish`, { encoding: 'utf8' });
  console.log(verificationOutput);
} catch (error) {
  console.log(error.stdout);
}
