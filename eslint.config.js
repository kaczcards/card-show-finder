// eslint.config.js
// Simple ESLint v9 flat config for React Native TypeScript project

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  // Base configuration
  {
    ignores: [
      'node_modules/**',
      'ios/**',
      'android/**',
      'build/**',
      'dist/**',
      '.expo/**',
      'coverage/**',
      // cache & generated
      '.jest-cache/**',
      '.jest/**',
      // large script / tooling directories
      'scripts/**',
      'e2e/**',
      // database & misc utility scripts
      'apply-*.js',
      'add-styles.js',
      'check-show-coordinates.js',
      'geocode-shows.js',
      // migrations & duplicated project dir
      'db_migrations/**',
      'card-show-finder/**',
      // debug-only files
      'debug-*.ts',
      'debug-*.js',
      // additional one-off utility / maintenance scripts
      'fix-*.js',
      'find-*.js',
      'run-*.js',
      'quick-*.js',
      'modify-*.js',
      'direct-*.js',
      'jest.setup.js',
      '*_service.js',
      '*_admin*.js',
      // backup / disabled test files
      '__tests__/**/*.bak',
      '**/*.config.js',
      '*.lock',
      '*.log',
    ]
  },
  
  // JavaScript files
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        __DEV__: 'readonly',
        require: 'readonly',
        process: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'react': require('eslint-plugin-react'),
    },
    rules: {
      // Basic rules to get started
      'no-unused-vars': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  
  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        __DEV__: 'readonly',
        require: 'readonly',
        process: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      'react': require('eslint-plugin-react'),
    },
    rules: {
      // Disable JS rule in favor of TS rule
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_' 
      }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      
      // React rules
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  }
];
