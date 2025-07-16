import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Marker, Callout, Region } from 'react-native-maps';
// Use our patched version that renames deprecated lifecycle methods
import FixedClusteredMapView from '../FixedClusteredMapView';
import { Show, Coordinates } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';

interface MapShowClusterProps {
  shows: Show[];
  onShowPress: (showId: string) => void;
  region: Region;
  showsUserLocation?: boolean;
  loadingEnabled?: boolean;
  showsCompass?: boolean;
  showsScale?: boolean;
  provider?: 'google' | undefined;
  onRegionChangeComplete?: (region: Region) => void;
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

  /* ------------------------------------------------------------------
   * Utility – Validate / auto-correct possibly swapped coordinates
   * ------------------------------------------------------------------
   * Returns:
   *   • corrected { latitude, longitude } if valid
   *   • null if coordinates are unusable
   * ------------------------------------------------------------------ */
  const sanitizeCoordinates = (coords?: Coordinates | null): Coordinates | null => {
    if (
      !coords ||
      typeof coords.latitude !== 'number' ||
      typeof coords.longitude !== 'number'
    ) {
      return null;
    }

    const { latitude, longitude } = coords;
    const latValid = latitude >= -90 && latitude <= 90;
    const lngValid = longitude >= -180 && longitude <= 180;

    // Already valid
    if (latValid && lngValid) return coords;

    // Attempt swap
    const swappedLat = longitude;
    const swappedLng = latitude;
    const swappedLatValid = swappedLat >= -90 && swappedLat <= 90;
    const swappedLngValid = swappedLng >= -180 && swappedLng <= 180;

    if (swappedLatValid && swappedLngValid) {
      console.warn(`Fixed swapped coordinates for a show: lat=${latitude}, lng=${longitude} → lat=${swappedLat}, lng=${swappedLng}`);
      return { latitude: swappedLat, longitude: swappedLng };
    }

    // Still invalid – give up
    console.error(`Invalid coordinates: lat=${latitude}, lng=${longitude}. Cannot display this show on the map.`);
    return null;
  };

  // Helper function to open a URL
  const openUrl = (url: string | undefined) => {
    if (!url) return;
    
    // Ensure URL has a protocol
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    
    Linking.canOpenURL(finalUrl)
      .then(supported => {
        if (supported) {
          Linking.openURL(finalUrl);
        } else {
          console.error(`Cannot open URL: ${finalUrl}`);
          Alert.alert('Error', 'Cannot open this URL');
        }
      })
      .catch(err => {
        console.error('Error opening URL:', err);
        Alert.alert('Error', 'Could not open the link');
      });
  };

  // Helper function to open address in maps app
  const openMaps = (address: string) => {
    if (!address) {
      console.log('No address provided to openMaps');
      return;
    }

    console.log('Opening map location for address:', address);

    try {
      const scheme = Platform.select({ ios: 'maps:?q=', android: 'geo:0,0?q=' });
      const encodedAddress = encodeURIComponent(address);
      const url = `${scheme}${encodedAddress}`;

      console.log('Attempting to open URL:', url);

      Linking.openURL(url).catch(err => {
        console.error('Error opening native maps app:', err);

        // Fallback: open Google Maps in the browser
        const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          address,
        )}`;
        console.log('Falling back to web URL:', webUrl);

        Linking.openURL(webUrl).catch(e => {
          console.error('Error opening maps in browser:', e);
          Alert.alert('Error', 'Could not open maps application.');
        });
      });
    } catch (error) {
      console.error('Error processing maps URL:', error);
      Alert.alert('Error', 'Could not open maps application.');
    }
  };

  const {
    shows,
    onShowPress,
    region,
    showsUserLocation = true,
    loadingEnabled = true,
    showsCompass = true,
    showsScale = true,
    provider = 'google',
    onRegionChangeComplete
  } = props;

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

  // Helper function to format entry fee
  const formatEntryFee = (fee: number | string | null | undefined) => {
    // Treat any "zero-ish" / missing value as free admission
    if (
      fee === 0 ||
      fee === '0' ||
      fee === null ||
      fee === undefined ||
      fee === '' ||
      isNaN(Number(fee))
    ) {
      return 'Free Entry';
    }
    return `Entry: $${fee}`;
  };

  /**
   * Debounced navigation handler to prevent double-clicks
   * Uses a combination of state tracking and timeout to ensure
   * the navigation action only happens once per user intent
   */
  const navigateToShow = useCallback((showId: string) => {
    // If already navigating, ignore subsequent clicks
    if (isNavigating) {
      console.log('Navigation already in progress, ignoring click');
      return;
    }
    
    console.log('View Details button pressed for show ID:', showId);
    
    // Set visual feedback and prevent double-clicks
    setIsNavigating(true);
    setPressedShowId(showId);
    
    // Add a small delay for visual feedback before navigation
    setTimeout(() => {
      try {
        if (props.onShowPress) {
          console.log('Using parent onShowPress handler');
          props.onShowPress(showId);
        } else if (navigation) {
          // Fallback: navigate directly using React Navigation
          console.log('Using navigation fallback to ShowDetail screen');
          navigation.navigate('ShowDetail', { showId });
        } else {
          console.error('No navigation method available');
          Alert.alert('Error', 'Cannot navigate to show details at this time.');
        }
      } catch (err) {
        console.error('Error during navigation:', err);
      } finally {
        // Reset state after navigation (with slight delay to prevent rapid re-clicks)
        setTimeout(() => {
          setIsNavigating(false);
          setPressedShowId(null);
        }, 300);
      }
    }, 50); // Small delay for visual feedback
  }, [props.onShowPress, navigation, isNavigating]);

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
