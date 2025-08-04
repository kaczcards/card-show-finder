#!/usr/bin/env node
/**
 * E2E Test Batch Runner
 * 
 * This script runs a specific batch of E2E tests defined in the batches.js configuration.
 * It provides logging, timing, and reporting capabilities to track test execution progress.
 * 
 * Usage:
 *   node e2e/scripts/run-batch.js --batch auth-basic
 *   node e2e/scripts/run-batch.js --batch auth-advanced --timeout 60
 *   node e2e/scripts/run-batch.js --tag auth --device ios.sim.debug
 * 
 * Options:
 *   --batch     Batch name to run (from batches.js)
 *   --tag       Run all batches with this tag
 *   --device    Detox device configuration to use (default: ios.sim.debug)
 *   --timeout   Maximum execution time in minutes (default: 60)
 *   --report    Generate detailed HTML report (default: true)
 *   --verbose   Enable verbose logging (default: false)
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const batches = require('../config/batches');

// Root project directory
const rootDir = path.resolve(__dirname, '../../');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  batch: getArgValue(args, '--batch'),
  tag: getArgValue(args, '--tag'),
  device: getArgValue(args, '--device') || 'ios.sim.debug',
  timeout: parseInt(getArgValue(args, '--timeout') || '60', 10),
  report: getArgValue(args, '--report') !== 'false',
  verbose: args.includes('--verbose'),
};

// Validate arguments
if (!options.batch && !options.tag) {
  console.error(chalk.red('Error: You must specify either a batch name (--batch) or a tag (--tag)'));
  process.exit(1);
}

// Setup directories
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const reportDir = path.join(rootDir, 'e2e', 'reports', timestamp);
const logsDir = path.join(reportDir, 'logs');

// Create directories if they don't exist
fs.mkdirSync(reportDir, { recursive: true });
fs.mkdirSync(logsDir, { recursive: true });

// Determine which batches to run
let batchesToRun = [];
if (options.batch) {
  const batch = batches.getBatchByName(options.batch);
  if (!batch) {
    console.error(chalk.red(`Error: Batch "${options.batch}" not found in configuration`));
    console.log(chalk.yellow('Available batches:'));
    batches.batches.forEach(b => {
      console.log(chalk.yellow(`  - ${b.name}: ${b.description}`));
    });
    process.exit(1);
  }
  
  if (batch.status === 'planned') {
    console.error(chalk.yellow(`Warning: Batch "${options.batch}" is marked as planned and may not have implemented tests yet.`));
  }
  
  batchesToRun.push(batch);
} else if (options.tag) {
  batchesToRun = batches.getBatchesByTag(options.tag).filter(batch => batch.status !== 'planned');
  
  if (batchesToRun.length === 0) {
    console.error(chalk.red(`Error: No active batches found with tag "${options.tag}"`));
    process.exit(1);
  }
  
  console.log(chalk.green(`Found ${batchesToRun.length} batches with tag "${options.tag}"`));
}

// Sort batches by priority
batchesToRun.sort((a, b) => a.priority - b.priority);

// Estimate total runtime
const totalEstimatedMinutes = batches.getEstimatedRuntime(batchesToRun.map(b => b.name));
console.log(chalk.blue(`Estimated total runtime: ${totalEstimatedMinutes} minutes`));

if (totalEstimatedMinutes > options.timeout) {
  console.warn(chalk.yellow(`Warning: Estimated runtime (${totalEstimatedMinutes} min) exceeds timeout (${options.timeout} min)`));
}

// Start time for the entire run
const startTime = new Date();

// Write run metadata
const runMetadata = {
  startTime: startTime.toISOString(),
  options,
  batches: batchesToRun.map(b => b.name),
  estimatedRuntime: totalEstimatedMinutes,
};
fs.writeFileSync(path.join(reportDir, 'run-metadata.json'), JSON.stringify(runMetadata, null, 2));

// Run each batch
(async function runBatches() {
  let overallSuccess = true;
  const batchResults = [];
  
  console.log(chalk.blue('='.repeat(80)));
  console.log(chalk.blue(`Starting E2E test run at ${startTime.toLocaleString()}`));
  console.log(chalk.blue(`Running ${batchesToRun.length} batch(es) with timeout of ${options.timeout} minutes`));
  console.log(chalk.blue('='.repeat(80)));
  
  for (const [index, batch] of batchesToRun.entries()) {
    const batchStartTime = new Date();
    console.log(chalk.green(`\n[${index + 1}/${batchesToRun.length}] Running batch: ${batch.name}`));
    console.log(chalk.green(`Description: ${batch.description}`));
    console.log(chalk.green(`Test files: ${batch.testFiles.length}`));
    
    // Create batch log file
    const batchLogPath = path.join(logsDir, `${batch.name}.log`);
    const batchLogStream = fs.createWriteStream(batchLogPath, { flags: 'a' });
    
    // Log batch start
    const batchLogHeader = `\n${'='.repeat(80)}\nBatch: ${batch.name}\nStarted: ${batchStartTime.toISOString()}\n${'='.repeat(80)}\n`;
    batchLogStream.write(batchLogHeader);
    
    // Track batch results
    const batchResult = {
      name: batch.name,
      startTime: batchStartTime.toISOString(),
      testFiles: batch.testFiles,
      testResults: [],
      success: true,
    };
    
    // Run each test file in the batch
    for (const [testIndex, testFile] of batch.testFiles.entries()) {
      const testStartTime = new Date();
      const testPath = path.join(rootDir, 'e2e', 'tests', testFile);
      
      // Check if test file exists
      if (!fs.existsSync(testPath)) {
        console.error(chalk.red(`Test file not found: ${testPath}`));
        batchLogStream.write(`\nERROR: Test file not found: ${testPath}\n`);
        
        batchResult.testResults.push({
          file: testFile,
          startTime: testStartTime.toISOString(),
          endTime: new Date().toISOString(),
          success: false,
          error: 'Test file not found',
        });
        
        batchResult.success = false;
        overallSuccess = false;
        continue;
      }
      
      console.log(chalk.cyan(`\n[${testIndex + 1}/${batch.testFiles.length}] Running test: ${testFile}`));
      
      try {
        // Build the detox test command
        const detoxArgs = [
          'test',
          '--configuration', options.device,
          // Pass the test file path directly; Detox forwards this to Jest
          testPath,
          '--artifacts-location', path.join(reportDir, 'artifacts', batch.name),
          '--record-logs', 'all',
          '--take-screenshots', 'all',
          '--record-videos', 'failing',
          '--cleanup',
        ];
        
        if (options.verbose) {
          detoxArgs.push('--loglevel', 'trace');
        }
        
        // Log the command
        const detoxCommand = `npx detox ${detoxArgs.join(' ')}`;
        console.log(chalk.gray(`Running: ${detoxCommand}`));
        batchLogStream.write(`\nRunning test: ${testFile}\nCommand: ${detoxCommand}\n`);
        
        // Execute the test
        const result = execSync(`npx detox ${detoxArgs.join(' ')}`, {
          cwd: rootDir,
          stdio: 'pipe',
          encoding: 'utf8',
          timeout: options.timeout * 60 * 1000, // Convert minutes to ms
        });
        
        // Log test output
        batchLogStream.write(result);
        if (options.verbose) {
          console.log(result);
        } else {
          // Print a summary of the test output
          const lines = result.split('\n');
          const summaryLines = lines.filter(line => 
            line.includes('PASS') || 
            line.includes('FAIL') || 
            line.includes('Error:') ||
            line.includes('✓') ||
            line.includes('✕')
          );
          console.log(summaryLines.join('\n'));
        }
        
        const testEndTime = new Date();
        const testDuration = (testEndTime - testStartTime) / 1000; // in seconds
        
        console.log(chalk.green(`Test completed in ${testDuration.toFixed(2)} seconds`));
        
        batchResult.testResults.push({
          file: testFile,
          startTime: testStartTime.toISOString(),
          endTime: testEndTime.toISOString(),
          duration: testDuration,
          success: true,
        });
      } catch (error) {
        const testEndTime = new Date();
        const testDuration = (testEndTime - testStartTime) / 1000; // in seconds
        
        console.error(chalk.red(`Test failed in ${testDuration.toFixed(2)} seconds`));
        console.error(chalk.red(error.message));
        
        // Log error
        batchLogStream.write(`\nERROR: ${error.message}\n`);
        if (error.stdout) batchLogStream.write(`\nSTDOUT:\n${error.stdout}\n`);
        if (error.stderr) batchLogStream.write(`\nSTDERR:\n${error.stderr}\n`);
        
        batchResult.testResults.push({
          file: testFile,
          startTime: testStartTime.toISOString(),
          endTime: testEndTime.toISOString(),
          duration: testDuration,
          success: false,
          error: error.message,
        });
        
        batchResult.success = false;
        overallSuccess = false;
      }
    }
    
    // Calculate batch duration
    const batchEndTime = new Date();
    const batchDuration = (batchEndTime - batchStartTime) / 1000 / 60; // in minutes
    
    batchResult.endTime = batchEndTime.toISOString();
    batchResult.duration = batchDuration;
    
    // Log batch completion
    const batchLogFooter = `\n${'='.repeat(80)}\nBatch: ${batch.name}\nCompleted: ${batchEndTime.toISOString()}\nDuration: ${batchDuration.toFixed(2)} minutes\nSuccess: ${batchResult.success}\n${'='.repeat(80)}\n`;
    batchLogStream.write(batchLogFooter);
    batchLogStream.end();
    
    console.log(chalk.green(`\nBatch ${batch.name} completed in ${batchDuration.toFixed(2)} minutes`));
    console.log(chalk.green(`Status: ${batchResult.success ? 'SUCCESS' : 'FAILED'}`));
    
    // Save batch results
    batchResults.push(batchResult);
    fs.writeFileSync(
      path.join(reportDir, `${batch.name}-results.json`), 
      JSON.stringify(batchResult, null, 2)
    );
    
    // Progress update
    const elapsedMinutes = (batchEndTime - startTime) / 1000 / 60;
    const remainingBatches = batchesToRun.length - (index + 1);
    const remainingEstimatedMinutes = batches.getEstimatedRuntime(
      batchesToRun.slice(index + 1).map(b => b.name)
    );
    
    console.log(chalk.blue(`\nProgress: ${index + 1}/${batchesToRun.length} batches completed`));
    console.log(chalk.blue(`Elapsed time: ${elapsedMinutes.toFixed(2)} minutes`));
    console.log(chalk.blue(`Estimated remaining time: ${remainingEstimatedMinutes} minutes`));
    
    // Check if we're approaching the timeout
    if (elapsedMinutes + remainingEstimatedMinutes > options.timeout) {
      console.warn(chalk.yellow(`\nWarning: Approaching timeout limit of ${options.timeout} minutes`));
      console.warn(chalk.yellow(`Consider running remaining batches separately or increasing the timeout`));
    }
  }
  
  // Calculate total duration
  const endTime = new Date();
  const totalDuration = (endTime - startTime) / 1000 / 60; // in minutes
  
  // Generate final report
  const finalReport = {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    duration: totalDuration,
    success: overallSuccess,
    batchCount: batchesToRun.length,
    batches: batchResults,
    options,
  };
  
  fs.writeFileSync(
    path.join(reportDir, 'final-report.json'), 
    JSON.stringify(finalReport, null, 2)
  );
  
  // Generate HTML report if requested
  if (options.report) {
    try {
      generateHtmlReport(finalReport, reportDir);
      console.log(chalk.green(`\nHTML report generated at: ${path.join(reportDir, 'report.html')}`));
    } catch (error) {
      console.error(chalk.red(`\nFailed to generate HTML report: ${error.message}`));
    }
  }
  
  // Print final summary
  console.log(chalk.blue('\n' + '='.repeat(80)));
  console.log(chalk.blue(`E2E Test Run Summary`));
  console.log(chalk.blue(`Started: ${startTime.toLocaleString()}`));
  console.log(chalk.blue(`Finished: ${endTime.toLocaleString()}`));
  console.log(chalk.blue(`Duration: ${totalDuration.toFixed(2)} minutes`));
  console.log(chalk.blue(`Status: ${overallSuccess ? chalk.green('SUCCESS') : chalk.red('FAILED')}`));
  console.log(chalk.blue(`Batches: ${batchesToRun.length}`));
  console.log(chalk.blue(`Report directory: ${reportDir}`));
  console.log(chalk.blue('='.repeat(80)));
  
  // Exit with appropriate code
  process.exit(overallSuccess ? 0 : 1);
})();

/**
 * Generate an HTML report from the test results
 */
function generateHtmlReport(report, reportDir) {
  const reportPath = path.join(reportDir, 'report.html');
  
  // Simple HTML template for the report
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E Test Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 {
      color: #0066cc;
    }
    .success {
      color: #00aa00;
    }
    .failure {
      color: #cc0000;
    }
    .summary {
      background-color: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .batch {
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .batch-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .test {
      margin: 10px 0;
      padding: 10px;
      background-color: #f9f9f9;
      border-radius: 3px;
    }
    .test-header {
      display: flex;
      justify-content: space-between;
    }
    .timestamp {
      color: #666;
      font-size: 0.9em;
    }
    .duration {
      font-weight: bold;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      text-align: left;
      padding: 8px;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f2f2f2;
    }
    tr:hover {
      background-color: #f5f5f5;
    }
  </style>
</head>
<body>
  <h1>E2E Test Report</h1>
  
  <div class="summary">
    <h2>Summary</h2>
    <p>
      <strong>Status:</strong> 
      <span class="${report.success ? 'success' : 'failure'}">
        ${report.success ? 'SUCCESS' : 'FAILED'}
      </span>
    </p>
    <p><strong>Start Time:</strong> ${new Date(report.startTime).toLocaleString()}</p>
    <p><strong>End Time:</strong> ${new Date(report.endTime).toLocaleString()}</p>
    <p><strong>Duration:</strong> ${report.duration.toFixed(2)} minutes</p>
    <p><strong>Batches:</strong> ${report.batchCount}</p>
  </div>
  
  <h2>Batch Results</h2>
  
  ${report.batches.map(batch => `
    <div class="batch">
      <div class="batch-header">
        <h3>${batch.name}</h3>
        <span class="${batch.success ? 'success' : 'failure'}">
          ${batch.success ? 'SUCCESS' : 'FAILED'}
        </span>
      </div>
      
      <p><strong>Duration:</strong> ${batch.duration.toFixed(2)} minutes</p>
      <p><strong>Test Files:</strong> ${batch.testFiles.length}</p>
      
      <table>
        <thead>
          <tr>
            <th>Test File</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${batch.testResults.map(test => `
            <tr>
              <td>${test.file}</td>
              <td class="${test.success ? 'success' : 'failure'}">
                ${test.success ? 'PASS' : 'FAIL'}
              </td>
              <td>${test.duration ? test.duration.toFixed(2) + 's' : 'N/A'}</td>
              <td>${test.error || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('')}
  
  <div class="timestamp">
    Report generated at ${new Date().toLocaleString()}
  </div>
</body>
</html>
  `;
  
  fs.writeFileSync(reportPath, html);
}

/**
 * Get the value of a command line argument
 */
function getArgValue(args, argName) {
  const index = args.indexOf(argName);
  if (index === -1 || index === args.length - 1) return null;
  return args[index + 1];
}
