import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import navigators
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import AdminNavigator from './AdminNavigator';

// Import auth context
import { useAuth } from '../contexts/AuthContext';

// Import theme context
import { useTheme } from '../contexts/ThemeContext';

// Import UI components
import { Loading } from '../components/ui';

/**
 * RootNavigator - Handles top-level navigation based on auth state
 * Shows either the auth flow or main app based on authentication status
 */
const RootNavigator: React.FC = () => {
  const { authState } = useAuth();
  const { isAuthenticated, isLoading } = authState;
  
  // Get theme from context
  const { theme: _theme } = useTheme();

  // Root stack that will hold the main app and the admin tools
  const RootStack = createNativeStackNavigator();

  // Show loading indicator while auth state is being determined
  if (isLoading) {
    return (
      <Loading 
        type="fullScreen"
        message="Loading..."
      />
    );
  }

  /**
   * Deep-link configuration
   *  – Recognises our custom URL scheme `cardshowfinder://`
   *  – Handles the password-reset flow (`cardshowfinder://reset-password?token=XYZ`)
   *
   *  The `ResetPassword` route lives inside the AuthNavigator stack.
   *  React Navigation will automatically drill into nested navigators
   *  as long as we declare the screen name in the config.
   */
  const linking = {
    // Accept both the custom-scheme URL and the universal https link
    prefixes: [
      'cardshowfinder://',
      'https://cardshowfinder.app',
    ],
    config: {
      screens: {
        // Auth flow
        ResetPassword: {
          path: 'reset-password',
        },
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      {isAuthenticated ? (
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {/* Main user‐facing app */}
          <RootStack.Screen name="Main" component={MainNavigator} />
          {/* Admin tools – only navigated to manually or via deep links */}
          <RootStack.Screen name="Admin" component={AdminNavigator} />
        </RootStack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
};

export default RootNavigator;
