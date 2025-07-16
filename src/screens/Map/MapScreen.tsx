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
  Linking,
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
import FilterSheet from '../../components/FilterSheet';
import MapShowCluster from '../../components/MapShowCluster/index';
import * as locationService from '../../services/locationService';
import { getShows } from '../../services/showService';
// Import toast utilities for location notifications
import { showErrorToast, showGpsLocationToast, showLocationFailedToast } from '../../utils/toastUtils';

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
  const mapRef = useRef<MapView>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const retryRef = useRef(0);

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
      const hasPermission = await locationService.checkLocationPermissions();

      if (!hasPermission) {
        const granted = await locationService.requestLocationPermissions();
        if (!granted) {
          console.log('Location permission denied');
          // Show toast notification if falling back to ZIP code
          if (user?.homeZipCode) {
            showLocationFailedToast(user.homeZipCode);
          } else {
            showErrorToast(
              'Location Permission Denied',
              'Please set your home ZIP code in your profile'
            );
          }
          return null;
        }
      }

      const location = await locationService.getCurrentLocation();

      if (location) {
        console.log('Got user location:', location);
        return location;
      } else if (user && user.homeZipCode) {
        console.log('Falling back to user ZIP code:', user.homeZipCode);
        showLocationFailedToast(user.homeZipCode);
        
        const zipData = await locationService.getZipCodeCoordinates(user.homeZipCode);
        if (zipData && zipData.coordinates) {
          return zipData.coordinates;
        }
      }

      if (!user?.homeZipCode) {
        showErrorToast(
          'Location Unavailable',
          'Please set your home ZIP code in your profile'
        );
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user location:', error);
      showErrorToast(
        'Location Error',
        'Failed to get your location. Please try again.'
      );
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

        if (initialUserLocation) {
          determinedLocation = initialUserLocation;
        }

        if (!determinedLocation) {
          const location = await getUserLocation();
          if (location) {
            determinedLocation = location;
            
            // Show toast for GPS location if it was successful
            try {
              const address = await locationService.reverseGeocodeCoordinates(location);
              const locationName = address ? (address.city || address.subregion || address.region) : undefined;
              showGpsLocationToast(locationName);
            } catch (e) {
              showGpsLocationToast();
            }
          }
        }

        if (!determinedLocation && user?.homeZipCode) {
          const zipData = await locationService.getZipCodeCoordinates(user.homeZipCode);
          if (zipData) {
            determinedLocation = zipData.coordinates;
            showLocationFailedToast(user.homeZipCode);
          }
        }

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

        setUserLocation(determinedLocation);
        setInitialRegion(regionToSet);
        setCurrentRegion(regionToSet);

        if (!initialUserLocation && !user?.homeZipCode) {
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
        showErrorToast(
          'Location Error',
          'Failed to determine your location. Please try again later.'
        );
      } finally {
        setLoading(false);
      }
    };

    setupInitialRegion();
  }, [getUserLocation, user, initialUserLocation]);

  // Fetch shows based on location or ZIP code
  const fetchShows = useCallback(async (isRefreshing = false) => {
    if (!userLocation) return;
    try {
      if (!isRefreshing) {
        setLoading(true);
      }
      setError(null);

      const today = new Date();
      const thirtyDaysOut = new Date();
      thirtyDaysOut.setDate(today.getDate() + 30);

      const currentFilters: ShowFilters = {
          radius: 25,
          startDate: today.toISOString(),
          endDate: thirtyDaysOut.toISOString(),
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
      };

      console.log('[MapScreen] Filters being used:', currentFilters);
      const showsData = await getShows(currentFilters);

      // Log detailed information about the API response
      console.log(`[MapScreen] [DEBUG] API returned ${showsData.length} total shows`);
      
      // Check for shows with missing or invalid coordinates
      const showsWithCoordinates = showsData.filter(show => 
        show.coordinates && 
        typeof show.coordinates.latitude === 'number' && 
        typeof show.coordinates.longitude === 'number'
      );
      
      const showsWithoutCoordinates = showsData.filter(show => 
        !show.coordinates || 
        typeof show.coordinates.latitude !== 'number' || 
        typeof show.coordinates.longitude !== 'number'
      );
      
      if (showsWithoutCoordinates.length > 0) {
        console.warn(`[MapScreen] [DEBUG] Found ${showsWithoutCoordinates.length} shows with missing or invalid coordinates`);
        showsWithoutCoordinates.forEach(show => {
          console.warn(`[MapScreen] [DEBUG] Show missing coordinates: "${show.title}" (ID: ${show.id}), coordinates:`, show.coordinates);
        });
      }
      
      // Check for shows with potentially invalid coordinate ranges
      const showsWithSuspiciousCoords = showsWithCoordinates.filter(show => {
        const { latitude, longitude } = show.coordinates;
        return Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || 
               (Math.abs(latitude) > 180 && Math.abs(longitude) < 90); // Potentially swapped
      });
      
      if (showsWithSuspiciousCoords.length > 0) {
        console.warn(`[MapScreen] [DEBUG] Found ${showsWithSuspiciousCoords.length} shows with suspicious coordinates (out of range or swapped)`);
        showsWithSuspiciousCoords.forEach(show => {
          console.warn(`[MapScreen] [DEBUG] Show with suspicious coordinates: "${show.title}" (ID: ${show.id}), coordinates:`, show.coordinates);
        });
      }
      
      // Log detailed information about each show
      console.log('[MapScreen] [DEBUG] Detailed show information:');
      showsData.forEach((show, index) => {
        console.log(`[MapScreen] [DEBUG] Show #${index + 1}: "${show.title}" (ID: ${show.id})`);
        console.log(`  • Status: ${show.status}`);
        console.log(`  • Dates: ${new Date(show.startDate).toLocaleDateString()} to ${new Date(show.endDate).toLocaleDateString()}`);
        console.log(`  • Coordinates:`, show.coordinates);
        console.log(`  • Address: ${show.address}`);
        console.log(`  • Entry Fee: ${show.entryFee}`);
      });

      setShows(Array.isArray(showsData) ? showsData : []);
      console.log(`[MapScreen] Successfully fetched ${showsData.length} shows`);

      if (showsData.length === 0 && retryRef.current < 1) {
        retryRef.current += 1;
        console.warn('[MapScreen] No shows returned – retrying in 2 seconds (attempt 1).');
        setTimeout(() => fetchShows(), 2000);
      } else {
        retryRef.current = 0; // Reset on successful fetch
      }

    } catch (error: any) {
      console.error('[MapScreen] Error fetching shows:', error);
      setShows([]);
      setError(error?.message || 'Failed to load card shows. Please try again.');
    } finally {
      setLoading(false);
      if (isRefreshing) {
        setRefreshing(false);
      }
    }
  }, [filters, userLocation, getUserLocation, user]);

  // Load shows when screen is focused or when the initial region is set
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
      onFilterChange(newFilters);
    } else {
      setLocalFilters(newFilters);
    }
    setFilterVisible(false);
  };

  // Reset filters to defaults
  const resetFilters = () => {
    if (onFilterChange) {
      onFilterChange(defaultFilters);
    } else {
      setLocalFilters(defaultFilters);
    }
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

  // ---------------------------------------------------------------------------
  // Open address in native maps application (Task 2)
  // ---------------------------------------------------------------------------
  const openMapLocation = (address: string) => {
    if (!address) return;

    try {
      // Use proper platform-specific scheme
      //  • iOS  : maps:?q=<encoded address>
      //  • Android : geo:0,0?q=<encoded address>
      const scheme = Platform.select({ ios: 'maps:?q=', android: 'geo:0,0?q=' });
      const encodedAddress = encodeURIComponent(address);
      const url = `${scheme}${encodedAddress}`;

      console.log('[MapScreen] Opening maps with URL:', url);
      Linking.openURL(url).catch((err) => {
        console.error('Error opening native maps app:', err);
        // Fallback to Google Maps in browser
        const webUrl = `https://maps.google.com/?q=${encodedAddress}`;
        console.log('[MapScreen] Fallback to web maps URL:', webUrl);
        Linking.openURL(webUrl).catch((e) => {
          console.error('Error opening web maps:', e);
          Alert.alert('Error', 'Could not open maps application.');
        });
      });
    } catch (error) {
      console.error('Error processing maps URL:', error);
      Alert.alert('Error', 'Could not open maps application.');
    }
  };

  // Center map on user location
  const centerOnUserLocation = async () => {
    try {
      setLoading(true);
      const location = await getUserLocation();

      if (location && mapRef.current) {
        const newRegion = {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        };
        setCurrentRegion(newRegion);
        mapRef.current.animateToRegion(newRegion, 1000);
        
        // Get location name for better context in toast
        try {
          const address = await locationService.reverseGeocodeCoordinates(location);
          const locationName = address ? (address.city || address.subregion || address.region) : undefined;
          showGpsLocationToast(locationName);
        } catch (e) {
          // If reverse geocoding fails, still show toast but without location name
          showGpsLocationToast();
        }
      } else if (user?.homeZipCode) {
        // Fall back to ZIP code
        showLocationFailedToast(user.homeZipCode);
        
        // Try to center on ZIP code
        const zipData = await locationService.getZipCodeCoordinates(user.homeZipCode);
        if (zipData && mapRef.current) {
          const newRegion = {
            latitude: zipData.coordinates.latitude,
            longitude: zipData.coordinates.longitude,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          };
          setCurrentRegion(newRegion);
          mapRef.current.animateToRegion(newRegion, 1000);
        }
      } else {
        // No location available at all
        showErrorToast(
          'Location Unavailable',
          'Could not determine your location. Please set your home ZIP code in your profile.'
        );
      }
    } catch (error) {
      console.error('Error centering on user location:', error);
      showErrorToast(
        'Location Error',
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
      if (isNaN(date.getTime())) return 'Unknown date';
      const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
      return utcDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (err) {
      return 'Unknown date';
    }
  };

  /**
   * Determine if a show entry fee should be considered free.
   * Adds verbose logging so we can see the raw value coming from the API.
   */
  const isEntryFree = (fee: any): boolean => {
    // Diagnostic log – remove or reduce verbosity once confirmed working
    console.log(
      `[MapScreen] [DEBUG] entryFee raw value:`,
      fee,
      '| type:',
      typeof fee
    );

    if (fee === null || fee === undefined) return true;
    if (typeof fee === 'number') return fee <= 0;

    // Handle string representations
    const feeStr = String(fee).trim().toLowerCase();
    return (
      feeStr === '' ||
      feeStr === '0' ||
      feeStr === '$0' ||
      feeStr === 'null' ||
      feeStr === '$null' ||
      feeStr === 'free'
    );
  };

  // Render map markers - with defensive coding
  const renderMarkers = () => {
    if (!shows || !Array.isArray(shows) || shows.length === 0) return null;
    
    // Log how many shows are being filtered out due to missing coordinates
    const validShows = shows.filter(show => show?.coordinates?.latitude && show.coordinates.longitude);
    const filteredOutCount = shows.length - validShows.length;
    
    if (filteredOutCount > 0) {
      console.warn(`[MapScreen] [DEBUG] Filtering out ${filteredOutCount} shows due to missing coordinates in renderMarkers`);
      shows.forEach(show => {
        if (!show?.coordinates?.latitude || !show.coordinates.longitude) {
          console.warn(`[MapScreen] [DEBUG] Show filtered out: "${show.title}" (ID: ${show.id}), coordinates:`, show.coordinates);
        }
      });
    }
    
    return shows
      .filter(show => show?.coordinates?.latitude && show.coordinates.longitude)
      .map((show) => (
        <Marker
          key={show.id}
          coordinate={show.coordinates}
          title={show.title}
          description={`${formatDate(show.startDate)} • ${
            isEntryFree(show.entryFee) ? 'Free' : `$${show.entryFee}`
          }`}
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
              <TouchableOpacity onPress={() => openMapLocation(show.address)}>
                <Text style={[styles.calloutDetail, styles.addressLink]}>
                  {show.address}
                </Text>
              </TouchableOpacity>
              <Text style={styles.calloutDetail}>
                {isEntryFree(show.entryFee)
                  ? 'Free Entry'
                  : `Entry: $${show.entryFee}`}
              </Text>
              <TouchableOpacity
                style={styles.calloutButton}
                onPress={() => navigation.navigate('ShowDetail', { showId: show.id })}
              >
                <Text style={styles.calloutButtonText}>View Details</Text>
              </TouchableOpacity>
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
        <View style={styles.filterInfoContainer}>
            <Text style={styles.filterInfoText}>
                Showing shows within 25 miles
            </Text>
            <TouchableOpacity style={styles.filterButton} onPress={() => setFilterVisible(true)}>
                <Ionicons name="filter" size={18} color="#007AFF" />
                <Text style={styles.filterButtonText}>Filter</Text>
            </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Finding nearby shows...</Text>
            </View>
        ) : error && !shows.length ? (
            <View style={styles.errorContainer}>
                 <Text style={styles.errorText}>{error}</Text>
                 <TouchableOpacity style={styles.retryButton} onPress={() => fetchShows()}>
                     <Text style={styles.retryButtonText}>Retry</Text>
                 </TouchableOpacity>
            </View>
        ) : (
            <MapShowCluster
                ref={mapRef}
                region={currentRegion}
                shows={shows}
                onCalloutPress={handleShowPress}
                onRegionChangeComplete={handleRegionChangeComplete}
            />
        )}

      <TouchableOpacity
        style={styles.myLocationButton}
        onPress={centerOnUserLocation}
      >
        <Ionicons name="locate" size={24} color="#007AFF" />
      </TouchableOpacity>

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
  mapContainer: {
    flex: 1,
    height: height,
    position: 'relative',
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
  filterButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  filterInfoContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 10, // Ensure it's on top
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
    zIndex: 10,
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
  /* Makes address appear as a clickable link */
  addressLink: {
    color: '#0066CC',
    textDecorationLine: 'underline',
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  retryButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
  },
  emptyStateContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeFiltersContainer: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    zIndex: 10,
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
  filtersAppliedContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    marginVertical: 8,
    borderRadius: 4,
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
  },
  filtersAppliedText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
});

export default MapScreen;
