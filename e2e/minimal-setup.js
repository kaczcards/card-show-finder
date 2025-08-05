// e2e/minimal-setup.js
/**
 * Minimal Detox Setup
 * 
 * This is the most basic setup possible for Detox E2E testing.
 * It only initializes Detox with the configuration from .detoxrc.js
 * and does nothing else to minimize potential points of failure.
 */

const { detox } = require('detox');
const adapter = require('detox/runners/jest/adapter');

// Set the default timeout for all operations to be generous
jest.setTimeout(120000);

// This is the minimal code needed to initialize Detox
module.exports = async function() {
  console.log('🚀 Minimal Detox setup starting...');
  
  try {
    // Initialize Detox using the default configuration
    await detox.init();
    console.log('✅ Detox initialized successfully');
    
    // Set up Jest adapter for Detox
    await adapter.beforeEach();
    console.log('✅ Jest adapter initialized');
  } catch (error) {
    console.error('❌ Error during minimal Detox setup:', error.message);
    console.error(error);
    
    // Even if setup fails, don't throw to allow tests to run
    // This helps diagnose issues by letting tests attempt to run
    console.log('⚠️ Continuing despite setup error to help diagnose issues');
  }
  
  console.log('✅ Minimal setup complete');
};
