import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

/**
 * MapFallback.tsx
 * 
 * This file provides fallback components for react-native-maps that gracefully
 * degrade when the native module isn't available (e.g., in Expo Go).
 * 
 * IMPORTANT: Do NOT import directly from react-native-maps at the module level!
 * Doing so executes code that tries to access the native module immediately.
 * 
 * Instead, we use dynamic requires inside functions that are guarded by
 * isNativeMapsAvailable() checks.
 */

// ---------------------------------------------------------------------------
// Type definitions - minimal versions of react-native-maps types
// ---------------------------------------------------------------------------
export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Use loose types to satisfy TypeScript without importing from react-native-maps
export type MapViewProps = {
  style?: ViewStyle;
  region?: Region;
  initialRegion?: Region;
  onRegionChangeComplete?: (region: Region) => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  showsScale?: boolean;
  loadingEnabled?: boolean;
  provider?: string;
  [key: string]: any;
};

export type MarkerProps = {
  coordinate: Coordinates;
  title?: string;
  description?: string;
  pinColor?: string;
  onPress?: () => void;
  tracksViewChanges?: boolean;
  [key: string]: any;
};

export type CalloutProps = {
  onPress?: () => void;
  tooltip?: boolean;
  [key: string]: any;
};

// Constants
export const _PROVIDER_GOOGLE = 'google';

// ---------------------------------------------------------------------------
// Helper function to check if native maps module is available
// ---------------------------------------------------------------------------
/**
 * Safely checks if the react-native-maps native module is available
 * without throwing an error
 */
export const _isNativeMapsAvailable = (): boolean => {
  if (Platform.OS === 'web') {
    return false;
  }
  
  try {
    // Attempt to access TurboModuleRegistry without importing it directly
    const _TurboModuleRegistry = require('react-native').TurboModuleRegistry;
    
    // Check if the native module exists
    const _hasModule = 
      TurboModuleRegistry &&
      typeof TurboModuleRegistry.getEnforcing === 'function' &&
      (() => {
        try {
          TurboModuleRegistry.getEnforcing('RNMapsAirModule');
          return true;
        } catch (_e) {
          return false;
        }
      })();
      
    return !!hasModule;
  } catch (_error) {
    // If any error occurs, assume the module is not available
    return false;
  }
};

// ---------------------------------------------------------------------------
// Styles for fallback components
// ---------------------------------------------------------------------------
const _styles = StyleSheet.create({
  mapFallbackContainer: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapFallbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 10,
    textAlign: 'center',
  },
  mapFallbackText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  markerFallbackContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 10,
    margin: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  markerFallbackText: {
    fontSize: 12,
    color: '#666',
  },
  calloutFallbackContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    margin: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    maxWidth: 200,
  },
  calloutFallbackText: {
    fontSize: 12,
    color: '#666',
  },
  clusterFallbackContainer: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  clusterFallbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 10,
    textAlign: 'center',
  },
  clusterFallbackText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
});

// ---------------------------------------------------------------------------
// Fallback components
// ---------------------------------------------------------------------------

/**
 * Fallback MapView component that renders a placeholder when the native module is not available
 */
export const _MapView = forwardRef<any, MapViewProps & {
  fallbackContainerStyle?: ViewStyle;
  fallbackTitleStyle?: TextStyle;
  fallbackTextStyle?: TextStyle;
}>((_props, _ref) => {
  const {
    fallbackContainerStyle,
    fallbackTitleStyle,
    fallbackTextStyle,
    _children,
    ...restProps
  } = props;

  // Create a local ref that we'll expose if native maps aren't available
  const _localRef = useRef<View>(null);
  
  // Expose methods that might be called on the ref
  useImperativeHandle(_ref, () => ({
    animateToRegion: (region: Region, duration = 500) => {
       
console.warn('MapView.animateToRegion called in fallback mode', { region, duration });
      // No-op in fallback mode
    },
    getMapRef: () => null,
    // Add any other methods that might be called on the ref
  }));

  if (isNativeMapsAvailable()) {
    try {
      // Dynamically require react-native-maps only when we know it's available
      const _RNMaps = require('react-native-maps');
      const _RealMapView = RNMaps.default || RNMaps.MapView;
      
      return <RealMapView ref={_ref} {...restProps}>{_children}</RealMapView>;
    } catch (_error) {
      console.error('Failed to load react-native-maps even though native module was detected:', _error);
      // Fall through to fallback if dynamic require fails
    }
  }

  // Fallback component when native maps are not available
  return (
    <View 
      ref={_localRef}
      style={[styles.mapFallbackContainer, fallbackContainerStyle || props.style]}
    >
      <Text style={[styles.mapFallbackTitle, fallbackTitleStyle]}>
        Map Not Available
      </Text>
      <Text style={[styles.mapFallbackText, fallbackTextStyle]}>
        Maps require a development build with native modules.
      </Text>
      <Text style={[styles.mapFallbackText, fallbackTextStyle]}>
        Run with: expo run:ios or expo run:android
      </Text>
      <Text style={[styles.mapFallbackText, { marginTop: 10 }, fallbackTextStyle]}>
        This is a placeholder for development in Expo Go.
      </Text>
    </View>
  );
});

/**
 * Fallback Marker component
 */
export const Marker: React.FC<MarkerProps> = (_props) => {
  if (isNativeMapsAvailable()) {
    try {
      const _RNMaps = require('react-native-maps');
      const _RealMarker = RNMaps.Marker;
      
      return <RealMarker {...props} />;
    } catch (_error) {
      // Fall through to fallback
    }
  }

  // In fallback mode, markers are not rendered directly
  // They will be handled by the MapView fallback
  return props.children ? <>{props.children}</> : null;
};

/**
 * Fallback Callout component
 */
export const Callout: React.FC<CalloutProps> = (_props) => {
  if (isNativeMapsAvailable()) {
    try {
      const _RNMaps = require('react-native-maps');
      const _RealCallout = RNMaps.Callout;
      
      return <RealCallout {...props} />;
    } catch (_error) {
      // Fall through to fallback
    }
  }

  // In fallback mode, return children wrapped in a styled container
  return (
    <View style={styles.calloutFallbackContainer}>
      {props.children || (
        <Text style={styles.calloutFallbackText}>
          Callout content (unavailable in Expo Go)
        </Text>
      )}
    </View>
  );
};

/**
 * Fallback for react-native-maps-super-cluster FixedClusteredMapView
 */
export const _FixedClusteredMapView = forwardRef<any, MapViewProps & {
  fallbackContainerStyle?: ViewStyle;
  fallbackTitleStyle?: TextStyle;
  fallbackTextStyle?: TextStyle;
  data?: any[];
  renderMarker?: (item: any) => React.ReactNode;
  renderCluster?: (cluster: any, onPress: () => void) => React.ReactNode;
  clusteringEnabled?: boolean;
  spiralEnabled?: boolean;
  zoomEnabled?: boolean;
  animateClusters?: boolean;
  spiderLineColor?: string;
  clusterPressMaxChildren?: number;
  nodeExtractor?: (item: any) => any;
  accessor?: string;
}>((_props, _ref) => {
  const {
    fallbackContainerStyle,
    fallbackTitleStyle,
    fallbackTextStyle,
    data,
    renderMarker,
    _renderCluster,
    ...restProps
  } = props;

  // Create a local ref that we'll expose if native maps aren't available
  const _localRef = useRef<View>(null);
  
  // Expose methods that might be called on the ref
  useImperativeHandle(_ref, () => ({
    animateToRegion: (region: Region, duration = 500) => {
       
console.warn('FixedClusteredMapView.animateToRegion called in fallback mode', { region, duration });
      // No-op in fallback mode
    },
    getMapRef: () => ({
      animateToRegion: (region: Region, duration = 500) => {
         
console.warn('getMapRef();.animateToRegion called in fallback mode', { region, duration });
        // No-op in fallback mode
      }
    }),
    // Add any other methods that might be called on the ref
  }));

  if (isNativeMapsAvailable()) {
    try {
      // Try to dynamically require the clustered map view
      const _RNMapsCluster = require('react-native-maps-super-cluster').default;
      
      if (_RNMapsCluster) {
        return (
          <RNMapsCluster
            ref={_ref}
            data={_data}
            renderMarker={_renderMarker}
            renderCluster={_renderCluster}
            {...restProps}
          />
        );
      }
    } catch (_error) {
      console.error('Failed to load react-native-maps-super-cluster:', _error);
      // Fall through to fallback
    }
  }

  // Fallback component when native maps are not available
  return (
    <View 
      ref={_localRef}
      style={[styles.clusterFallbackContainer, fallbackContainerStyle || props.style]}
    >
      <Text style={[styles.clusterFallbackTitle, fallbackTitleStyle]}>
        Clustered Map Not Available
      </Text>
      <Text style={[styles.clusterFallbackText, fallbackTextStyle]}>
        Maps require a development build with native modules.
      </Text>
      <Text style={[styles.clusterFallbackText, fallbackTextStyle]}>
        Run with: expo run:ios or expo run:android
      </Text>
      <Text style={[styles.clusterFallbackText, { marginTop: 10 }, fallbackTextStyle]}>
        {data && Array.isArray(data) ? `${data.length} item${data.length === 1 ? '' : 's'} would be shown on the map` : 'No data available'}
      </Text>

      {/* ------------------------------------------------------------------
          NEW: Helpful list for Expo Go fallback
         ------------------------------------------------------------------ */}
      {Array.isArray(data) && data.length > 0 && (
        <ScrollView
          style={{ maxHeight: 300, alignSelf: 'stretch', marginTop: 12 }}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {data.map((_item, _idx) => {
            // Attempt to pull a few common fields that show objects use
            const _title =
              item.title ??
              item.properties?.title ??
              `Item #${idx + 1}`;

            const _startDate =
              item.startDate ??
              item.properties?.startDate ??
              item.start_date;
            const _endDate =
              item.endDate ??
              item.properties?.endDate ??
              item.end_date;

            const _dateLabel = startDate
              ? `${new Date(_startDate).toLocaleDateString()}${
                  endDate &&
                  new Date(_startDate).toDateString() !==
                    new Date(_endDate).toDateString()
                    ? ` – ${new Date(_endDate).toLocaleDateString()}`
                    : ''
                }`
              : 'Date N/A';

            const _handlePress = () => {
              try {
                // Allow devs to invoke their marker renderer to inspect data
                if (_renderMarker) {
                  renderMarker(_item);
                }
              } catch (_e) {
                console.warn(
                  '[_MapFallback] Error invoking renderMarker from fallback list:',
                  _e
                );
              }
            };

            return (
              <TouchableOpacity
                key={_idx}
                onPress={_handlePress}
                style={{
                  backgroundColor: 'white',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 8,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <Text style={{ fontWeight: '600', marginBottom: 4 }}>
                  {_title}
                </Text>
                <Text style={{ fontSize: 12, color: '#555' }}>
                  {_dateLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
});

// Default export for convenient imports
export default {
  MapView,
  Marker,
  Callout,
  FixedClusteredMapView,
  PROVIDER_GOOGLE,
  isNativeMapsAvailable,
};
