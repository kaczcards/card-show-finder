// e2e/reporters/detox-reporter.js
const { DefaultReporter } = require('@jest/reporters');

/**
 * Simplified Detox reporter for E2E tests
 * Extends the default Jest reporter with minimal additional functionality
 */
class DetoxReporter extends DefaultReporter {
  constructor(globalConfig, reporterOptions) {
    super(globalConfig, reporterOptions);
    
    // Test statistics
    this.stats = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      startTime: Date.now()
    };
    
    try {
      console.log('\n🧪 Starting E2E Tests');
    } catch (error) {
      // Fail silently - don't let reporter issues break tests
    }
  }
  
  /**
   * Called when a test starts
   */
  onTestStart(test) {
    try {
      super.onTestStart(test);
      
      // Simple log of test start
      const testPath = test.path.split('/').pop();
      console.log(`\n▶️  Running: ${test.title || 'Unnamed test'} (${testPath})`);
      
      // Track test start time
      test._detoxStartTime = Date.now();
    } catch (error) {
      // Fail silently - don't let reporter issues break tests
    }
  }
  
  /**
   * Called when a test completes
   */
  onTestResult(test, testResult, aggregatedResult) {
    try {
      super.onTestResult(test, testResult, aggregatedResult);
      
      // Update statistics
      this.stats.total += testResult.numPassingTests + testResult.numFailingTests + testResult.numPendingTests;
      this.stats.passed += testResult.numPassingTests;
      this.stats.failed += testResult.numFailingTests;
      this.stats.skipped += testResult.numPendingTests;
      
      // Calculate test duration
      const duration = Date.now() - (test._detoxStartTime || this.stats.startTime);
      
      // Log simple test result summary
      const testPath = test.path.split('/').pop();
      console.log(`\n📊 Test Results (${testPath}):`);
      console.log(`   ✅ Passed: ${testResult.numPassingTests}/${testResult.numPassingTests + testResult.numFailingTests + testResult.numPendingTests}`);
      
      if (testResult.numFailingTests > 0) {
        console.log(`   ❌ Failed: ${testResult.numFailingTests}`);
      }
      
      if (testResult.numPendingTests > 0) {
        console.log(`   ⏭️  Skipped: ${testResult.numPendingTests}`);
      }
      
      console.log(`   ⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
    } catch (error) {
      // Log error but continue - don't break test execution
      console.error('Error in test reporter:', error.message);
    }
  }
  
  /**
   * Called when all tests complete
   */
  onRunComplete(contexts, results) {
    try {
      super.onRunComplete(contexts, results);
      
      const totalDuration = Date.now() - this.stats.startTime;
      
      // Log final summary
      console.log('\n=================================================');
      console.log('📱 E2E TEST SUMMARY');
      console.log('=================================================');
      console.log(`✅ Passed: ${this.stats.passed}`);
      
      if (this.stats.failed > 0) {
        console.log(`❌ Failed: ${this.stats.failed}`);
      }
      
      if (this.stats.skipped > 0) {
        console.log(`⏭️  Skipped: ${this.stats.skipped}`);
      }
      
      console.log(`🧪 Total: ${this.stats.total}`);
      console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
      console.log('=================================================');
      console.log(`E2E Testing completed in ${(totalDuration / 1000).toFixed(2)}s`);
      console.log('=================================================\n');
    } catch (error) {
      // Log error but continue - don't break test execution
      console.error('Error in test reporter summary:', error.message);
    }
  }
}

module.exports = DetoxReporter;
