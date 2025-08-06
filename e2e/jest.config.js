// e2e/jest.config.js
module.exports = {
  // Test environment configuration
  // Use Detox-provided Jest environment for proper integration
  testEnvironment: 'detox/runners/jest/testEnvironment',
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  testTimeout: 120000, // 2-minute timeout is usually enough for a single E2E test
  
  // Detox v20+ handles init/cleanup via dedicated hooks – use built-in scripts.
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  // `setupFilesAfterEnv` is no longer required – keeping it causes duplicate / early
  // initialisation that leads to expect.getState and jest context errors.
  
  // Run tests serially – Detox doesn’t support parallelism well
  maxWorkers: 1,

  // Reporters – keep default + Detox reporter only
  reporters: [
    'default',
    ['<rootDir>/e2e/reporters/detox-reporter.js', {}],
  ],
  
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

  // Misc
  displayName: 'E2E',
  errorOnDeprecated: true,
};
