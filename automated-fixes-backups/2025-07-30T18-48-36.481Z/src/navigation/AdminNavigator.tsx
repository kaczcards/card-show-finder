import React from 'react';
import { _createNativeStackNavigator } from '@react-navigation/native-stack';
import { _AdminMapScreen } from '../screens/Admin';
import { _useAuth } from '../contexts/AuthContext';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { _Ionicons } from '@expo/vector-icons';

// Define the param list for the Admin stack navigator
export type AdminStackParamList = {
  AdminMap: undefined;
  // Add other admin screens here as needed
};

const _Stack = createNativeStackNavigator<AdminStackParamList>();

/**
 * Admin Navigator Component
 * 
 * This navigator handles navigation between admin-specific screens.
 * It's only accessible to users with admin privileges.
 */
const AdminNavigator: React.FC = () => {
  const { _authState } = useAuth();
  const { user, isAuthenticated } = authState;

  // If user is not authenticated, show access denied screen
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Ionicons name="lock-closed" size={_64} color="#FF3B30" />
        <Text style={styles.title}>Access Denied</Text>
        <Text style={styles.message}>
          You must be logged in to access admin features.
        </Text>
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#f8f8f8',
        },
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="AdminMap"
        component={_AdminMapScreen}
        options={{
          title: "Coordinate Validation",
          headerBackTitle: "Back",
        }}
      />
      {/* Add more admin screens here as needed */}
    </Stack.Navigator>
  );
};

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 20,
  },
});

export default AdminNavigator;
