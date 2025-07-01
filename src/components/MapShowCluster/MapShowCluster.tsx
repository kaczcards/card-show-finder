import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Marker, Callout, Region } from 'react-native-maps';
import ClusteredMapView from 'react-native-maps-super-cluster';
import { Ionicons } from '@expo/vector-icons';
import { Show, Coordinates } from '../types';

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

const { width } = Dimensions.get('window');

const MapShowCluster: React.FC<MapShowClusterProps> = ({
  shows,
  onShowPress,
  region,
  showsUserLocation = true,
  loadingEnabled = true,
  showsCompass = true,
  showsScale = true,
  provider = 'google',
  onRegionChangeComplete,
}) => {
  const mapRef = useRef<ClusteredMapView>(null);
  const [currentRegion, setCurrentRegion] = useState<Region>(region);

  /**
   * Format date for callout with timezone correction
   * @param dateValue Date or string to format
   * @returns Formatted date string
   */
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

  /**
   * Render an individual marker for a show
   * @param show The show to render
   * @returns Marker component
   */
  const renderMarker = (show: Show) => {
    if (!show.coordinates || 
        typeof show.coordinates.latitude !== 'number' || 
        typeof show.coordinates.longitude !== 'number') {
      return null;
    }

    return (
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
        <Callout onPress={() => onShowPress(show.id)} tooltip>
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
    );
  };

  /**
   * Render a cluster of markers
   * @param cluster Cluster information
   * @param onPress Callback for when the cluster is pressed
   * @returns Marker component for the cluster
   */
  const renderCluster = (cluster: any, onPress: () => void) => {
    const { pointCount, coordinate, clusterId } = cluster;
    
    return (
      <Marker
        key={`cluster-${clusterId}`}
        coordinate={coordinate}
        onPress={onPress}
      >
        <View style={styles.clusterContainer}>
          <Text style={styles.clusterText}>{pointCount}</Text>
        </View>
      </Marker>
    );
  };

  /**
   * Convert Show objects to points for the clusterer
   * @param show Show object
   * @returns Point object with location and properties
   */
  const showToPoint = (show: Show) => {
    if (!show.coordinates || 
        typeof show.coordinates.latitude !== 'number' || 
        typeof show.coordinates.longitude !== 'number') {
      return null;
    }

    return {
      location: {
        latitude: show.coordinates.latitude,
        longitude: show.coordinates.longitude,
      },
      properties: {
        point_count: 0,
        ...show,
      },
    };
  };

  /**
   * Filter valid shows that have coordinates
   * @returns Array of valid shows
   */
  const getValidShows = () => {
    return shows.filter(show => 
      show && 
      show.coordinates && 
      typeof show.coordinates.latitude === 'number' && 
      typeof show.coordinates.longitude === 'number'
    );
  };

  /**
   * Handle region change
   * @param newRegion New map region
   */
  const handleRegionChangeComplete = (newRegion: Region) => {
    setCurrentRegion(newRegion);
    if (onRegionChangeComplete) {
      onRegionChangeComplete(newRegion);
    }
  };

  return (
    <ClusteredMapView
      ref={mapRef}
      style={styles.map}
      data={getValidShows()}
      initialRegion={region}
      region={currentRegion}
      renderMarker={renderMarker}
      renderCluster={renderCluster}
      showsUserLocation={showsUserLocation}
      loadingEnabled={loadingEnabled}
      showsCompass={showsCompass}
      showsScale={showsScale}
      provider={provider}
      onRegionChangeComplete={handleRegionChangeComplete}
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
  );
};

const styles = StyleSheet.create({
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
});

export default MapShowCluster;
