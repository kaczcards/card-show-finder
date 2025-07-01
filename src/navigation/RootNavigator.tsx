import React from 'react';
import { NavigationContainer } from '@react-navigation/native';

// Import navigators
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

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
  const { theme } = useTheme();

  // Show loading indicator while auth state is being determined
  if (isLoading) {
    return (
      <Loading 
        type="fullScreen"
        message="Loading..."
      />
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default RootNavigator;
