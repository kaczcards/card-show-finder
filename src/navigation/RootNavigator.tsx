import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

// Import navigators
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

// Import auth context
import { useAuth } from '../contexts/AuthContext';

/**
 * RootNavigator - Handles top-level navigation based on auth state
 * Shows either the auth flow or main app based on authentication status
 */
const RootNavigator: React.FC = () => {
  const { authState } = useAuth();
  const { isAuthenticated, isLoading } = authState;

  // Show loading indicator while auth state is being determined
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10, fontSize: 16, color: '#666' }}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default RootNavigator;
