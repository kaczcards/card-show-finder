// e2e/tests/auth/session-persistence.test.js
const { device, element, by, waitFor, expect } = require('detox');
const {
  navigateTo,
  loginAsTestUser,
  waitForElementToBeVisible,
  waitForElementToBeGone,
  takeScreenshot,
  resetAppToInitialState,
} = require('../../helpers/testHelpers');

describe('Session Persistence Tests', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
  });

  beforeEach(async () => {
    // Reset to login screen before each test
    try {
      const isOnLoginScreen = await element(by.id('screen-login')).isVisible();
      if (!isOnLoginScreen) {
        await resetAppToInitialState();
        // Wait for app to load completely
        await waitForElementToBeVisible(by.id('screen-login'), 10000);
      }
    } catch (error) {
      await resetAppToInitialState();
      await waitForElementToBeVisible(by.id('screen-login'), 10000);
    }
  });

  afterEach(async () => {
    // Take screenshot after each test for debugging
    await takeScreenshot(`session-persistence-test-${Date.now()}`);
  });

  it('should maintain user session after app restart', async () => {
    // Login first
    await loginAsTestUser();
    
    // Verify successful login
    await waitForElementToBeVisible(by.id('screen-home'), 10000);
    
    // Restart app without clearing data
    await device.launchApp({ newInstance: true });
    
    // Wait for app to load
    await waitForElementToBeVisible(by.id('tab-home'), 10000);
    
    // Verify user is still logged in by navigating to profile
    await navigateTo('Profile');
    
    // Check for logout button which indicates user is logged in
    await waitForElementToBeVisible(by.id('logout-button'));
    
    // Clean up - logout for next test
    await element(by.id('logout-button')).tap();
    await waitForElementToBeVisible(by.id('screen-login'));
  });

  it('should clear session when app data is cleared', async () => {
    // Login first
    await loginAsTestUser();
    
    // Verify successful login
    await waitForElementToBeVisible(by.id('screen-home'), 10000);
    
    // Restart app with data cleared
    await device.launchApp({ delete: true, newInstance: true });
    
    // Wait for app to load
    await waitForElementToBeVisible(by.id('screen-login'), 10000);
    
    // Verify user is logged out by checking for login button
    await waitForElementToBeVisible(by.id('login-button'));
  });
});
