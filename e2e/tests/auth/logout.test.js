// e2e/tests/auth/logout.test.js
const { device, element, by, waitFor, expect } = require('detox');
const {
  navigateTo,
  loginAsTestUser,
  waitForElementToBeVisible,
  waitForElementToBeGone,
  takeScreenshot,
  resetAppToInitialState,
} = require('../../helpers/testHelpers');

describe('Logout Tests', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
  });

  beforeEach(async () => {
    // Start each test with a logged-in user
    try {
      // Check if we're already logged in
      await navigateTo('Profile');
      const isLoggedIn = await element(by.id('logout-button')).isVisible();
      
      if (!isLoggedIn) {
        // If not logged in, reset to login screen and log in
        await resetAppToInitialState();
        await waitForElementToBeVisible(by.id('screen-login'), 10000);
        await loginAsTestUser();
      }
    } catch (error) {
      // If error (likely not logged in), reset and log in
      await resetAppToInitialState();
      await waitForElementToBeVisible(by.id('screen-login'), 10000);
      await loginAsTestUser();
    }
    
    // Ensure we're on the profile screen where logout button is
    await navigateTo('Profile');
    await waitForElementToBeVisible(by.id('logout-button'), 5000);
  });

  afterEach(async () => {
    // Take screenshot after each test for debugging
    await takeScreenshot(`logout-test-${Date.now()}`);
  });

  it('should successfully logout a logged in user', async () => {
    // Verify user is logged in by checking for logout button
    await waitForElementToBeVisible(by.id('logout-button'));
    
    // Logout
    await element(by.id('logout-button')).tap();
    
    // Handle confirmation dialog if it appears
    try {
      const confirmButton = element(by.text('Confirm').withAncestor(by.id('logout-confirmation')));
      const isVisible = await confirmButton.isVisible();
      if (isVisible) {
        await confirmButton.tap();
      }
    } catch (error) {
      // No confirmation dialog, continue
    }
    
    // Verify successful logout by checking if we're redirected to login screen
    await waitForElementToBeVisible(by.id('screen-login'));
  });

  it('should clear user session data after logout', async () => {
    // Verify user is logged in
    await waitForElementToBeVisible(by.id('logout-button'));
    
    // Logout
    await element(by.id('logout-button')).tap();
    
    // Handle confirmation dialog if it appears
    try {
      const confirmButton = element(by.text('Confirm').withAncestor(by.id('logout-confirmation')));
      const isVisible = await confirmButton.isVisible();
      if (isVisible) {
        await confirmButton.tap();
      }
    } catch (error) {
      // No confirmation dialog, continue
    }
    
    // Wait for login screen
    await waitForElementToBeVisible(by.id('screen-login'));
    
    // Try to access protected route by directly navigating to profile
    try {
      await navigateTo('Profile');
      
      // Check if we're redirected to login screen
      await waitForElementToBeVisible(by.id('login-button'));
    } catch (error) {
      // If navigation fails, we're likely already on login screen which is expected
      await waitForElementToBeVisible(by.id('login-button'));
    }
  });
});
