import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Import screen components
import { HomeScreen } from '../screens/Home';
import CollectionScreen from '../screens/Collection';
import BadgesScreen from '../screens/Badges';
import DirectMessagesScreen from '../screens/Messages/DirectMessagesScreen';
import NotificationsScreen from '../screens/Notifications';
import ProfileNavigator from './ProfileNavigator';

// Define navigation types for main tabs
export type MainTabParamList = {
  Home: undefined;
  Collection: undefined;
  Badges: undefined;
  Messages: undefined;
  Notifications: undefined;
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
          } else if (route.name === 'Collection') {
            iconName = focused ? 'images' : 'images-outline';
          } else if (route.name === 'Badges') {
            iconName = focused ? 'trophy' : 'trophy-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'mail' : 'mail-outline';
          } else if (route.name === 'Notifications') {
            // Rename "Notifications" visual elements to use calendar icons
            iconName = focused ? 'calendar-sharp' : 'calendar-outline';
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
        options={{ title: 'Home' }}
      />
      <MainTab.Screen
        name="Collection"
        component={CollectionScreen}
        options={{ title: 'My Collection' }}
      />
      <MainTab.Screen
        name="Badges"
        component={BadgesScreen}
        options={{ title: 'Badges' }}
      />
      <MainTab.Screen
        name="Messages"
        component={DirectMessagesScreen}
        options={{ title: 'Messages' }}
      />
      <MainTab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'My Shows' }}
      />
      <MainTab.Screen 
        name="Profile" 
        component={ProfileNavigator} 
        options={{ 
          title: 'My Profile',
          headerShown: false, // ProfileNavigator manages its own headers
        }}
      />
    </MainTab.Navigator>
  );
};

export default MainTabNavigator;
