import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Global toast notifications
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
// ---------------- TEMPORARILY DISABLED ----------------
// Sentry for error/performance monitoring
// (Commented out while debugging Hermes prototype crash)
// import * as Sentry from 'sentry-expo';
// Centralised environment polyfills (structuredClone, etc.)
import './src/utils/polyfills';

// ------------------------------------------------------------------
// Context providers
// ------------------------------------------------------------------
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';

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
/*
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  enableInExpoDevelopment: true,
  debug: true,
  tracesSampleRate: 1.0, // capture 100% transactions (adjust in prod)
  integrations: [
    new Sentry.Native.ReactNativeTracing({
      routingInstrumentation,
    }),
  ],
});
*/

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
      console.log('[Diagnostics] Pinging public endpoint:', TEST_URL);
      try {
        const resp = await fetch(TEST_URL, { signal: controller.signal });
        console.log(
          `[Diagnostics] Fetch completed – status: ${resp.status} ${resp.ok ? '(OK)' : '(ERR)'}`
        );
        if (!resp.ok) {
          setNetStatus('error');
          setNetError(`HTTP ${resp.status}`);
          return;
        }
        const data = await resp.json();
        console.log('[Diagnostics] Response JSON:', data);
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

    // Perform any initialization tasks here
    const prepare = async () => {
      try {
        // Load any resources, fonts, or cached data
        // This is where you would load fonts with expo-font if needed
        
        // Small artificial delay to ensure everything is loaded
        await new Promise(resolve => setTimeout(resolve, 500));
        // Run connectivity test (does not block app start)
        await testConnectivity();
      } catch (e) {
        console.warn('Error initializing app:', e);
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
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <RootNavigator />
              <StatusBar style="auto" />
              {/* Global toast portal */}
              <Toast config={toastConfig} />
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
  );
}
