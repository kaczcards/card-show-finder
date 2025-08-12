import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import HomeScreen from './HomeScreen';
import MapScreen from '../Map/MapScreen';
import { ShowFilters, Coordinates } from '../../types';
import { getCurrentLocation } from '../../services/locationService';
import { useAuth } from '../../contexts/AuthContext';
import {
  DEFAULT_FILTERS,
  loadTemporaryFilters,
  saveTemporaryFilters,
} from '../../services/filterService';

// Define the main stack param list type
type MainStackParamList = {
  MainTabs: undefined;
  ShowDetail: { showId: string };
};

type Props = NativeStackScreenProps<MainStackParamList>;

// Create top tab navigator
const Tab = createMaterialTopTabNavigator();

/**
 * HomeTabsScreen
 * 
 * Container component that provides a tabbed interface between list and map views.
 * Manages shared state (filters, location) between the views and handles persistence.
 */
const HomeTabsScreen: React.FC<Props> = ({ navigation }) => {
  const { authState } = useAuth();
  const { user: _user } = authState;
  const userId = _user?.id;

  // Shared state
  const [filters, setFilters] = useState<ShowFilters>(DEFAULT_FILTERS);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  // `activeTab` is currently unused but kept for potential future
  // analytics or state-driven styling; prefix with underscore to
  // satisfy eslint-unused-vars rule.
  const [_activeTab, setActiveTab] = useState<'list' | 'map'>('list');

  /**
   * ------------------------------------------------------------------
   * User-scoped filter persistence
   * ------------------------------------------------------------------
   */
  // Load filters when user changes
  useEffect(() => {
    if (!userId) {
      setFilters(DEFAULT_FILTERS);
      return;
    }

    (async () => {
      try {
        const stored = await loadTemporaryFilters(userId);
        if (stored) {
          setFilters({ ...DEFAULT_FILTERS, ...stored });
        } else {
          setFilters(DEFAULT_FILTERS);
        }
      } catch (e) {
        console.warn('[HomeTabsScreen] Failed to load user filters', e);
      }
    })();
  }, [userId]);

  // Persist filters whenever they change (and we have a user)
  useEffect(() => {
    if (!userId) return;
    saveTemporaryFilters(userId, filters).catch((e) =>
      console.warn('[HomeTabsScreen] Failed to save user filters', e)
    );
  }, [userId, filters]);

  // Get user location on mount
  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const location = await getCurrentLocation();
        if (location) {
          setUserLocation(location);
        }
      } catch (error) {
        console.error('Error getting user: _user location:', error);
      }
    };

    fetchLocation();
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: ShowFilters) => {
    setFilters(newFilters);
  }, []);

  // Handle show selection
  const handleShowPress = useCallback((showId: string) => {
    navigation.navigate('ShowDetail', { showId });
  }, [navigation]);

  // Handle tab change
  const handleTabChange = (index: number) => {
    setActiveTab(index === 0 ? 'list' : 'map');
  };

  return (
    <View style={styles.container}>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#666',
          tabBarIndicatorStyle: { backgroundColor: '#007AFF' },
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
        }}
        screenListeners={{
          state: (e) => {
            const index = e.data.state?.index || 0;
            handleTabChange(index);
          },
        }}
      >
        <Tab.Screen name="List">
          {(props) => (
            <HomeScreen
              {...props}
              customFilters={filters}
              onFilterChange={handleFilterChange}
              onShowPress={handleShowPress}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Map">
          {(props) => (
            <MapScreen {...props} initialUserLocation={userLocation} />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  tabBar: {
    backgroundColor: 'white',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tabLabel: {
    fontWeight: '600',
    textTransform: 'none',
    fontSize: 14,
  },
});

export default HomeTabsScreen;
