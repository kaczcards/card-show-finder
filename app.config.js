const path = require('path');
// --------------------------------------------------
// Load environment variables from .env (if present)
// --------------------------------------------------
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Grab the variables we need so we can validate them once
const {
  EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
  EXPO_PUBLIC_SENTRY_DSN,
} = process.env;

// Determine build type (production vs. development)
const isProd =
  process.env.APP_ENV === 'production' ||
  process.env.NODE_ENV === 'production';

// --------------------------------------------------
// Basic validation / helpful warnings
// --------------------------------------------------
if (!EXPO_PUBLIC_SUPABASE_URL) {
  // eslint-disable-next-line no-console
  console.warn(
    '[app.config.js] Missing environment variable: EXPO_PUBLIC_SUPABASE_URL. ' +
      'Authentication requests will fail until this is provided.'
  );
}

if (!EXPO_PUBLIC_SENTRY_DSN) {
  // eslint-disable-next-line no-console
  console.warn(
    '[app.config.js] Missing environment variable: EXPO_PUBLIC_SENTRY_DSN. ' +
      'Crash reporting via Sentry will be disabled until this is provided.'
  );
}

if (!EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[app.config.js] Missing environment variable: EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Authentication requests will fail until this is provided.'
  );
}

if (!EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[app.config.js] Missing environment variable: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. ' +
      'Map functionality may not work correctly.'
  );
}

module.exports = {
  name: "Card Show Finder",
  slug: "card-show-finder",
  // Professional app synopsis with required subscription disclosure
  description:
    "Discover trading-card shows near you, save favorites, and manage events. " +
    "Auto-renewable MVP Dealer and Show Organizer subscriptions are available. " +
    "Terms of Use: https://csfinderapp.com/Terms/",
  version: "1.0.7",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  /**
   * ------------------------------------------------------------------
   * React-Native New Architecture (Fabric + TurboModules)
   * must be enabled when running in Expo Go because Expo Go
   * is always built with the new architecture.  All core
   * libraries used in the project have been verified to work
   * with the new architecture, so we enable it here to avoid
   * runtime module resolution errors (e.g. RNMapsAirModule).
   * ------------------------------------------------------------------
   *
   * Previously **disabled** due to Swift compilation failures in CI
   * (ExpoModulesCore under Xcode 15 on GA runners).  Those issues have
   * been resolved, so the new architecture is now **enabled** for
   * App Store compliance and performance.
   * ------------------------------------------------------------------
   */
  newArchEnabled: true,
  scheme: "cardshowfinder",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "cover",
    backgroundColor: "#ffffff"
  },
  ios: {
    supportsTablet: true,
    /**
     * ------------------------------------------------------------------
     * Use Hermes on iOS for smaller bundle size & better runtime
     * performance.  Must be set here so `expo prebuild` generates
     * the correct Podfile.properties.json every time.
     * ------------------------------------------------------------------
     */
    // Enable Hermes for smaller bundle size & App Store compliance
    jsEngine: "hermes",
    // Required by App Store Connect: declare encryption usage.
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Allow Card Show Finder to access your location so we can display nearby card shows.",
      NSUserTrackingUsageDescription:
        "This identifier will be used to deliver a better, more relevant experience (e.g., analytics and limited advertising).",
      /* Camera permission – required for Apple review (ITMS-90683) */
      NSCameraUsageDescription:
        "Allow Card Show Finder to use the camera so you can take photos of your trading cards, event badges, or QR codes at shows.",
      ITSAppUsesNonExemptEncryption: false,
      /* --------------------------------------------------------------
       * App Transport Security – strict by default.  For dev builds we
       * allow localhost so the Metro bundler & mock APIs work without
       * weakening production security.
       * ------------------------------------------------------------ */
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSAllowsArbitraryLoadsForMedia: false,
        NSAllowsArbitraryLoadsInWebContent: false,
        ...(isProd
          ? {}
          : {
              NSExceptionDomains: {
                localhost: {
                  NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
                  NSIncludesSubdomains: true,
                },
                '127.0.0.1': {
                  NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
                  NSIncludesSubdomains: true,
                },
              },
            }),
      },
      ...(isProd
        ? {}
        : {
            NSLocalNetworkUsageDescription:
              'Allow local network access for development only.',
          }),
    },
    /* ------------------------------------------------------------------
     * Universal Links (iOS) – ensure password-reset email links open
     * the app rather than Safari.  Replace the domain below with the
     * production domain used for your Supabase redirect / link-shortener.
     * ------------------------------------------------------------------ */
    associatedDomains: [
      "applinks:csfinderapp.com"
    ],
    /* Unique identifier used for App Store publishing */
    bundleIdentifier: "com.kaczcards.cardshowfinder",
    /* Build number bump for App Store submission */
    buildNumber: "9"
  },
  android: {
    package: "com.kaczcards.cardshowfinder",
    versionCode: 91,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
    permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    config: {
      googleMaps: {
        apiKey: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
    /**
     * Match iOS – run Hermes on Android as well.
     * Keeping this in app config prevents configuration drift
     * when platform folders are regenerated.
     */
    // Enable Hermes for better performance and consistency with iOS
    jsEngine: "hermes",

    /* ------------------------------------------------------------------
     * Deep-link / Intent filters
     * ------------------------------------------------------------------ */
    intentFilters: [
      {
        action: "VIEW",
        data: [
          {
            scheme: "https",
            host: "csfinderapp.com",
            pathPrefix: "/reset-password",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
      {
        action: "VIEW",
        data: [
          {
            scheme: "cardshowfinder",
            host: "reset-password",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  extra: {
    supabaseUrl: EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: EXPO_PUBLIC_SUPABASE_ANON_KEY,
    googleMapsApiKey: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    sentryDsn: EXPO_PUBLIC_SENTRY_DSN,
    /* ---------------------------------------------------------------
     * EAS project configuration – required for non-interactive builds
     * ------------------------------------------------------------- */
    eas: {
      projectId: "13f5779d-487a-4bfd-b7df-9e925db60a1a",
    },
  },

  /* ------------------------------------------------------------------
   * EAS Update configuration (required for OTA updates & channels)
   * ------------------------------------------------------------------ */
  updates: {
    url: "https://u.expo.dev/13f5779d-487a-4bfd-b7df-9e925db60a1a",
  },
  runtimeVersion: "1.0.6",

  plugins: [
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: "Allow Card Show Finder to access your location so we can display nearby card shows."
      }
    ],
    // App Tracking Transparency (iOS 14+) – required to correctly link the
    // native framework and generate the Info.plist entries that Apple checks
    "expo-tracking-transparency",
    "expo-asset",                        // Required for asset management
    "sentry-expo"                        // Enabled for crash reporting
  ],
  // Note: Expo's "hooks" field was removed because it is not a valid
  // app configuration field and caused schema validation errors
};

