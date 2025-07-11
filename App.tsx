import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Import context providers
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';

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
export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Perform any initialization tasks here
    const prepare = async () => {
      try {
        // Load any resources, fonts, or cached data
        // This is where you would load fonts with expo-font if needed
        
        // Small artificial delay to ensure everything is loaded
        await new Promise(resolve => setTimeout(resolve, 500));
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
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
