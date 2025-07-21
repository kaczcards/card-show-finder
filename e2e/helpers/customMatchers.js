// e2e/helpers/customMatchers.js
/**
 * Custom Jest matchers for Detox E2E tests
 * These matchers wrap Detox's built-in expectations with improved error messages
 * and better integration with Jest's assertion system.
 */

/**
 * Checks if an element is visible on screen
 * @param {Object} element - Detox element
 * @returns {Object} - Jest matcher result
 */
const toBeVisible = async function(element) {
  try {
    // Use Detox's built-in matcher
    await expect(element).toBeVisible();
    
    return {
      message: () => `Expected element not to be visible, but it was visible`,
      pass: true
    };
  } catch (error) {
    return {
      message: () => `Expected element to be visible, but it was not visible.\nDetox error: ${error.message}`,
      pass: false
    };
  }
};

/**
 * Checks if an element exists in the view hierarchy
 * @param {Object} element - Detox element
 * @returns {Object} - Jest matcher result
 */
const toExist = async function(element) {
  try {
    // Use Detox's built-in matcher
    await expect(element).toExist();
    
    return {
      message: () => `Expected element not to exist, but it exists`,
      pass: true
    };
  } catch (error) {
    return {
      message: () => `Expected element to exist, but it was not found.\nDetox error: ${error.message}`,
      pass: false
    };
  }
};

/**
 * Checks if an element has specific text
 * @param {Object} element - Detox element
 * @param {String} expectedText - Expected text content
 * @returns {Object} - Jest matcher result
 */
const toHaveText = async function(element, expectedText) {
  try {
    // Use Detox's built-in matcher
    await expect(element).toHaveText(expectedText);
    
    return {
      message: () => `Expected element not to have text "${expectedText}", but it did`,
      pass: true
    };
  } catch (error) {
    // Try to get the actual text for better error message
    let actualText = 'unknown';
    try {
      const attributes = await element.getAttributes();
      actualText = attributes.text || attributes.label || 'unknown';
    } catch (e) {
      // Ignore error when getting attributes
    }
    
    return {
      message: () => 
        `Expected element to have text "${expectedText}", but it had text "${actualText}".\nDetox error: ${error.message}`,
      pass: false
    };
  }
};

/**
 * Checks if an element has specific value
 * @param {Object} element - Detox element
 * @param {String} expectedValue - Expected value
 * @returns {Object} - Jest matcher result
 */
const toHaveValue = async function(element, expectedValue) {
  try {
    // Use Detox's built-in matcher
    await expect(element).toHaveValue(expectedValue);
    
    return {
      message: () => `Expected element not to have value "${expectedValue}", but it did`,
      pass: true
    };
  } catch (error) {
    // Try to get the actual value for better error message
    let actualValue = 'unknown';
    try {
      const attributes = await element.getAttributes();
      actualValue = attributes.value || 'unknown';
    } catch (e) {
      // Ignore error when getting attributes
    }
    
    return {
      message: () => 
        `Expected element to have value "${expectedValue}", but it had value "${actualValue}".\nDetox error: ${error.message}`,
      pass: false
    };
  }
};

/**
 * Checks if an element is enabled (not disabled)
 * @param {Object} element - Detox element
 * @returns {Object} - Jest matcher result
 */
const toBeEnabled = async function(element) {
  try {
    // Check if the element is not disabled
    await expect(element).not.toBeNotVisible();
    
    // Get attributes to check enabled state
    const attributes = await element.getAttributes();
    const isEnabled = !attributes.disabled;
    
    if (isEnabled) {
      return {
        message: () => `Expected element not to be enabled, but it was enabled`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected element to be enabled, but it was disabled`,
        pass: false
      };
    }
  } catch (error) {
    return {
      message: () => `Expected element to be enabled, but encountered an error.\nDetox error: ${error.message}`,
      pass: false
    };
  }
};

/**
 * Checks if an element is disabled
 * @param {Object} element - Detox element
 * @returns {Object} - Jest matcher result
 */
const toBeDisabled = async function(element) {
  try {
    // Get attributes to check disabled state
    const attributes = await element.getAttributes();
    const isDisabled = !!attributes.disabled;
    
    if (isDisabled) {
      return {
        message: () => `Expected element not to be disabled, but it was disabled`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected element to be disabled, but it was enabled`,
        pass: false
      };
    }
  } catch (error) {
    return {
      message: () => `Expected element to be disabled, but encountered an error.\nDetox error: ${error.message}`,
      pass: false
    };
  }
};

// Export all custom matchers
module.exports = {
  toBeVisible,
  toExist,
  toHaveText,
  toHaveValue,
  toBeEnabled,
  toBeDisabled
};
