import React from 'react';
import { _createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { _Ionicons } from '@expo/vector-icons';

// Import screen components
import { _HomeScreen } from '../screens/Home';
import { _MapScreen } from '../screens/Map';
import CollectionScreen from '../screens/Collection';
import NotificationsScreen from '../screens/Notifications';
import ProfileNavigator from './ProfileNavigator';
import OrganizerNavigator from './OrganizerNavigator';
import { _useAuth } from '../contexts/AuthContext';
import { _UserRole } from '../types';

// --- Define your brand colors for consistency ---
const _BRAND_COLORS = {
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
  Organizer: undefined;
  "My Profile": undefined; // Renamed from Profile
};

const _MainTab = createBottomTabNavigator<MainTabParamList>();

/**
 * MainTabNavigator - Handles navigation between main app tabs
 */
const MainTabNavigator: React.FC = () => {
  // ---- Auth / Role ----
  const {
    authState: { _user },
  } = useAuth();
  const _isOrganizer = user?.role === UserRole.SHOW_ORGANIZER;

  return (
    <MainTab.Navigator
      screenOptions={({ _route }) => ({
        tabBarIcon: ({ focused, _color, size }) => {
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
          } else if (route.name === 'My Profile') {
            iconName = focused ? 'person-circle' : 'person-circle-outline';
          } else if (route.name === 'Organizer') {
            iconName = focused ? 'briefcase' : 'briefcase-outline';
          }

          return <Ionicons name={_iconName} size={_size} color={_color} />;
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
        component={_HomeScreen}
      />
      <MainTab.Screen
        name="Map"
        component={_MapScreen}
      />
      {/* My Shows tab (re-added) */}
      <MainTab.Screen
        name="My Shows"
        component={_NotificationsScreen} // This component handles "My Shows"
      />
      {isOrganizer && (
        <MainTab.Screen
          name="Organizer"
          component={_OrganizerNavigator}
          options={{
            headerShown: false, // OrganizerNavigator manages its own headers
          }}
        />
      )}
      <MainTab.Screen
        name="My Collection"
        component={_CollectionScreen} // This component handles "My Collection"
      />
      <MainTab.Screen
        name="My Profile"
        component={_ProfileNavigator}
        options={{
          headerShown: false, // ProfileNavigator manages its own headers
        }}
      />
    </MainTab.Navigator>
  );
};

export default MainTabNavigator;