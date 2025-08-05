// e2e/minimal-teardown.js
/**
 * Minimal Detox Teardown
 * 
 * This is the most basic teardown possible for Detox E2E testing.
 * It only cleans up the Detox instance without any complex cleanup logic
 * to minimize potential points of failure.
 */

const { detox } = require('detox');
const adapter = require('detox/runners/jest/adapter');

module.exports = async function() {
  console.log('🧹 Minimal Detox teardown starting...');
  
  try {
    // Clean up Jest adapter
    await adapter.afterAll();
    console.log('✅ Jest adapter cleaned up');
    
    // Clean up Detox
    await detox.cleanup();
    console.log('✅ Detox cleaned up successfully');
  } catch (error) {
    console.error('⚠️ Error during minimal Detox teardown:', error.message);
    console.error(error);
    
    // Don't throw errors during teardown to ensure test results are reported
    console.log('⚠️ Continuing despite teardown error to preserve test results');
  }
  
  console.log('✅ Minimal teardown complete');
};
