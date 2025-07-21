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
      testEnvironment: 'node',
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
        type: 'iPhone 16 Plus',
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
          log: { enabled: true },
          screenshot: {
            enabled: true,
            shouldTakeAutomaticSnapshots: true,
            keepOnlyFailedTestsArtifacts: false,
            takeWhen: {
              testStart: false,
              testDone: true,
              testFail: true
            }
          },
          video: {
            enabled: false
          },
          instruments: {
            enabled: true
          },
          timeline: {
            enabled: true
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
        debugSynchronization: 10000,
        autoStart: true,
        server: 'ws://localhost:8099',
        sessionId: 'test'
      }
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
      artifacts: {
        rootDir: './e2e/artifacts',
        plugins: {
          log: { enabled: true },
          screenshot: {
            enabled: true,
            shouldTakeAutomaticSnapshots: true,
            keepOnlyFailedTestsArtifacts: true,
            takeWhen: {
              testStart: false,
              testDone: true,
              testFail: true
            }
          },
          video: {
            enabled: false
          },
          instruments: {
            enabled: true
          },
          timeline: {
            enabled: true
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
        debugSynchronization: 5000,
        autoStart: true,
        server: 'ws://localhost:8099',
        sessionId: 'test'
      }
    }
  },
  artifacts: {
    pathBuilder: './e2e/artifacts/pathbuilder.js',
    plugins: {
      log: {
        enabled: true,
        keepOnlyFailedTestsArtifacts: false
      },
      screenshot: {
        enabled: true,
        shouldTakeAutomaticSnapshots: true,
        keepOnlyFailedTestsArtifacts: false,
        takeWhen: {
          testStart: false,
          testDone: true,
          testFail: true
        }
      },
      video: {
        enabled: false
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
    // Environment variables for isolated test data
    DETOX_TEST_MODE: 'true',
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_TEST_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_TEST_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_TEST_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    // For test isolation, use a dedicated test database if available
    DETOX_USE_ISOLATED_DATA: 'true',
    // Performance settings
    DETOX_PERF_MONITOR: 'true',
    DETOX_PERF_THRESHOLD_CPU: '80',
    DETOX_PERF_THRESHOLD_MEMORY: '500'
  }
};
