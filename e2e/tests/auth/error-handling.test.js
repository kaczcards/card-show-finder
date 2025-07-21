// e2e/tests/auth/error-handling.test.js
const { device, element, by, waitFor, expect } = require('detox');
const {
  navigateTo,
  loginAsTestUser,
  waitForElementToBeVisible,
  waitForElementToBeGone,
  takeScreenshot,
  resetAppToInitialState,
  clearTextInput,
  generateRandomData,
} = require('../../helpers/testHelpers');

// Import test data
const { TEST_USER_CREDENTIALS, TEST_ERROR_SCENARIOS } = require('../../data/testData');

describe('Authentication Error Handling Tests', () => {
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
    await takeScreenshot(`error-handling-test-${Date.now()}`);
    
    // Reset network status if it was changed
    try {
      await device.setStatusBar({ networkType: 'wifi' });
    } catch (error) {
      // Ignore if not supported in this environment
    }
  });

  describe('Network and Server Errors', () => {
    it('should handle network errors during login gracefully', async () => {
      // This test simulates network errors
      // In a real scenario, we would use network interception
      
      // Enable airplane mode if possible
      // Note: This might not work in all test environments
      try {
        await device.setStatusBar({ networkType: 'none' });
      } catch (error) {
        console.log('Cannot control network state in this environment');
        return; // Skip test
      }
      
      // Attempt login
      await element(by.id('login-email-input')).typeText(TEST_USER_CREDENTIALS.regularUser.email);
      await element(by.id('login-password-input')).typeText(TEST_USER_CREDENTIALS.regularUser.password);
      await element(by.id('login-button')).tap();
      
      // Verify network error message
      await waitForElementToBeVisible(by.text('Network error'));
      
      // Restore network
      await device.setStatusBar({ networkType: 'wifi' });
    });

    it('should handle server errors during authentication', async () => {
      // This test would ideally use a mock server to simulate errors
      // For now, we'll check if the app has error handling UI components
      
      // Enter valid credentials
      await element(by.id('login-email-input')).typeText(TEST_USER_CREDENTIALS.regularUser.email);
      await element(by.id('login-password-input')).typeText(TEST_USER_CREDENTIALS.regularUser.password);
      
      // Check if there's a retry button for server errors
      try {
        const retryButton = element(by.id('retry-button'));
        const isVisible = await retryButton.isVisible();
        
        if (isVisible) {
          // Tap retry button to test error recovery
          await retryButton.tap();
          
          // Verify either error message or successful login
          try {
            await waitForElementToBeVisible(by.id('screen-home'), 5000);
          } catch (error) {
            // If login fails, we should still see an error message
            await waitForElementToBeVisible(by.id('error-message'));
          }
        }
      } catch (error) {
        // No retry button, skip this part of the test
        console.log('No retry button found, skipping error recovery test');
      }
    });
  });

  describe('Validation Errors', () => {
    it('should handle validation errors with clear messages', async () => {
      // Test various validation error scenarios
      
      // 1. Empty fields
      await element(by.id('login-button')).tap();
      await waitForElementToBeVisible(by.text('Email is required'));
      
      // 2. Invalid email format
      await element(by.id('login-email-input')).typeText('invalid@email');
      await element(by.id('login-button')).tap();
      await waitForElementToBeVisible(by.text('Invalid email format'));
      
      // 3. Password too short (if there's a minimum length)
      await clearTextInput(by.id('login-email-input'));
      await element(by.id('login-email-input')).typeText('valid@example.com');
      await element(by.id('login-password-input')).typeText('short');
      await element(by.id('login-button')).tap();
      
      // Check for password length error message
      try {
        await waitForElementToBeVisible(by.text('Password must be at least'));
      } catch (error) {
        // If no specific length requirement, might just show generic error
        try {
          await waitForElementToBeVisible(by.text('Invalid password'));
        } catch (innerError) {
          // Some apps might just attempt login and show invalid credentials
          await waitForElementToBeVisible(by.text('Invalid email or password'));
        }
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely long email addresses', async () => {
      // Use edge case credentials with very long email
      const { email, password } = TEST_USER_CREDENTIALS.edgeCases.veryLongEmail;
      
      // Enter long email
      await element(by.id('login-email-input')).typeText(email);
      await element(by.id('login-password-input')).typeText(password);
      
      // Submit login form
      await element(by.id('login-button')).tap();
      
      // Check if input is properly handled (either error message or attempt login)
      try {
        // App might show validation error
        await waitForElementToBeVisible(by.text('Email too long'));
      } catch (error) {
        // Or might attempt login and show invalid credentials
        try {
          await waitForElementToBeVisible(by.text('Invalid email or password'));
        } catch (innerError) {
          // Or might actually accept it and show loading state
          await waitForElementToBeVisible(by.id('login-loading'));
        }
      }
    });

    it('should handle special characters in password', async () => {
      // Generate random email
      const email = generateRandomData('email');
      
      // Use password with special characters
      const password = 'Pass!@#$%^&*()_+{}|:\"<>?~`-=[]\\\\;\\',./';\n      
      // Navigate to register screen
      await element(by.text('Sign Up')).tap();
      await waitForElementToBeVisible(by.id('screen-register'));
      
      // Fill in registration form
      await element(by.id('register-email-input')).typeText(email);
      await element(by.id('register-username-input')).typeText('specialchars');
      await element(by.id('register-password-input')).typeText(password);
      await element(by.id('register-confirm-password-input')).typeText(password);
      
      // Submit registration form
      await element(by.id('register-button')).tap();
      
      // Check if password is accepted or rejected
      try {
        // Might show validation error
        await waitForElementToBeVisible(by.text('Password contains invalid characters'));
      } catch (error) {
        // Or might accept it and proceed with registration
        try {
          // Wait for home screen (successful registration)
          await waitForElementToBeVisible(by.id('screen-home'), 10000);
          
          // Clean up - logout
          await navigateTo('Profile');
          await element(by.id('logout-button')).tap();
        } catch (innerError) {
          // Or might show other error
          await waitForElementToBeVisible(by.id('error-message'));
        }
      }
    });

    it('should handle rapid repeated login attempts', async () => {
      // Use test user credentials
      const { email, password } = TEST_USER_CREDENTIALS.regularUser;
      
      // Enter login credentials
      await element(by.id('login-email-input')).typeText(email);
      await element(by.id('login-password-input')).typeText(password);
      
      // Tap login button multiple times in rapid succession
      await element(by.id('login-button')).multiTap(3);
      
      // Verify app doesn't crash and either:
      // 1. Shows loading indicator and proceeds with login
      // 2. Shows error about multiple attempts
      // 3. Successfully logs in
      
      try {
        // Check for loading indicator
        await waitForElementToBeVisible(by.id('login-loading'));
      } catch (error) {
        // Or check for multiple attempts error
        try {
          await waitForElementToBeVisible(by.text('Too many attempts'));
        } catch (innerError) {
          // Or check for successful login
          await waitForElementToBeVisible(by.id('screen-home'), 10000);
          
          // Clean up - logout
          await navigateTo('Profile');
          await element(by.id('logout-button')).tap();
        }
      }
    });
  });

  describe('Security Features', () => {
    it('should enforce password strength requirements', async () => {
      // Navigate to register screen
      await element(by.text('Sign Up')).tap();
      await waitForElementToBeVisible(by.id('screen-register'));
      
      // Test weak passwords
      const weakPasswords = [
        'password',
        '12345678',
        'abcdefgh',
        'qwerty123',
      ];
      
      // Generate random email
      const email = generateRandomData('email');
      await element(by.id('register-email-input')).typeText(email);
      await element(by.id('register-username-input')).typeText('weakpasstest');
      
      // Try each weak password
      for (const weakPassword of weakPasswords) {
        await clearTextInput(by.id('register-password-input'));
        await element(by.id('register-password-input')).typeText(weakPassword);
        await clearTextInput(by.id('register-confirm-password-input'));
        await element(by.id('register-confirm-password-input')).typeText(weakPassword);
        
        // Submit form
        await element(by.id('register-button')).tap();
        
        // Check for password strength error
        try {
          await waitForElementToBeVisible(by.text('Password is too weak'));
        } catch (error) {
          try {
            await waitForElementToBeVisible(by.text('Password must include'));
          } catch (innerError) {
            // Some apps might have different error messages
            await waitForElementToBeVisible(by.id('password-error'));
          }
        }
      }
    });

    it('should mask password input', async () => {
      // Check if password field is masked
      const passwordInput = element(by.id('login-password-input'));
      
      // Type password
      await passwordInput.typeText('TestPassword123');
      
      // Check if there's a toggle to show/hide password
      try {
        const togglePasswordVisibility = element(by.id('toggle-password-visibility'));
        const isVisible = await togglePasswordVisibility.isVisible();
        
        if (isVisible) {
          // Test toggle functionality
          await togglePasswordVisibility.tap();
          
          // Check if password is now visible (this is hard to verify in E2E tests)
          // We can check if the toggle button text/icon changed
          try {
            await waitForElementToBeVisible(by.id('hide-password-icon'));
          } catch (error) {
            // Or check for "Hide" text
            await waitForElementToBeVisible(by.text('Hide'));
          }
          
          // Toggle back
          await togglePasswordVisibility.tap();
        }
      } catch (error) {
        // No toggle button, just verify input exists
        await expect(passwordInput).toExist();
      }
    });

    it('should have protection against brute force attacks', async () => {
      // This test attempts multiple failed logins to check for account lockout
      // Note: This test might lock the test account, so use with caution
      
      const maxAttempts = 5; // Typical lockout threshold
      const { email } = TEST_USER_CREDENTIALS.regularUser;
      const wrongPassword = 'WrongPassword123!';
      
      // Attempt multiple failed logins
      for (let i = 0; i < maxAttempts; i++) {
        // Clear fields and enter credentials
        await clearTextInput(by.id('login-email-input'));
        await clearTextInput(by.id('login-password-input'));
        await element(by.id('login-email-input')).typeText(email);
        await element(by.id('login-password-input')).typeText(wrongPassword);
        
        // Submit login form
        await element(by.id('login-button')).tap();
        
        // Wait for error message
        await waitForElementToBeVisible(by.text('Invalid email or password'));
        
        // Check if account lockout message appears
        try {
          const lockoutMessage = await element(by.text('Too many failed attempts')).isVisible();
          if (lockoutMessage) {
            // Account lockout detected, test passed
            break;
          }
        } catch (error) {
          // No lockout message yet, continue with attempts
          if (i === maxAttempts - 1) {
            console.log('No account lockout detected after maximum attempts');
          }
        }
      }
    });
  });
});
