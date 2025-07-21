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
  newArchEnabled: true,
  scheme: "cardshowfinder",
  splash: {
    image: "./assets/splash.jpg",
    resizeMode: "cover",
    backgroundColor: "#ffffff"
  },
  ios: {
    supportsTablet: true,
    googleServicesFile: "./GoogleService-Info.plist",
    jsEngine: "jsc",
    infoPlist: {
      NSLocationWhenInUseUsageDescription: "Allow Card Show Finder to access your location so we can display nearby card shows."
    },
    /* ------------------------------------------------------------------
     * Universal Links (iOS) – ensure password-reset email links open
     * the app rather than Safari.  Replace the domain below with the
     * production domain used for your Supabase redirect / link-shortener.
     * ------------------------------------------------------------------ */
    associatedDomains: [
      "applinks:cardshowfinder.app"
    ],
    bundleIdentifier: "com.kaczcards.cardshowfinder"
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    edgeToEdgeEnabled: true,
    googleServicesFile: "./google-services.json",
    permissions: [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION"
    ],
    jsEngine: "jsc",
    package: "com.kaczcards.cardshowfinder"
    ,
    /* ------------------------------------------------------------------
     * Deep-link / Intent filters (Android)
     *  – Handles both the custom scheme  cardshowfinder://reset-password
     *    and the universal https link  https://cardshowfinder.app/reset-password
     * ------------------------------------------------------------------ */
    intentFilters: [
      {
        action: "VIEW",
        data: [
          {
            scheme: "https",
            host: "cardshowfinder.app",
            pathPrefix: "/reset-password"
          }
        ],
        category: ["BROWSABLE", "DEFAULT"]
      },
      {
        action: "VIEW",
        data: [
          {
            scheme: "cardshowfinder",
            host: "reset-password"
          }
        ],
        category: ["BROWSABLE", "DEFAULT"]
      }
    ]
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  extra: {
    supabaseUrl: EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: EXPO_PUBLIC_SUPABASE_ANON_KEY,
    googleMapsApiKey: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    sentryDsn: EXPO_PUBLIC_SENTRY_DSN,
  },
  plugins: [
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: "Allow Card Show Finder to access your location so we can display nearby card shows."
      }
    ],
    "sentry-expo"
  ],
  hooks: {
    postPublish: [
      {
        file: "sentry-expo/upload-sourcemaps",
        config: {
          /**
           * ------------------------------------------------------------------
           * Set your Sentry **organization slug** here.
           * You can find it in the Sentry web UI:
           *   Settings ▸ Organization Settings ▸ General Settings ▸ “Slug”
           * Example:  "my-startup"  (do **not** include quotes when you paste)
           * ------------------------------------------------------------------
           */
          organization: "triforce-studios-llc",
          project: "card-show-finder",
          authToken: process.env.SENTRY_AUTH_TOKEN,
        }
      }
    ]
  }
};
