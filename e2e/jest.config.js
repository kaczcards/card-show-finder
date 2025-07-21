// e2e/jest.config.js
module.exports = {
  // Test environment configuration
  // Use Detox-provided Jest environment for proper integration
  testEnvironment: 'detox/runners/jest/testEnvironment',
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  testTimeout: 120000, // 2 minutes timeout for E2E tests
  
  // Setup and teardown files
  globalSetup: '<rootDir>/e2e/setup.js',
  globalTeardown: '<rootDir>/e2e/teardown.js',
  setupFilesAfterEnv: ['<rootDir>/e2e/init.js'],
  
  // Test isolation and retries
  maxWorkers: 1, // Run tests serially to prevent interference
  
  // Reporters and output
  verbose: true,
  reporters: [
    'default',
    ['<rootDir>/e2e/reporters/detox-reporter.js', {}],
    // Temporarily removing jest-junit reporter to simplify setup
  ],
  
  // Coverage (optional for E2E tests)
  collectCoverage: false,
  coveragePathIgnorePatterns: ['/node_modules/', '/e2e/'],
  
  // Performance monitoring
  slowTestThreshold: 30, // Mark tests taking more than 30s as slow
  
  // Test data isolation
  globals: {
    __DETOX_TEST_MODE__: true,
    __DETOX_ISOLATED_DATA__: true,
  },
  
  // Additional configuration
  bail: 0, // Don't bail on first test failure
  cache: false, // Disable cache for consistent test runs
  detectOpenHandles: true,
  forceExit: true, // Force exit after tests complete
  logHeapUsage: true, // Log memory usage for performance monitoring
  
  // Transform and module configuration
  transform: {
    '^.+\\.(js|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],
  
  // Module directories and extensions
  moduleDirectories: ['node_modules', 'src'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Root directory and test environment configuration
  rootDir: '..',
  roots: ['<rootDir>/e2e'],
  
  // Display options
  displayName: 'Card Show Finder E2E Tests',
  errorOnDeprecated: true,
  prettierPath: null,
  
  // Notification settings for CI environments
  notify: false,
  notifyMode: 'failure-change',
  
  // Performance metrics collection
  fakeTimers: {
    enableGlobally: false,
    legacyFakeTimers: false,
  },
  testLocationInResults: true,
};
