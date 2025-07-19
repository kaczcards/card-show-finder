// e2e/tests/auth/registration.test.js
const { device, element, by, waitFor, expect } = require('detox');
const {
  navigateTo,
  waitForElementToBeVisible,
  waitForElementToBeGone,
  takeScreenshot,
  generateRandomData,
  resetAppToInitialState,
  clearTextInput,
  tapBackButton,
} = require('../../helpers/testHelpers');

// Import test data
const { TEST_USER_CREDENTIALS, TEST_ERROR_SCENARIOS } = require('../../data/testData');

describe('Registration Tests', () => {
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
    await takeScreenshot(`registration-test-${Date.now()}`);
  });

  it('should successfully register a new user with valid credentials', async () => {
    // Generate random user data
    const userData = generateRandomData('user');
    
    // Navigate to register screen
    await element(by.text('Sign Up')).tap();
    await waitForElementToBeVisible(by.id('screen-register'));
    
    // Fill in registration form
    await element(by.id('register-email-input')).typeText(userData.email);
    await element(by.id('register-username-input')).typeText(userData.username);
    await element(by.id('register-password-input')).typeText(userData.password);
    await element(by.id('register-confirm-password-input')).typeText(userData.password);
    
    // Add home ZIP code if field exists
    try {
      const zipInput = element(by.id('register-home-zip-input'));
      const isVisible = await zipInput.isVisible();
      if (isVisible) {
        await zipInput.typeText(userData.homeZip);
      }
    } catch (error) {
      // Field might not exist, continue
    }
    
    // Submit registration form
    await element(by.id('register-button')).tap();
    
    // Verify successful registration by checking if we're redirected to home screen
    await waitForElementToBeVisible(by.id('screen-home'), 15000);
    
    // Verify user is logged in by checking profile tab
    await navigateTo('Profile');
    await waitForElementToBeVisible(by.id('logout-button'));
    
    // Clean up - logout for next test
    await element(by.id('logout-button')).tap();
    await waitForElementToBeVisible(by.id('screen-login'));
  });

  it('should show validation errors for invalid registration data', async () => {
    // Navigate to register screen
    await element(by.text('Sign Up')).tap();
    await waitForElementToBeVisible(by.id('screen-register'));
    
    // Test empty fields
    await element(by.id('register-button')).tap();
    await waitForElementToBeVisible(by.text('Email is required'));
    
    // Test invalid email format
    await element(by.id('register-email-input')).typeText('invalid-email');
    await element(by.id('register-button')).tap();
    await waitForElementToBeVisible(by.text('Invalid email format'));
    
    // Clear and enter valid email
    await element(by.id('register-email-input')).clearText();
    await element(by.id('register-email-input')).typeText('valid@example.com');
    
    // Test password too short
    await element(by.id('register-password-input')).typeText('short');
    await element(by.id('register-button')).tap();
    await waitForElementToBeVisible(by.text('Password must be at least 8 characters'));
    
    // Test password confirmation mismatch
    await element(by.id('register-password-input')).clearText();
    await element(by.id('register-password-input')).typeText('ValidPass123!');
    await element(by.id('register-confirm-password-input')).typeText('DifferentPass123!');
    await element(by.id('register-button')).tap();
    await waitForElementToBeVisible(by.text('Passwords do not match'));
  });

  it('should handle duplicate email registration attempt', async () => {
    // Use a known existing email (from test user credentials)
    const existingEmail = TEST_USER_CREDENTIALS.regularUser.email;
    
    // Navigate to register screen
    await element(by.text('Sign Up')).tap();
    await waitForElementToBeVisible(by.id('screen-register'));
    
    // Fill in registration form with existing email
    await element(by.id('register-email-input')).typeText(existingEmail);
    await element(by.id('register-username-input')).typeText('newusername');
    await element(by.id('register-password-input')).typeText('ValidPass123!');
    await element(by.id('register-confirm-password-input')).typeText('ValidPass123!');
    
    // Submit registration form
    await element(by.id('register-button')).tap();
    
    // Verify error message for duplicate email
    await waitForElementToBeVisible(by.text('Email already in use'));
  });

  it('should allow user to cancel registration and return to login', async () => {
    // Navigate to register screen
    await element(by.text('Sign Up')).tap();
    await waitForElementToBeVisible(by.id('screen-register'));
    
    // Tap back button or cancel button
    try {
      await element(by.id('register-cancel-button')).tap();
    } catch (error) {
      await tapBackButton();
    }
    
    // Verify return to login screen
    await waitForElementToBeVisible(by.id('screen-login'));
  });
});
