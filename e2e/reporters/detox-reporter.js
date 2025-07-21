// e2e/reporters/detox-reporter.js
const fs = require('fs');
const path = require('path');
const { DefaultReporter } = require('@jest/reporters');

/**
 * Custom Jest reporter for Detox E2E tests
 * Extends the default Jest reporter with additional functionality:
 * - Formatted output for E2E test results
 * - Performance metrics logging
 * - Summary report creation
 * - Screenshot and artifact handling
 */
class DetoxReporter extends DefaultReporter {
  constructor(globalConfig, reporterOptions) {
    super(globalConfig, reporterOptions);
    
    this.artifactsDir = path.join(process.cwd(), 'e2e', 'artifacts');
    this.reportDir = path.join(this.artifactsDir, 'reports');
    this.screenshotsDir = path.join(this.artifactsDir, 'screenshots');
    
    // Ensure directories exist
    this._ensureDirectoryExists(this.artifactsDir);
    this._ensureDirectoryExists(this.reportDir);
    this._ensureDirectoryExists(this.screenshotsDir);
    
    // Test statistics
    this.stats = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      slowTests: [],
      failedTests: [],
      performanceIssues: [],
    };
    
    // Start time
    this.startTime = Date.now();
    
    console.log('\n🧪 Starting Card Show Finder E2E Tests');
    console.log('📱 Test artifacts will be saved to:', this.artifactsDir);
  }
  
  /**
   * Called when a test starts
   */
  onTestStart(test) {
    super.onTestStart(test);
    
    // Log test start with prettier formatting
    const testPath = test.path.split('/').pop();
    console.log(`\n▶️  Running: ${test.title} (${testPath})`);
    
    // Track test start time for performance monitoring
    test._detoxStartTime = Date.now();
  }
  
  /**
   * Called when a test completes
   */
  onTestResult(test, testResult, aggregatedResult) {
    super.onTestResult(test, testResult, aggregatedResult);
    
    // Calculate test duration
    const duration = Date.now() - (test._detoxStartTime || this.startTime);
    
    // Update statistics
    this.stats.total += testResult.numPassingTests + testResult.numFailingTests + testResult.numPendingTests;
    this.stats.passed += testResult.numPassingTests;
    this.stats.failed += testResult.numFailingTests;
    this.stats.skipped += testResult.numPendingTests;
    this.stats.duration += duration;
    
    // Process test results
    testResult.testResults.forEach(result => {
      const testTitle = result.title;
      const testDuration = result.duration || 0;
      const testStatus = result.status;
      
      // Check for slow tests (over 5 seconds)
      if (testDuration > 5000) {
        this.stats.slowTests.push({
          title: testTitle,
          duration: testDuration,
          path: test.path,
        });
      }
      
      // Track failed tests
      if (testStatus === 'failed') {
        this.stats.failedTests.push({
          title: testTitle,
          path: test.path,
          failureMessages: result.failureMessages,
        });
        
        // Save screenshot for failed test if available
        this._saveFailureArtifacts(test, testTitle, result);
      }
      
      // Log performance metrics if available
      this._logPerformanceMetrics(testTitle);
    });
    
    // Log test result summary
    const passedCount = testResult.numPassingTests;
    const failedCount = testResult.numFailingTests;
    const skippedCount = testResult.numPendingTests;
    const totalCount = passedCount + failedCount + skippedCount;
    
    console.log(`\n📊 Test Results (${test.path.split('/').pop()}):`);
    console.log(`   ✅ Passed: ${passedCount}/${totalCount}`);
    
    if (failedCount > 0) {
      console.log(`   ❌ Failed: ${failedCount}/${totalCount}`);
    }
    
    if (skippedCount > 0) {
      console.log(`   ⏭️  Skipped: ${skippedCount}/${totalCount}`);
    }
    
    console.log(`   ⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
  }
  
  /**
   * Called when all tests complete
   */
  onRunComplete(contexts, results) {
    super.onRunComplete(contexts, results);
    
    const totalDuration = Date.now() - this.startTime;
    
    // Generate final report
    this._generateSummaryReport(results, totalDuration);
    
    // Log final summary
    console.log('\n=================================================');
    console.log('📱 CARD SHOW FINDER E2E TEST SUMMARY');
    console.log('=================================================');
    console.log(`✅ Passed: ${this.stats.passed}`);
    console.log(`❌ Failed: ${this.stats.failed}`);
    console.log(`⏭️  Skipped: ${this.stats.skipped}`);
    console.log(`🧪 Total: ${this.stats.total}`);
    console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    
    // Log slow tests
    if (this.stats.slowTests.length > 0) {
      console.log('\n⚠️  Slow Tests:');
      this.stats.slowTests.forEach(test => {
        console.log(`   - ${test.title} (${(test.duration / 1000).toFixed(2)}s)`);
      });
    }
    
    // Log performance issues
    if (this.stats.performanceIssues.length > 0) {
      console.log('\n🔍 Performance Issues:');
      this.stats.performanceIssues.forEach(issue => {
        console.log(`   - ${issue.test}: ${issue.metric} = ${issue.value} (threshold: ${issue.threshold})`);
      });
    }
    
    // Log failed tests
    if (this.stats.failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      this.stats.failedTests.forEach(test => {
        console.log(`   - ${test.title}`);
        console.log(`     Path: ${test.path}`);
      });
      
      console.log(`\n📷 Screenshots for failed tests saved to: ${this.screenshotsDir}`);
      console.log(`📊 Detailed reports saved to: ${this.reportDir}`);
    }
    
    console.log('\n=================================================');
    console.log(`E2E Testing completed in ${(totalDuration / 1000).toFixed(2)}s`);
    console.log('=================================================\n');
  }
  
  /**
   * Save artifacts for failed tests
   */
  _saveFailureArtifacts(test, testTitle, result) {
    try {
      // Create a safe filename from the test title
      const safeTitle = testTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const screenshotFilename = `${safeTitle}_${timestamp}.png`;
      const logFilename = `${safeTitle}_${timestamp}.log`;
      
      // Save failure messages to log file
      const logPath = path.join(this.reportDir, logFilename);
      fs.writeFileSync(
        logPath,
        `Test: ${testTitle}\nPath: ${test.path}\nTimestamp: ${timestamp}\n\nFailure Messages:\n${result.failureMessages.join('\n\n')}`
      );
      
      // Check if a screenshot was taken by Detox
      // This requires the test to call takeScreenshot or for Detox to be configured to take screenshots on failure
      const detoxGlobal = global.__DETOX_GLOBAL__;
      if (detoxGlobal && detoxGlobal.screenshots) {
        const lastScreenshot = detoxGlobal.screenshots[detoxGlobal.screenshots.length - 1];
        if (lastScreenshot && fs.existsSync(lastScreenshot)) {
          const screenshotPath = path.join(this.screenshotsDir, screenshotFilename);
          fs.copyFileSync(lastScreenshot, screenshotPath);
        }
      }
    } catch (error) {
      console.error(`Error saving failure artifacts for test "${testTitle}":`, error);
    }
  }
  
  /**
   * Log performance metrics if available
   */
  _logPerformanceMetrics(testTitle) {
    try {
      const detoxGlobal = global.__DETOX_GLOBAL__;
      if (detoxGlobal && detoxGlobal.PERFORMANCE && detoxGlobal.PERFORMANCE.enabled) {
        const { measurements, thresholds, logPath } = detoxGlobal.PERFORMANCE;
        
        // Find measurements for this test
        const testMeasurements = measurements.filter(m => m.test === testTitle);
        
        if (testMeasurements.length > 0) {
          // Append to performance log
          const timestamp = new Date().toISOString();
          const logStream = fs.createWriteStream(logPath, { flags: 'a' });
          
          testMeasurements.forEach(measurement => {
            // Log to file
            logStream.write(`${timestamp},${testTitle},${measurement.metric},${measurement.value}\n`);
            
            // Check against thresholds
            const threshold = thresholds[measurement.metric];
            if (threshold && measurement.value > threshold) {
              this.stats.performanceIssues.push({
                test: testTitle,
                metric: measurement.metric,
                value: measurement.value,
                threshold,
              });
            }
          });
          
          logStream.end();
        }
      }
    } catch (error) {
      console.error(`Error logging performance metrics for test "${testTitle}":`, error);
    }
  }
  
  /**
   * Generate summary report
   */
  _generateSummaryReport(results, totalDuration) {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const reportPath = path.join(this.reportDir, `summary_${timestamp}.json`);
      
      const report = {
        timestamp: new Date().toISOString(),
        duration: totalDuration,
        stats: {
          total: this.stats.total,
          passed: this.stats.passed,
          failed: this.stats.failed,
          skipped: this.stats.skipped,
          passRate: this.stats.total > 0 ? (this.stats.passed / this.stats.total * 100).toFixed(2) : '0.00',
        },
        slowTests: this.stats.slowTests.map(test => ({
          title: test.title,
          duration: test.duration,
          path: test.path,
        })),
        failedTests: this.stats.failedTests.map(test => ({
          title: test.title,
          path: test.path,
        })),
        performanceIssues: this.stats.performanceIssues,
        testResults: results.testResults.map(result => ({
          testFilePath: result.testFilePath,
          numPassingTests: result.numPassingTests,
          numFailingTests: result.numFailingTests,
          numPendingTests: result.numPendingTests,
          testResults: result.testResults.map(test => ({
            title: test.title,
            status: test.status,
            duration: test.duration,
          })),
        })),
      };
      
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      // Also generate HTML report for easier viewing
      this._generateHtmlReport(report, timestamp);
    } catch (error) {
      console.error('Error generating summary report:', error);
    }
  }
  
  /**
   * Generate HTML report
   */
  _generateHtmlReport(report, timestamp) {
    try {
      const reportPath = path.join(this.reportDir, `summary_${timestamp}.html`);
      
      // Simple HTML template
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Card Show Finder E2E Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
    h1, h2, h3 { color: #2c3e50; }
    .container { max-width: 1200px; margin: 0 auto; }
    .summary { background-color: #f8f9fa; border-radius: 5px; padding: 20px; margin-bottom: 20px; }
    .stats { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; }
    .stat-card { background-color: white; border-radius: 5px; padding: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); flex: 1; min-width: 150px; }
    .pass { color: #28a745; }
    .fail { color: #dc3545; }
    .skip { color: #6c757d; }
    .duration { color: #17a2b8; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f8f9fa; }
    tr:hover { background-color: #f1f1f1; }
    .badge { display: inline-block; padding: 5px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .badge-success { background-color: #d4edda; color: #155724; }
    .badge-danger { background-color: #f8d7da; color: #721c24; }
    .badge-warning { background-color: #fff3cd; color: #856404; }
    .badge-info { background-color: #d1ecf1; color: #0c5460; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Card Show Finder E2E Test Report</h1>
    <p>Generated on: ${report.timestamp}</p>
    
    <div class="summary">
      <h2>Summary</h2>
      <div class="stats">
        <div class="stat-card">
          <h3 class="pass">Passed</h3>
          <p>${report.stats.passed} / ${report.stats.total} (${report.stats.passRate}%)</p>
        </div>
        <div class="stat-card">
          <h3 class="fail">Failed</h3>
          <p>${report.stats.failed} / ${report.stats.total}</p>
        </div>
        <div class="stat-card">
          <h3 class="skip">Skipped</h3>
          <p>${report.stats.skipped} / ${report.stats.total}</p>
        </div>
        <div class="stat-card">
          <h3 class="duration">Duration</h3>
          <p>${(report.duration / 1000).toFixed(2)}s</p>
        </div>
      </div>
    </div>
    
    ${report.failedTests.length > 0 ? `
    <h2>Failed Tests</h2>
    <table>
      <thead>
        <tr>
          <th>Test</th>
          <th>File</th>
        </tr>
      </thead>
      <tbody>
        ${report.failedTests.map(test => `
        <tr>
          <td>${test.title}</td>
          <td>${test.path}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
    
    ${report.slowTests.length > 0 ? `
    <h2>Slow Tests</h2>
    <table>
      <thead>
        <tr>
          <th>Test</th>
          <th>Duration</th>
          <th>File</th>
        </tr>
      </thead>
      <tbody>
        ${report.slowTests.map(test => `
        <tr>
          <td>${test.title}</td>
          <td>${(test.duration / 1000).toFixed(2)}s</td>
          <td>${test.path}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
    
    ${report.performanceIssues.length > 0 ? `
    <h2>Performance Issues</h2>
    <table>
      <thead>
        <tr>
          <th>Test</th>
          <th>Metric</th>
          <th>Value</th>
          <th>Threshold</th>
        </tr>
      </thead>
      <tbody>
        ${report.performanceIssues.map(issue => `
        <tr>
          <td>${issue.test}</td>
          <td>${issue.metric}</td>
          <td>${issue.value}</td>
          <td>${issue.threshold}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
    
    <h2>All Tests</h2>
    <table>
      <thead>
        <tr>
          <th>Test</th>
          <th>Status</th>
          <th>Duration</th>
        </tr>
      </thead>
      <tbody>
        ${report.testResults.flatMap(result => 
          result.testResults.map(test => `
          <tr>
            <td>${test.title}</td>
            <td>
              <span class="badge ${
                test.status === 'passed' ? 'badge-success' : 
                test.status === 'failed' ? 'badge-danger' : 'badge-warning'
              }">
                ${test.status.toUpperCase()}
              </span>
            </td>
            <td>${test.duration ? (test.duration / 1000).toFixed(2) + 's' : 'N/A'}</td>
          </tr>
          `)
        ).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
      `;
      
      fs.writeFileSync(reportPath, html);
    } catch (error) {
      console.error('Error generating HTML report:', error);
    }
  }
  
  /**
   * Ensure directory exists
   */
  _ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

module.exports = DetoxReporter;
