import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator } from 'react-native';
// Intentionally unused – kept here for future navigation container instrumentation
import { NavigationContainer as _NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Global toast notifications
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
// Stripe payment provider
import { StripeProvider } from '@stripe/stripe-react-native';
// ---------------- TEMPORARILY DISABLED ----------------
// Sentry for error/performance monitoring
import * as Sentry from 'sentry-expo';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
// Centralised environment polyfills (structuredClone, etc.)
import './src/utils/polyfills';

// ------------------------------------------------------------------
// Context providers
// ------------------------------------------------------------------
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
// Global error boundary
import ErrorBoundary from './src/components/ErrorBoundary';

/**
 * ---------------------------------------------------------
 *  Sentry Initialisation
 * ---------------------------------------------------------
 *  • Error & crash reporting
 *  • Performance monitoring (tracing)
 *  • Breadcrumbs for console.log / network calls, etc.
 * ---------------------------------------------------------
 */

// ---------------- TEMPORARILY DISABLED ----------------
// React Navigation instrumentation – enables route change tracing
// const routingInstrumentation = new Sentry.Native.ReactNavigationV5Instrumentation();

// ---------------- TEMPORARILY DISABLED ----------------
// Sentry initialisation block (disabled while isolating runtime crash)
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  enableInExpoDevelopment: true,
  debug: true,
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  /**
   * Scrub sensitive data & limit payload size
   */
  beforeSend: (event) => {
    // Remove user information
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – Sentry event typing
    delete event.user;

    // Remove request headers if present
    if (event.request?.headers) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      delete event.request.headers;
    }

    // Truncate long string extras to 1 000 chars
    if (event.extra) {
      Object.keys(event.extra).forEach((key) => {
        const val = event.extra?.[key];
        if (typeof val === 'string' && val.length > 1000) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          event.extra[key] = `${val.slice(0, 1000)}…(truncated)`;
        }
      });
    }
    return event;
  },
});

// Lightweight tags for easier filtering
try {
  Sentry.setTag('app_version', Constants.expoConfig?.version ?? 'unknown');
  Sentry.setTag('platform', Platform.OS);
} catch (_err) {
  // noop – avoid crashing if Sentry not fully initialised
}

// Import theme for initial loading screen
import { theme } from './src/constants/theme';

// Import root navigator from navigation folder
import RootNavigator from './src/navigation';

/**
 * React Query client – single instance shared across the app.
 *  - staleTime:   30 seconds (data considered fresh for this long)
 *  - cacheTime:    5 minutes (unused data kept in cache this long)
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,      // 30 seconds
      cacheTime: 5 * 60 * 1000,  // 5 minutes
    },
  },
});

/**
 * Main App component
 * Sets up providers and initializes the app
 */

/**
 * Toast configuration – enables `success`, `info`, `warning`, and `error`
 * types with simple coloured accents on the left border.
 */
const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#4CAF50' }}               /* green */
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 16, fontWeight: '600' }}
      text2Style={{ fontSize: 14 }}
    />
  ),
  info: (props: any) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#2196F3' }}               /* blue */
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 16, fontWeight: '600' }}
      text2Style={{ fontSize: 14 }}
    />
  ),
  warning: (props: any) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#FF9800' }}               /* orange */
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 16, fontWeight: '600' }}
      text2Style={{ fontSize: 14 }}
    />
  ),
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: '#F44336' }}               /* red */
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 16, fontWeight: '600' }}
      text2Style={{ fontSize: 14 }}
    />
  ),
};

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [netStatus, setNetStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [netError, setNetError] = useState<string | null>(null);

  useEffect(() => {
    /**
     * Quick network diagnostic – attempts to fetch a known-good public
     * JSON endpoint with a 5 second timeout.  Logs full details so we
     * know whether basic DNS + HTTPS are working in the running
     * environment (simulator / device).
     */
    const testConnectivity = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const TEST_URL = 'https://jsonplaceholder.typicode.com/todos/1';
      if (__DEV__)
        console.warn('[Diagnostics] Pinging public endpoint:', TEST_URL);
      try {
        const resp = await fetch(TEST_URL, { signal: controller.signal });
        if (__DEV__)
          console.warn(
          `[Diagnostics] Fetch completed – status: ${resp.status} ${resp.ok ? '(OK)' : '(ERR)'}`
        );
        if (!resp.ok) {
          setNetStatus('error');
          setNetError(`HTTP ${resp.status}`);
          return;
        }
        const data = await resp.json();
        if (__DEV__) console.warn('[Diagnostics] Response JSON:', data);
        setNetStatus('success');
      } catch (err: any) {
        const msg =
          err?.name === 'AbortError'
            ? 'Timeout after 5s'
            : err?.message || 'Unknown error';
        console.error('[Diagnostics] Network test failed:', msg);
        setNetStatus('error');
        setNetError(msg);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    /**
     * App Tracking Transparency (iOS 14+)
     * Prompt the user for tracking permission if it hasn't been asked yet.
     * Runs as a fire-and-forget task so it never blocks app start-up.
     */
    const requestATT = async () => {
      if (Platform.OS !== 'ios') return;
      try {
        // Dynamic import prevents crashes in Expo Go / builds lacking the native module
        const mod = await import('expo-tracking-transparency');
        const getPerms =
          (mod as any).getTrackingPermissionsAsync as
            | undefined
            | (() => Promise<{ status: string }>);
        const reqPerms =
          (mod as any).requestTrackingPermissionsAsync as
            | undefined
            | (() => Promise<{ status: string }>);

        if (typeof getPerms !== 'function' || typeof reqPerms !== 'function') {
          if (__DEV__)
            console.warn('[ATT] Module present but functions missing – skipping');
          return;
        }

        const { status } = await getPerms();
        if (status === 'undetermined') {
          await reqPerms();
        }
      } catch (err: any) {
        // When running in Expo Go or other runtimes without the native module
        if (__DEV__)
          console.warn(
            '[ATT] Tracking transparency unavailable in this runtime:',
            err?.message || err
          );
      }
    };

    // Perform any initialization tasks here
    const prepare = async () => {
      try {
        // Fire-and-forget ATT prompt (iOS only)
        requestATT();

        // Load any resources, fonts, or cached data
        // This is where you would load fonts with expo-font if needed
        
        // Small artificial delay to ensure everything is loaded
        await new Promise(resolve => setTimeout(resolve, 500));
        // Run connectivity test (does not block app start)
        await testConnectivity();
      } catch (e) {
        if (__DEV__) console.warn('Error initializing app:', e);
      } finally {
        setIsReady(true);
      }
    };

    prepare();
  }, []);

  if (!isReady) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background.default,
        /* Ensure the splash covers the entire viewport on all devices */
        width: '100%',
        height: '100%',
      }}>
        <ActivityIndicator
          /* Bigger spinner for better visibility on high-res screens */
          size={64}
          color={theme.colors.primary.main}
        />

        {/* ----- Network status indicator ----- */}
        <Text
          style={{
            marginTop: theme.spacing.spacing.medium,
            fontSize: theme.typography.fontSize.body,
            color:
              netStatus === 'success'
                ? 'green'
                : netStatus === 'error'
                ? 'red'
                : theme.colors.text.secondary,
          }}
        >
          {netStatus === 'idle'
            ? 'Checking network…'
            : netStatus === 'success'
            ? 'Network OK'
            : `Network error: ${netError}`}
        </Text>

        <Text style={{
          marginTop: theme.spacing.spacing.medium,
          /* Slightly larger start-up text for improved readability */
          fontSize: theme.typography.fontSize.body * 1.25,
          color: theme.colors.text.secondary,
        }}>
          Starting up...
        </Text>
      </View>
    );
  }

  return (
      <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <ThemeProvider>
              <AuthProvider>
                <ErrorBoundary>
                  <RootNavigator />
                </ErrorBoundary>
                <StatusBar style="auto" />
                {/* Global toast portal */}
                <Toast config={toastConfig} />
              </AuthProvider>
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </StripeProvider>
  );
}
