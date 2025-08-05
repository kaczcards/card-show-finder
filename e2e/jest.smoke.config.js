// e2e/jest.smoke.config.js
/**
 * Minimal Jest Configuration for Smoke Tests
 * 
 * This is an extremely simplified configuration that only includes
 * the essential settings needed to run basic smoke tests with Detox.
 * It removes all complex features, custom reporters, and other potential
 * points of failure to help isolate configuration issues.
 */

module.exports = {
  // Use the Detox test environment - this is essential
  testEnvironment: 'detox/runners/jest/testEnvironment',
  
  // Only run smoke test files
  testMatch: [
    '<rootDir>/e2e/tests/minimal.test.js',
    '<rootDir>/e2e/tests/basic.test.js',
    '<rootDir>/e2e/tests/smoke.test.js',
  ],
  
  // Very generous timeout for CI environments (3 minutes)
  testTimeout: 180000,
  
  // Use only the default Jest reporter
  reporters: ['default'],
  
  // Minimal transform configuration
  transform: {
    '^.+\\.(js|ts|tsx)$': 'babel-jest',
  },
  
  // Detox v20+ handles runtime setup automatically via the dedicated
  // globalSetup / globalTeardown scripts – no setupFilesAfterEnv needed.
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  
  // Simple test sequence - no retries or complex patterns
  maxWorkers: 1,
  
  // Create basic artifacts
  testRunner: 'jest-circus/runner',
  
  // Verbose output for diagnostics
  verbose: true,
  
  // Bail after first failure to speed up CI
  bail: 1,
  
  // Avoid any complex globals
  globals: {
    __DETOX_TEST__: true,
  },
  
  // No coverage reporting
  collectCoverage: false,
  
  // Root directory
  rootDir: '..',
};
