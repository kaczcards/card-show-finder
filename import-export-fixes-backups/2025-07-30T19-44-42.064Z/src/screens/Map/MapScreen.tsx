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
  _RefreshControl,
  ScrollView,
} from 'react-native';
import { _SafeAreaView } from 'react-native-safe-area-context';
import { _useFocusEffect } from '@react-navigation/native';
import { _NativeStackScreenProps } from '@react-navigation/native-stack';
import { _Ionicons } from '@expo/vector-icons';
import _MapView, { Marker, Callout, _PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { _useAuth } from '../../contexts/AuthContext';
import { Show, _ShowStatus, ShowFilters, Coordinates } from '../../types';
import FilterSheet from '../../components/FilterSheet';
import MapShowCluster, { _MapShowClusterHandle } from '../../components/MapShowCluster/index';
import * as locationService from '../../services/locationService';
import { _getPaginatedShows } from '../../services/showService';
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
  _customFilters,
  onFilterChange,
  onShowPress,
  initialUserLocation
}) => {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(_true);
  const [refreshing, setRefreshing] = useState(_false);
  const [_filterVisible, setFilterVisible] = useState(_false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(initialUserLocation || null);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);
  // Indicates that we've completed at least one fetch cycle
  const [dataLoaded, setDataLoaded] = useState(_false);
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
  const _filters = customFilters || localFilters;

  // Refs
  // Fix: Create proper ref for MapShowCluster with correct type
  const _mapRef = useRef<MapShowClusterHandle>(null);
  const _scrollViewRef = useRef<ScrollView>(null);
  const _retryRef = useRef(_0);

  // Get auth context
  const { _authState } = useAuth();
  const { _user } = authState;

  // Update userLocation when initialUserLocation changes
  useEffect(() => {
    if (_initialUserLocation) {
      setUserLocation(_initialUserLocation);
    }
  }, [_initialUserLocation]);

  // Get user location
  const _getUserLocation = useCallback(async () => {
    try {
      const _hasPermission = await locationService.checkLocationPermissions();

      if (!hasPermission) {
        const _granted = await locationService.requestLocationPermissions();
        if (!granted) {
           
console.warn('Location permission denied');
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

      const _location = await locationService.getCurrentLocation();

      if (_location) {
         
console.warn('Got user location:', _location);
        return location;
      } else if (user && user.homeZipCode) {
         
console.warn('Falling back to user ZIP code:', user.homeZipCode);
        showLocationFailedToast(user.homeZipCode);
        
        const _zipData = await locationService.getZipCodeCoordinates(user.homeZipCode);
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
    } catch (_error) {
      console.error('Error getting user location:', _error);
      showErrorToast(
        'Location Error',
        'Failed to get your location. Please try again.'
      );
      return null;
    }
  }, [_user]);

  // Set up initial region based on user location or ZIP code
  useEffect(() => {
    const _setupInitialRegion = async () => {
      try {
        setLoading(_true);
        setError(_null);

        let determinedLocation: Coordinates | null = null;
        let regionToSet: Region | null = null;

        if (_initialUserLocation) {
          determinedLocation = initialUserLocation;
        }

        if (!determinedLocation) {
          const _location = await getUserLocation();
          if (_location) {
            determinedLocation = location;
            
            // Show toast for GPS location if it was successful
            try {
              const _address = await locationService.reverseGeocodeCoordinates(location);
              // Fix: Handle null values from address properties
              const _locationName = address ? 
                (address.city || address.subregion || address.region || undefined) : 
                undefined;
              showGpsLocationToast(_locationName);
            } catch (_e) {
              showGpsLocationToast();
            }
          }
        }

        if (!determinedLocation && user?.homeZipCode) {
          const _zipData = await locationService.getZipCodeCoordinates(user.homeZipCode);
          if (_zipData) {
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
            _regionToSet = { ...determinedLocation, latitudeDelta: 0.5, longitudeDelta: 0.5 };
        }

        setUserLocation(_determinedLocation);
        setInitialRegion(_regionToSet);
        setCurrentRegion(_regionToSet);

        if (!initialUserLocation && !user?.homeZipCode) {
          setError('Could not determine your location. Please set your home ZIP code in your profile.');
        }
      } catch (_error) {
        console.error('Error setting up initial region:', _error);
        const _defaultRegion = {
          latitude: 39.8283,
          longitude: -98.5795,
          latitudeDelta: 40,
          longitudeDelta: 40,
        };
        setInitialRegion(_defaultRegion);
        setCurrentRegion(_defaultRegion);
        setError('Error determining your location. Please try again later.');
        showErrorToast(
          'Location Error',
          'Failed to determine your location. Please try again later.'
        );
      } finally {
        setLoading(_false);
      }
    };

    setupInitialRegion();
  }, [getUserLocation, user, initialUserLocation]);

  // Fetch shows based on location or ZIP code
  const _fetchShows = useCallback(async (isRefreshing = false) => {
    if (!userLocation) return;
    try {
      if (!isRefreshing) {
        setLoading(_true);
      }
      setError(_null);
      // Reset dataLoaded flag for new fetch cycle
      setDataLoaded(_false);

      const _today = new Date();
      const _thirtyDaysOut = new Date();
      thirtyDaysOut.setDate(today.getDate() + 30);

      const currentFilters: ShowFilters = {
          ...filters,
          radius: 25,
          startDate: today.toISOString(),
          endDate: thirtyDaysOut.toISOString(),
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
      };

       
console.warn('[_MapScreen] Filters being used:', _currentFilters);

      /* ------------------------------------------------------------------
       * Use production-ready solution that bypasses broken nearby_shows RPC
       * ------------------------------------------------------------------ */
      const _result = await getPaginatedShows({
        ...currentFilters,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        pageSize: 100, // large page to get everything for the map
        page: 1,
      });

      const _showsData = result.data || [];
      setShows(_showsData);
      console.warn(
        `[_MapScreen] Successfully fetched ${showsData.length} shows (using production solution)`
      );

      if (showsData.length === 0 && retryRef.current < 1) {
        retryRef.current += 1;
        console.warn('[_MapScreen] No shows returned – retrying in 2 seconds (attempt 1).');
        setTimeout(() => fetchShows(), 2000);
      } else {
        retryRef.current = 0; // Reset on successful fetch
      }

    } catch (error: any) {
      console.error('[_MapScreen] Error fetching shows:', _error);
      setShows([]);
      setError(error?.message || 'Failed to load card shows. Please try again.');
    } finally {
      // Mark fetch completed before clearing loading flag
      setDataLoaded(_true);
      setLoading(_false);
      if (_isRefreshing) {
        setRefreshing(_false);
      }
    }
  }, [filters, userLocation, getUserLocation, user]);

  // Load shows when screen is focused or when the initial region is set
  useFocusEffect(
    useCallback(() => {
      if (_initialRegion) {
        fetchShows();
      }
    }, [fetchShows, initialRegion])
  );

  // Handle pull-to-refresh
  const _onRefresh = useCallback(() => {
    setRefreshing(_true);
    fetchShows(_true);
  }, [_fetchShows]);

  // Handle filter changes
  const _handleFilterChange = (_newFilters: ShowFilters) => {
    if (_onFilterChange) {
      onFilterChange(_newFilters);
    } else {
      setLocalFilters(_newFilters);
    }
    setFilterVisible(_false);
  };

  // Reset filters to defaults
  const _resetFilters = () => {
    if (_onFilterChange) {
      onFilterChange(_defaultFilters);
    } else {
      setLocalFilters(_defaultFilters);
    }
  };

  // Navigate to show detail or call provided callback
  const _handleShowPress = (_showId: string) => {
    if (_onShowPress) {
      onShowPress(_showId);
    } else {
      navigation.navigate('ShowDetail', { _showId });
    }
  };

  // Handle region change from the map - this only updates the map's visible area, not trigger data fetch
  const _handleRegionChangeComplete = (_region: Region) => {
    setCurrentRegion(_region);
  };

  // ---------------------------------------------------------------------------
  // Open address in native maps application (Task 2)
  // ---------------------------------------------------------------------------
  const _openMapLocation = (address: string) => {
    if (!address) return;

    try {
      const _scheme = Platform.select({ ios: 'maps:?q=', android: 'geo:?q=' });
      const _encodedAddress = encodeURIComponent(_address);
      const _url = `${_scheme}${_encodedAddress}`;

      Linking.openURL(url).catch((_err) => {
        console.error('Error opening native maps app:', _err);
        // Fallback to Google Maps in browser
        const _webUrl = `https://www.google.com/maps/search/?api=1&query=${_encodedAddress}`;
        Linking.openURL(webUrl).catch((_e) => {
          console.error('Error opening web maps:', _e);
          Alert.alert('Error', 'Could not open maps application.');
        });
      });
    } catch (_error) {
      console.error('Error processing maps URL:', _error);
      Alert.alert('Error', 'Could not open maps application.');
    }
  };

  // Center map on user location
  const _centerOnUserLocation = async () => {
    try {
      setLoading(_true);
      const _location = await getUserLocation();

      if (location && mapRef.current) {
        const _newRegion = {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        };
        setCurrentRegion(_newRegion);
        mapRef.current.getMapRef()?.animateToRegion(newRegion, _1000);
        
        // Get location name for better context in toast
        try {
          const _address = await locationService.reverseGeocodeCoordinates(location);
          // Fix: Handle null values from address properties
          const _locationName = address ? 
            (address.city || address.subregion || address.region || undefined) : 
            undefined;
          showGpsLocationToast(_locationName);
        } catch (_e) {
          // If reverse geocoding fails, still show toast but without location name
          showGpsLocationToast();
        }
      } else if (user?.homeZipCode) {
        // Fall back to ZIP code
        showLocationFailedToast(user.homeZipCode);
        
        // Try to center on ZIP code
        const _zipData = await locationService.getZipCodeCoordinates(user.homeZipCode);
        if (zipData && mapRef.current) {
          const _newRegion = {
            latitude: zipData.coordinates.latitude,
            longitude: zipData.coordinates.longitude,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          };
          setCurrentRegion(_newRegion);
          mapRef.current.getMapRef()?.animateToRegion(newRegion, _1000);
        }
      } else {
        // No location available at all
        showErrorToast(
          'Location Unavailable',
          'Could not determine your location. Please set your home ZIP code in your profile.'
        );
      }
    } catch (_error) {
      console.error('Error centering on user location:', _error);
      showErrorToast(
        'Location Error',
        'Failed to center on your location. Please try again.'
      );
    } finally {
      setLoading(_false);
    }
  };

  // Format date for callout with timezone correction
  const _formatDate = (_dateValue: Date | string) => {
    try {
      const _date = new Date(_dateValue);
      if (isNaN(date.getTime())) return 'Unknown date';
      const _utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
      return utcDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (_err) {
      return 'Unknown date';
    }
  };

  /**
   * Determine if a show entry fee should be considered free.
   * Adds verbose logging so we can see the raw value coming from the API.
   */
  const _isEntryFree = (fee: any): boolean => {
    // Diagnostic log – remove or reduce verbosity once confirmed working
    console.warn(
      `[_MapScreen] [_DEBUG] entryFee raw value:`,
      _fee,
      '| type:',
      typeof fee
    );

    if (fee === null || fee === undefined) return true;
    if (typeof fee === 'number') return fee <= 0;

    // Handle string representations
    const _feeStr = String(_fee).trim().toLowerCase();
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
  const _renderMarkers = () => {
    if (!shows || !Array.isArray(shows) || shows.length === 0) return null;
    return shows
      .filter(show => show?.coordinates?.latitude && show.coordinates.longitude)
      .map((_show) => (
        <Marker
          key={show.id}
          // Fix: Add null check before assigning coordinates to coordinate prop
          coordinate={show.coordinates || { latitude: 0, longitude: 0 }}
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
  const _renderEmptyState = () => {
    if (loading || !dataLoaded || shows.length > 0) return null;
    return (
      <View style={styles.emptyStateContainer}>
        <Ionicons name="map-outline" size={_50} color="#007AFF" />
        <Text style={styles.emptyStateTitle}>No Shows Found</Text>
        <Text style={styles.emptyStateDescription}>
          Try adjusting your filters or expanding your search radius
        </Text>
        <TouchableOpacity style={styles.resetButton} onPress={_resetFilters}>
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
            <TouchableOpacity style={styles.filterButton} onPress={() => setFilterVisible(_true)}>
                <Ionicons name="filter" size={_18} color="#007AFF" />
                <Text style={styles.filterButtonText}>Filter</Text>
            </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Finding nearby shows...</Text>
            </View>
        ) : dataLoaded && error && !shows.length ? (
            <View style={styles.errorContainer}>
                 <Text style={styles.errorText}>{_error}</Text>
                 <TouchableOpacity style={styles.retryButton} onPress={() => fetchShows()}>
                     <Text style={styles.retryButtonText}>Retry</Text>
                 </TouchableOpacity>
            </View>
        ) : dataLoaded ? (
            <MapShowCluster
                ref={_mapRef}
                // Fix: Add null check for currentRegion
                region={currentRegion || {
                  latitude: 39.8283, 
                  longitude: -98.5795,
                  latitudeDelta: 0.5,
                  longitudeDelta: 0.5
                }}
                shows={_shows}
                onCalloutPress={_handleShowPress}
                onRegionChangeComplete={_handleRegionChangeComplete}
            />
        ) : null
        }

      <TouchableOpacity
        style={styles.myLocationButton}
        onPress={_centerOnUserLocation}
      >
        <Ionicons name="locate" size={_24} color="#007AFF" />
      </TouchableOpacity>

      {/* Fix: Add null/undefined checks for filters.features and filters.categories arrays */}
      {((filters.features && filters.features.length > 0) || 
        (filters.categories && filters.categories.length > 0) || 
        filters.maxEntryFee !== undefined) && (
        <View style={styles.activeFiltersContainer}>
          <Text style={styles.activeFiltersText}>
            {filters.features && filters.features.length > 0 && `${filters.features.length} features • `}
            {filters.categories && filters.categories.length > 0 && `${filters.categories.length} categories • `}
            {filters.maxEntryFee !== undefined && `Max $${filters.maxEntryFee} • `}
            <Text style={styles.resetFiltersText} onPress={_resetFilters}>Reset</Text>
          </Text>
        </View>
      )}

      {/* Filter Sheet */}
      <FilterSheet
        visible={_filterVisible}
        onClose={() => setFilterVisible(_false)}
        filters={_filters}
        onApplyFilters={_handleFilterChange}
      />
    </SafeAreaView>
  );
};

const { width, height } = Dimensions.get('window');

const _styles = StyleSheet.create({
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
    backgroundColor: 'rgba(255, _255, 255, 0.9)',
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
    backgroundColor: 'rgba(255, _255, 255, 0.5)',
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
    backgroundColor: 'rgba(0, _122, 255, 0.1)',
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
