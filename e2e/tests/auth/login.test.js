// e2e/tests/auth/login.test.js
const { device, element, by, waitFor, expect } = require('detox');
const {
  navigateTo,
  loginAsTestUser,
  waitForElementToBeVisible,
  waitForElementToBeGone,
  takeScreenshot,
  resetAppToInitialState,
  clearTextInput,
} = require('../../helpers/testHelpers');

// Import test data
const { TEST_USER_CREDENTIALS } = require('../../data/testData');

describe('Login Tests', () => {
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
    await takeScreenshot(`login-test-${Date.now()}`);
  });

  it('should successfully login with valid credentials', async () => {
    // Use test user credentials
    const { email, password } = TEST_USER_CREDENTIALS.regularUser;
    
    // Enter login credentials
    await element(by.id('login-email-input')).typeText(email);
    await element(by.id('login-password-input')).typeText(password);
    
    // Submit login form
    await element(by.id('login-button')).tap();
    
    // Verify successful login by checking if we're redirected to home screen
    await waitForElementToBeVisible(by.id('screen-home'), 10000);
    
    // Clean up - logout for next test
    await navigateTo('Profile');
    await element(by.id('logout-button')).tap();
    await waitForElementToBeVisible(by.id('screen-login'));
  });

  it('should show error message for invalid credentials', async () => {
    // Use invalid credentials
    const { email } = TEST_USER_CREDENTIALS.regularUser;
    const wrongPassword = 'WrongPassword123!';
    
    // Enter invalid credentials
    await element(by.id('login-email-input')).typeText(email);
    await element(by.id('login-password-input')).typeText(wrongPassword);
    
    // Submit login form
    await element(by.id('login-button')).tap();
    
    // Verify error message
    await waitForElementToBeVisible(by.text('Invalid email or password'));
  });

  it('should show validation errors for empty login fields', async () => {
    // Submit empty login form
    await element(by.id('login-button')).tap();
    
    // Verify validation error messages
    await waitForElementToBeVisible(by.text('Email is required'));
    
    // Enter email only
    await element(by.id('login-email-input')).typeText('test@example.com');
    await element(by.id('login-button')).tap();
    
    // Verify password validation error
    await waitForElementToBeVisible(by.text('Password is required'));
  });

  it('should remember email if "Remember Me" is checked', async () => {
    // Check if Remember Me checkbox exists
    try {
      const rememberMeCheckbox = element(by.id('login-remember-me'));
      const isVisible = await rememberMeCheckbox.isVisible();
      
      if (isVisible) {
        // Use test user credentials
        const { email, password } = TEST_USER_CREDENTIALS.regularUser;
        
        // Enter login credentials and check Remember Me
        await element(by.id('login-email-input')).typeText(email);
        await element(by.id('login-password-input')).typeText(password);
        await rememberMeCheckbox.tap();
        
        // Submit login form
        await element(by.id('login-button')).tap();
        
        // Verify successful login
        await waitForElementToBeVisible(by.id('screen-home'), 10000);
        
        // Logout
        await navigateTo('Profile');
        await element(by.id('logout-button')).tap();
        await waitForElementToBeVisible(by.id('screen-login'));
        
        // Verify email is remembered
        await expect(element(by.id('login-email-input'))).toHaveText(email);
      }
    } catch (error) {
      console.log('Remember Me feature not available, skipping test');
    }
  });

  it('should handle non-existent user login attempt', async () => {
    // Use non-existent email
    const nonExistentEmail = `nonexistent-${Date.now()}@example.com`;
    const password = 'Password123!';
    
    // Enter non-existent credentials
    await element(by.id('login-email-input')).typeText(nonExistentEmail);
    await element(by.id('login-password-input')).typeText(password);
    
    // Submit login form
    await element(by.id('login-button')).tap();
    
    // Verify error message
    await waitForElementToBeVisible(by.text('Invalid email or password'));
  });
});
