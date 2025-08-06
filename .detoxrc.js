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
        /**
         * Avoid specifying an explicit OS version so Detox can pick
         * whichever runtime is available on the runner.  This prevents
         * “Failed to find a device … by OS” errors in CI.
         *
         * Use **iPhone 15** as the primary target because it is the
         * newest model consistently pre-installed on *all* current
         * GitHub Actions macOS runners (Xcode 15 & 16 images).  We
         * intentionally avoid pinning an OS version so Detox can
         * automatically choose the best-matching runtime that exists on
         * the runner (prevents the \"Failed to find a device … by OS\"
         * error seen in CI).
         */
        type: 'iPhone 15'
      }
    },
    /**
     * Fallback device definition that can be referenced in the future if
     * GitHub Actions images downgrade or do not yet include the latest iPhone
     * runtimes.  It is **not** used by default but provides an easy switch.
     */
    'simulatorLegacy': {
      type: 'ios.simulator',
      device: {
        /**
         * First fallback – **iPhone 14** remains widely available on
         * runners that have not yet updated to the newest Xcode image.
         */
        type: 'iPhone 14'
      }
    },
    /**
     * Second-level fallback for older macOS images (rare, but keeps the
     * config future-proof).  iPhone 13 simulators have shipped with every
     * Xcode version since 13.
     */
    'simulatorLegacy2': {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 13'
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
