// jest.config.js
module.exports = {
  // Use React Native's Jest preset as the base configuration
  preset: 'jest-expo',

  // Test environment setup
  testEnvironment: 'node',
  
  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,
  
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  
  // Coverage reporters to use
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'html'],
  
  // A list of paths to directories that Jest should use to search for files in
  roots: ['<rootDir>'],
  
  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  
  // Ignore patterns for tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    '.git',
    '.history'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/types.ts',
    '!src/**/types/*.ts',
    '!src/constants/**',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/e2e/**'
  ],
  
  // Coverage thresholds for production quality
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70
    },
    './src/services/': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80
    },
    './src/hooks/': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80
    }
  },
  
  // Transform configuration for TypeScript/JSX
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  
  // Module name mapper for assets and special imports
  moduleNameMapper: {
    // Handle image imports
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
    
    // Handle CSS/SCSS imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    
    // Handle module aliases if you're using them
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // Setup files to run before tests
  setupFiles: [
    '<rootDir>/jest.setup.js'
  ],
  
  // Setup files to run after the test framework is instantiated
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect'
  ],
  
  // Module file extensions for importing
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Mock all native modules
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|react-clone-referenced-element|@react-native-community|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|@sentry/.*|react-native-maps|react-native-maps-super-cluster)'
  ],
  
  // Global variables available in all test files
  globals: {
    'ts-jest': {
      babelConfig: true,
      isolatedModules: true
    }
  },
  
  // Verbose output
  verbose: true,
  
  // Timeout for tests
  testTimeout: 30000,
  
  // Cache configuration
  cache: true,
  cacheDirectory: '.jest-cache',
  
  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // Reporter configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'reports/junit',
      outputName: 'jest-junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ]
};
