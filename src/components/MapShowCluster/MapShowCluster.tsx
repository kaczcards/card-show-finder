import React, {
  useState,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
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
import SocialIcon from '../ui/SocialIcon';
// Fallback map components that gracefully degrade when the native
// react-native-maps module isn't available (e.g. running in Expo Go).
import {
  Marker,
  Callout,
  FixedClusteredMapView,
} from '../MapFallback';
import { Show } from '../../types';
import { formatDate, formatEntryFee } from '../../utils/formatters';
import { sanitizeCoordinates } from '../../utils/coordinateUtils'; 
import { debounce } from '../../utils/helpers';
import { useNavigation } from '@react-navigation/native';
import { supabase as _supabase } from '../../supabase';
import {
  openExternalLink,
  DEFAULT_WHITELIST_HOSTS,
} from '../../utils/safeLinking';

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
  onCalloutPress?: (showId: string) => void;
  loadingEnabled?: boolean;
  showsUserLocation?: boolean;
  showsCompass?: boolean;
  showsScale?: boolean;
  provider?: 'google' | undefined;
  organizerProfiles?: Record<string, any>;
}

// Methods exposed to parent components via ref
export interface MapShowClusterHandle {
  getMapRef: () => any | null;
}

const MapShowCluster = forwardRef<MapShowClusterHandle, MapShowClusterProps>(({
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
  /* ------------------------------------------------------------------
   *  High-level render diagnostics
   * ------------------------------------------------------------------ */
  const renderTimestamp = new Date().toISOString();
  const currentShowCount =
    Array.isArray(shows) ? shows.length : 0;

  // Log every render with show count & timestamp
  if (__DEV__) {
    console.warn(
      `[MapShowCluster] Render @ ${renderTimestamp} – received ${currentShowCount} show(s)`
    );
  }

  // Track previous show count to detect prop changes
  const prevShowsCountRef = useRef<number>(currentShowCount);

  // Track the first time we get a non-empty shows array
  const firstNonEmptyLoggedRef = useRef<boolean>(false);

  useEffect(() => {
    if (prevShowsCountRef.current !== currentShowCount) {
      if (__DEV__) {
        console.warn(
          `[MapShowCluster] shows prop changed: ${prevShowsCountRef.current} → ${currentShowCount} @ ${new Date().toISOString()}`
        );
      }
      prevShowsCountRef.current = currentShowCount;
    }

    if (
      !firstNonEmptyLoggedRef.current &&
      currentShowCount > 0
    ) {
      if (__DEV__) {
        console.warn(
          '[MapShowCluster] First non-empty shows array received – initial timing issue should be resolved'
        );
      }
      firstNonEmptyLoggedRef.current = true;
    }
  }, [currentShowCount]);

  const [pressedShowId, setPressedShowId] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const navigation = useNavigation<any>();

  // Ref for the underlying FixedClusteredMapView instance
  const mapRef = useRef<any>(null);

  // Expose imperative methods to parent components
  useImperativeHandle(ref, () => ({
    getMapRef: () => mapRef.current?.getMapRef?.() ?? null,
  }));
  
  // Function to open maps with native app
  const _openMaps = (address: string) => {
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
          return openExternalLink(webUrl);
        }
      })
      .catch(() => {
        Alert.alert('Error', 'Could not open maps application.');
      });
  };

  // Function to open any URL
  const openUrl = (url: string) => {
    // Centralised safe-link handler with whitelist protection
    openExternalLink(url, { whitelistHosts: DEFAULT_WHITELIST_HOSTS });
  };

  // Debounced navigation function with enhanced debugging
  const navigateToShow = debounce((showId: string) => {
    if (__DEV__) {
      console.warn('[DEBUG] View Details button pressed for show ID:', showId);
      console.warn('[DEBUG] Current navigation state:', { isNavigating, pressedShowId });
    }
    
    // If already navigating, ignore subsequent clicks
    if (isNavigating) {
      if (__DEV__) {
        console.warn('[DEBUG] Navigation already in progress, ignoring click');
      }
      return;
    }
    
    if (__DEV__) {
      console.warn('[DEBUG] Setting navigation state to active');
    }
    setIsNavigating(true);
    setPressedShowId(showId);
    
    try {
      if (__DEV__) {
        console.warn('[DEBUG] Looking for show with ID:', showId);
      }
      const selectedShow = shows.find(show => show.id === showId);
      
      if (!selectedShow) {
        console.error('[DEBUG] Show not found with ID:', showId);
        Alert.alert('Error', 'Could not find show details.');
        return;
      }
      
      if (__DEV__) {
        console.warn('[DEBUG] Found show:', selectedShow.title);
      }
      
      if (onCalloutPress) {
        if (__DEV__) {
          console.warn('[DEBUG] Using provided onCalloutPress handler');
        }
        onCalloutPress(selectedShow.id);
      } else if (navigation) {
        // Fallback to direct navigation if onCalloutPress is not provided
        if (__DEV__) {
          console.warn('[DEBUG] onCalloutPress not provided, using direct navigation');
          console.warn('[DEBUG] Navigation object available:', !!navigation);
          console.warn('[DEBUG] Navigation state:', Object.keys(navigation));
        }
        
        try {
          if (__DEV__) {
            console.warn('[DEBUG] Attempting to navigate to ShowDetail screen');
          }
          navigation.navigate('ShowDetail', { showId });
        } catch (navError) {
          console.error('[DEBUG] Navigation error:', navError);
          Alert.alert('Error', 'Failed to navigate to show details screen.');
        }
      } else {
        console.error('[DEBUG] No navigation method available');
        Alert.alert('Error', 'Cannot navigate to show details at this time.');
      }
    } catch (error) {
      console.error('[DEBUG] Error in navigateToShow:', error);
      Alert.alert('Error', 'Could not navigate to show details.');
    } finally {
      // Reset state after navigation (with slight delay for visual feedback)
      if (__DEV__) {
        console.warn('[DEBUG] Setting timeout to reset navigation state');
      }
      setTimeout(() => {
        if (__DEV__) {
          console.warn('[DEBUG] Resetting navigation state');
        }
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
        {/* Entire callout is now clickable — navigates to ShowDetail */}
        <Callout
          onPress={() => {
            if (__DEV__) {
              console.warn('[DEBUG] Callout pressed for show:', show.title);
            }
            navigateToShow(show.id);
          }}
          tooltip
        >
          <View style={styles.calloutContainer}>
            <Text style={styles.calloutTitle}>{show.title}</Text>
            <Text style={styles.calloutDetail}>
              {formatDate(show.startDate)}
              {new Date(show.startDate).toDateString() !== new Date(show.endDate).toDateString() && 
                ` - ${formatDate(show.endDate)}`}
            </Text>
            {/* Address rendered as text only. Nested pressables inside Callout
               are unreliable across platforms. */}
            <View style={styles.addressContainer}>
              <Text style={styles.addressLink}>{show.address}</Text>
            </View>
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
                  <SocialIcon
                    platform="whatnot"
                    onPress={() => openUrl(organizer.whatnotUrl)}
                    style={styles.socialIconButton}
                  />
                )}
                
                {organizer.ebayStoreUrl && (
                  <SocialIcon
                    platform="ebay"
                    onPress={() => openUrl(organizer.ebayStoreUrl)}
                    style={styles.socialIconButton}
                  />
                )}
              </View>
            )}
            
            {/* Button kept for visual cue – Callout handles the actual press */}
            <TouchableOpacity
              style={[
                styles.calloutButton,
                isPressed && styles.calloutButtonPressed
              ]}
              /* No onPress here; handled by parent Callout */
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

  /* ------------------------------------------------------------------
   * Coordinate-based filtering (with DEBUG logging)
   * ------------------------------------------------------------------ */
  const totalShows = Array.isArray(shows) ? shows.length : 0;

  const validShows = shows.filter(
    (show) =>
      show &&
      show.coordinates &&
      typeof show.coordinates.latitude === 'number' &&
      typeof show.coordinates.longitude === 'number'
  );

  const invalidShows = shows.filter(
    (show) =>
      !show ||
      !show.coordinates ||
      typeof show.coordinates.latitude !== 'number' ||
      typeof show.coordinates.longitude !== 'number'
  );

  // Debug output (only in development to avoid noisy production logs)
  if (__DEV__) {
    console.warn(
      `[MapShowCluster] Total shows received: ${totalShows}. ` +
        `Valid coordinates: ${validShows.length}. ` +
        `Invalid / missing coordinates: ${invalidShows.length}.`
    );

    if (invalidShows.length > 0) {
      console.warn('[MapShowCluster] Shows filtered out due to invalid coordinates:');
      invalidShows.forEach((s) =>
        console.warn(
          `  • "${s?.title ?? 'Unknown'}" (ID: ${s?.id ?? 'n/a'}) — coordinates:`,
          s?.coordinates
        )
      );
    }
  }

  // Add zoom controls
  const handleZoom = (zoomIn = true) => {
    if (mapRef.current && typeof mapRef.current.getMapRef === 'function') {
      // FixedClusteredMapView exposes getMapRef() which returns the underlying MapView
      const mapView = mapRef.current.getMapRef();
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
        ref={mapRef}
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
