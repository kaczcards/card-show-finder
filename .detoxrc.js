// .detoxrc.js
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js'
    },
    jest: {
      setupTimeout: 120000,
      reportSpecs: true,
      reportWorkerAssign: true,
      testRunner: 'jest-circus/runner'
    }
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/cardshowfinder.app',
      build: 'xcodebuild -workspace ios/cardshowfinder.xcworkspace -scheme cardshowfinder -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build'
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/cardshowfinder.app',
      build: 'xcodebuild -workspace ios/cardshowfinder.xcworkspace -scheme cardshowfinder -configuration Release -sdk iphonesimulator -derivedDataPath ios/build'
    }
  },
  devices: {
    'simulator': {
      type: 'ios.simulator',
      device: {
        // Use a broadly-available simulator that exists on GitHub Actions macOS images.
        type: 'iPhone 15',
        // Updated to match the runtime versions actually present on CI images
        os: 'iOS 18.5'
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
            // keep only artifacts for failing tests to save disk space
            keepOnlyFailedTestsArtifacts: true
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
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
      artifacts: {
        rootDir: './e2e/artifacts',
        plugins: {
          screenshot: {
            enabled: true,
            keepOnlyFailedTestsArtifacts: true
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
    level: process.env.CI ? 'debug' : 'info',
    detectAnomalies: true,
    options: {
      inspectionDepth: 5,
      showLoggerTimestamp: true,
      showLoggerLevel: true
    }
  },
  environment: {
    // Minimal environment needed for CI
    DETOX_TEST_MODE: 'true'
  }
};
