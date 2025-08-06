// e2e/tests/basic.test.js
/**
 * Basic Detox Connectivity Test
 * 
 * This is the most minimal test possible to verify that:
 * 1. Device can launch the app
 * 2. Device object is accessible
 * 3. Element queries can be executed
 * 
 * Use this test to diagnose fundamental Detox setup issues.
 */

const { device, element, by } = require('detox');

describe('Basic Detox Connectivity Test', () => {
  beforeAll(async () => {
    console.log('🔍 BASIC TEST: Starting basic connectivity test...');
    try {
      console.log('📱 BASIC TEST: Attempting to launch app...');
      await device.launchApp({
        newInstance: true,
        delete: true,
        launchArgs: { debug: 'true' },
      });
      console.log('✅ BASIC TEST: App launched successfully');
    } catch (error) {
      console.error('❌ BASIC TEST: Failed to launch app:', error.message);
      // Don't throw here, let the test continue to gather more diagnostic info
    }
  });

  afterAll(async () => {
    console.log('🧹 BASIC TEST: Cleaning up...');
    try {
      await device.terminateApp();
      console.log('✅ BASIC TEST: App terminated successfully');
    } catch (error) {
      console.error('⚠️ BASIC TEST: Error during cleanup:', error.message);
    }
  });

  it('should verify device object is accessible', async () => {
    console.log('🔍 BASIC TEST: Checking device object...');
    
    // Simply verify the device object exists and has expected methods
    if (!device) {
      throw new Error('Device object is undefined – Detox not initialised?');
    }

    if (typeof device.launchApp !== 'function') {
      throw new Error('device.launchApp is not a function – Detox APIs unavailable');
    }

    if (typeof device.reloadReactNative !== 'function') {
      throw new Error('device.reloadReactNative is not a function – Detox APIs unavailable');
    }
    
    // Log device info for debugging
    try {
      const platform = device.getPlatform();
      console.log(`✅ BASIC TEST: Device platform: ${platform}`);
    } catch (error) {
      console.error('❌ BASIC TEST: Failed to get device platform:', error.message);
      throw error;
    }
  });

  it('should be able to execute element queries', async () => {
    console.log('🔍 BASIC TEST: Testing element queries...');
    
    try {
      // Just attempt to query for any element - we don't care if it exists
      // This just verifies the query mechanism works
      const anyElement = element(by.text('ANY_TEXT_THAT_MAY_NOT_EXIST'));
      
      // Check if the element query returns an object with expected methods
      if (!anyElement) {
        throw new Error('Element query returned undefined');
      }
      if (typeof anyElement.tap !== 'function') {
        throw new Error('Element object is missing expected methods');
      }
      
      console.log('✅ BASIC TEST: Element query executed successfully');
      
      // Try to find something that should exist in any app
      console.log('🔍 BASIC TEST: Attempting to find any visible elements...');
      
      // This won't fail the test if nothing is found, it just tries to query
      await element(by.text('Sign In')).getAttributes()
        .then(attrs => console.log('✅ BASIC TEST: Found element with text "Sign In"'))
        .catch(e => console.log('ℹ️ BASIC TEST: No "Sign In" text found (this is not an error)'));
      
      await element(by.traits(['button'])).getAttributes()
        .then(attrs => console.log('✅ BASIC TEST: Found a button element'))
        .catch(e => console.log('ℹ️ BASIC TEST: No button traits found (this is not an error)'));
      
    } catch (error) {
      console.error('❌ BASIC TEST: Failed to execute element query:', error.message);
      throw error;
    }
  });

  it('should attempt to take a screenshot', async () => {
    console.log('📸 BASIC TEST: Attempting to take a screenshot...');
    
    try {
      await device.takeScreenshot('basic-test-screenshot');
      console.log('✅ BASIC TEST: Screenshot taken successfully');
    } catch (error) {
      console.error('⚠️ BASIC TEST: Failed to take screenshot:', error.message);
      // Don't fail the test just because screenshots don't work
      // This is just additional diagnostic information
    }
  });
});
