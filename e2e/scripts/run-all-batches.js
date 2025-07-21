#!/usr/bin/env node
/**
 * E2E Test All Batches Runner
 * 
 * This script runs all active E2E test batches sequentially, with a timeout for each batch.
 * It provides comprehensive logging, timing, and reporting capabilities to track progress.
 * 
 * Usage:
 *   node e2e/scripts/run-all-batches.js
 *   node e2e/scripts/run-all-batches.js --device ios.sim.debug --batch-timeout 60
 *   node e2e/scripts/run-all-batches.js --skip-batches auth-basic,auth-advanced
 * 
 * Options:
 *   --device        Detox device configuration to use (default: ios.sim.debug)
 *   --batch-timeout Maximum execution time per batch in minutes (default: 60)
 *   --total-timeout Maximum total execution time in minutes (default: 480 - 8 hours)
 *   --skip-batches  Comma-separated list of batch names to skip
 *   --only-batches  Comma-separated list of batch names to run (overrides skip-batches)
 *   --report        Generate detailed HTML report (default: true)
 *   --verbose       Enable verbose logging (default: false)
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
  device: getArgValue(args, '--device') || 'ios.sim.debug',
  batchTimeout: parseInt(getArgValue(args, '--batch-timeout') || '60', 10),
  totalTimeout: parseInt(getArgValue(args, '--total-timeout') || '480', 10),
  skipBatches: (getArgValue(args, '--skip-batches') || '').split(',').filter(Boolean),
  onlyBatches: (getArgValue(args, '--only-batches') || '').split(',').filter(Boolean),
  report: getArgValue(args, '--report') !== 'false',
  verbose: args.includes('--verbose'),
};

// Setup directories
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const reportDir = path.join(rootDir, 'e2e', 'reports', 'all-batches-' + timestamp);
const logsDir = path.join(reportDir, 'logs');

// Create directories if they don't exist
fs.mkdirSync(reportDir, { recursive: true });
fs.mkdirSync(logsDir, { recursive: true });

// Get all active batches (non-planned)
let batchesToRun = batches.getActiveBatches();

// Filter batches based on options
if (options.onlyBatches.length > 0) {
  batchesToRun = batchesToRun.filter(batch => options.onlyBatches.includes(batch.name));
} else if (options.skipBatches.length > 0) {
  batchesToRun = batchesToRun.filter(batch => !options.skipBatches.includes(batch.name));
}

// Sort batches by priority
batchesToRun.sort((a, b) => a.priority - b.priority);

// Validate we have batches to run
if (batchesToRun.length === 0) {
  console.error(chalk.red('Error: No active batches found to run'));
  if (options.onlyBatches.length > 0) {
    console.error(chalk.red(`No active batches match the specified batches: ${options.onlyBatches.join(', ')}`));
  }
  process.exit(1);
}

// Estimate total runtime
const totalEstimatedMinutes = batches.getEstimatedRuntime(batchesToRun.map(b => b.name));
console.log(chalk.blue(`Estimated total runtime: ${totalEstimatedMinutes} minutes`));

if (totalEstimatedMinutes > options.totalTimeout) {
  console.warn(chalk.yellow(`Warning: Estimated runtime (${totalEstimatedMinutes} min) exceeds total timeout (${options.totalTimeout} min)`));
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

// Main log file
const mainLogPath = path.join(logsDir, 'all-batches.log');
const mainLogStream = fs.createWriteStream(mainLogPath, { flags: 'a' });

// Log header
const logHeader = `
${'='.repeat(80)}
E2E Test All Batches Run
Started: ${startTime.toISOString()}
Batches: ${batchesToRun.length}
Device: ${options.device}
Batch Timeout: ${options.batchTimeout} minutes
Total Timeout: ${options.totalTimeout} minutes
${'='.repeat(80)}
`;
mainLogStream.write(logHeader);

// Run all batches
(async function runAllBatches() {
  let overallSuccess = true;
  const batchResults = [];
  
  console.log(chalk.blue('='.repeat(80)));
  console.log(chalk.blue(`Starting E2E test run at ${startTime.toLocaleString()}`));
  console.log(chalk.blue(`Running ${batchesToRun.length} batch(es)`));
  console.log(chalk.blue(`Device: ${options.device}`));
  console.log(chalk.blue(`Batch timeout: ${options.batchTimeout} minutes`));
  console.log(chalk.blue(`Total timeout: ${options.totalTimeout} minutes`));
  console.log(chalk.blue('='.repeat(80)));
  
  // Track overall elapsed time
  let totalElapsedMinutes = 0;
  
  for (const [index, batch] of batchesToRun.entries()) {
    const batchStartTime = new Date();
    console.log(chalk.green(`\n[${index + 1}/${batchesToRun.length}] Running batch: ${batch.name}`));
    console.log(chalk.green(`Description: ${batch.description}`));
    console.log(chalk.green(`Test files: ${batch.testFiles.length}`));
    console.log(chalk.green(`Estimated time: ${batch.estimatedTime} minutes`));
    
    // Log batch start
    mainLogStream.write(`\n\n${'='.repeat(80)}\nBatch: ${batch.name}\nStarted: ${batchStartTime.toISOString()}\n${'='.repeat(80)}\n`);
    
    // Build the run-batch command
    const batchArgs = [
      path.join(rootDir, 'e2e', 'scripts', 'run-batch.js'),
      '--batch', batch.name,
      '--device', options.device,
      '--timeout', options.batchTimeout.toString(),
      '--report', options.report.toString(),
    ];
    
    if (options.verbose) {
      batchArgs.push('--verbose');
    }
    
    // Log the command
    const batchCommand = `node ${batchArgs.join(' ')}`;
    console.log(chalk.gray(`Running: ${batchCommand}`));
    mainLogStream.write(`Running command: ${batchCommand}\n`);
    
    // Track batch results
    const batchResult = {
      name: batch.name,
      startTime: batchStartTime.toISOString(),
      testFiles: batch.testFiles,
      estimatedTime: batch.estimatedTime,
      success: false,
    };
    
    try {
      // Execute the batch
      const result = execSync(`node ${batchArgs.join(' ')}`, {
        cwd: rootDir,
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: options.batchTimeout * 60 * 1000, // Convert minutes to ms
      });
      
      // Log batch output
      mainLogStream.write(result);
      if (options.verbose) {
        console.log(result);
      } else {
        // Print a summary of the batch output
        const lines = result.split('\n');
        const summaryLines = lines.filter(line => 
          line.includes('PASS') || 
          line.includes('FAIL') || 
          line.includes('Error:') ||
          line.includes('✓') ||
          line.includes('✕') ||
          line.includes('Batch') ||
          line.includes('Duration:') ||
          line.includes('Status:')
        );
        console.log(summaryLines.join('\n'));
      }
      
      batchResult.success = true;
    } catch (error) {
      console.error(chalk.red(`Batch ${batch.name} failed`));
      console.error(chalk.red(error.message));
      
      // Log error
      mainLogStream.write(`\nERROR: ${error.message}\n`);
      if (error.stdout) mainLogStream.write(`\nSTDOUT:\n${error.stdout}\n`);
      if (error.stderr) mainLogStream.write(`\nSTDERR:\n${error.stderr}\n`);
      
      batchResult.success = false;
      overallSuccess = false;
    }
    
    // Calculate batch duration
    const batchEndTime = new Date();
    const batchDuration = (batchEndTime - batchStartTime) / 1000 / 60; // in minutes
    
    batchResult.endTime = batchEndTime.toISOString();
    batchResult.duration = batchDuration;
    
    // Log batch completion
    const batchLogFooter = `\n${'='.repeat(80)}\nBatch: ${batch.name}\nCompleted: ${batchEndTime.toISOString()}\nDuration: ${batchDuration.toFixed(2)} minutes\nSuccess: ${batchResult.success}\n${'='.repeat(80)}\n`;
    mainLogStream.write(batchLogFooter);
    
    console.log(chalk.green(`\nBatch ${batch.name} completed in ${batchDuration.toFixed(2)} minutes`));
    console.log(chalk.green(`Status: ${batchResult.success ? 'SUCCESS' : 'FAILED'}`));
    
    // Save batch results
    batchResults.push(batchResult);
    
    // Update total elapsed time
    totalElapsedMinutes += batchDuration;
    
    // Progress update
    const remainingBatches = batchesToRun.length - (index + 1);
    const remainingEstimatedMinutes = batches.getEstimatedRuntime(
      batchesToRun.slice(index + 1).map(b => b.name)
    );
    
    console.log(chalk.blue(`\nProgress: ${index + 1}/${batchesToRun.length} batches completed`));
    console.log(chalk.blue(`Elapsed time: ${totalElapsedMinutes.toFixed(2)} minutes`));
    console.log(chalk.blue(`Estimated remaining time: ${remainingEstimatedMinutes} minutes`));
    
    // Check if we're approaching the total timeout
    if (totalElapsedMinutes + remainingEstimatedMinutes > options.totalTimeout) {
      console.warn(chalk.yellow(`\nWarning: Approaching total timeout limit of ${options.totalTimeout} minutes`));
      
      if (remainingBatches > 0) {
        console.warn(chalk.yellow(`${remainingBatches} batches remaining. Consider running them separately.`));
        
        // List remaining batches
        console.warn(chalk.yellow('Remaining batches:'));
        batchesToRun.slice(index + 1).forEach(b => {
          console.warn(chalk.yellow(`  - ${b.name}: ${b.description}`));
        });
        
        // Ask if we should continue
        console.warn(chalk.yellow('\nDo you want to continue? (y/n)'));
        
        // Simple synchronous input (not ideal but works for this case)
        const response = readSyncFromStdin();
        
        if (response.toLowerCase() !== 'y') {
          console.log(chalk.blue('\nStopping test run early as requested.'));
          break;
        }
      }
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
    batchCount: batchResults.length,
    batches: batchResults,
    options,
  };
  
  fs.writeFileSync(
    path.join(reportDir, 'all-batches-report.json'), 
    JSON.stringify(finalReport, null, 2)
  );
  
  // Generate HTML report if requested
  if (options.report) {
    try {
      generateHtmlReport(finalReport, reportDir);
      console.log(chalk.green(`\nHTML report generated at: ${path.join(reportDir, 'all-batches-report.html')}`));
    } catch (error) {
      console.error(chalk.red(`\nFailed to generate HTML report: ${error.message}`));
    }
  }
  
  // Log footer
  const logFooter = `
${'='.repeat(80)}
E2E Test All Batches Run
Completed: ${endTime.toISOString()}
Duration: ${totalDuration.toFixed(2)} minutes
Status: ${overallSuccess ? 'SUCCESS' : 'FAILED'}
Batches: ${batchResults.length}/${batchesToRun.length}
${'='.repeat(80)}
`;
  mainLogStream.write(logFooter);
  mainLogStream.end();
  
  // Print final summary
  console.log(chalk.blue('\n' + '='.repeat(80)));
  console.log(chalk.blue(`E2E All Batches Test Run Summary`));
  console.log(chalk.blue(`Started: ${startTime.toLocaleString()}`));
  console.log(chalk.blue(`Finished: ${endTime.toLocaleString()}`));
  console.log(chalk.blue(`Duration: ${totalDuration.toFixed(2)} minutes`));
  console.log(chalk.blue(`Status: ${overallSuccess ? chalk.green('SUCCESS') : chalk.red('FAILED')}`));
  console.log(chalk.blue(`Batches: ${batchResults.length}/${batchesToRun.length}`));
  
  // Print batch summary table
  console.log(chalk.blue('\nBatch Results:'));
  console.log('┌─────────────────────────┬──────────┬────────────┬──────────────┐');
  console.log('│ Batch Name              │ Status   │ Duration   │ Test Files   │');
  console.log('├─────────────────────────┼──────────┼────────────┼──────────────┤');
  
  batchResults.forEach(batch => {
    const name = batch.name.padEnd(23);
    const status = batch.success ? chalk.green('SUCCESS').padEnd(8) : chalk.red('FAILED').padEnd(8);
    const duration = `${batch.duration.toFixed(2)}m`.padEnd(10);
    const files = `${batch.testFiles.length}`.padEnd(12);
    
    console.log(`│ ${name} │ ${status} │ ${duration} │ ${files} │`);
  });
  
  console.log('└─────────────────────────┴──────────┴────────────┴──────────────┘');
  console.log(chalk.blue(`Report directory: ${reportDir}`));
  console.log(chalk.blue('='.repeat(80)));
  
  // Exit with appropriate code
  process.exit(overallSuccess ? 0 : 1);
})();

/**
 * Generate an HTML report from the test results
 */
function generateHtmlReport(report, reportDir) {
  const reportPath = path.join(reportDir, 'all-batches-report.html');
  
  // Simple HTML template for the report
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E All Batches Test Report</title>
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
      margin-bottom: 20px;
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
    .progress-bar-container {
      width: 100%;
      background-color: #f1f1f1;
      border-radius: 5px;
      margin: 10px 0;
    }
    .progress-bar {
      height: 24px;
      border-radius: 5px;
      text-align: center;
      line-height: 24px;
      color: white;
    }
    .success-bar {
      background-color: #4CAF50;
    }
    .failure-bar {
      background-color: #f44336;
    }
  </style>
</head>
<body>
  <h1>E2E All Batches Test Report</h1>
  
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
    
    <!-- Success rate progress bar -->
    <p><strong>Success Rate:</strong></p>
    <div class="progress-bar-container">
      <div class="progress-bar ${report.success ? 'success-bar' : 'failure-bar'}" 
           style="width: ${calculateSuccessRate(report.batches)}%">
        ${calculateSuccessRate(report.batches)}%
      </div>
    </div>
  </div>
  
  <h2>Batch Results</h2>
  
  <table>
    <thead>
      <tr>
        <th>Batch Name</th>
        <th>Status</th>
        <th>Duration</th>
        <th>Test Files</th>
        <th>Start Time</th>
        <th>End Time</th>
      </tr>
    </thead>
    <tbody>
      ${report.batches.map(batch => `
        <tr>
          <td>${batch.name}</td>
          <td class="${batch.success ? 'success' : 'failure'}">
            ${batch.success ? 'SUCCESS' : 'FAILED'}
          </td>
          <td>${batch.duration ? batch.duration.toFixed(2) + ' min' : 'N/A'}</td>
          <td>${batch.testFiles.length}</td>
          <td>${new Date(batch.startTime).toLocaleString()}</td>
          <td>${batch.endTime ? new Date(batch.endTime).toLocaleString() : 'N/A'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <h2>Batch Details</h2>
  
  ${report.batches.map(batch => `
    <div class="batch">
      <div class="batch-header">
        <h3>${batch.name}</h3>
        <span class="${batch.success ? 'success' : 'failure'}">
          ${batch.success ? 'SUCCESS' : 'FAILED'}
        </span>
      </div>
      
      <p><strong>Duration:</strong> ${batch.duration ? batch.duration.toFixed(2) + ' minutes' : 'N/A'}</p>
      <p><strong>Test Files:</strong> ${batch.testFiles.length}</p>
      <p><strong>Start Time:</strong> ${new Date(batch.startTime).toLocaleString()}</p>
      <p><strong>End Time:</strong> ${batch.endTime ? new Date(batch.endTime).toLocaleString() : 'N/A'}</p>
      
      <h4>Test Files:</h4>
      <ul>
        ${batch.testFiles.map(file => `<li>${file}</li>`).join('')}
      </ul>
    </div>
  `).join('')}
  
  <div class="timestamp">
    Report generated at ${new Date().toLocaleString()}
  </div>
  
  <script>
    function calculateSuccessRate(batches) {
      if (!batches || batches.length === 0) return 0;
      const successfulBatches = batches.filter(batch => batch.success).length;
      return Math.round((successfulBatches / batches.length) * 100);
    }
  </script>
</body>
</html>
  `;
  
  fs.writeFileSync(reportPath, html);
}

/**
 * Calculate success rate from batch results
 */
function calculateSuccessRate(batches) {
  if (!batches || batches.length === 0) return 0;
  const successfulBatches = batches.filter(batch => batch.success).length;
  return Math.round((successfulBatches / batches.length) * 100);
}

/**
 * Get the value of a command line argument
 */
function getArgValue(args, argName) {
  const index = args.indexOf(argName);
  if (index === -1 || index === args.length - 1) return null;
  return args[index + 1];
}

/**
 * Simple synchronous stdin reader (for basic y/n prompts)
 */
function readSyncFromStdin() {
  const buffer = Buffer.alloc(1024);
  let bytesRead;
  
  try {
    bytesRead = fs.readSync(process.stdin.fd, buffer, 0, 1024);
  } catch (e) {
    // Handle error or return default
    return 'n';
  }
  
  return buffer.toString('utf8', 0, bytesRead).trim();
}
