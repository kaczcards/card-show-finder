import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Import screen components
import { HomeScreen } from '../screens/Home';
import { MapScreen } from '../screens/Map';
import { ProfileScreen } from '../screens/Profile';

// TODO: Replace with real implementation when ready
const FavoritesScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Favorites Screen (Coming Soon)</Text>
  </View>
);

// Define navigation types for main tabs
export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  Favorites: undefined;
  Profile: undefined;
};

// Create bottom tab navigator
const MainTab = createBottomTabNavigator<MainTabParamList>();

/**
 * MainTabNavigator - Handles navigation between main app tabs
 * Includes Home, Map, Favorites, and Profile screens
 */
const MainTabNavigator: React.FC = () => {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Favorites') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
        tabBarStyle: {
          paddingBottom: 5,
          height: 55,
        },
      })}
    >
      <MainTab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'Card Shows' }}
      />
      <MainTab.Screen 
        name="Map" 
        component={MapScreen} 
        options={{ title: 'Map View' }}
      />
      <MainTab.Screen 
        name="Favorites" 
        component={FavoritesScreen} 
        options={{ title: 'My Favorites' }}
      />
      <MainTab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ title: 'My Profile' }}
      />
    </MainTab.Navigator>
  );
};

export default MainTabNavigator;
