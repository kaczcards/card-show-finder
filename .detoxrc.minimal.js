// .detoxrc.minimal.js
/**
 * Minimal Detox Configuration
 * 
 * This is the simplest possible Detox configuration for running basic smoke tests.
 * It removes all optional features and complexity to minimize potential failure points.
 */

module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.smoke.config.js'  // Use the minimal Jest config
    },
    jest: {
      setupTimeout: 180000,  // 3 minutes - generous timeout for CI
      reportSpecs: true,
      testRunner: 'jest-circus/runner'
    }
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/cardshowfinder.app',
      build: 'xcodebuild -workspace ios/cardshowfinder.xcworkspace -scheme cardshowfinder -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build'
    }
  },
  devices: {
    'simulator': {
      type: 'ios.simulator',
      device: {
        // Use a simulator that's definitely available in GitHub Actions
        /**
         * Do NOT pin an explicit iOS runtime here.  GitHub Actions runners
         * frequently update Xcode and the available simulator runtimes.
         * Let Detox pick whichever runtime exists for the given device type.
         *
         * We explicitly choose **iPhone 15** because it is the newest model
         * that ships with *all* current GitHub Actions macOS runner images
         * (Xcode 15 & 16).  By not pinning an OS version, Detox can use
         * whichever iOS runtime is available, preventing \"device not found\"
         * errors when Apple/Actions update their images.
         */
        type: 'iPhone 15'
      }
    }
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
      artifacts: {
        rootDir: './e2e/artifacts',
        plugins: {
          screenshot: {
            enabled: true,
            keepOnlyFailedTestsArtifacts: false
          }
        }
      },
      behavior: {
        init: {
          exposeGlobals: true,
          reinstallApp: true,
          launchApp: true
        },
        cleanup: {
          shutdownDevice: false
        }
      },
      session: {
        autoStart: true
      }
    }
  },
  logger: {
    level: 'debug',  // Always use debug level for better diagnostics
    options: {
      inspectionDepth: 3,
      showLoggerTimestamp: true,
      showLoggerLevel: true
    }
  },
  environment: {
    // Only the absolute minimum required
    DETOX_TEST_MODE: 'true'
  }
};
