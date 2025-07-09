import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Region } from 'react-native-maps';
import { useAuth } from '../../contexts/AuthContext';
import { Show, ShowStatus, ShowFilters, Coordinates } from '../../types';
import {
  getCurrentLocation,
  getZipCodeCoordinates,
} from '../../services/locationService';
import { getShows } from '../../services/showService';
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
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  // Fetch shows when filters or userLocation changes
  useEffect(() => {
    const fetchShows = async () => {
      if (!userLocation) return;
      
      setLoading(true);
      setError(null);
      console.info('[MapScreen] Fetching shows with filters:', {
        ...filters,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });
      
      try {
        // Combine location with other filters
        const showFilters: ShowFilters = {
          ...filters,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        };
        
        const showsData = await getShows(showFilters);
        console.info(
          `[MapScreen] Received ${showsData.length} total show(s) from service.`,
        );

        // Extra diagnostics – count shows that actually have coordinates
        const showsWithCoords = showsData.filter(
          s =>
            s.coordinates &&
            typeof s.coordinates.latitude === 'number' &&
            typeof s.coordinates.longitude === 'number',
        );
        console.info(
          `[MapScreen] ${showsWithCoords.length}/${showsData.length} show(s) contain valid coordinates.`,
        );

        setShows(showsData);

        /* ---------------------------------------------------------
         * Retry once automatically if nothing returned
         * ------------------------------------------------------- */
        if (showsData.length === 0 && retryRef.current < 1) {
          retryRef.current += 1;
          console.warn(
            '[MapScreen] No shows returned – retrying in 2 seconds (attempt 1).',
          );
          setTimeout(fetchShows, 2000);
        }
      } catch (err: any) {
        console.error(
          '[MapScreen] Error fetching shows with filters:',
          err,
        );
        setError(
          err.message ||
            'Failed to fetch shows. Please check your internet connection or try again later.',
        );
        setShows([]);
      } finally {
        setLoading(false);
      }
    };
    
    // keep retry counter stable across renders
    const retryRef = fetchShows.retryRef || { current: 0 };
    // @ts-ignore – attach to function for persistence w/o extra ref
    fetchShows.retryRef = retryRef;

    retryRef.current = 0; // reset counter each dependency change
    fetchShows();
  }, [filters, userLocation]);

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
      {loading && !shows.length ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading shows...</Text>
        </View>
      ) : (
        <>
          {initialRegion && (
            <MapShowCluster
              ref={mapRef}
              shows={shows}
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

          {/* Error message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  // Re-trigger the useEffect by updating userLocation
                  if (userLocation) {
                    setUserLocation({...userLocation});
                  }
                }}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
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
  errorContainer: {
    position: 'absolute',
    top: 70,
    left: 16,
    right: 16,
    backgroundColor: '#ffeeee',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ff3b30',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#ff3b30',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#ff3b30',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
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
