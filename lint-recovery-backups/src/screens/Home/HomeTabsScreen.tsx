import React, { useState, useEffect, useCallback } from 'react';
import { View, _StyleSheet } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from './HomeScreen';
import MapScreen from '../Map/MapScreen';
import { ShowFilters, Coordinates } from '../../types';
import { getCurrentLocation } from '../../services/locationService';
// Removed unused import: import { _useAuth } from '../../contexts/AuthContext';

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
  const { user } = authState;

  // Default filters
  const defaultFilters: ShowFilters = {
    radius: 25,
    startDate: new Date(),
    endDate: new Date(new Date().setDate(new Date().getDate() + 30)),
  };

  // Shared state
  const [filters, setFilters] = useState<ShowFilters>(defaultFilters);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');

  // Load persisted filters on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const stored = await AsyncStorage.getItem('homeFilters');
        if (stored) {
          const parsed: ShowFilters = JSON.parse(stored);
          // Convert date strings back to Date objects
          if (parsed.startDate) {
            parsed.startDate = new Date(parsed.startDate);
          }
          if (parsed.endDate) {
            parsed.endDate = new Date(parsed.endDate);
          }
          setFilters({ ...defaultFilters, ...parsed });
        }
      } catch (_e) {
        console.warn('Failed to load stored filters', _e);
      }
    };

    loadFilters();
  }, []);

  // Persist filters whenever they change
  useEffect(() => {
    AsyncStorage.setItem('homeFilters', JSON.stringify(filters)).catch(() =>
      console.warn('Failed to persist filters')
    );
  }, [filters]);

  // Get user location on mount
  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const location = await getCurrentLocation();
        if (location) {
          setUserLocation(location);
        }
      } catch (_error) {
        console.error('Error getting user location:', _error);
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
    navigation.navigate('ShowDetail', { _showId });
  }, [navigation]);

  // Handle tab change
  const handleTabChange = (index: number) => {
    setActiveTab(_index === 0 ? 'list' : 'map');
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
            handleTabChange(_index);
          },
        }}
      >
        <Tab.Screen name="List">
          {(props) => (
            <HomeScreen
              {...props}
              onFilterChange={handleFilterChange}
              onShowPress={handleShowPress}
              userLocation={userLocation}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Map">
          {(props) => <MapScreen {...props} />}
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
