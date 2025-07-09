import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Import screen components
import { HomeScreen } from '../screens/Home';
import { MapScreen } from '../screens/Map';
import CollectionScreen from '../screens/Collection';
import DirectMessagesScreen from '../screens/Messages/DirectMessagesScreen';
import NotificationsScreen from '../screens/Notifications';
import ProfileNavigator from './ProfileNavigator';
import OrganizerNavigator from './OrganizerNavigator';

// --- Define your brand colors for consistency ---
const BRAND_COLORS = {
  primaryBlue: '#007AFF',
  primaryOrange: '#FF6A00',
  activeTab: '#007AFF', // Using blue for the active tab
  inactiveTab: '#8E8E93', // A standard iOS gray for inactive tabs
  barBackground: '#FFFFFF',
};

// Define navigation types for main tabs
export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  "My Shows": undefined; // Renamed from Notifications
  "My Collection": undefined; // Renamed from Collection
  Messages: undefined;
  Organizer: undefined;
  "My Profile": undefined; // Renamed from Profile
};

const MainTab = createBottomTabNavigator<MainTabParamList>();

/**
 * MainTabNavigator - Handles navigation between main app tabs
 */
const MainTabNavigator: React.FC = () => {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home'; // Default icon
          size = focused ? 28 : 24; // Make focused icon slightly larger

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'My Shows') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'My Collection') {
            iconName = focused ? 'images' : 'images-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'mail' : 'mail-outline';
          } else if (route.name === 'My Profile') {
            iconName = focused ? 'person-circle' : 'person-circle-outline';
          } else if (route.name === 'Organizer') {
            iconName = focused ? 'briefcase' : 'briefcase-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        // --- Updated Styling ---
        tabBarActiveTintColor: BRAND_COLORS.activeTab,
        tabBarInactiveTintColor: BRAND_COLORS.inactiveTab,
        headerShown: true, // Keep headers visible on most screens
        tabBarStyle: {
          backgroundColor: BRAND_COLORS.barBackground,
          height: 90, // A more modern, taller tab bar
          paddingTop: 10,
          paddingBottom: 30,
          borderTopWidth: 0.5,
          borderTopColor: '#E0E0E0',
          elevation: 5, // Shadow for Android
          shadowColor: '#000', // Shadow for iOS
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      })}
    >
      {/* --- Screens in the Correct Order --- */}
      <MainTab.Screen
        name="Home"
        component={HomeScreen}
      />
      <MainTab.Screen
        name="Map"
        component={MapScreen}
      />
      <MainTab.Screen
        name="My Shows"
        component={NotificationsScreen} // This component handles "My Shows"
      />
      <MainTab.Screen
        name="Organizer"
        component={OrganizerNavigator}
        options={{
          headerShown: false, // OrganizerNavigator manages its own headers
        }}
      />
      <MainTab.Screen
        name="My Collection"
        component={CollectionScreen} // This component handles "My Collection"
      />
      <MainTab.Screen
        name="Messages"
        component={DirectMessagesScreen}
      />
      <MainTab.Screen
        name="My Profile"
        component={ProfileNavigator}
        options={{
          headerShown: false, // ProfileNavigator manages its own headers
        }}
      />
    </MainTab.Navigator>
  );
};

export default MainTabNavigator;