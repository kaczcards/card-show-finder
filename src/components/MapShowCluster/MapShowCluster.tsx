import React, { useRef } from 'react';
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

const MapShowCluster = React.forwardRef<any, MapShowClusterProps>((props, ref) => {
  // Navigation (used as a fallback when parent doesn't supply onShowPress)
  const navigation = useNavigation<any>();

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
      return { latitude: swappedLat, longitude: swappedLng };
    }

    // Still invalid – give up
    return null;
  };

  // Helper function to open address in maps app
  const openMaps = (address: string) => {
    if (!address) return;

    try {
      const scheme = Platform.select({ ios: 'maps:?q=', android: 'geo:?q=' });
      const url = `${scheme}${encodeURIComponent(address)}`;

      Linking.openURL(url).catch(err => {
        console.error('Error opening native maps app:', err);

        // Fallback: open Google Maps in the browser
        const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          address,
        )}`;
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
    // Treat any “zero-ish” / missing value as free admission
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
   * Wrapper handler so the marker can still navigate even if the parent
   * component forgot to pass `onShowPress`.  We fallback to React Navigation.
   */
  const navigateToShow = (showId: string) => {
    if (props.onShowPress) {
      props.onShowPress(showId);
    } else {
      // Fallback: push ShowDetail screen directly
      // @ts-ignore – Route name exists in the main navigator
      navigation.navigate('ShowDetail', { showId });
    }
  };

  // Render an individual marker
  const renderMarker = (show: Show) => {
    const safeCoords = sanitizeCoordinates(show.coordinates);
    if (!safeCoords) {
      return null;
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
      >
        <Callout tooltip>
          <View style={styles.calloutContainer}>
            <Text style={styles.calloutTitle}>{show.title}</Text>
            <Text style={styles.calloutDetail}>
              {formatDate(show.startDate)}
              {new Date(show.startDate).toDateString() !== new Date(show.endDate).toDateString() && 
                ` - ${formatDate(show.endDate)}`}
            </Text>
            <TouchableOpacity onPress={() => openMaps(show.address)}>
              <Text style={styles.addressLink}>{show.address}</Text>
            </TouchableOpacity>
            <Text style={styles.calloutDetail}>
              {formatEntryFee(show.entryFee)}
            </Text>
            <TouchableOpacity
              style={styles.calloutButton}
              onPress={() => navigateToShow(show.id)}
            >
              <Text style={styles.calloutButtonText}>View Details</Text>
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
      />
      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomButton} onPress={() => handleZoom(true)}>
          <Text style={styles.zoomButtonText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomButton} onPress={() => handleZoom(false)}>
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
  addressContainer: {
    marginBottom: 4,
  },
  addressLink: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4,
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
    width: 40,
    height: 40,
    backgroundColor: 'white',
    borderRadius: 20,
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
