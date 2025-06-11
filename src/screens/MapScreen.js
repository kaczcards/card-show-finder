import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getCardShowsByLocation } from '../services/firebaseApi';

// Get screen dimensions for aspect ratio calculation
const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

const MapScreen = () => {
  const navigation = useNavigation();
  const mapRef = useRef(null);
  
  // State declarations
  const [cardShows, setCardShows] = useState([]);
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedShow, setSelectedShow] = useState(null);
  const [region, setRegion] = useState({
    latitude: 41.8781, // Default to Chicago
    longitude: -87.6298,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  });

  // Format date function
  const formatDate = (date) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date instanceof Date ? date.toLocaleDateString('en-US', options) : 'Date unavailable';
  };

  // Request location permissions and get current location + nearby shows
  useEffect(() => {
    const fetchShowsByLocation = async () => {
      try {
        setLoading(true);
        
        // Request location permission
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          setLoading(false);
          return;
        }

        // Get current location
        let currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        setLocation(currentLocation);
        
        // Update region to center on user's location
        const userRegion = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        };
        
        setRegion(userRegion);
        
        // Fetch card shows near user location
        const { shows, error } = await getCardShowsByLocation(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          50 // radius in miles
        );
        
        if (error) {
          setErrorMsg(`Error fetching card shows: ${error}`);
          return;
        }
        
        if (shows && Array.isArray(shows)) {
          setCardShows(shows);
        } else {
          setCardShows([]);
        }
        
      } catch (error) {
        console.error("Map location error:", error);
        setErrorMsg('Could not determine your location or load nearby shows');
      } finally {
        setLoading(false);
      }
    };
    
    fetchShowsByLocation();
  }, []);

  // Function to calculate distance between two coordinates in miles
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return "Distance unavailable";
    
    const R = 3958.8; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return `${distance.toFixed(1)} miles away`;
  };

  // Show all markers on the map
  const showAllMarkers = () => {
    if (!mapRef.current || cardShows.length === 0) return;
    
    try {
      const coordinates = cardShows
        .filter(show => show.coordinate && show.coordinate.latitude && show.coordinate.longitude)
        .map(show => ({
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
      
      if (coordinates.length > 0) {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      console.error("Error showing all markers:", error);
    }
  };

  // Center map on user's location
  const centerOnUserLocation = () => {
    if (!location || !mapRef.current) {
      Alert.alert('Location not available', 'Your current location could not be determined.');
      return;
    }
    
    try {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: LATITUDE_DELTA / 4, // Zoom in a bit more
        longitudeDelta: LONGITUDE_DELTA / 4,
      }, 1000);
    } catch (error) {
      console.error("Error centering on user location:", error);
    }
  };

  // Handle marker press
  const handleMarkerPress = (show) => {
    setSelectedShow(show);
  };

  // Retry loading
  const handleRetry = () => {
    setErrorMsg(null);
    setLoading(true);
    // Re-run the effect
    navigation.replace('Map');
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
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={true}
        rotateEnabled={true}
        onMapReady={showAllMarkers}
      >
        {cardShows.map((show) => (
          show.coordinate && show.coordinate.latitude && show.coordinate.longitude ? (
            <Marker
              key={show.id}
              coordinate={{
                latitude: show.coordinate.latitude,
                longitude: show.coordinate.longitude
              }}
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
                onPress={() => navigation.navigate('ShowDetails', { show })}
              >
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle}>{show.title}</Text>
                  <Text style={styles.calloutLocation}>{show.location}</Text>
                  <Text style={styles.calloutDate}>
                    {formatDate(show.date)}
                  </Text>
                  
                  {location && show.coordinate && (
                    <Text style={styles.calloutDistance}>
                      {calculateDistance(
                        location.coords.latitude,
                        location.coords.longitude,
                        show.coordinate.latitude,
                        show.coordinate.longitude
                      )}
                    </Text>
                  )}
                  
                  <View style={styles.calloutBadgeContainer}>
                    <View style={styles.priceBadge}>
                      <Text style={styles.badgeText}>{show.entryFee}</Text>
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
          {cardShows.length} card {cardShows.length === 1 ? 'show' : 'shows'} found
        </Text>
        <Text style={styles.infoSubtext}>
          Tap on a marker to see details
        </Text>
      </View>
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
});

export default MapScreen;