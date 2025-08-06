// e2e/init.js
const detox = require('detox');
const fs = require('fs');
const path = require('path');

// Import test helpers
const {
  navigateTo,
  loginAsTestUser,
  logout,
  waitForElementToBeVisible,
  waitForElementToBeGone,
  takeScreenshot,
  measurePerformance,
  generateRandomData,
  resetAppToInitialState,
  mockLocation,
  tapBackButton,
  scrollToElement,
  clearTextInput,
} = require('./helpers/testHelpers');

// Import test data
const {
  TEST_USER_CREDENTIALS,
  TEST_SHOWS_DATA,
  TEST_LOCATIONS,
  TEST_SEARCH_QUERIES,
} = require('./data/testData');

// Performance monitoring
let performanceMonitor = {
  startTime: null,
  measurements: [],
  currentTest: null,
  cpuUsage: [],
  memoryUsage: [],
  
  startMeasurement(testName, metricName) {
    this.startTime = Date.now();
    this.currentTest = testName;
    return this.startTime;
  },
  
  endMeasurement(metricName) {
    if (!this.startTime) return 0;
    
    const duration = Date.now() - this.startTime;
    this.measurements.push({
      test: this.currentTest,
      metric: metricName,
      duration,
      timestamp: new Date().toISOString(),
    });
    
    this.startTime = null;
    return duration;
  },
  
  recordMetric(testName, metricName, value) {
    this.measurements.push({
      test: testName,
      metric: metricName,
      value,
      timestamp: new Date().toISOString(),
    });
  },
  
  saveResults() {
    if (this.measurements.length === 0) return;
    
    const artifactsDir = path.join(process.cwd(), 'e2e', 'artifacts');
    const perfLogPath = path.join(artifactsDir, 'performance.log');
    
    // Append to existing log file
    let logContent = '';
    this.measurements.forEach(m => {
      logContent += `${m.timestamp},${m.test},${m.metric},${m.duration || m.value}\n`;
    });
    
    fs.appendFileSync(perfLogPath, logContent);
    
    // Reset measurements after saving
    this.measurements = [];
  },
};

// Error handling
const errorHandler = {
  errors: [],
  
  captureError(error, testName) {
    this.errors.push({
      test: testName,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    
    // Log error to console
    console.error(`Error in test "${testName}": ${error.message}`);
    
    // Take screenshot on error
    try {
      const artifactsDir = path.join(process.cwd(), 'e2e', 'artifacts');
      const screenshotPath = path.join(artifactsDir, `error-${testName}-${Date.now()}.png`);
      takeScreenshot(screenshotPath);
    } catch (screenshotError) {
      console.error('Failed to take error screenshot:', screenshotError.message);
    }
    
    return error;
  },
  
  saveResults() {
    if (this.errors.length === 0) return;
    
    const artifactsDir = path.join(process.cwd(), 'e2e', 'artifacts');
    const errorLogPath = path.join(artifactsDir, 'error.log');
    
    // Write errors to log file
    let logContent = '';
    this.errors.forEach(e => {
      logContent += `${e.timestamp} - ${e.test}: ${e.error}\n${e.stack}\n\n`;
    });
    
    fs.appendFileSync(errorLogPath, logContent);
    
    // Reset errors after saving
    this.errors = [];
  },
};

// Expose globals for tests
global.navigateTo = navigateTo;
global.loginAsTestUser = loginAsTestUser;
global.logout = logout;
global.waitForElementToBeVisible = waitForElementToBeVisible;
global.waitForElementToBeGone = waitForElementToBeGone;
global.takeScreenshot = takeScreenshot;
global.measurePerformance = measurePerformance;
global.generateRandomData = generateRandomData;
global.resetAppToInitialState = resetAppToInitialState;
global.mockLocation = mockLocation;
global.tapBackButton = tapBackButton;
global.scrollToElement = scrollToElement;
global.clearTextInput = clearTextInput;

// Expose test data
global.TEST_USER_CREDENTIALS = TEST_USER_CREDENTIALS;
global.TEST_SHOWS_DATA = TEST_SHOWS_DATA;
global.TEST_LOCATIONS = TEST_LOCATIONS;
global.TEST_SEARCH_QUERIES = TEST_SEARCH_QUERIES;

// Set up Jest hooks
/* ------------------------------------------------------------------ *
 * Jest lifecycle hooks are only available when this file is executed
 * within a Jest context.  When the file is `require`-d by tools such
 * as the configuration validator, those globals are **undefined**.
 * Guard each hook so the file can be safely imported anywhere.
 * ------------------------------------------------------------------ */

if (typeof beforeAll !== 'undefined') {
  beforeAll(async () => {
  // Detox initialization is handled automatically by the jest-circus environment (Detox v20+)
  
  // Create artifacts directory if it doesn't exist
  const artifactsDir = path.join(process.cwd(), 'e2e', 'artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }
  
  // Initialize performance monitoring
  performanceMonitor.startMeasurement('App', 'startupTime');
  
  // Set up global error handler
  process.on('unhandledRejection', (error) => {
    errorHandler.captureError(error, 'Unhandled Rejection');
  });
  
  // Log test environment info
  console.log('Test Environment:');
  console.log(`- Detox Version: ${require('detox/package.json').version}`);
  console.log(`- Test Mode: ${process.env.DETOX_TEST_MODE || 'default'}`);
  console.log(`- Using Isolated Data: ${process.env.DETOX_USE_ISOLATED_DATA || 'false'}`);
  console.log(`- Performance Monitoring: ${process.env.DETOX_PERF_MONITOR || 'false'}`);
  
  // Log test start time
  console.log(`Test Suite Started: ${new Date().toISOString()}`);
  });
}

/**
 * Safely resolve the current test name in a way that **never throws**.
 * Falls back to sensible defaults when Jest internals are unavailable
 * or when running under a different test-runner implementation.
 *
 * @returns {string} Resolved test name or 'unknown-test'
 */
function safeGetCurrentTestName() {
  try {
    // Newer Jest versions (expect.getState exists)
    if (typeof expect !== 'undefined'
      && expect !== null
      && typeof expect.getState === 'function') {
      const state = expect.getState();
      if (state && typeof state.currentTestName === 'string') {
        return state.currentTestName;
      }
    }

    // Jasmine fallback (older Detox < v20 or custom envs)
    if (global.jasmine?.currentTest?.fullName) {
      return global.jasmine.currentTest.fullName;
    }

    // jest-circus or worker context
    if (global.jest?.currentTest?.fullName) {
      return global.jest.currentTest.fullName;
    }
  } catch {
    /* swallow */ /* eslint-disable-line no-empty */
  }

  return 'unknown-test';
}

if (typeof beforeEach !== 'undefined') {
  beforeEach(async () => {
  // Resolve current test name defensively
  const testName = safeGetCurrentTestName();
  
  // Start performance monitoring for this test
  if (process.env.DETOX_PERF_MONITOR === 'true') {
    performanceMonitor.startMeasurement(testName, 'testDuration');
    
    // Record initial memory usage
    const memoryUsage = process.memoryUsage();
    performanceMonitor.recordMetric(testName, 'memory', Math.round(memoryUsage.heapUsed / 1024 / 1024));
  }
  
  // Log test start
  console.log(`Starting test: ${testName}`);
  });
}

if (typeof afterEach !== 'undefined') {
  afterEach(async () => {
  // Resolve current test name defensively
  const testName = safeGetCurrentTestName();
  
  // Determine test status more reliably
  let testStatus = 'unknown';
  try {
    // Different ways to detect test status depending on the test runner
    if (typeof expect.getState === 'function') {
      const state = expect.getState();
      testStatus = state && !state.suppressedErrors && state.suppressedErrors.length === 0 ? 'passed' : 'failed';
    } else if (testInfo?.currentTest) {
      testStatus = testInfo.currentTest.failedExpectations && 
                  testInfo.currentTest.failedExpectations.length === 0 ? 'passed' : 'failed';
    }
  } catch (e) {
    console.log('Could not determine test status:', e.message);
    testStatus = 'unknown';
  }
  
  // End performance monitoring for this test
  if (process.env.DETOX_PERF_MONITOR === 'true') {
    const duration = performanceMonitor.endMeasurement('testDuration');
    console.log(`Test "${testName}" completed in ${duration}ms`);
    
    // Record final memory usage
    const memoryUsage = process.memoryUsage();
    performanceMonitor.recordMetric(testName, 'memory', Math.round(memoryUsage.heapUsed / 1024 / 1024));
    
    // Save performance measurements periodically
    performanceMonitor.saveResults();
  }
  
  // Take screenshot after each test if configured
  if (process.env.DETOX_SCREENSHOT_AFTER_TEST === 'true' || testStatus === 'failed') {
    const artifactsDir = path.join(process.cwd(), 'e2e', 'artifacts');
    const screenshotPath = path.join(
      artifactsDir, 
      `${testName.replace(/\s+/g, '-').toLowerCase()}-${testStatus}.png`
    );
    await takeScreenshot(screenshotPath);
  }
  
  // Clean up after each test
  try {
    // Reset app state if needed
    if (process.env.DETOX_RESET_APP_AFTER_TEST === 'true') {
      await resetAppToInitialState();
    }
  } catch (error) {
    errorHandler.captureError(error, `Cleanup after ${testName}`);
  }
  
  // Nothing extra required for jest-circus afterEach
  });
}

if (typeof afterAll !== 'undefined') {
  afterAll(async () => {
  // End performance monitoring for app startup
  const startupTime = performanceMonitor.endMeasurement('startupTime');
  console.log(`App startup time: ${startupTime}ms`);
  
  // Save any remaining performance measurements
  performanceMonitor.saveResults();
  
  // Save any error logs
  errorHandler.saveResults();
  
  // Log test end time
  console.log(`Test Suite Completed: ${new Date().toISOString()}`);
  
  // Cleanup is now handled automatically by Detox in v20+
  // No need to call detox.cleanup() manually
  });
}

// Export test helpers for use in test files
module.exports = {
  navigateTo,
  loginAsTestUser,
  logout,
  waitForElementToBeVisible,
  waitForElementToBeGone,
  takeScreenshot,
  measurePerformance,
  generateRandomData,
  resetAppToInitialState,
  mockLocation,
  tapBackButton,
  scrollToElement,
  clearTextInput,
  performanceMonitor,
  errorHandler,
};
