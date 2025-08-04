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
  name: "card-show-finder",
  slug: "card-show-finder",
  version: "1.0.0",
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
    // Temporarily disable Hermes while investigating runtime crash
    jsEngine: "jsc",
    // Required by App Store Connect: declare encryption usage.
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Allow Card Show Finder to access your location so we can display nearby card shows.",
      ITSAppUsesNonExemptEncryption: false,
    },
    /* ------------------------------------------------------------------
     * Universal Links (iOS) – ensure password-reset email links open
     * the app rather than Safari.  Replace the domain below with the
     * production domain used for your Supabase redirect / link-shortener.
     * ------------------------------------------------------------------ */
    associatedDomains: [
      "applinks:cardshowfinder.app"
    ],
    /* Unique identifier used for App Store publishing */
    bundleIdentifier: "com.kaczcards.cardshowfinder"
  },
  android: {
    package: "com.kaczcards.cardshowfinder",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
    permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    /**
     * Match iOS – run Hermes on Android as well.
     * Keeping this in app config prevents configuration drift
     * when platform folders are regenerated.
     */
    // Temporarily disable Hermes while investigating runtime crash
    jsEngine: "jsc",

    /* ------------------------------------------------------------------
     * Deep-link / Intent filters
     * ------------------------------------------------------------------ */
    intentFilters: [
      {
        action: "VIEW",
        data: [
          {
            scheme: "https",
            host: "cardshowfinder.app",
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
  runtimeVersion: "1.0.0",

  plugins: [
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: "Allow Card Show Finder to access your location so we can display nearby card shows."
      }
    ],
    // "sentry-expo"                        // ← Temporarily disabled while debugging runtime crash
  ],
  // Note: Expo's "hooks" field was removed because it is not a valid
  // app configuration field and caused schema validation errors
};

