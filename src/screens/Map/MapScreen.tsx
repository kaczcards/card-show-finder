import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Region } from 'react-native-maps';
import { useAuth } from '../../contexts/AuthContext';
import { Show, ShowStatus, ShowFilters, Coordinates } from '../../types';
// Removed import for getShows from showService as we're hardcoding data
import {
  getCurrentLocation,
  getZipCodeCoordinates,
} from '../../services/locationService';
import FilterSheet from '../../components/FilterSheet';
import MapShowCluster from '../../components/MapShowCluster/index';

// Define the main stack param list type
type MainStackParamList = {
  MainTabs: undefined;
  ShowDetail: { showId: string };
};

// Define props interface with optional props for tabbed interface
interface MapScreenProps extends NativeStackScreenProps<MainStackParamList> {
  customFilters?: ShowFilters;
  onFilterChange?: (filters: ShowFilters) => void;
  onShowPress?: (showId: string) => void;
  initialUserLocation?: Coordinates | null;
}

const MapScreen: React.FC<MapScreenProps> = ({
  navigation,
  customFilters,
  onFilterChange,
  onShowPress,
  initialUserLocation
}) => {
  // --- HARDCODED SHOWS DATA ---
  // We are temporarily hardcoding show data to test if pins appear and to stop infinite logging.
  // This bypasses the showService and Supabase.
  const [shows, setShows] = useState<Show[]>([
    {
      id: "hardcoded-show-1",
      title: "Sample Card Show A",
      location: "Noblesville, IN",
      address: "Moose Lodge, 950 Field Drive, Noblesville, IN 46060",
      startDate: "2025-07-12T00:00:00+00:00",
      endDate: "2025-07-12T00:00:00+00:00",
      startTime: "09:00 AM",
      endTime: "03:00 PM",
      entryFee: 5,
      description: "This is a hardcoded test show to check map pins. Should appear near Noblesville.",
      status: ShowStatus.ACTIVE,
      categories: ["Sports Cards"],
      features: ["Autographs"],
      organizerId: "test-organizer-1",
      coordinates: {
        latitude: 40.063948,
        longitude: -85.976875
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "hardcoded-show-2",
      title: "Sample Card Show B",
      location: "Indianapolis, IN",
      address: "200 E. Market St, Indianapolis, IN 46204",
      startDate: "2025-07-19T00:00:00+00:00",
      endDate: "2025-07-19T00:00:00+00:00",
      startTime: "10:00 AM",
      endTime: "04:00 PM",
      entryFee: 10,
      description: "Another hardcoded test show. Should appear in Indianapolis.",
      status: ShowStatus.ACTIVE,
      categories: ["Memorabilia"],
      features: ["Free Parking"],
      organizerId: "test-organizer-2",
      coordinates: {
        latitude: 39.7684,
        longitude: -86.1581
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]);
  const [loading, setLoading] = useState(false); // Set to false because data is hardcoded and immediately available
  // --- END HARDCODED SHOWS DATA ---

  const [filterVisible, setFilterVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(initialUserLocation || null);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);

  // Default filters
  const defaultFilters: ShowFilters = {
    radius: 25,
    startDate: new Date(),
    endDate: new Date(new Date().setDate(new Date().getDate() + 30)),
  };

  // Use customFilters if provided, otherwise use local state
  const [localFilters, setLocalFilters] = useState<ShowFilters>(defaultFilters);
  const filters = customFilters || localFilters;

  // Refs
  const mapRef = useRef<any>(null);

  // Get auth context
  const { authState } = useAuth();
  const { user } = authState;

  // Update userLocation when initialUserLocation changes
  useEffect(() => {
    if (initialUserLocation) {
      setUserLocation(initialUserLocation);
    }
  }, [initialUserLocation]);

  // Set up initial region based on user location or ZIP code
  useEffect(() => {
    const setupInitialRegion = async () => {
      try {
        let determinedLocation: Coordinates | null = null;
        let regionToSet: Region | null = null;

        /* ---- 1) Try initialUserLocation first if provided ---- */
        if (initialUserLocation) {
          determinedLocation = initialUserLocation;
          regionToSet = {
            latitude: initialUserLocation.latitude,
            longitude: initialUserLocation.longitude,
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
          };
        }

        /* ---- 2) Try live GPS if no initialUserLocation or it's null ---- */
        if (!determinedLocation) {
          const gps = await getCurrentLocation();
          if (gps) {
            determinedLocation = gps;
            regionToSet = {
              latitude: gps.latitude,
              longitude: gps.longitude,
              latitudeDelta: 0.5,
              longitudeDelta: 0.5,
            };
          }
        }

        /* ---- 3) Fallback to profile ZIP if still no location ---- */
        if (!determinedLocation && user?.homeZipCode) {
          const zipData = await getZipCodeCoordinates(user.homeZipCode);
          if (zipData) {
            determinedLocation = zipData.coordinates;
            regionToSet = {
              latitude: zipData.coordinates.latitude,
              longitude: zipData.coordinates.longitude,
              latitudeDelta: 2,
              longitudeDelta: 2,
            };
          }
        }

        /* ---- 4) Final fallback – US center if no location could be determined ---- */
        if (!determinedLocation || !regionToSet) {
          console.warn('No coordinates available, falling back to US center.');
          determinedLocation = { latitude: 39.8283, longitude: -98.5795 };
          regionToSet = {
            latitude: 39.8283,
            longitude: -98.5795,
            latitudeDelta: 40,
            longitudeDelta: 40,
          };
        }

        setUserLocation(determinedLocation);
        setInitialRegion(regionToSet);
        setCurrentRegion(regionToSet);
      } catch (error) {
        console.error('Error setting up initial region:', error);
        const defaultRegion = {
          latitude: 39.8283,
          longitude: -98.5795,
          latitudeDelta: 40,
          longitudeDelta: 40,
        };
        setInitialRegion(defaultRegion);
        setCurrentRegion(defaultRegion);
      }
    };

    setupInitialRegion();
  }, [user, initialUserLocation]);

  // --- TEMPORARILY DISABLED fetchShows LOGIC ---
  // This entire useCallback is commented out to stop fetching from Supabase
  // and prevent infinite loops while we test hardcoded pins.
  /*
  const fetchShows = useCallback(async () => {
    if (!initialRegion) {
        console.log('[MapScreen] Waiting for initialRegion to be set before fetching shows.');
        return;
    }

    setLoading(true);
    console.log('[MapScreen] Fetching shows using showService');

    const currentFilters: ShowFilters = { ...filters };
    if (userLocation) {
        currentFilters.latitude = userLocation.latitude;
        currentFilters.longitude = userLocation.longitude;
    }
    console.log('[MapScreen] Filters being used:', currentFilters);

    try {
      const showsData = await getShows(currentFilters);
      console.log('[MapScreen] Fetched shows data:', JSON.stringify(showsData, null, 2));
      setShows(Array.isArray(showsData) ? showsData : []);
      console.log(`[MapScreen] Successfully fetched ${showsData.length} shows`);
    } catch (error: any) {
      console.error('[MapScreen] Error fetching shows:', error);
      setShows([]);
      Alert.alert(
        'Error',
        `Failed to load card shows. ${error?.message ? `\n\nDetails: ${error.message}` : 'Please try again.'}`
      );
    } finally {
      setLoading(false);
    }
  }, [filters, userLocation, initialRegion]);
  */
  // --- END TEMPORARILY DISABLED fetchShows LOGIC ---

  // --- TEMPORARILY DISABLED useEffect CALLS TO fetchShows ---
  // Comment out any useEffect or useFocusEffect that calls fetchShows,
  // as data is now hardcoded.
  /*
  useFocusEffect(
    useCallback(() => {
      if (initialRegion) {
        fetchShows();
      }
    }, [initialRegion, filters, userLocation])
  );

  useEffect(() => {
    if (initialRegion) {
      fetchShows();
    }
  }, [initialRegion, filters, userLocation]);
  */
  // --- END TEMPORARILY DISABLED useEffect CALLS ---


  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<ShowFilters>) => {
    if (onFilterChange) {
      onFilterChange({ ...filters, ...newFilters });
    } else {
      setLocalFilters(prev => ({ ...prev, ...newFilters }));
    }
    setFilterVisible(false);
  };

  // Navigate to show detail or call provided callback
  const handleShowPress = (showId: string) => {
    if (onShowPress) {
      onShowPress(showId);
    } else {
      navigation.navigate('ShowDetail', { showId });
    }
  };

  // Handle region change from the map - this only updates the map's visible area, not trigger data fetch
  const handleRegionChangeComplete = (region: Region) => {
    setCurrentRegion(region);
  };

  // Center map on user location
  const centerOnUserLocation = async () => {
    try {
      const gps = await getCurrentLocation();

      if (!gps) {
        Alert.alert(
          'Location Needed',
          'Please enable location permissions in settings to center the map on your position.'
        );
        return;
      }

      setUserLocation(gps);

      const newRegion = {
        latitude: gps.latitude,
        longitude: gps.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0922,
      };

      setCurrentRegion(newRegion);

      if (mapRef.current && mapRef.current.animateToRegion) {
        mapRef.current.animateToRegion(newRegion, 500);
      }
    } catch (error) {
      console.error('Error centering on user location:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {loading && !initialRegion ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      ) : (
        <>
          {initialRegion && (
            <MapShowCluster
              ref={mapRef}
              shows={shows} // Now uses hardcoded 'shows' data
              onShowPress={handleShowPress}
              region={currentRegion || initialRegion}
              showsUserLocation={true}
              loadingEnabled={true}
              showsCompass={true}
              showsScale={true}
              provider="google"
              onRegionChangeComplete={handleRegionChangeComplete}
            />
          )}

          {/* Filter info banner */}
          <View style={styles.filterInfoContainer}>
            <Text style={styles.filterInfoText}>
              {shows.length === 0
                ? 'No shows found'
                : shows.length === 1
                ? '1 show found'
                : `${shows.length} shows found`}
              {' • '}Within {filters.radius} miles
            </Text>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setFilterVisible(true)}
            >
              <Ionicons name="options-outline" size={18} color="#007AFF" />
              <Text style={styles.filterButtonText}>Filter</Text>
            </TouchableOpacity>
          </View>

          {/* My Location Button */}
          <TouchableOpacity
            style={styles.myLocationButton}
            onPress={centerOnUserLocation}
          >
            <Ionicons name="locate" size={24} color="#007AFF" />
          </TouchableOpacity>

          {/* Filter Sheet */}
          <FilterSheet
            visible={filterVisible}
            onClose={() => setFilterVisible(false)}
            filters={filters}
            onApplyFilters={handleFilterChange}
          />
        </>
      )}
    </SafeAreaView>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  map: {
    width,
    height,
  },
  filterInfoContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filterInfoText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 30,
    right: 16,
    backgroundColor: 'white',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default MapScreen;
