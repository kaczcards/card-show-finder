import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  Image
} from 'react-native';
import MapView, {
  Marker,
  Callout,
  PROVIDER_GOOGLE,
  Circle,
} from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getCardShowsByLocation } from '../services/firebaseApi';
import { useUser } from '../context/UserContext';

// Get screen dimensions for aspect ratio calculation
const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
// Widen default view so 25-mi radius is visible
const LATITUDE_DELTA = 0.5;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

// Initial search radius (miles) - using a slightly larger initial radius to ensure we get results
const INITIAL_SEARCH_RADIUS = 40; // Start with a larger radius then filter down to 25 miles
const DISPLAY_RADIUS = 25; // The radius we actually want to display to users

const MapScreen = () => {
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const { userProfile } = useUser();
  
  // State declarations
  const [cardShows, setCardShows] = useState([]);
  const [unfilteredShows, setUnfilteredShows] = useState([]); // Store all shows before filtering
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // map pull-to-refresh
  const [selectedShow, setSelectedShow] = useState(null);
  const [locationSource, setLocationSource] = useState('unknown'); // Track which location source we're using
  const [region, setRegion] = useState({
    latitude: 41.8781, // Default to Chicago
    longitude: -87.6298,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  });

  // Format date function with error handling
  const formatDate = (date) => {
    try {
      if (!date) return 'Date unavailable';
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return date instanceof Date ? date.toLocaleDateString('en-US', options) : new Date(date).toLocaleDateString('en-US', options);
    } catch (err) {
      console.error('Error formatting date:', err);
      return 'Date unavailable';
    }
  };

  // Helper: convert US ZIP → lat/lon via Zippopotam.us
  const zipToCoords = async (zip) => {
    if (!zip) {
      console.log('No zip code provided');
      return null;
    }
    
    try {
      console.log(`Converting zip code ${zip} to coordinates...`);
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
      
      if (!res.ok) {
        console.log(`Zip code API returned error status: ${res.status}`);
        return null;
      }
      
      const data = await res.json();
      const place = data.places?.[0];
      
      if (!place) {
        console.log('No place data found for zip code');
        return null;
      }
      
      const coords = {
        latitude: parseFloat(place.latitude),
        longitude: parseFloat(place.longitude),
      };
      
      console.log(`Successfully converted zip ${zip} to:`, coords);
      return coords;
    } catch (error) {
      console.error('Error in zipToCoords:', error);
      return null;
    }
  };

  // Function to safely parse dates with error handling
  const safelyParseDate = (dateValue) => {
    if (!dateValue) return null;
    
    try {
      // If it's already a Date object, return it
      if (dateValue instanceof Date && !isNaN(dateValue)) {
        return dateValue;
      }
      
      // If it's a string, try to parse it
      if (typeof dateValue === 'string') {
        const parsed = new Date(dateValue);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
      
      // If it's a timestamp number, convert it
      if (typeof dateValue === 'number') {
        const parsed = new Date(dateValue);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
      
      console.warn('Could not parse date:', dateValue);
      return null;
    } catch (error) {
      console.error('Error parsing date:', error);
      return null;
    }
  };

  // Filter shows by date range (next 30 days)
  const filterShowsByDate = (shows) => {
    if (!Array.isArray(shows)) {
      console.warn('Shows is not an array in filterShowsByDate');
      return [];
    }
    
    console.log(`Filtering ${shows.length} shows by date...`);
    
    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 30); // Next 30 days
    
    console.log(`Date range: ${now.toISOString()} to ${end.toISOString()}`);
    
    const filtered = shows.filter(show => {
      try {
        if (!show.date) {
          console.log(`Show ${show.id || 'unknown'} has no date`);
          return false;
        }
        
        const showDate = safelyParseDate(show.date);
        if (!showDate) {
          console.log(`Could not parse date for show ${show.id || 'unknown'}`);
          return false;
        }
        
        const isInRange = showDate >= now && showDate <= end;
        if (!isInRange) {
          console.log(`Show ${show.id || 'unknown'} date ${showDate.toISOString()} is outside range`);
        }
        
        return isInRange;
      } catch (error) {
        console.error(`Error filtering show ${show.id || 'unknown'} by date:`, error);
        return false;
      }
    });
    
    console.log(`Date filtering result: ${filtered.length} shows remain`);
    return filtered;
  };

  // Function to calculate distance between two coordinates in miles
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      console.log('Missing coordinates for distance calculation');
      return "Distance unavailable";
    }
    
    try {
      const R = 3958.8; // Earth's radius in miles
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      return {
        value: distance,
        formatted: `${distance.toFixed(1)} miles away`
      };
    } catch (error) {
      console.error('Error calculating distance:', error);
      return { value: null, formatted: "Distance unavailable" };
    }
  };

  // Filter shows by distance (25 miles)
  const filterShowsByDistance = (shows, userLocation, maxDistance = DISPLAY_RADIUS) => {
    if (!Array.isArray(shows)) {
      console.warn('Shows is not an array in filterShowsByDistance');
      return [];
    }
    
    if (!userLocation?.coords?.latitude || !userLocation?.coords?.longitude) {
      console.warn('Invalid user location for distance filtering');
      return shows; // Return all shows if we can't filter
    }
    
    console.log(`Filtering ${shows.length} shows by distance (${maxDistance} miles)...`);
    
    const filtered = shows.filter(show => {
      try {
        if (!show.coordinate || !show.coordinate.latitude || !show.coordinate.longitude) {
          console.log(`Show ${show.id || 'unknown'} has no valid coordinates`);
          return false;
        }
        
        const distance = calculateDistance(
          userLocation.coords.latitude,
          userLocation.coords.longitude,
          show.coordinate.latitude,
          show.coordinate.longitude
        );
        
        // Store the distance on the show object for display
        show.distance = distance.formatted;
        show.distanceValue = distance.value;
        
        const isInRange = distance.value <= maxDistance;
        if (!isInRange) {
          console.log(`Show ${show.id || 'unknown'} distance ${distance.formatted} exceeds ${maxDistance} miles`);
        }
        
        return isInRange;
      } catch (error) {
        console.error(`Error filtering show ${show.id || 'unknown'} by distance:`, error);
        return false;
      }
    });
    
    console.log(`Distance filtering result: ${filtered.length} shows remain`);
    return filtered;
  };

  // Main fetcher so we can reuse for refresh
  const fetchShowsByLocation = async () => {
    try {
      setLoading(true);
      let determinedLocation = null;

      // --- 1) Try zip code ------------------------------------------------
      if (userProfile?.zipCode) {
        console.log(`Attempting to use zip code from profile: ${userProfile.zipCode}`);
        const coords = await zipToCoords(userProfile.zipCode);
        
        if (coords) {
          console.log('Successfully determined location from zip code');
          determinedLocation = { coords };
          setLocationSource('zipCode');
        } else {
          console.log('Failed to convert zip code to coordinates');
        }
      } else {
        console.log('No zip code found in user profile');
      }

      // --- 2) Fallback to device GPS -------------------------------------
      if (!determinedLocation) {
        console.log('Attempting to use device GPS');
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status === 'granted') {
          console.log('Location permission granted, getting current position');
          try {
            const gpsLoc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            
            determinedLocation = gpsLoc;
            setLocationSource('gps');
            console.log('Successfully determined location from GPS:', determinedLocation.coords);
          } catch (gpsError) {
            console.error('Error getting GPS location:', gpsError);
          }
        } else {
          console.log('Location permission denied');
        }
      }

      // --- 3) Final fallback: Chicago default ----------------------------
      if (!determinedLocation) {
        console.log('Using default Chicago location');
        determinedLocation = {
          coords: { latitude: 41.8781, longitude: -87.6298 },
        };
        setLocationSource('default');
        setErrorMsg(
          'Using default location (Chicago) – enable location services or add ZIP in profile for better results.'
        );
      }

      setLocation(determinedLocation);
      console.log('Final determined location:', determinedLocation.coords);

      // Center map
      const newRegion = {
        latitude: determinedLocation.coords.latitude,
        longitude: determinedLocation.coords.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      };
      
      setRegion(newRegion);
      console.log('Setting map region:', newRegion);

      // Fetch nearby shows with a slightly larger radius to ensure we get results
      console.log(`Fetching shows within ${INITIAL_SEARCH_RADIUS} miles of determined location...`);
      const { shows, error } = await getCardShowsByLocation(
        determinedLocation.coords.latitude,
        determinedLocation.coords.longitude,
        INITIAL_SEARCH_RADIUS // Use larger initial radius
      );
      
      if (error) {
        console.error('Error fetching card shows:', error);
        setErrorMsg(`Error fetching card shows: ${error}`);
        return;
      }
      
      if (!shows || !Array.isArray(shows)) {
        console.warn('No shows returned or shows is not an array');
        setCardShows([]);
        setUnfilteredShows([]);
        return;
      }
      
      console.log(`Received ${shows.length} shows from API`);
      setUnfilteredShows(shows);
      
      // Filter shows by date (next 30 days)
      const dateFiltered = filterShowsByDate(shows);
      
      // Then filter by actual display distance (25 miles)
      const distanceFiltered = filterShowsByDistance(dateFiltered, determinedLocation);
      
      console.log(`Final filtered result: ${distanceFiltered.length} shows to display`);
      setCardShows(distanceFiltered);
      
      // Ensure we fit all markers on the map after data is loaded
      setTimeout(() => {
        showAllMarkers();
      }, 500);
      
    } catch (error) {
      console.error("Map location error:", error);
      setErrorMsg('Could not determine your location or load nearby shows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('MapScreen mounted, fetching shows...');
    fetchShowsByLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh handler
  const refreshMap = async () => {
    console.log('Refreshing map...');
    try {
      setRefreshing(true);
      await fetchShowsByLocation();
    } catch (error) {
      console.error('Error refreshing map:', error);
      Alert.alert('Error', 'Failed to refresh map data');
    } finally {
      setRefreshing(false);
    }
  };

  // Show all markers on the map
  const showAllMarkers = () => {
    if (!mapRef.current) {
      console.log('Map reference not available');
      return;
    }
    
    if (!cardShows.length) {
      console.log('No card shows to display on map');
      centerOnUserLocation(); // Center on user if no shows
      return;
    }
    
    try {
      console.log(`Attempting to fit ${cardShows.length} markers on map`);
      
      // Filter out shows with invalid coordinates
      const validShows = cardShows.filter(show => 
        show.coordinate && 
        typeof show.coordinate.latitude === 'number' && 
        typeof show.coordinate.longitude === 'number'
      );
      
      console.log(`Found ${validShows.length} shows with valid coordinates`);
      
      if (validShows.length === 0) {
        console.log('No valid coordinates found in shows');
        centerOnUserLocation(); // Center on user if no valid coordinates
        return;
      }
      
      const coordinates = validShows.map(show => ({
        latitude: show.coordinate.latitude,
        longitude: show.coordinate.longitude
      }));
      
      // Add user location if available
      if (location && location.coords) {
        coordinates.push({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
      
      console.log(`Fitting map to ${coordinates.length} coordinates`);
      
      // Ensure we have valid coordinates before calling fitToCoordinates
      if (coordinates.length > 0) {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      } else {
        console.log('No coordinates to fit, centering on user location');
        centerOnUserLocation();
      }
    } catch (error) {
      console.error("Error showing all markers:", error);
      // Fallback to centering on user location
      centerOnUserLocation();
    }
  };

  // Center map on user's location
  const centerOnUserLocation = () => {
    if (!location || !location.coords || !mapRef.current) {
      console.log('Cannot center on user location - location or map ref not available');
      Alert.alert('Location not available', 'Your current location could not be determined.');
      return;
    }
    
    try {
      console.log('Centering map on user location');
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: LATITUDE_DELTA / 2,
        longitudeDelta: LONGITUDE_DELTA / 2,
      }, 1000);
    } catch (error) {
      console.error("Error centering on user location:", error);
      Alert.alert('Error', 'Failed to center map on your location');
    }
  };

  // Handle marker press
  const handleMarkerPress = (show) => {
    console.log('Marker pressed for show:', show.title);
    setSelectedShow(show);
  };

  // Retry loading
  const handleRetry = () => {
    console.log('Retrying map load...');
    setErrorMsg(null);
    setLoading(true);
    fetchShowsByLocation(); // Use our function instead of navigation.replace
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading map and nearby shows...</Text>
      </View>
    );
  }

  // Error state
  if (errorMsg) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={48} color="#dc3545" />
        <Text style={styles.errorText}>{errorMsg}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={true}
        rotateEnabled={true}
        onMapReady={() => {
          console.log('Map is ready');
          showAllMarkers();
        }}
      >
        {/* 25-mile radius circle */}
        {location?.coords && (
          <Circle
            center={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude
            }}
            radius={40233.6}           /* 25 miles in meters */
            strokeWidth={1}
            strokeColor="rgba(52,152,219,0.4)"
            fillColor="rgba(52,152,219,0.15)"
          />
        )}
        
        {cardShows.map((show) => (
          show.coordinate && show.coordinate.latitude && show.coordinate.longitude ? (
            <Marker
              key={show.id}
              coordinate={{
                latitude: show.coordinate.latitude,
                longitude: show.coordinate.longitude
              }}
              tracksViewChanges={false}
              title={show.title}
              description={show.location}
              onPress={() => handleMarkerPress(show)}
            >
              <View style={styles.markerContainer}>
                <View style={styles.markerIconContainer}>
                  <Ionicons name="calendar" size={18} color="#fff" />
                </View>
                <View style={styles.markerArrow} />
              </View>
              
              <Callout
                tooltip
                onPress={() => {
                  console.log('Navigating to show details:', show.title);
                  navigation.navigate('ShowDetails', { show });
                }}
              >
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle}>{show.title}</Text>
                  <Text style={styles.calloutLocation}>{show.location}</Text>
                  <Text style={styles.calloutDate}>
                    {formatDate(show.date)}
                  </Text>
                  
                  {location && show.coordinate && (
                    <Text style={styles.calloutDistance}>
                      {show.distance || calculateDistance(
                        location.coords.latitude,
                        location.coords.longitude,
                        show.coordinate.latitude,
                        show.coordinate.longitude
                      ).formatted}
                    </Text>
                  )}
                  
                  <View style={styles.calloutBadgeContainer}>
                    <View style={styles.priceBadge}>
                      <Text style={styles.badgeText}>{show.entryFee || 'Free'}</Text>
                    </View>
                    {show.rating && (
                      <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={10} color="#fff" />
                        <Text style={styles.badgeText}>{show.rating}</Text>
                      </View>
                    )}
                  </View>
                  
                  <TouchableOpacity style={styles.calloutButton}>
                    <Text style={styles.calloutButtonText}>Show Details</Text>
                  </TouchableOpacity>
                </View>
              </Callout>
            </Marker>
          ) : null
        ))}
      </MapView>
      
      {/* Map Controls */}
      <View style={styles.mapControls}>
        {/* Refresh Button */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={refreshMap}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#3498db" />
          ) : (
            <Ionicons name="refresh" size={24} color="#3498db" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={showAllMarkers}
        >
          <Ionicons name="expand" size={24} color="#3498db" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={centerOnUserLocation}
        >
          <Ionicons name="locate" size={24} color="#3498db" />
        </TouchableOpacity>
      </View>
      
      {/* Info Card */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          {cardShows.length} card {cardShows.length === 1 ? 'show' : 'shows'} found within 25 miles in the next 30 days
        </Text>
        <Text style={styles.infoSubtext}>
          {locationSource === 'zipCode' ? 'Using your zip code location' : 
           locationSource === 'gps' ? 'Using your current GPS location' : 
           'Using default location'}
        </Text>
      </View>
      
      {/* No Shows Found Overlay - only show when we have a location but no shows */}
      {location && cardShows.length === 0 && !loading && (
        <View style={styles.noShowsContainer}>
          <View style={styles.noShowsCard}>
            <Ionicons name="calendar-outline" size={60} color="#6c757d" />
            <Text style={styles.noShowsTitle}>No Card Shows Found</Text>
            <Text style={styles.noShowsMessage}>
              There are no upcoming card shows within 25 miles in the next 30 days.
            </Text>
            <Text style={styles.noShowsMessage}>
              Try refreshing or checking back later.
            </Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refreshMap}
            >
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerIconContainer: {
    backgroundColor: '#3498db',
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#3498db',
    transform: [{ rotate: '180deg' }],
    marginTop: -2,
  },
  calloutContainer: {
    width: 220,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  calloutLocation: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  calloutDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  calloutDistance: {
    fontSize: 12,
    color: '#28a745',
    marginBottom: 6,
  },
  calloutBadgeContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  priceBadge: {
    backgroundColor: '#28a745',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginRight: 6,
  },
  ratingBadge: {
    backgroundColor: '#f39c12',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  calloutButton: {
    backgroundColor: '#3498db',
    borderRadius: 4,
    paddingVertical: 6,
    alignItems: 'center',
  },
  calloutButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mapControls: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    alignItems: 'center',
  },
  controlButton: {
    backgroundColor: '#fff',
    borderRadius: 30,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  infoContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#212529',
  },
  infoSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  // No Shows Found styles
  noShowsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  noShowsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    width: '80%',
    maxWidth: 300,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  noShowsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginTop: 16,
    marginBottom: 8,
  },
  noShowsMessage: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 8,
  },
  refreshButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default MapScreen;
