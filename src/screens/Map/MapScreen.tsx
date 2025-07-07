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
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useAuth } from '../../contexts/AuthContext';
import { Show, ShowStatus, ShowFilters, Coordinates } from '../../types';
import { getShows } from '../../services/showService';
import * as locationService from '../../services/locationService';
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
  // State
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(initialUserLocation || null);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Default filters
  const defaultFilters: ShowFilters = {
    radius: 25,
    startDate: new Date(),
    endDate: new Date(new Date().setDate(new Date().getDate() + 30)),
    maxEntryFee: undefined,
    features: [],
    categories: [],
  };

  // Use customFilters if provided, otherwise use local state
  const [localFilters, setLocalFilters] = useState<ShowFilters>(defaultFilters);
  const filters = customFilters || localFilters;

  // Refs
  const mapRef = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Get auth context
  const { authState } = useAuth();
  const { user } = authState;

  // Update userLocation when initialUserLocation changes
  useEffect(() => {
    if (initialUserLocation) {
      setUserLocation(initialUserLocation);
    }
  }, [initialUserLocation]);

  // Get user location
  const getUserLocation = useCallback(async () => {
    try {
      // First check if we have permission
      const hasPermission = await locationService.checkLocationPermissions();
      
      if (!hasPermission) {
        const granted = await locationService.requestLocationPermissions();
        if (!granted) {
          console.log('Location permission denied');
          return null;
        }
      }
      
      // Get current location
      const location = await locationService.getCurrentLocation();
      
      if (location) {
        console.log('Got user location:', location);
        setUserLocation(location);
        return location;
      } else if (user && user.homeZipCode) {
        // Fall back to ZIP code if we can't get current location
        console.log('Falling back to user ZIP code:', user.homeZipCode);
        const zipData = await locationService.getZipCodeCoordinates(user.homeZipCode);
        
        if (zipData && zipData.coordinates) {
          setUserLocation(zipData.coordinates);
          return zipData.coordinates;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user location:', error);
      return null;
    }
  }, [user]);

  // Set up initial region based on user location or ZIP code
  useEffect(() => {
    const setupInitialRegion = async () => {
      try {
        setLoading(true);
        setError(null);
        
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
          const location = await getUserLocation();
          if (location) {
            determinedLocation = location;
            regionToSet = {
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.5,
              longitudeDelta: 0.5,
            };
          }
        }

        /* ---- 3) Fallback to profile ZIP if still no location ---- */
        if (!determinedLocation && user?.homeZipCode) {
          const zipData = await locationService.getZipCodeCoordinates(user.homeZipCode);
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
        
        // Set error if we couldn't get user location and don't have a ZIP code
        if (!user || !user.homeZipCode) {
          setError('Could not determine your location. Please set your home ZIP code in your profile.');
        }
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
        setError('Error determining your location. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    setupInitialRegion();
  }, [getUserLocation, user, initialUserLocation]);

  // Fetch shows based on location or ZIP code
  const fetchShows = useCallback(async (isRefreshing = false) => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      }
      setError(null);
      
      console.log('[MapScreen] Fetching shows using showService');
      
      // Create a copy of the filters to modify
  /* -------------------------------------------------------------
   * Build _authoritative_ filters for the API request.
   * – Always within 25 miles of the user (spec)
   * – Always within the next 30 days
   * Anything coming from UI / parent that violates these bounds
   * is ignored so we never fall back to test-data responses.
   * ----------------------------------------------------------- */
  const currentFilters: ShowFilters = { ...filters };
  const today = new Date();
  const thirtyDaysOut = new Date();
  thirtyDaysOut.setDate(today.getDate() + 30);

  currentFilters.radius = 25;              // force spec radius
  currentFilters.startDate = today;        // today
  currentFilters.endDate = thirtyDaysOut;  // +30 days
      
      // If we have user location, use it
      if (userLocation) {
        currentFilters.latitude = userLocation.latitude;
        currentFilters.longitude = userLocation.longitude;
      } else {
        // Try to get user location again if we don't have it
        const location = await getUserLocation();
        
        if (location) {
          currentFilters.latitude = location.latitude;
          currentFilters.longitude = location.longitude;
        } else if (user && user.homeZipCode) {
          // Fall back to ZIP code if we still can't get location
          const zipData = await locationService.getZipCodeCoordinates(user.homeZipCode);
          
          if (zipData && zipData.coordinates) {
            currentFilters.latitude = zipData.coordinates.latitude;
            currentFilters.longitude = zipData.coordinates.longitude;
          } else {
            throw new Error('Could not determine your location. Please check your home ZIP code.');
          }
        } else {
          throw new Error('No location available. Please set your home ZIP code in your profile.');
        }
      }
      
      // Format dates as ISO strings if they're Date objects
      if (currentFilters.startDate instanceof Date) {
        currentFilters.startDate = currentFilters.startDate.toISOString();
      }
      
      if (currentFilters.endDate instanceof Date) {
        currentFilters.endDate = currentFilters.endDate.toISOString();
      }
      
      console.log('[MapScreen] Filters being used:', currentFilters);
      
      // Use the improved getShows function from showService
      const showsData = await getShows(currentFilters);
      
      // Always ensure we're setting an array
      setShows(Array.isArray(showsData) ? showsData : []);
      console.log(`[MapScreen] Successfully fetched ${showsData.length} shows`);
    } catch (error: any) {
      console.error('[MapScreen] Error fetching shows:', error);
      // Set empty array to prevent map errors
      setShows([]);
      setError(error?.message || 'Failed to load card shows. Please try again.');
    } finally {
      setLoading(false);
      if (isRefreshing) {
        setRefreshing(false);
      }
    }
  }, [filters, userLocation, getUserLocation, user]);

  // Load shows when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (initialRegion) {
        fetchShows();
      }
    }, [fetchShows, initialRegion])
  );

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchShows(true);
  }, [fetchShows]);

  // Handle filter changes
  const handleFilterChange = (newFilters: ShowFilters) => {
    if (onFilterChange) {
      // If parent is managing filters, call the callback
      onFilterChange(newFilters);
    } else {
      // Otherwise, update local state
      setLocalFilters(newFilters);
    }
    setFilterVisible(false);
    // Fetch shows with new filters
    fetchShows();
  };

  // Reset filters to defaults
  const resetFilters = () => {
    if (onFilterChange) {
      onFilterChange(defaultFilters);
    } else {
      setLocalFilters(defaultFilters);
    }
    // Fetch data with default filters
    fetchShows();
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
      setLoading(true);
      
      // Get current location
      const location = await getUserLocation();
      
      if (location && mapRef.current) {
        // Animate to user location
        const newRegion = {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        };
        
        setCurrentRegion(newRegion);
        
        if (mapRef.current.animateToRegion) {
          mapRef.current.animateToRegion(newRegion, 1000);
        }
        
        console.log('Centered map on user location:', location);
      } else {
        Alert.alert(
          'Location Unavailable',
          'Could not determine your current location. Please check your device settings and ensure location services are enabled.'
        );
      }
    } catch (error) {
      console.error('Error centering on user location:', error);
      Alert.alert(
        'Error',
        'Failed to center on your location. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Format date for callout with timezone correction
  const formatDate = (dateValue: Date | string) => {
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        return 'Unknown date';
      }

      // Adjust for timezone offset to ensure correct date display
      const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);

      return utcDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (err) {
      return 'Unknown date';
    }
  };

  // Render map markers - with defensive coding
  const renderMarkers = () => {
    if (!shows || !Array.isArray(shows) || shows.length === 0) {
      return null;
    }

    return shows
      .filter(show => show && show.coordinates && 
               typeof show.coordinates.latitude === 'number' && 
               typeof show.coordinates.longitude === 'number')
      .map((show) => (
        <Marker
          key={show.id}
          coordinate={{
            latitude: show.coordinates!.latitude,
            longitude: show.coordinates!.longitude,
          }}
          title={show.title}
          description={`${formatDate(show.startDate)} • ${show.entryFee === 0 ? 'Free' : `$${show.entryFee}`}`}
          pinColor="#007AFF"
        >
          <Callout onPress={() => handleShowPress(show.id)} tooltip>
            <View style={styles.calloutContainer}>
              <Text style={styles.calloutTitle}>{show.title}</Text>
              <Text style={styles.calloutDetail}>
                {formatDate(show.startDate)}
                {new Date(show.startDate).toDateString() !== new Date(show.endDate).toDateString() && 
                  ` - ${formatDate(show.endDate)}`}
              </Text>
              <Text style={styles.calloutDetail}>
                {show.address}
              </Text>
              <Text style={styles.calloutDetail}>
                {show.entryFee === 0 ? 'Free Entry' : `Entry: $${show.entryFee}`}
              </Text>
              <View style={styles.calloutButton}>
                <Text style={styles.calloutButtonText}>View Details</Text>
              </View>
            </View>
          </Callout>
        </Marker>
      ));
  };

  // Render empty state when no shows are found
  const renderEmptyState = () => {
    if (loading || shows.length > 0) return null;
    
    return (
      <View style={styles.emptyStateContainer}>
        <Ionicons name="map-outline" size={50} color="#007AFF" />
        <Text style={styles.emptyStateTitle}>No Shows Found</Text>
        <Text style={styles.emptyStateDescription}>
          Try adjusting your filters or expanding your search radius
        </Text>
        <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
          <Text style={styles.resetButtonText}>Reset Filters</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        scrollEnabled={false}
      >
        {loading && !initialRegion ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        ) : (
          <>
            {initialRegion && (
              // Use MapShowCluster if available, otherwise fallback to standard MapView
              mapRef.current && MapShowCluster ? (
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
              ) : (
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={initialRegion}
                  region={currentRegion || undefined}
                  showsUserLocation
                  showsMyLocationButton={false}
                  showsCompass
                  showsScale
                  loadingEnabled
                  onRegionChangeComplete={handleRegionChangeComplete}
                >
                  {renderMarkers()}
                </MapView>
              )
            )}

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#D32F2F" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Empty State */}
            {renderEmptyState()}

            {/* Filter info banner */}
            <View style={styles.filterInfoContainer}>
              <Text style={styles.filterInfoText}>
                {shows.length === 0
                  ? 'No shows found'
                  : shows.length === 1
                  ? '1 show found'
                  : `${shows.length} shows found`}
                {' • '}Within 25 miles
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

            {/* Active Filters Display */}
            {(filters.features?.length > 0 || filters.categories?.length > 0 || filters.maxEntryFee !== undefined) && (
              <View style={styles.activeFiltersContainer}>
                <Text style={styles.activeFiltersText}>
                  {filters.features?.length > 0 && `${filters.features.length} features • `}
                  {filters.categories?.length > 0 && `${filters.categories.length} categories • `}
                  {filters.maxEntryFee !== undefined && `Max $${filters.maxEntryFee} • `}
                  <Text style={styles.resetFiltersText} onPress={resetFilters}>Reset</Text>
                </Text>
              </View>
            )}

            {/* Loading Overlay */}
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#007AFF" />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Filter Sheet */}
      <FilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filters={filters}
        onApplyFilters={handleFilterChange}
      />
    </SafeAreaView>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: height - 100,
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
  calloutContainer: {
    width: 200,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  calloutDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  calloutButton: {
    backgroundColor: '#007AFF',
    borderRadius: 4,
    paddingVertical: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  calloutButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    position: 'absolute',
    top: 70,
    left: 16,
    right: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#D32F2F',
    marginLeft: 8,
  },
  emptyStateContainer: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    marginBottom: 5,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  resetButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeFiltersContainer: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activeFiltersText: {
    fontSize: 14,
    color: '#333',
  },
  resetFiltersText: {
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default MapScreen;
