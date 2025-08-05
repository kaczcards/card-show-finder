// e2e/tests/smoke.test.js
const { device, element, by, waitFor, expect } = require('detox');

describe('Smoke Test', () => {
  beforeAll(async () => {
    // Launch the app with a clean state
    await device.launchApp({ newInstance: true, delete: true });
  });

  afterAll(async () => {
    // Clean up after all tests are done
    await device.terminateApp();
  });

  it('should launch the app and display content', async () => {
    // Wait for any visible text that indicates the app has loaded
    // Using common text elements that should be present on the login screen
    await waitFor(element(by.text('Sign In')))
      .toBeVisible()
      .withTimeout(20000);
    
    // Verify another text element is visible to confirm app loaded properly
    await expect(element(by.text('Sign Up'))).toBeVisible();
    
    // Take a screenshot for verification
    await device.takeScreenshot('smoke-test-app-launched');
    
    console.log('✅ App launched successfully and displays content');
  });
});
