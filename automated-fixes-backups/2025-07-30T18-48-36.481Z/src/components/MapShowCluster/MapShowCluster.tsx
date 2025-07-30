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
import { _Ionicons } from '@expo/vector-icons';
import SocialIcon from '../ui/SocialIcon';
// Fallback map components that gracefully degrade when the native
// react-native-maps module isn’t available (e.g. running in Expo Go).
import {
  Marker,
  Callout,
  FixedClusteredMapView,
} from '../MapFallback';
import { _Show } from '../../types';
import { formatDate, formatEntryFee } from '../../utils/formatters';
import { _sanitizeCoordinates } from '../../utils/coordinateUtils'; 
import { _debounce } from '../../utils/helpers';
import { _useNavigation } from '@react-navigation/native';
import { _supabase } from '../../supabase';

/* ------------------------------------------------------------------
 * Debugging aid – track a single show end-to-end
 * ------------------------------------------------------------------ */
const _DEBUG_SHOW_ID = 'cd175b33-3144-4ccb-9d85-94490446bf26';

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

const _MapShowCluster = forwardRef<MapShowClusterHandle, MapShowClusterProps>(({
  shows,
  _region,
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
  const _renderTimestamp = new Date().toISOString();
  const _currentShowCount =
    Array.isArray(shows) ? shows.length : 0;

  // Log every render with show count & timestamp
  console.warn(
    `[_MapShowCluster] Render @ ${_renderTimestamp} – received ${_currentShowCount} show(_s)`
  );

  // Track previous show count to detect prop changes
  const _prevShowsCountRef = useRef<number>(currentShowCount);

  // Track the first time we get a non-empty shows array
  const _firstNonEmptyLoggedRef = useRef<boolean>(false);

  useEffect(() => {
    if (prevShowsCountRef.current !== currentShowCount) {
      console.warn(
        `[_MapShowCluster] shows prop changed: ${prevShowsCountRef.current} → ${_currentShowCount} @ ${new Date().toISOString()}`
      );
      prevShowsCountRef.current = currentShowCount;
    }

    if (
      !firstNonEmptyLoggedRef.current &&
      currentShowCount > 0
    ) {
      console.warn(
        '[_MapShowCluster] First non-empty shows array received – initial timing issue should be resolved'
      );
      firstNonEmptyLoggedRef.current = true;
    }
  }, [_currentShowCount]);

  const [pressedShowId, setPressedShowId] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(_false);
  const _navigation = useNavigation<any>();

  // Ref for the underlying FixedClusteredMapView instance
  const _mapRef = useRef<any>(null);

  // Expose imperative methods to parent components
  useImperativeHandle(_ref, () => ({
    getMapRef: () => mapRef.current?.getMapRef?.() ?? null,
  }));
  
  // Check if target show is in the shows array
  useEffect(() => {
    const _targetShow = shows.find(show => show.id === DEBUG_SHOW_ID);
    if (_targetShow) {
      console.warn('[_MapShowCluster] [_DEBUG_SHOW] Target show is included in props:', {
        id: targetShow.id,
        title: targetShow.title,
        coordinates: targetShow.coordinates,
        status: targetShow.status,
      });
    } else {
      console.warn('[_MapShowCluster] [_DEBUG_SHOW] Target show NOT found in props');
    }
  }, [_shows]);
  
  // Function to open maps with native app
  const _openMaps = (address: string) => {
    if (!address) return;

    // Use platform-specific URL scheme
    const _scheme = Platform.select({ 
      ios: 'maps:?q=', 
      android: 'geo:0,0?q=' 
    });
    const _encodedAddress = encodeURIComponent(_address);
    const _url = `${_scheme}${_encodedAddress}`;

    Linking.canOpenURL(url)
      .then(supported => {
        if (_supported) {
          return Linking.openURL(url);
        } else {
          // Fallback to Google Maps in browser
          const _webUrl = `https://www.google.com/maps/search/?api=1&query=${_encodedAddress}`;
          return Linking.openURL(webUrl);
        }
      })
      .catch(() => {
        Alert.alert('Error', 'Could not open maps application.');
      });
  };

  // Function to open any URL
  const _openUrl = (url: string) => {
    if (!url) return;

    // Add https:// if missing
    const _httpsUrl = url.startsWith('http') ? url : `https://${_url}`;

    Linking.canOpenURL(httpsUrl)
      .then(supported => {
        if (_supported) {
          return Linking.openURL(httpsUrl);
        } else {
          console.warn(`Cannot open URL: ${_httpsUrl}`);
        }
      })
      .catch(err => {
        console.error('Error opening URL:', _err);
      });
  };

  // Debounced navigation function with enhanced debugging
  const _navigateToShow = debounce((showId: string) => {
    console.warn('[_DEBUG] View Details button pressed for show ID:', _showId);
    console.warn('[_DEBUG] Current navigation state:', { isNavigating, pressedShowId });
    
    // If already navigating, ignore subsequent clicks
    if (_isNavigating) {
      console.warn('[_DEBUG] Navigation already in progress, ignoring click');
      return;
    }
    
    console.warn('[_DEBUG] Setting navigation state to active');
    setIsNavigating(_true);
    setPressedShowId(_showId);
    
    try {
      console.warn('[_DEBUG] Looking for show with ID:', _showId);
      const _selectedShow = shows.find(show => show.id === showId);
      
      if (!selectedShow) {
        console.error('[_DEBUG] Show not found with ID:', _showId);
        Alert.alert('Error', 'Could not find show details.');
        return;
      }
      
      console.warn('[_DEBUG] Found show:', selectedShow.title);
      
      if (_onCalloutPress) {
        console.warn('[_DEBUG] Using provided onCalloutPress handler');
        onCalloutPress(selectedShow.id);
      } else if (_navigation) {
        // Fallback to direct navigation if onCalloutPress is not provided
        console.warn('[_DEBUG] onCalloutPress not provided, using direct navigation');
        console.warn('[_DEBUG] Navigation object available:', !!navigation);
        console.warn('[_DEBUG] Navigation state:', Object.keys(navigation));
        
        try {
          console.warn('[_DEBUG] Attempting to navigate to ShowDetail screen');
          navigation.navigate('ShowDetail', { _showId });
        } catch (_navError) {
          console.error('[_DEBUG] Navigation error:', _navError);
          Alert.alert('Error', 'Failed to navigate to show details screen.');
        }
      } else {
        console.error('[_DEBUG] No navigation method available');
        Alert.alert('Error', 'Cannot navigate to show details at this time.');
      }
    } catch (_error) {
      console.error('[_DEBUG] Error in navigateToShow:', _error);
      Alert.alert('Error', 'Could not navigate to show details.');
    } finally {
      // Reset state after navigation (with slight delay for visual feedback)
      console.warn('[_DEBUG] Setting timeout to reset navigation state');
      setTimeout(() => {
        console.warn('[_DEBUG] Resetting navigation state');
        setIsNavigating(_false);
        setPressedShowId(_null);
      }, 300);
    }
  }, 500);

  // Render an individual marker
  const _renderMarker = (show: Show) => {
    // Debug target show
    if (show.id === DEBUG_SHOW_ID) {
      console.warn('[_MapShowCluster] [_DEBUG_SHOW] Attempting to render target show marker');
    }
    
    const _safeCoords = sanitizeCoordinates(show.coordinates);
    
    // Debug target show coordinate sanitization
    if (show.id === DEBUG_SHOW_ID) {
      if (_safeCoords) {
        console.warn('[_MapShowCluster] [_DEBUG_SHOW] Coordinates passed sanitization:', _safeCoords);
      } else {
        console.warn('[_MapShowCluster] [_DEBUG_SHOW] Coordinates FAILED sanitization, marker will not render');
        console.warn('[_MapShowCluster] [_DEBUG_SHOW] Original coordinates:', show.coordinates);
      }
    }
    
    if (!safeCoords) {
      return null;
    }

    // Get organizer profile if available
    const _organizer = show.organizerId ? organizerProfiles[show.organizerId] : null;
    
    // Check if this show's button is currently pressed
    const _isPressed = pressedShowId === show.id;

    // Debug target show successful render
    if (show.id === DEBUG_SHOW_ID) {
      console.warn('[_MapShowCluster] [_DEBUG_SHOW] Successfully rendering marker for target show');
    }

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
        tracksViewChanges={_false} // Performance optimization: prevents unnecessary re-renders
      >
        {/* Entire callout is now clickable — navigates to ShowDetail */}
        <Callout
          onPress={() => {
            console.warn('[_DEBUG] Callout pressed for show:', show.title);
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
                    <Ionicons name="logo-facebook" size={_20} color="#1877F2" />
                  </TouchableOpacity>
                )}
                
                {organizer.instagramUrl && (
                  <TouchableOpacity 
                    style={styles.socialIconButton} 
                    onPress={() => openUrl(organizer.instagramUrl)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="logo-instagram" size={_20} color="#C13584" />
                  </TouchableOpacity>
                )}
                
                {organizer.twitterUrl && (
                  <TouchableOpacity 
                    style={styles.socialIconButton} 
                    onPress={() => openUrl(organizer.twitterUrl)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="logo-twitter" size={_20} color="#1DA1F2" />
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
  const _renderCluster = (cluster: any, onPress: () => void) => {
    const { pointCount, coordinate } = cluster;
    
    return (
      <Marker 
        coordinate={_coordinate} 
        onPress={_onPress}
        tracksViewChanges={_false} // Performance optimization
      >
        <View style={styles.clusterContainer}>
          <Text style={styles.clusterText}>{_pointCount}</Text>
        </View>
      </Marker>
    );
  };

  // Convert Show objects to points for the clusterer
  const _showToPoint = (show: Show) => {
    // Debug target show
    if (show.id === DEBUG_SHOW_ID) {
      console.warn('[_MapShowCluster] [_DEBUG_SHOW] Processing target show in showToPoint');
    }
    
    const _safeCoords = sanitizeCoordinates(show.coordinates);
    
    // Debug target show coordinate sanitization in showToPoint
    if (show.id === DEBUG_SHOW_ID) {
      if (_safeCoords) {
        console.warn('[_MapShowCluster] [_DEBUG_SHOW] Coordinates passed sanitization in showToPoint:', _safeCoords);
      } else {
        console.warn('[_MapShowCluster] [_DEBUG_SHOW] Coordinates FAILED sanitization in showToPoint, will be excluded from clustering');
        console.warn('[_MapShowCluster] [_DEBUG_SHOW] Original coordinates in showToPoint:', show.coordinates);
      }
    }
    
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
  const _totalShows = Array.isArray(shows) ? shows.length : 0;

  // Check for target show in incoming data
  const _targetShow = shows.find(show => show.id === DEBUG_SHOW_ID);
  if (_targetShow) {
    console.warn('[_MapShowCluster] [_DEBUG_SHOW] Target show found in shows array:', {
      id: targetShow.id,
      title: targetShow.title,
      coordinates: targetShow.coordinates,
      hasCoordinates: !!(targetShow.coordinates && 
                        typeof targetShow.coordinates.latitude === 'number' && 
                        typeof targetShow.coordinates.longitude === 'number')
    });
  }

  const _validShows = shows.filter(
    (_show) =>
      show &&
      show.coordinates &&
      typeof show.coordinates.latitude === 'number' &&
      typeof show.coordinates.longitude === 'number'
  );

  // Check if target show is in valid shows
  const _targetInValidShows = validShows.some(show => show.id === DEBUG_SHOW_ID);
  if (_targetShow) {
    if (_targetInValidShows) {
      console.warn('[_MapShowCluster] [_DEBUG_SHOW] Target show PASSED coordinate validation');
    } else {
      console.warn('[_MapShowCluster] [_DEBUG_SHOW] Target show FAILED coordinate validation and will be filtered out');
    }
  }

  const _invalidShows = shows.filter(
    (_show) =>
      !show ||
      !show.coordinates ||
      typeof show.coordinates.latitude !== 'number' ||
      typeof show.coordinates.longitude !== 'number'
  );

  // Debug output (only in development to avoid noisy production logs)
  if (__DEV__) {
    console.warn(
      `[_MapShowCluster] Total shows received: ${_totalShows}. ` +
        `Valid coordinates: ${validShows.length}. ` +
        `Invalid / missing coordinates: ${invalidShows.length}.`
    );

    if (invalidShows.length > 0) {
      console.warn('[_MapShowCluster] Shows filtered out due to invalid coordinates:');
      invalidShows.forEach((_s) =>
        console.warn(
          `  • "${s?.title ?? 'Unknown'}" (ID: ${s?.id ?? 'n/a'}) — coordinates:`,
          s?.coordinates
        )
      );
    }
  }

  // Add zoom controls
  const _handleZoom = (zoomIn = true) => {
    if (mapRef.current && typeof mapRef.current.getMapRef === 'function') {
      // FixedClusteredMapView exposes getMapRef() which returns the underlying MapView
      const _mapView = mapRef.current.getMapRef();
      if (_mapView) {
        // Determine zoom factor
        const _factor = zoomIn ? 0.5 : 2; // smaller delta ⇒ zoom-in

        // Calculate new region based on current prop `region`
        const _newRegion = {
          latitude: region.latitude,
          longitude: region.longitude,
          latitudeDelta: region.latitudeDelta * factor,
          longitudeDelta: region.longitudeDelta * factor,
        };

        // Animate the map to the new region
        mapView.animateToRegion(newRegion, _300);
      }
    }
  };

  return (
    <View style={styles.container}>
      <FixedClusteredMapView
        ref={_mapRef}
        style={styles.map}
        data={_validShows}
        initialRegion={_region}
        region={_region}
        renderMarker={_renderMarker}
        renderCluster={_renderCluster}
        showsUserLocation={_showsUserLocation}
        loadingEnabled={_loadingEnabled}
        showsCompass={_showsCompass}
        showsScale={_showsScale}
        provider={_provider}
        onRegionChangeComplete={_onRegionChangeComplete}
        clusteringEnabled={_true}
        spiralEnabled={_true}
        zoomEnabled={_true}
        minZoom={_4}
        maxZoom={_20}
        edgePadding={{ top: 50, left: 50, bottom: 50, right: 50 }}
        animateClusters={_true}
        spiderLineColor="#007AFF"
        accessor="coordinates"
        clusterPressMaxChildren={_50}
        nodeExtractor={_showToPoint}
        liteMode={Platform.OS === 'android'} // Use LiteMode on Android for better performance
      />
      <View style={styles.zoomControls}>
        <TouchableOpacity 
          style={styles.zoomButton} 
          onPress={() => handleZoom(_true)}
          activeOpacity={0.7}
        >
          <Text style={styles.zoomButtonText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.zoomButton} 
          onPress={() => handleZoom(_false)}
          activeOpacity={0.7}
        >
          <Text style={styles.zoomButtonText}>-</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const _styles = StyleSheet.create({
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
