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
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useAuth } from '../../contexts/AuthContext';
import { Show, ShowStatus, ShowFilters, Coordinates } from '../../types';
import { getShows } from '../../services/showService';
import {
  getCurrentLocation,
  getZipCodeCoordinates,
} from '../../services/locationService';
import FilterSheet from '../../components/FilterSheet';

// Define the main stack param list type
type MainStackParamList = {
  MainTabs: undefined;
  ShowDetail: { showId: string };
};

type Props = NativeStackScreenProps<MainStackParamList>;

const MapScreen: React.FC<Props> = ({ navigation }) => {
  // State
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterVisible, setFilterVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [filters, setFilters] = useState<ShowFilters>({
    radius: 25, // Default radius: 25 miles
    startDate: new Date(), // Default start date: today
    endDate: new Date(new Date().setDate(new Date().getDate() + 30)), // Default end date: 30 days from now
  });

  // Refs
  const mapRef = useRef<MapView>(null);

  // Get auth context
  const { authState } = useAuth();
  const { user } = authState;

  // Set up initial region based on user location or ZIP code
  useEffect(() => {
    const setupInitialRegion = async () => {
      try {
        /* ---- 1) Try live GPS ---- */
        const gps = await getCurrentLocation();
        if (gps) {
          setUserLocation(gps);
          setInitialRegion({
            latitude: gps.latitude,
            longitude: gps.longitude,
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
          });
          return;
        }

        /* ---- 2) Fallback to profile ZIP ---- */
        if (user?.homeZipCode) {
          const zipData = await getZipCodeCoordinates(user.homeZipCode);
          if (zipData) {
            setInitialRegion({
              latitude: zipData.coordinates.latitude,
              longitude: zipData.coordinates.longitude,
              latitudeDelta: 2,
              longitudeDelta: 2,
            });
            return;
          }
        }

        /* ---- 3) Final fallback – US center ---- */
        setInitialRegion({
          latitude: 39.8283,
          longitude: -98.5795,
          latitudeDelta: 40,
          longitudeDelta: 40,
        });
      } catch (error) {
        console.error('Error setting up initial region:', error);
        // Default to US center if error
        setInitialRegion({
          latitude: 39.8283,
          longitude: -98.5795,
          latitudeDelta: 40,
          longitudeDelta: 40,
        });
      }
    };

    setupInitialRegion();
  }, [user]);

  /**
   * fetchShows
   *
   * Retrieves shows from the backend using the current filter state and the
   * user's location when available. Passes location data and radius to the
   * showService, enabling geo-spatial queries on the database. This function:
   *
   * 1. Copies the current filters to a new object
   * 2. Adds the user's location coordinates when available
   * 3. Calls the API with all relevant filters
   * 4. Updates the local shows state with the results
   *
   * The function handles errors gracefully, showing appropriate alerts and
   * ensuring the shows state is always a valid array.
   */
  const fetchShows = useCallback(async () => {
    try {
      setLoading(true);
      
      console.log('[MapScreen] Fetching shows using showService');
      
      // Create a copy of the filters to modify
      const currentFilters: ShowFilters = { ...filters };
      
      // If we have user location, use it
      if (userLocation) {
        currentFilters.latitude = userLocation.latitude;
        currentFilters.longitude = userLocation.longitude;
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
      Alert.alert(
        'Error', 
        `Failed to load card shows. ${error?.message ? `\n\nDetails: ${error.message}` : 'Please try again.'}`
      );
    } finally {
      setLoading(false);
    }
  }, [filters, userLocation]);

  // Load shows when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (initialRegion) {
        fetchShows();
      }
    }, [fetchShows, initialRegion])
  );

  /* ------------------------------------------------------------------
   * Re-run query whenever the user changes filter options or when we
   * obtain a fresh GPS fix.  We guard with `initialRegion` so we don’t
   * fire while the map is still initializing (e.g., first app launch).
   * ---------------------------------------------------------------- */
  useEffect(() => {
    if (initialRegion) {
      fetchShows();
    }
  }, [filters, userLocation, initialRegion, fetchShows]);

  // Handle filter changes
  /**
   * handleFilterChange
   *
   * Merges the newly-selected values into the existing `filters` state.
   * The `useEffect` above listens for changes to `filters` and will
   * automatically trigger a fresh show fetch, so we don’t need to call
   * `fetchShows` directly here.
   */
  const handleFilterChange = (newFilters: Partial<ShowFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setFilterVisible(false);
  };

  // Navigate to show detail
  const handleShowPress = (showId: string) => {
    navigation.navigate('ShowDetail', { showId });
  };

  // Center map on user location
  /**
   * centerOnUserLocation
   *
   * Requests the user’s current coordinates, updates local state so that
   * subsequent show queries use the fresh location, and smoothly animates
   * the map camera to the user’s position.  If permissions are denied we
   * present a helpful alert prompting the user to enable them.
   */
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

      setUserLocation(gps); // update state so future fetches use fresh coords

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: gps.latitude,
            longitude: gps.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0922,
          },
          500
        );
      }
    } catch (error) {
      console.error('Error centering on user location:', error);
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
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={initialRegion}
              showsUserLocation
              showsMyLocationButton={false}
              showsCompass
              showsScale
              loadingEnabled
            >
              {renderMarkers()}
            </MapView>
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
});

export default MapScreen;
