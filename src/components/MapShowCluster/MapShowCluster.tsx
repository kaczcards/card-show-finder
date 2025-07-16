import React, { useState, forwardRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Marker, Callout } from 'react-native-maps';
import FixedClusteredMapView from 'react-native-maps-super-cluster';
import { Show } from '../../types';
import { formatDate, formatEntryFee } from '../../utils/formatters';
import { sanitizeCoordinates } from '../../utils/coordinateUtils'; 
import { debounce } from '../../utils/helpers';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../supabase';

/**
 * MapShowCluster Component
 * 
 * An enhanced map view that displays shows as markers with clustering support.
 * Includes improvements for performance and UX, such as:
 * - Optimized marker rendering with tracksViewChanges=false
 * - LiteMode for Android for better performance
 * - Coordinate sanitization to handle invalid/swapped coordinates
 * - Debounced navigation to prevent multiple taps
 * - Platform-specific address handling
 * - Added visual feedback for button presses
 */
interface MapShowClusterProps {
  shows: Show[];
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  onRegionChangeComplete?: (region: any) => void;
  onCalloutPress?: (show: Show) => void;
  loadingEnabled?: boolean;
  showsUserLocation?: boolean;
  showsCompass?: boolean;
  showsScale?: boolean;
  provider?: 'google' | undefined;
  organizerProfiles?: Record<string, any>;
}

// Type for organizer profile with social media links
interface OrganizerProfile {
  id: string;
  firstName: string;
  lastName?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  whatnotUrl?: string;
  ebayStoreUrl?: string;
}

const MapShowCluster = forwardRef<any, MapShowClusterProps>(({
  shows,
  region,
  onRegionChangeComplete,
  onCalloutPress,
  loadingEnabled = true,
  showsUserLocation = true,
  showsCompass = true,
  showsScale = true,
  provider = undefined,
  organizerProfiles = {},
}, ref) => {
  const [pressedShowId, setPressedShowId] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const navigation = useNavigation<any>();
  
  // Function to open maps with native app
  const openMaps = (address: string) => {
    if (!address) return;

    // Use platform-specific URL scheme
    const scheme = Platform.select({ 
      ios: 'maps:?q=', 
      android: 'geo:0,0?q=' 
    });
    const encodedAddress = encodeURIComponent(address);
    const url = `${scheme}${encodedAddress}`;

    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          // Fallback to Google Maps in browser
          const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
          return Linking.openURL(webUrl);
        }
      })
      .catch(() => {
        Alert.alert('Error', 'Could not open maps application.');
      });
  };

  // Function to open any URL
  const openUrl = (url: string) => {
    if (!url) return;

    // Add https:// if missing
    const httpsUrl = url.startsWith('http') ? url : `https://${url}`;

    Linking.canOpenURL(httpsUrl)
      .then(supported => {
        if (supported) {
          return Linking.openURL(httpsUrl);
        } else {
          console.warn(`Cannot open URL: ${httpsUrl}`);
        }
      })
      .catch(err => {
        console.error('Error opening URL:', err);
      });
  };

  // Debounced navigation function
  const navigateToShow = debounce((showId: string) => {
    if (isNavigating) return;
    
    setIsNavigating(true);
    setPressedShowId(showId);
    
    try {
      const selectedShow = shows.find(show => show.id === showId);
      if (selectedShow && onCalloutPress) {
        onCalloutPress(selectedShow);
      }
    } catch (error) {
      console.error('Error navigating to show:', error);
      Alert.alert('Error', 'Could not navigate to show details.');
    } finally {
      // Reset state after navigation (with slight delay for visual feedback)
      setTimeout(() => {
        setIsNavigating(false);
        setPressedShowId(null);
      }, 300);
    }
  }, 500);

  // Render an individual marker
  const renderMarker = (show: Show) => {
    const safeCoords = sanitizeCoordinates(show.coordinates);
    if (!safeCoords) {
      return null;
    }

    // Get organizer profile if available
    const organizer = show.organizerId ? organizerProfiles[show.organizerId] : null;
    
    // Check if this show's button is currently pressed
    const isPressed = pressedShowId === show.id;

    return (
      <Marker
        key={show.id}
        coordinate={{
          latitude: safeCoords.latitude,
          longitude: safeCoords.longitude,
        }}
        title={show.title}
        description={`${formatDate(show.startDate)} • ${formatEntryFee(show.entryFee).replace('Entry: ', '')}`}
        pinColor="#007AFF"
        tracksViewChanges={false} // Performance optimization: prevents unnecessary re-renders
      >
        <Callout tooltip>
          <View style={styles.calloutContainer}>
            <Text style={styles.calloutTitle}>{show.title}</Text>
            <Text style={styles.calloutDetail}>
              {formatDate(show.startDate)}
              {new Date(show.startDate).toDateString() !== new Date(show.endDate).toDateString() && 
                ` - ${formatDate(show.endDate)}`}
            </Text>
            <TouchableOpacity 
              onPress={() => openMaps(show.address)}
              activeOpacity={0.7}
              style={styles.addressContainer}
            >
              <Text style={styles.addressLink}>{show.address}</Text>
            </TouchableOpacity>
            <Text style={styles.calloutDetail}>
              {formatEntryFee(show.entryFee)}
            </Text>
            
            {/* Social Media Links */}
            {organizer && (
              <View style={styles.socialLinksContainer}>
                {organizer.facebookUrl && (
                  <TouchableOpacity 
                    style={styles.socialIconButton} 
                    onPress={() => openUrl(organizer.facebookUrl)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="logo-facebook" size={20} color="#1877F2" />
                  </TouchableOpacity>
                )}
                
                {organizer.instagramUrl && (
                  <TouchableOpacity 
                    style={styles.socialIconButton} 
                    onPress={() => openUrl(organizer.instagramUrl)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="logo-instagram" size={20} color="#C13584" />
                  </TouchableOpacity>
                )}
                
                {organizer.twitterUrl && (
                  <TouchableOpacity 
                    style={styles.socialIconButton} 
                    onPress={() => openUrl(organizer.twitterUrl)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="logo-twitter" size={20} color="#1DA1F2" />
                  </TouchableOpacity>
                )}
                
                {organizer.whatnotUrl && (
                  <TouchableOpacity 
                    style={styles.socialIconButton} 
                    onPress={() => openUrl(organizer.whatnotUrl)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="cart-outline" size={20} color="#FF001F" />
                  </TouchableOpacity>
                )}
                
                {organizer.ebayStoreUrl && (
                  <TouchableOpacity 
                    style={styles.socialIconButton} 
                    onPress={() => openUrl(organizer.ebayStoreUrl)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pricetag-outline" size={20} color="#E53238" />
                  </TouchableOpacity>
                )}
              </View>
            )}
            
            <TouchableOpacity
              style={[
                styles.calloutButton,
                isPressed && styles.calloutButtonPressed
              ]}
              onPress={() => navigateToShow(show.id)}
              activeOpacity={0.6}
              disabled={isNavigating}
            >
              <Text style={styles.calloutButtonText}>
                {isPressed ? 'Opening...' : 'View Details'}
              </Text>
            </TouchableOpacity>
          </View>
        </Callout>
      </Marker>
    );
  };

  // Render a cluster
  const renderCluster = (cluster: any, onPress: () => void) => {
    const { pointCount, coordinate } = cluster;
    
    return (
      <Marker 
        coordinate={coordinate} 
        onPress={onPress}
        tracksViewChanges={false} // Performance optimization
      >
        <View style={styles.clusterContainer}>
          <Text style={styles.clusterText}>{pointCount}</Text>
        </View>
      </Marker>
    );
  };

  // Convert Show objects to points for the clusterer
  const showToPoint = (show: Show) => {
    const safeCoords = sanitizeCoordinates(show.coordinates);
    if (!safeCoords) {
      return null;
    }

    return {
      location: {
        latitude: safeCoords.latitude,
        longitude: safeCoords.longitude,
      },
      properties: {
        point_count: 0,
        ...show,
      },
    };
  };

  // Filter valid shows with coordinates
  const validShows = shows.filter(show => 
    show && 
    show.coordinates && 
    typeof show.coordinates.latitude === 'number' && 
    typeof show.coordinates.longitude === 'number'
  );

  // Add zoom controls
  const handleZoom = (zoomIn = true) => {
    if (
      ref &&
      // @ts-ignore – ref comes from forwardRef<any>
      ref.current &&
      typeof ref.current.getMapRef === 'function'
    ) {
      // FixedClusteredMapView exposes getMapRef() which returns the underlying MapView
      const mapView = ref.current.getMapRef();
      if (mapView) {
        // Determine zoom factor
        const factor = zoomIn ? 0.5 : 2; // smaller delta ⇒ zoom-in

        // Calculate new region based on current prop `region`
        const newRegion = {
          latitude: region.latitude,
          longitude: region.longitude,
          latitudeDelta: region.latitudeDelta * factor,
          longitudeDelta: region.longitudeDelta * factor,
        };

        // Animate the map to the new region
        mapView.animateToRegion(newRegion, 300);
      }
    }
  };

  return (
    <View style={styles.container}>
      <FixedClusteredMapView
        ref={ref}
        style={styles.map}
        data={validShows}
        initialRegion={region}
        region={region}
        renderMarker={renderMarker}
        renderCluster={renderCluster}
        showsUserLocation={showsUserLocation}
        loadingEnabled={loadingEnabled}
        showsCompass={showsCompass}
        showsScale={showsScale}
        provider={provider}
        onRegionChangeComplete={onRegionChangeComplete}
        clusteringEnabled={true}
        spiralEnabled={true}
        zoomEnabled={true}
        minZoom={4}
        maxZoom={20}
        edgePadding={{ top: 50, left: 50, bottom: 50, right: 50 }}
        animateClusters={true}
        spiderLineColor="#007AFF"
        accessor="coordinates"
        clusterPressMaxChildren={50}
        nodeExtractor={showToPoint}
        liteMode={Platform.OS === 'android'} // Use LiteMode on Android for better performance
      />
      <View style={styles.zoomControls}>
        <TouchableOpacity 
          style={styles.zoomButton} 
          onPress={() => handleZoom(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.zoomButtonText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.zoomButton} 
          onPress={() => handleZoom(false)}
          activeOpacity={0.7}
        >
          <Text style={styles.zoomButtonText}>-</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  calloutContainer: {
    width: 240, // Increased from 220 for better readability
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16, // Increased from 12 for better touch targets
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
  addressContainer: {
    marginBottom: 4,
    paddingVertical: 4, // Added padding for better touch target
  },
  addressLink: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4,
    textDecorationLine: 'underline',
  },
  socialLinksContainer: {
    flexDirection: 'row',
    marginVertical: 8,
    justifyContent: 'center',
  },
  socialIconButton: {
    width: 40, // Increased from 36 for better touch target
    height: 40, // Increased from 36 for better touch target
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  calloutButton: {
    backgroundColor: '#007AFF',
    borderRadius: 6, // Slightly increased for better visual
    paddingVertical: 10, // Increased from 6 for better touch target
    paddingHorizontal: 12, // Added horizontal padding
    alignItems: 'center',
    marginTop: 10, // Increased from 8
    minHeight: 44, // Minimum height for better touchability (Apple's recommendation)
    justifyContent: 'center',
  },
  calloutButtonPressed: {
    backgroundColor: '#0056b3', // Darker blue when pressed
    transform: [{ scale: 0.98 }], // Slight scale down for press feedback
  },
  calloutButtonText: {
    color: 'white',
    fontSize: 15, // Slightly increased from 14
    fontWeight: '600', // Increased from 500
  },
  clusterContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  clusterText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  zoomControls: {
    position: 'absolute',
    top: 50,
    right: 15,
    backgroundColor: 'transparent',
  },
  zoomButton: {
    width: 44, // Increased from 40 for better touch target
    height: 44, // Increased from 40 for better touch target
    backgroundColor: 'white',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  zoomButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
});

export default MapShowCluster;
