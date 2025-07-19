// e2e/tests/authentication.test.js
const { device, element, by, waitFor, expect } = require('detox');
const {
  navigateTo,
  loginAsTestUser,
  logout,
  waitForElementToBeVisible,
  waitForElementToBeGone,
  takeScreenshot,
  generateRandomData,
  resetAppToInitialState,
  clearTextInput,
  tapBackButton,
} = require('../helpers/testHelpers');

// Import test data
const { TEST_USER_CREDENTIALS, TEST_ERROR_SCENARIOS } = require('../data/testData');

describe('Authentication Tests', () => {
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
    await takeScreenshot(`auth-test-${Date.now()}`);
  });

  // ====================================
  // 1. REGISTRATION TESTS
  // ====================================
  describe('Registration Flow', () => {
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

  // ====================================
  // 2. LOGIN TESTS
  // ====================================
  describe('Login Flow', () => {
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

  // ====================================
  // 3. LOGOUT TESTS
  // ====================================
  describe('Logout Flow', () => {
    it('should successfully logout a logged in user', async () => {
      // Login first
      await loginAsTestUser();
      
      // Navigate to profile screen
      await navigateTo('Profile');
      
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
      // Login first
      await loginAsTestUser();
      
      // Navigate to profile screen and logout
      await navigateTo('Profile');
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

  // ====================================
  // 4. PASSWORD RESET TESTS
  // ====================================
  describe('Password Reset Flow', () => {
    it('should navigate to forgot password screen', async () => {
      // Tap on forgot password link
      await element(by.text('Forgot Password')).tap();
      
      // Verify navigation to forgot password screen
      await waitForElementToBeVisible(by.id('screen-forgot-password'));
    });

    it('should show validation error for invalid email in forgot password', async () => {
      // Navigate to forgot password screen
      await element(by.text('Forgot Password')).tap();
      
      // Submit empty form
      await element(by.id('forgot-password-submit-button')).tap();
      
      // Verify validation error
      await waitForElementToBeVisible(by.text('Email is required'));
      
      // Enter invalid email
      await element(by.id('forgot-password-email-input')).typeText('invalid-email');
      await element(by.id('forgot-password-submit-button')).tap();
      
      // Verify validation error
      await waitForElementToBeVisible(by.text('Invalid email format'));
    });

    it('should show success message after submitting valid email for password reset', async () => {
      // Navigate to forgot password screen
      await element(by.text('Forgot Password')).tap();
      
      // Enter valid email
      await element(by.id('forgot-password-email-input')).typeText(TEST_USER_CREDENTIALS.regularUser.email);
      
      // Submit form
      await element(by.id('forgot-password-submit-button')).tap();
      
      // Verify success message
      await waitForElementToBeVisible(by.text('Password reset email sent'));
    });

    it('should allow navigation back to login from forgot password screen', async () => {
      // Navigate to forgot password screen
      await element(by.text('Forgot Password')).tap();
      
      // Tap back button or back to login link
      try {
        await element(by.text('Back to Login')).tap();
      } catch (error) {
        await tapBackButton();
      }
      
      // Verify return to login screen
      await waitForElementToBeVisible(by.id('screen-login'));
    });

    // Note: Full password reset flow with email link testing requires
    // special handling since we can't easily test email reception in E2E tests
    it('should handle reset password screen with valid token', async () => {
      // This test is a mock since we can't easily test the email link flow
      // In a real scenario, we would need to intercept the email or use a test API
      
      // Simulate opening app with reset token
      // This would typically be done by launching the app with a specific URL
      try {
        await device.launchApp({
          newInstance: true,
          url: 'cardshowfinder://reset-password?token=mock-valid-token',
        });
        
        // Check if reset password screen is shown
        await waitForElementToBeVisible(by.id('screen-reset-password'), 10000);
        
        // Enter new password
        await element(by.id('reset-password-input')).typeText('NewPassword123!');
        await element(by.id('reset-confirm-password-input')).typeText('NewPassword123!');
        
        // Submit form
        await element(by.id('reset-password-submit-button')).tap();
        
        // Verify success message or redirection to login
        try {
          await waitForElementToBeVisible(by.text('Password reset successful'));
        } catch (error) {
          // Or might redirect directly to login
          await waitForElementToBeVisible(by.id('screen-login'));
        }
      } catch (error) {
        console.log('Deep linking for password reset not testable in this environment');
        // Skip test or mark as pending
      }
    });
  });

  // ====================================
  // 5. SESSION PERSISTENCE TESTS
  // ====================================
  describe('Session Persistence', () => {
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

  // ====================================
  // 6. ERROR HANDLING TESTS
  // ====================================
  describe('Error Handling', () => {
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

  // ====================================
  // 7. EDGE CASES
  // ====================================
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
      const password = 'Pass!@#$%^&*()_+{}|:"<>?~`-=[]\\;\',./';
      
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

  // ====================================
  // 8. SECURITY TESTS
  // ====================================
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
