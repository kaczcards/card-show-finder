// eslint.config.js
// Simple ESLint v9 flat config for React Native TypeScript project

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  // Base configuration
  {
    ignores: [
      // Node and build directories
      'node_modules/**',
      'ios/**',
      'android/**',
      'build/**',
      'dist/**',
      '.expo/**',
      '.expo-shared/**',
      'web-build/**',
      'coverage/**',
      
      // All backup directories patterns
      '*-backups/**',
      '*backup*/**',
      '**/*-backups/**',
      '**/*backup*/**',
      
      // Specific backup directories
      'admin-cli-fixes-backups/**',
      'quick-fixes-backups/**',
      'automated-fixes-backups/**',
      'lint-fix-backups/**',
      'lint-recovery-backups/**',
      'unused-cleanup-backups/**',
      'unused-vars-fixes-backups/**',
      'console-logs-backups/**',
      'import-export-fixes-backups/**',
      'temp_backup/**',
      
      // Temp directories and build artifacts
      'temp-*/**',
      'temp-export/**',
      'temp-test-build/**',
      '_expo/**',
      '**/_expo/**',
      
      // Cache directories
      '.jest-cache/**',
      '.jest/**',
      '.cache/**',
      '.npm/**',
      '.babel-cache/**',
      'jest-cache/**',
      
      // E2E test artifacts
      'e2e/artifacts/**',
      'e2e/reports/**',
      
      // Generated and backup files
      '**/*.generated.*',
      '**/*.bak',
      '**/*.bak-*',
      '**/*.js.map',
      '**/*.d.ts.map',
      '**/*.js.bundle',
      '**/*.tsbuildinfo',
      
      // Admin and CLI files
      'admin_*.js',
      'admin-*.js',
      
      // SQL files and migrations
      '**/*.sql',
      'db_migrations/**',
      'supabase/migrations/**',
      'sql/**',
      
      // Shell scripts
      '**/*.sh',
      
      // Utility scripts in root directory
      'apply-*.js',
      'add-*.js',
      'check-*.js',
      'geocode-*.js',
      'debug-*.js',
      'debug-*.ts',
      'fix-*.js',
      'find-*.js',
      'run-*.js',
      'quick-*.js',
      'modify-*.js',
      'direct-*.js',
      'setup-*.js',
      'test-*.js',
      'verify-*.js',
      'install-*.js',
      'create-*.js',
      'insert-*.js',
      'validate-*.js',
      
      // Config files
      '*.config.js',
      'jest.setup.js',
      'metro.config.js',
      'babel.config.js',
      
      // Scraper directory
      'scraper/**',
      
      // Scripts directory
      'scripts/**',
      
      // Test directories
      'e2e/**',
      '__mocks__/**',

      // ------------------------------------------------------------------
      // Debug-only files (explicit & pattern-based)
      // ------------------------------------------------------------------
      // Specific files that triggered lint failures
      'debug_scraper_detailed.js',
      'analyze-show-series.js',
      // Generic debug patterns
      '**/*.debug.*',
      '**/debug_*',
      
      // Shelved features
      'shelved-features/**',
      
      // Other files
      '*.lock',
      '*.log',
      '*.md',
      '.env*',
      '.gitignore',
      '.eslintignore'
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
