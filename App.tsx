import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

// Import context providers
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';

// Import theme for initial loading screen
import { theme } from './src/constants/theme';

// Import root navigator from navigation folder
import RootNavigator from './src/navigation';

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
      }}>
        <ActivityIndicator
          size="large"
          color={theme.colors.primary.main}
        />
        <Text style={{
          marginTop: theme.spacing.spacing.medium,
          fontSize: theme.typography.fontSize.body,
          color: theme.colors.text.secondary,
        }}>
          Starting up...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
