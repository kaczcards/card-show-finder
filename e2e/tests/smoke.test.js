// e2e/tests/smoke.test.js
const { device, element, by, waitFor, expect } = require('detox');

describe('Smoke Test', () => {
  beforeAll(async () => {
    // Launch the app with a clean state
    await device.launchApp({ newInstance: true, delete: true });
  });

  beforeEach(async () => {
    // Ensure we're starting from a clean state for each test
    if (device.getPlatform() === 'ios') {
      await device.reloadReactNative();
    } else {
      await device.launchApp({ newInstance: false });
    }
  });

  afterAll(async () => {
    // Clean up after all tests are done
    await device.terminateApp();
  });

  it('should launch the app successfully', async () => {
    // Wait for app to be fully loaded (up to 10 seconds)
    await waitFor(element(by.id('app-root')))
      .toBeVisible()
      .withTimeout(10000);
    
    console.log('App launched successfully');
  });

  it('should display the initial screen with key UI elements', async () => {
    // Wait for the initial screen to be visible
    // This could be a login screen, welcome screen, or main screen depending on app state
    await waitFor(element(by.id('screen-login')).atIndex(0))
      .toBeVisible()
      .withTimeout(10000);
    
    // Check for common UI elements that should be present on the initial screen
    // These IDs should match what's in your app's code
    await expect(element(by.text('Sign In'))).toBeVisible();
    await expect(element(by.text('Sign Up'))).toBeVisible();
    
    // Verify input fields are present
    await expect(element(by.id('email-input'))).toExist();
    await expect(element(by.id('password-input'))).toExist();
    
    console.log('Initial screen loaded with expected UI elements');
  });

  it('should take a screenshot for verification', async () => {
    // Take a screenshot for manual verification
    await device.takeScreenshot('smoke-test-initial-screen');
    
    console.log('Screenshot taken for verification');
  });

  it('should have working navigation elements', async () => {
    // Test basic navigation without actually logging in
    // For example, tapping the Sign Up link should navigate to registration
    await element(by.text('Sign Up')).tap();
    
    // Verify we've navigated to the registration screen
    await waitFor(element(by.id('screen-register')))
      .toBeVisible()
      .withTimeout(5000);
    
    // Go back to login screen
    if (device.getPlatform() === 'ios') {
      await element(by.traits(['button']).withAncestor(by.id('header'))).atIndex(0).tap();
    } else {
      await device.pressBack();
    }
    
    // Verify we're back at the login screen
    await waitFor(element(by.id('screen-login')))
      .toBeVisible()
      .withTimeout(5000);
    
    console.log('Basic navigation is working');
  });
});
