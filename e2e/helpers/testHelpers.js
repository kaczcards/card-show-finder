// e2e/helpers/testHelpers.js
const detox = require('detox');
const { device, element, by, waitFor, expect } = require('detox');
const fs = require('fs');
const path = require('path');

// ====================================
// 1. NAVIGATION HELPERS
// ====================================

/**
 * Navigate to a specific screen using the tab bar
 * @param {string} screenName - Name of the screen to navigate to (Home, Map, Collection, Messages, Profile)
 */
const navigateToTabScreen = async (screenName) => {
  const tabMapping = {
    'Home': by.id('tab-home'),
    'Map': by.id('tab-map'),
    'Collection': by.id('tab-collection'),
    'Messages': by.id('tab-messages'),
    'Profile': by.id('tab-profile'),
  };

  const tabMatcher = tabMapping[screenName];
  if (!tabMatcher) {
    throw new Error(`Unknown tab screen: ${screenName}`);
  }

  await element(tabMatcher).tap();
  await waitForElementToBeVisible(by.id(`screen-${screenName.toLowerCase()}`));
};

/**
 * Navigate to a show detail screen from the home screen
 * @param {string} showName - Name of the show to navigate to
 */
const navigateToShowDetail = async (showName) => {
  // First ensure we're on the home screen
  await navigateToTabScreen('Home');
  
  // Find and tap on the show card with the given name
  const showCard = element(by.text(showName).withAncestor(by.id('show-card')));
  await waitForElementToBeVisible(showCard);
  await showCard.tap();
  
  // Wait for the show detail screen to appear
  await waitForElementToBeVisible(by.id('screen-show-detail'));
};

/**
 * Navigate back using the system back button or the back button in the header
 */
const navigateBack = async () => {
  try {
    // First try to find a back button in the header
    const backButton = element(by.id('header-back-button'));
    await backButton.tap();
  } catch (error) {
    // If no back button found, use the device back button
    await device.pressBack();
  }
};

/**
 * Navigate to a specific screen using the drawer menu (if applicable)
 * @param {string} screenName - Name of the screen to navigate to
 */
const navigateToDrawerScreen = async (screenName) => {
  // Open the drawer menu
  const menuButton = element(by.id('drawer-menu-button'));
  await menuButton.tap();
  
  // Tap on the menu item for the specified screen
  const menuItem = element(by.text(screenName).withAncestor(by.id('drawer-menu')));
  await menuItem.tap();
  
  // Wait for the screen to appear
  await waitForElementToBeVisible(by.id(`screen-${screenName.toLowerCase().replace(/\s+/g, '-')}`));
};

/**
 * Navigate to a specific screen using a combination of methods
 * @param {string} screenName - Name of the screen to navigate to
 */
const navigateTo = async (screenName) => {
  // Handle tab screens
  const tabScreens = ['Home', 'Map', 'Collection', 'Messages', 'Profile'];
  if (tabScreens.includes(screenName)) {
    return navigateToTabScreen(screenName);
  }
  
  // Handle other screens based on their parent navigation
  switch (screenName) {
    case 'Login':
    case 'Register':
    case 'ForgotPassword':
      // First ensure we're logged out and on the auth screen
      await logout();
      
      // Then navigate to the specific auth screen if needed
      if (screenName !== 'Login') {
        const buttonText = screenName === 'Register' ? 'Sign Up' : 'Forgot Password';
        await element(by.text(buttonText)).tap();
      }
      break;
      
    case 'ShowDetail':
      // Navigate to the first show in the list
      const firstShowCard = element(by.id('show-card').atIndex(0));
      await waitForElementToBeVisible(firstShowCard);
      await firstShowCard.tap();
      break;
      
    case 'AddShow':
      // Navigate to Profile then to Add Show
      await navigateToTabScreen('Profile');
      await element(by.id('add-show-button')).tap();
      break;
      
    case 'EditProfile':
      await navigateToTabScreen('Profile');
      await element(by.id('edit-profile-button')).tap();
      break;
      
    case 'Subscription':
      await navigateToTabScreen('Profile');
      await element(by.id('subscription-button')).tap();
      break;
      
    default:
      throw new Error(`Navigation to screen "${screenName}" is not implemented`);
  }
  
  // Wait for the target screen to be visible
  const screenId = `screen-${screenName.toLowerCase().replace(/\s+/g, '-')}`;
  await waitForElementToBeVisible(by.id(screenId));
};

// ====================================
// 2. AUTHENTICATION HELPERS
// ====================================

/**
 * Login with the provided credentials
 * @param {Object} credentials - Object containing email and password
 */
const login = async (credentials) => {
  // Navigate to login screen if not already there
  try {
    const loginScreen = element(by.id('screen-login'));
    const isVisible = await loginScreen.isVisible();
    if (!isVisible) {
      await navigateTo('Login');
    }
  } catch (error) {
    await navigateTo('Login');
  }
  
  // Enter credentials
  await element(by.id('login-email-input')).typeText(credentials.email);
  await element(by.id('login-password-input')).typeText(credentials.password);
  
  // Tap login button
  await element(by.id('login-button')).tap();
  
  // Wait for home screen to appear, indicating successful login
  await waitForElementToBeVisible(by.id('screen-home'), 10000);
};

/**
 * Login with the test user credentials
 */
const loginAsTestUser = async () => {
  // Get test user credentials from global object
  const testUser = global.__DETOX_GLOBAL__?.TEST_USER || {
    email: 'test@example.com',
    password: 'Test123!@#',
  };
  
  await login(testUser);
};

/**
 * Register a new user
 * @param {Object} userData - Object containing user registration data
 */
const registerUser = async (userData) => {
  // Navigate to register screen
  await navigateTo('Register');
  
  // Fill in registration form
  await element(by.id('register-email-input')).typeText(userData.email);
  await element(by.id('register-username-input')).typeText(userData.username);
  await element(by.id('register-password-input')).typeText(userData.password);
  await element(by.id('register-confirm-password-input')).typeText(userData.password);
  
  // Optional fields if they exist
  try {
    if (userData.homeZip) {
      await element(by.id('register-home-zip-input')).typeText(userData.homeZip);
    }
  } catch (error) {
    // Ignore if field doesn't exist
  }
  
  // Submit registration form
  await element(by.id('register-button')).tap();
  
  // Wait for home screen to appear, indicating successful registration
  await waitForElementToBeVisible(by.id('screen-home'), 15000);
};

/**
 * Logout the current user
 */
const logout = async () => {
  // Navigate to profile screen
  await navigateToTabScreen('Profile');
  
  // Check if we're already logged out
  try {
    const loginButton = element(by.id('login-button'));
    const isVisible = await loginButton.isVisible();
    if (isVisible) {
      // Already logged out
      return;
    }
  } catch (error) {
    // Continue with logout
  }
  
  // Scroll to bottom to find logout button
  const profileScreen = element(by.id('screen-profile'));
  await profileScreen.scrollTo('bottom');
  
  // Tap logout button
  const logoutButton = element(by.id('logout-button'));
  await logoutButton.tap();
  
  // Confirm logout if confirmation dialog appears
  try {
    const confirmButton = element(by.text('Confirm').withAncestor(by.id('logout-confirmation')));
    await confirmButton.tap();
  } catch (error) {
    // No confirmation dialog, continue
  }
  
  // Wait for login screen to appear, indicating successful logout
  await waitForElementToBeVisible(by.id('screen-login'), 5000);
};

/**
 * Reset password for a user
 * @param {string} email - Email address to reset password for
 */
const resetPassword = async (email) => {
  // Navigate to forgot password screen
  await navigateTo('ForgotPassword');
  
  // Enter email
  await element(by.id('forgot-password-email-input')).typeText(email);
  
  // Submit form
  await element(by.id('forgot-password-submit-button')).tap();
  
  // Wait for confirmation message
  await waitForElementToBeVisible(by.text('Password reset email sent'));
};

// ====================================
// 3. ELEMENT INTERACTION HELPERS
// ====================================

/**
 * Wait for an element to be visible
 * @param {Object} elementMatcher - Detox element matcher
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 */
const waitForElementToBeVisible = async (elementMatcher, timeout = 5000) => {
  await waitFor(element(elementMatcher))
    .toBeVisible()
    .withTimeout(timeout);
};

/**
 * Wait for an element to be gone
 * @param {Object} elementMatcher - Detox element matcher
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 */
const waitForElementToBeGone = async (elementMatcher, timeout = 5000) => {
  await waitFor(element(elementMatcher))
    .not.toBeVisible()
    .withTimeout(timeout);
};

/**
 * Tap on an element
 * @param {Object} elementMatcher - Detox element matcher
 */
const tapElement = async (elementMatcher) => {
  await element(elementMatcher).tap();
};

/**
 * Tap on the back button
 */
const tapBackButton = async () => {
  try {
    // First try to find a back button in the header
    await element(by.id('header-back-button')).tap();
  } catch (error) {
    // If no back button found, use the device back button
    await device.pressBack();
  }
};

/**
 * Long press on an element
 * @param {Object} elementMatcher - Detox element matcher
 * @param {number} duration - Duration in milliseconds (default: 1000)
 */
const longPressElement = async (elementMatcher, duration = 1000) => {
  await element(elementMatcher).longPress(duration);
};

/**
 * Scroll to find an element
 * @param {Object} scrollViewMatcher - Detox element matcher for the scroll view
 * @param {Object} elementMatcher - Detox element matcher for the element to find
 * @param {string} direction - Direction to scroll ('up', 'down', 'left', 'right')
 * @param {number} maxScrolls - Maximum number of scrolls to attempt (default: 10)
 */
const scrollToElement = async (scrollViewMatcher, elementMatcher, direction = 'down', maxScrolls = 10) => {
  const scrollView = element(scrollViewMatcher);
  let isVisible = false;
  let scrollCount = 0;
  
  while (!isVisible && scrollCount < maxScrolls) {
    try {
      await waitFor(element(elementMatcher))
        .toBeVisible()
        .withTimeout(1000);
      isVisible = true;
    } catch (error) {
      await scrollView.scroll(100, direction);
      scrollCount++;
    }
  }
  
  if (!isVisible) {
    throw new Error(`Element not found after ${maxScrolls} scrolls`);
  }
};

/**
 * Type text into an input field
 * @param {Object} elementMatcher - Detox element matcher for the input field
 * @param {string} text - Text to type
 */
const typeText = async (elementMatcher, text) => {
  await element(elementMatcher).typeText(text);
};

/**
 * Clear text from an input field
 * @param {Object} elementMatcher - Detox element matcher for the input field
 */
const clearTextInput = async (elementMatcher) => {
  await element(elementMatcher).clearText();
};

/**
 * Replace text in an input field
 * @param {Object} elementMatcher - Detox element matcher for the input field
 * @param {string} text - Text to replace with
 */
const replaceText = async (elementMatcher, text) => {
  await element(elementMatcher).replaceText(text);
};

/**
 * Swipe on an element
 * @param {Object} elementMatcher - Detox element matcher
 * @param {string} direction - Direction to swipe ('up', 'down', 'left', 'right')
 * @param {string} speed - Speed of swipe ('fast', 'slow')
 */
const swipeElement = async (elementMatcher, direction, speed = 'fast') => {
  await element(elementMatcher).swipe(direction, speed);
};

/**
 * Pinch to zoom on an element
 * @param {Object} elementMatcher - Detox element matcher
 * @param {number} scale - Scale factor (>1 to zoom in, <1 to zoom out)
 * @param {string} speed - Speed of pinch ('fast', 'slow')
 */
const pinchElement = async (elementMatcher, scale, speed = 'slow') => {
  await element(elementMatcher).pinch(scale, speed);
};

// ====================================
// 4. SCREENSHOT AND PERFORMANCE HELPERS
// ====================================

/**
 * Take a screenshot
 * @param {string} name - Name for the screenshot file
 */
const takeScreenshot = async (name) => {
  const artifactsDir = path.join(process.cwd(), 'e2e', 'artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }
  
  const screenshotPath = path.join(artifactsDir, `${name.replace(/\s+/g, '-')}-${Date.now()}.png`);
  await device.takeScreenshot(screenshotPath);
  return screenshotPath;
};

/**
 * Measure performance of a specific operation
 * @param {string} operationName - Name of the operation being measured
 * @param {Function} operation - Async function to measure
 */
const measurePerformance = async (operationName, operation) => {
  const startTime = Date.now();
  
  try {
    // Execute the operation
    await operation();
  } finally {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log performance data
    console.log(`Performance: ${operationName} - ${duration}ms`);
    
    // Store in global performance monitor if available
    if (global.__DETOX_GLOBAL__?.PERFORMANCE) {
      global.__DETOX_GLOBAL__.PERFORMANCE.measurements.push({
        metric: operationName,
        value: duration,
        timestamp: new Date().toISOString(),
        test: expect.getState().currentTestName,
      });
    }
    
    return duration;
  }
};

/**
 * Measure app startup time
 */
const measureAppStartup = async () => {
  // Terminate the app
  await device.terminateApp();
  
  // Measure launch time
  return measurePerformance('appStartup', async () => {
    await device.launchApp({ newInstance: true });
  });
};

/**
 * Measure screen transition time
 * @param {Function} navigationAction - Async function that performs navigation
 * @param {Object} destinationScreenMatcher - Matcher for the destination screen
 */
const measureScreenTransition = async (navigationAction, destinationScreenMatcher) => {
  return measurePerformance('screenTransition', async () => {
    await navigationAction();
    await waitForElementToBeVisible(destinationScreenMatcher, 10000);
  });
};

// ====================================
// 5. DATA GENERATION HELPERS
// ====================================

/**
 * Generate a random email address
 * @returns {string} Random email address
 */
const generateRandomEmail = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `test-${timestamp}-${random}@example.com`;
};

/**
 * Generate a random username
 * @returns {string} Random username
 */
const generateRandomUsername = () => {
  const adjectives = ['happy', 'clever', 'brave', 'mighty', 'swift', 'calm', 'wise'];
  const nouns = ['tiger', 'eagle', 'wolf', 'fox', 'bear', 'hawk', 'lion'];
  const random = Math.floor(Math.random() * 10000);
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adjective}_${noun}_${random}`;
};

/**
 * Generate a random password
 * @returns {string} Random password
 */
const generateRandomPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one uppercase, one lowercase, one number, and one special char
  password += chars[Math.floor(Math.random() * 26)]; // Uppercase
  password += chars[Math.floor(Math.random() * 26) + 26]; // Lowercase
  password += chars[Math.floor(Math.random() * 10) + 52]; // Number
  password += chars[Math.floor(Math.random() * 8) + 62]; // Special
  
  // Add more random characters to reach minimum length
  for (let i = 0; i < 6; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  // Shuffle the password characters
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};

/**
 * Generate a random ZIP code
 * @returns {string} Random ZIP code
 */
const generateRandomZipCode = () => {
  return String(10000 + Math.floor(Math.random() * 90000));
};

/**
 * Generate random user data
 * @returns {Object} Random user data
 */
const generateRandomUserData = () => {
  return {
    email: generateRandomEmail(),
    username: generateRandomUsername(),
    password: generateRandomPassword(),
    homeZip: generateRandomZipCode(),
  };
};

/**
 * Generate a random date in the future
 * @param {number} minDays - Minimum days in the future
 * @param {number} maxDays - Maximum days in the future
 * @returns {Date} Random future date
 */
const generateRandomFutureDate = (minDays = 1, maxDays = 30) => {
  const now = new Date();
  const days = minDays + Math.floor(Math.random() * (maxDays - minDays));
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + days);
  return futureDate;
};

/**
 * Generate random show data
 * @returns {Object} Random show data
 */
const generateRandomShowData = () => {
  const startDate = generateRandomFutureDate(7, 60);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + Math.floor(Math.random() * 3) + 1);
  
  const features = ['sports', 'pokemon', 'magic', 'yugioh', 'baseball', 'football', 'basketball', 'hockey', 'vintage', 'modern'];
  const selectedFeatures = [];
  const featureCount = Math.floor(Math.random() * 4) + 1;
  
  for (let i = 0; i < featureCount; i++) {
    const randomFeature = features[Math.floor(Math.random() * features.length)];
    if (!selectedFeatures.includes(randomFeature)) {
      selectedFeatures.push(randomFeature);
    }
  }
  
  return {
    name: `Test Card Show ${Date.now()}`,
    description: `This is a test card show generated for E2E testing at ${new Date().toISOString()}`,
    address: '123 Test Street, Los Angeles, CA 90001',
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    entryFee: Math.floor(Math.random() * 20) + 5,
    coordinates: {
      lat: 34.052235 + (Math.random() * 0.1 - 0.05),
      lng: -118.243683 + (Math.random() * 0.1 - 0.05),
    },
    features: selectedFeatures,
  };
};

/**
 * Generate random data based on the specified type
 * @param {string} type - Type of data to generate ('user', 'show', 'email', 'username', 'password', 'zipCode')
 * @returns {any} Random data of the specified type
 */
const generateRandomData = (type) => {
  switch (type) {
    case 'user':
      return generateRandomUserData();
    case 'show':
      return generateRandomShowData();
    case 'email':
      return generateRandomEmail();
    case 'username':
      return generateRandomUsername();
    case 'password':
      return generateRandomPassword();
    case 'zipCode':
      return generateRandomZipCode();
    default:
      throw new Error(`Unknown random data type: ${type}`);
  }
};

// ====================================
// 6. APP STATE MANAGEMENT HELPERS
// ====================================

/**
 * Reset the app to its initial state
 * @param {boolean} clearStorage - Whether to clear app storage
 */
const resetAppToInitialState = async (clearStorage = true) => {
  // Terminate and relaunch the app
  if (clearStorage) {
    await device.launchApp({ delete: true, newInstance: true });
  } else {
    await device.launchApp({ newInstance: true });
  }
};

/**
 * Clear app data without relaunching
 */
const clearAppData = async () => {
  await device.clearKeychain();
  await device.resetContentAndSettings();
};

/**
 * Put the app in a specific state
 * @param {string} stateName - Name of the state to set up ('loggedIn', 'loggedOut', 'showDetail', etc.)
 */
const setupAppState = async (stateName) => {
  switch (stateName) {
    case 'loggedIn':
      // Check if already logged in
      try {
        await navigateToTabScreen('Profile');
        const logoutButton = element(by.id('logout-button'));
        const isLoggedIn = await logoutButton.isVisible();
        
        if (!isLoggedIn) {
          await loginAsTestUser();
        }
      } catch (error) {
        await loginAsTestUser();
      }
      break;
      
    case 'loggedOut':
      // Check if already logged out
      try {
        await navigateToTabScreen('Profile');
        const loginButton = element(by.id('login-button'));
        const isLoggedOut = await loginButton.isVisible();
        
        if (!isLoggedOut) {
          await logout();
        }
      } catch (error) {
        // If we can't navigate to profile, we're probably already logged out
      }
      break;
      
    case 'showDetail':
      await setupAppState('loggedIn');
      await navigateToTabScreen('Home');
      await element(by.id('show-card').atIndex(0)).tap();
      break;
      
    case 'mapView':
      await setupAppState('loggedIn');
      await navigateToTabScreen('Map');
      break;
      
    case 'collectionView':
      await setupAppState('loggedIn');
      await navigateToTabScreen('Collection');
      break;
      
    case 'freshInstall':
      await device.launchApp({ delete: true, newInstance: true });
      break;
      
    default:
      throw new Error(`Unknown app state: ${stateName}`);
  }
};

// ====================================
// 7. LOCATION MOCKING HELPERS
// ====================================

/**
 * Mock the device location
 * @param {Object} location - Location object with lat and lng properties
 */
const mockLocation = async (location) => {
  await device.setLocation(location.lat, location.lng);
};

/**
 * Mock location to Los Angeles
 */
const mockLocationToLosAngeles = async () => {
  await mockLocation({ lat: 34.052235, lng: -118.243683 });
};

/**
 * Mock location to New York
 */
const mockLocationToNewYork = async () => {
  await mockLocation({ lat: 40.712776, lng: -74.005974 });
};

/**
 * Mock location to Chicago
 */
const mockLocationToChicago = async () => {
  await mockLocation({ lat: 41.878113, lng: -87.629799 });
};

/**
 * Mock location to a random US city
 */
const mockLocationToRandomUSCity = async () => {
  const cities = [
    { name: 'Los Angeles', lat: 34.052235, lng: -118.243683 },
    { name: 'New York', lat: 40.712776, lng: -74.005974 },
    { name: 'Chicago', lat: 41.878113, lng: -87.629799 },
    { name: 'Houston', lat: 29.760427, lng: -95.369804 },
    { name: 'Phoenix', lat: 33.448376, lng: -112.074036 },
    { name: 'Philadelphia', lat: 39.952583, lng: -75.165222 },
    { name: 'San Antonio', lat: 29.424349, lng: -98.491142 },
    { name: 'San Diego', lat: 32.715736, lng: -117.161087 },
    { name: 'Dallas', lat: 32.776665, lng: -96.796989 },
    { name: 'San Jose', lat: 37.338207, lng: -121.886330 },
  ];
  
  const randomCity = cities[Math.floor(Math.random() * cities.length)];
  console.log(`Mocking location to ${randomCity.name}`);
  await mockLocation(randomCity);
  return randomCity;
};

// ====================================
// 8. COMMON ASSERTIONS
// ====================================

/**
 * Assert that an element is visible
 * @param {Object} elementMatcher - Detox element matcher
 * @param {string} message - Custom error message
 */
const assertElementVisible = async (elementMatcher, message) => {
  try {
    await expect(element(elementMatcher)).toBeVisible();
  } catch (error) {
    throw new Error(message || `Element not visible: ${JSON.stringify(elementMatcher)}`);
  }
};

/**
 * Assert that an element is not visible
 * @param {Object} elementMatcher - Detox element matcher
 * @param {string} message - Custom error message
 */
const assertElementNotVisible = async (elementMatcher, message) => {
  try {
    await expect(element(elementMatcher)).not.toBeVisible();
  } catch (error) {
    throw new Error(message || `Element is visible but should not be: ${JSON.stringify(elementMatcher)}`);
  }
};

/**
 * Assert that an element has specific text
 * @param {Object} elementMatcher - Detox element matcher
 * @param {string} text - Expected text
 * @param {string} message - Custom error message
 */
const assertElementHasText = async (elementMatcher, text, message) => {
  try {
    await expect(element(elementMatcher)).toHaveText(text);
  } catch (error) {
    throw new Error(message || `Element does not have expected text "${text}": ${JSON.stringify(elementMatcher)}`);
  }
};

/**
 * Assert that an element exists
 * @param {Object} elementMatcher - Detox element matcher
 * @param {string} message - Custom error message
 */
const assertElementExists = async (elementMatcher, message) => {
  try {
    await expect(element(elementMatcher)).toExist();
  } catch (error) {
    throw new Error(message || `Element does not exist: ${JSON.stringify(elementMatcher)}`);
  }
};

/**
 * Assert that an element does not exist
 * @param {Object} elementMatcher - Detox element matcher
 * @param {string} message - Custom error message
 */
const assertElementDoesNotExist = async (elementMatcher, message) => {
  try {
    await expect(element(elementMatcher)).not.toExist();
  } catch (error) {
    throw new Error(message || `Element exists but should not: ${JSON.stringify(elementMatcher)}`);
  }
};

/**
 * Assert that an element is enabled
 * @param {Object} elementMatcher - Detox element matcher
 * @param {string} message - Custom error message
 */
const assertElementEnabled = async (elementMatcher, message) => {
  try {
    await expect(element(elementMatcher)).toBeEnabled();
  } catch (error) {
    throw new Error(message || `Element is not enabled: ${JSON.stringify(elementMatcher)}`);
  }
};

/**
 * Assert that an element is disabled
 * @param {Object} elementMatcher - Detox element matcher
 * @param {string} message - Custom error message
 */
const assertElementDisabled = async (elementMatcher, message) => {
  try {
    await expect(element(elementMatcher)).toBeDisabled();
  } catch (error) {
    throw new Error(message || `Element is enabled but should be disabled: ${JSON.stringify(elementMatcher)}`);
  }
};

// Export all helper functions
module.exports = {
  // Navigation helpers
  navigateTo,
  navigateToTabScreen,
  navigateToShowDetail,
  navigateBack,
  navigateToDrawerScreen,
  
  // Authentication helpers
  login,
  loginAsTestUser,
  registerUser,
  logout,
  resetPassword,
  
  // Element interaction helpers
  waitForElementToBeVisible,
  waitForElementToBeGone,
  tapElement,
  tapBackButton,
  longPressElement,
  scrollToElement,
  typeText,
  clearTextInput,
  replaceText,
  swipeElement,
  pinchElement,
  
  // Screenshot and performance helpers
  takeScreenshot,
  measurePerformance,
  measureAppStartup,
  measureScreenTransition,
  
  // Data generation helpers
  generateRandomData,
  generateRandomEmail,
  generateRandomUsername,
  generateRandomPassword,
  generateRandomZipCode,
  generateRandomUserData,
  generateRandomFutureDate,
  generateRandomShowData,
  
  // App state management helpers
  resetAppToInitialState,
  clearAppData,
  setupAppState,
  
  // Location mocking helpers
  mockLocation,
  mockLocationToLosAngeles,
  mockLocationToNewYork,
  mockLocationToChicago,
  mockLocationToRandomUSCity,
  
  // Common assertions
  assertElementVisible,
  assertElementNotVisible,
  assertElementHasText,
  assertElementExists,
  assertElementDoesNotExist,
  assertElementEnabled,
  assertElementDisabled,
};
