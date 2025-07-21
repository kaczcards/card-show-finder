// e2e/setup.js
const detox = require('detox');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables from .env.test if it exists, fallback to .env
const envPath = fs.existsSync(path.resolve(process.cwd(), '.env.test')) 
  ? path.resolve(process.cwd(), '.env.test')
  : path.resolve(process.cwd(), '.env');

dotenv.config({ path: envPath });

// Create a Supabase client for test data setup
const supabaseUrl = process.env.EXPO_PUBLIC_TEST_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_TEST_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Test user credentials - will be used across tests
const TEST_USER = {
  email: `test-user-${Date.now()}@example.com`,
  password: 'Test123!@#',
  username: `testuser${Date.now()}`,
  homeZip: '90210',
};

// Test show data
const TEST_SHOWS = [
  {
    name: 'Test Card Show 1',
    description: 'A test card show for E2E testing',
    address: '123 Test Street, Los Angeles, CA 90001',
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days from now
    entryFee: 5.00,
    coordinates: { lat: 34.052235, lng: -118.243683 },
    features: ['sports', 'trading', 'vintage'],
  },
  {
    name: 'Test Card Show 2',
    description: 'Another test card show for E2E testing',
    address: '456 Test Avenue, Los Angeles, CA 90002',
    startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
    endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now
    entryFee: 10.00,
    coordinates: { lat: 34.052235, lng: -118.343683 },
    features: ['pokemon', 'magic', 'modern'],
  },
];

// Performance monitoring thresholds
const PERFORMANCE_THRESHOLDS = {
  cpu: process.env.DETOX_PERF_THRESHOLD_CPU || 80, // CPU usage percentage threshold
  memory: process.env.DETOX_PERF_THRESHOLD_MEMORY || 500, // Memory usage in MB threshold
  startupTime: 5000, // App startup time threshold in ms
  transitionTime: 1000, // Screen transition time threshold in ms
};

// Create artifacts directory if it doesn't exist
const artifactsDir = path.join(process.cwd(), 'e2e', 'artifacts');
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

// Supabase test data setup function
async function setupTestDatabase() {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not found. Skipping test database setup.');
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check if we can connect to Supabase
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    
    if (error) {
      console.error('Failed to connect to Supabase:', error.message);
      return;
    }
    
    console.log('Connected to Supabase test database successfully');
    
    // Create test user if needed
    const { data: existingUser, error: userError } = await supabase.auth.signUp({
      email: TEST_USER.email,
      password: TEST_USER.password,
    });
    
    if (userError) {
      console.error('Failed to create test user:', userError.message);
    } else {
      console.log('Test user created or already exists');
      
      // Update profile with test data
      const userId = existingUser?.user?.id;
      if (userId) {
        await supabase.from('profiles').upsert({
          id: userId,
          username: TEST_USER.username,
          home_zip: TEST_USER.homeZip,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        
        console.log('Test user profile updated');
      }
    }
    
    // Create test shows
    for (const show of TEST_SHOWS) {
      const { error: showError } = await supabase.rpc('create_show_with_coordinates', {
        p_name: show.name,
        p_description: show.description,
        p_address: show.address,
        p_start_date: show.startDate,
        p_end_date: show.endDate,
        p_entry_fee: show.entryFee,
        p_lat: show.coordinates.lat,
        p_lng: show.coordinates.lng,
        p_features: show.features,
      });
      
      if (showError) {
        console.error(`Failed to create test show "${show.name}":`, showError.message);
      } else {
        console.log(`Test show "${show.name}" created`);
      }
    }
    
    // Store test data in global object for tests to access
    global.__DETOX_GLOBAL__ = global.__DETOX_GLOBAL__ || {};
    global.__DETOX_GLOBAL__.TEST_USER = TEST_USER;
    global.__DETOX_GLOBAL__.TEST_SHOWS = TEST_SHOWS;
    
    console.log('Test database setup completed successfully');
  } catch (err) {
    console.error('Error setting up test database:', err);
  }
}

// Mock service setup
function setupMockServices() {
  // Set up mock services for external APIs if needed
  // For this implementation, we'll use real API calls with test keys as requested
  console.log('Using real API calls with test keys for external services');
  
  // Store any mock configurations in global object
  global.__DETOX_GLOBAL__ = global.__DETOX_GLOBAL__ || {};
  global.__DETOX_GLOBAL__.MOCK_SERVICES = {
    enabled: false,
    usesRealApis: true,
  };
}

// Performance monitoring setup
function setupPerformanceMonitoring() {
  console.log('Setting up performance monitoring');
  
  // Store performance thresholds in global object
  global.__DETOX_GLOBAL__ = global.__DETOX_GLOBAL__ || {};
  global.__DETOX_GLOBAL__.PERFORMANCE = {
    enabled: true,
    thresholds: PERFORMANCE_THRESHOLDS,
    measurements: [],
    startTime: Date.now(),
  };
  
  // Create performance log file
  const perfLogPath = path.join(artifactsDir, 'performance.log');
  fs.writeFileSync(perfLogPath, 'TIMESTAMP,TEST,METRIC,VALUE\n');
  
  global.__DETOX_GLOBAL__.PERFORMANCE.logPath = perfLogPath;
  
  console.log(`Performance monitoring enabled. Log file: ${perfLogPath}`);
}

// Environment validation
function validateEnvironment() {
  console.log('Validating test environment');
  
  const requiredEnvVars = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`Missing required environment variables: ${missingVars.join(', ')}`);
    console.warn('Tests may fail or behave unexpectedly without these variables');
  } else {
    console.log('All required environment variables are present');
  }
  
  // Check for required dependencies
  try {
    const detoxVersion = require('detox/package.json').version;
    console.log(`Detox version: ${detoxVersion}`);
    
    // Check iOS environment
    if (process.platform === 'darwin') {
      const xcodeVersion = execSync('xcodebuild -version').toString().split('\n')[0];
      console.log(`Xcode version: ${xcodeVersion}`);
      
      const simulatorList = execSync('xcrun simctl list devices available').toString();
      const hasTargetSimulator = simulatorList.includes('iPhone 16 Plus');
      
      if (!hasTargetSimulator) {
        console.warn('iPhone 16 Plus simulator not found. Tests may fail.');
      } else {
        console.log('Target simulator (iPhone 16 Plus) is available');
      }
    }
  } catch (err) {
    console.error('Error checking dependencies:', err.message);
  }
  
  console.log('Environment validation completed');
}

// Main setup function
module.exports = async () => {
  console.log('Starting Detox E2E test setup');
  
  // Set up isolated test database and seed data
  await setupTestDatabase();
  
  // Configure mock services
  setupMockServices();
  
  // Set up performance monitoring
  setupPerformanceMonitoring();
  
  // Validate test environment
  validateEnvironment();
  
  console.log('Detox E2E test setup completed successfully');
  
  // Store setup timestamp for test duration calculations
  global.__DETOX_GLOBAL__ = global.__DETOX_GLOBAL__ || {};
  global.__DETOX_GLOBAL__.SETUP_TIMESTAMP = Date.now();
};
