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
import * as Location from 'expo-location';
import { useAuth } from '../../contexts/AuthContext';
import { getShows } from '../../services/showService';
import { getCurrentLocation, getZipCodeCoordinates } from '../../services/locationService';
import { Show, ShowFilters, Coordinates } from '../../types';

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
        let coordinates: Coordinates | null = null;

        // If user has a home ZIP code, use that
        if (user?.homeZipCode) {
          const zipData = await getZipCodeCoordinates(user.homeZipCode);
          if (zipData) {
            coordinates = zipData.coordinates;
          }
        }

        // If no ZIP code or couldn't get coordinates from ZIP, try current location
        if (!coordinates) {
          coordinates = await getCurrentLocation();
        }

        // If we have coordinates, set the initial region
        if (coordinates) {
          setUserLocation(coordinates);
          setInitialRegion({
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            latitudeDelta: 0.1, // Zoom level
            longitudeDelta: 0.1, // Zoom level
          });
        } else {
          // Default to US center if no location available
          setInitialRegion({
            latitude: 39.8283,
            longitude: -98.5795,
            latitudeDelta: 40, // Zoomed out to show most of US
            longitudeDelta: 40,
          });
          Alert.alert(
            'Location Not Available',
            'Unable to determine your location. Please enable location access or set your home ZIP code in your profile.'
          );
        }
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

  // Fetch shows based on location or ZIP code
  const fetchShows = useCallback(async () => {
    try {
      setLoading(true);
      let showsData: Show[] = [];
      let locationCoords: Coordinates | null = null;

      // If user has a home ZIP code, use that
      if (user?.homeZipCode) {
        const zipData = await getZipCodeCoordinates(user.homeZipCode);
        if (zipData) {
          locationCoords = zipData.coordinates;
        }
      } else {
        // Otherwise, try to get current location
        locationCoords = await getCurrentLocation();
      }

      const currentFilters: ShowFilters = { ...filters };
      if (locationCoords) {
        currentFilters.latitude = locationCoords.latitude;
        currentFilters.longitude = locationCoords.longitude;
      }

      showsData = await getShows(currentFilters);

      setShows(showsData);
    } catch (error) {
      console.error('Error fetching shows:', error);
      Alert.alert('Error', 'Failed to load card shows. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, userLocation, filters]);

  // Load shows when screen is focused or filters change
  useFocusEffect(
    useCallback(() => {
      if (initialRegion) {
        fetchShows();
      }
    }, [fetchShows, initialRegion])
  );

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<ShowFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setFilterVisible(false);
  };

  // Navigate to show detail
  const handleShowPress = (showId: string) => {
    navigation.navigate('ShowDetail', { showId });
  };

  // Center map on user location
  const centerOnUserLocation = async () => {
    try {
      const location = await getCurrentLocation();
      if (location && mapRef.current) {
        setUserLocation(location);
        mapRef.current.animateToRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }, 1000);
      } else {
        Alert.alert(
          'Location Not Available',
          'Unable to determine your location. Please enable location access.'
        );
      }
    } catch (error) {
      console.error('Error centering on user location:', error);
      Alert.alert('Error', 'Failed to get your current location.');
    }
  };

  // Format date for callout
  const formatDate = (dateValue: Date | string) => {
    const date = new Date(dateValue);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Render map markers
  const renderMarkers = () => {
    return shows.map((show) => (
      show.coordinates && (
        <Marker
          key={show.id}
          coordinate={{
            latitude: show.coordinates.latitude,
            longitude: show.coordinates.longitude,
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
                {new Date(show.startDate).toDateString() !== new Date(show.endDate).toDateString() && ` - ${formatDate(show.endDate)}`}
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
      )
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

          {/* Filter Sheet - To be implemented later */}
          {/* <FilterSheet
            visible={filterVisible}
            onClose={() => setFilterVisible(false)}
            filters={filters}
            onApplyFilters={handleFilterChange}
          /> */}
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
