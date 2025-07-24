import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
} from 'react-native';
import {
  useNavigation,
  useIsFocused,
  NavigationProp,
  ParamListBase,
} from '@react-navigation/native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { format, addDays } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
// Mock implementations for missing contexts
const useShowService = () => ({
  // Accept filters but ignore them in the mock
  getShows: async (_filters?: ShowFilters) => [],
});
const useLocationService = () => ({
  // Accept ZIP code string but ignore it in the mock
  getZipCodeCoordinates: async (_zip?: string) => ({
    coordinates: { latitude: 0, longitude: 0 },
  }),
});
const useToast = () => ({ 
  showErrorToast: (title: string, message: string) => console.error(title, message) 
});
const useAnalytics = () => ({
  trackScreen: (screen: string) => console.log(`Tracking screen: ${screen}`)
});

import { Show, ShowFilters, Coordinates } from '../../types';

// Mock component implementations
const MapShowCluster = (props: any) => null;
const ShowListItem = (props: any) => null;

// Mock utility functions
const formatDate = (date: string | Date) => format(new Date(date), 'MMM d, yyyy');
const formatDistance = (distance: number) => `${distance.toFixed(1)} mi`;
const isEntryFree = (entryFee: number | string) => 
  entryFee === 0 || entryFee === '0' || entryFee === 'Free' || entryFee === 'free';
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  // Simple mock implementation
  return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2)) * 69.2;
};

// Mock theme constants
const COLORS = {
  primary: '#007AFF',
  darkGray: '#333',
  gray: '#999',
  lightGray: '#eee',
};

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;

const MapScreen = () => {
  // Explicitly type the navigation prop to accept a route name and params
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const isFocused = useIsFocused();
  const { authState } = useAuth();
  const { user } = authState;
  const { trackScreen } = useAnalytics();
  const { getShows } = useShowService();
  const locationService = useLocationService();
  const { showErrorToast } = useToast();
  const mapRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shows, setShows] = useState<Show[]>([]);
  const [userLocation, setUserLocation] = useState<Coordinates | undefined>(undefined);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  useEffect(() => {
    if (isFocused) {
      trackScreen('Map');
    }
  }, [isFocused, trackScreen]);

  useEffect(() => {
    const setupLocation = async () => {
      try {
        setLoading(true);
        await setupInitialRegion();
        setLoading(false);
      } catch (error) {
        console.error('[MapScreen] Error setting up location:', error);
        setLoading(false);
      }
    };

    setupLocation();
  }, []);

  useEffect(() => {
    if (userLocation) {
      fetchShows();
    }
  }, [userLocation]);

  const setupInitialRegion = async () => {
    let determinedLocation: Coordinates | undefined;
    let regionToSet: Region;

    // Try to get current location
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        determinedLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
      } else {
        console.warn('Location permission denied');
      }
    } catch (error) {
      console.error('[MapScreen] Error getting location:', error);
    }

    // If location not available, try to use home zip code
    if (!determinedLocation && user?.homeZipCode) {
      const zipData = await locationService.getZipCodeCoordinates(user.homeZipCode);
      if (zipData) {
        determinedLocation = zipData.coordinates;
        showLocationFailedToast(user.homeZipCode);
      }
    }

    // If still no location, use US center as fallback
    if (!determinedLocation) {
      console.warn('No coordinates available, falling back to US center.');
      determinedLocation = { latitude: 39.8283, longitude: -98.5795 };
      regionToSet = { ...determinedLocation, latitudeDelta: 40, longitudeDelta: 40 };
      
      if (!user?.homeZipCode) {
        showErrorToast(
          'Location Unavailable',
          'Please set your home ZIP code in your profile'
        );
      }
    } else {
      regionToSet = { ...determinedLocation, latitudeDelta: 0.5, longitudeDelta: 0.5 };
    }

    // Only set userLocation if determinedLocation is not null
    if (determinedLocation) {
      setUserLocation(determinedLocation);
    }

    setInitialRegion(regionToSet);
    setCurrentRegion(regionToSet);
  };

  const showLocationFailedToast = (zipCode: string) => {
    showErrorToast(
      'Location Services Unavailable',
      `Using your home ZIP code (${zipCode}) instead.`
    );
  };

  const fetchShows = async () => {
    try {
      if (!userLocation) {
        console.warn('[MapScreen] [DEBUG] Aborting fetchShows – userLocation is null');
        return;
      }

      setRefreshing(true);
      
      const today = new Date();
      const thirtyDaysOut = addDays(today, 30);
      
      const currentFilters: ShowFilters = {
        radius: 25,
        startDate: today.toISOString(),
        endDate: thirtyDaysOut.toISOString(),
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      };
      
      const fetchedShows = await getShows(currentFilters);
      setShows(fetchedShows);
    } catch (error) {
      console.error('[MapScreen] Error fetching shows:', error);
      showErrorToast('Error', 'Failed to fetch shows. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchShows();
  };

  const handleRegionChangeComplete = (region: Region) => {
    setCurrentRegion(region);
  };

  const handleShowPress = (show: Show) => {
    navigation.navigate('ShowDetail', { showId: show.id });
  };

  const renderMarkers = () => {
    return shows
      .filter(show => {
        // Improved type guard
        return show.coordinates && 
               typeof show.coordinates.latitude === 'number' && 
               typeof show.coordinates.longitude === 'number';
      })
      .map((show) => (
        <Marker
          key={show.id}
          coordinate={show.coordinates!} // non-null assertion is safe due to prior filter
          title={show.title}
          description={`${formatDate(show.startDate)} • ${
            isEntryFree(show.entryFee) ? 'Free' : `$${show.entryFee}`
          }`}
          pinColor="#007AFF"
        >
          <TouchableOpacity onPress={() => handleShowPress(show)}>
            <View style={styles.markerContainer}>
              <View style={styles.marker} />
            </View>
          </TouchableOpacity>
        </Marker>
      ));
  };

  const renderListItem = ({ item }: { item: Show }) => {
    const distance = userLocation && item.coordinates
      ? getDistance(
          userLocation.latitude,
          userLocation.longitude,
          item.coordinates.latitude,
          item.coordinates.longitude
        )
      : null;

    return (
      <ShowListItem
        show={item}
        distance={distance}
        onPress={() => handleShowPress(item)}
      />
    );
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'map' ? 'list' : 'map');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {viewMode === 'map' ? 'Map View' : 'List View'}
        </Text>
        <TouchableOpacity onPress={toggleViewMode} style={styles.viewToggle}>
          {viewMode === 'map' ? (
            <Ionicons name="list" size={24} color={COLORS.primary} />
          ) : (
            <Ionicons name="map" size={24} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      </View>

      {viewMode === 'map' ? (
        <>
          {currentRegion && (
            <MapShowCluster
              ref={mapRef}
              region={currentRegion}
              shows={shows}
              onCalloutPress={handleShowPress}
              onRegionChangeComplete={handleRegionChangeComplete}
            />
          )}
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <MaterialIcons
              name="refresh"
              size={24}
              color={refreshing ? COLORS.gray : COLORS.primary}
            />
          </TouchableOpacity>
        </>
      ) : (
        <FlatList
          data={shows}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderListItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No shows found in this area.</Text>
              <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
                <Text style={styles.retryText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.darkGray,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  viewToggle: {
    padding: 8,
  },
  refreshButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  listContainer: {
    paddingBottom: 20,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.darkGray,
    marginBottom: 10,
  },
  retryButton: {
    padding: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 5,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  markerContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#fff',
  },
});

export default MapScreen;
