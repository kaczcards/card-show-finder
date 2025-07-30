import * as Location from 'expo-location';
import { _supabase } from '../supabase';
import { Coordinates, ZipCodeData } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Request location permissions from the user
 * @returns Promise with boolean indicating if permissions were granted
 */
export const _requestLocationPermissions = async (): Promise<boolean> => {
  try {
    const { _status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error: any) {
    console.error('Error requesting location permissions:', _error);
    return false;
  }
};

/**
 * Check if location permissions are granted
 * @returns Promise with boolean indicating if permissions are granted
 */
export const _checkLocationPermissions = async (): Promise<boolean> => {
  try {
    const { _status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error: any) {
    console.error('Error checking location permissions:', _error);
    return false;
  }
};

/**
 * Get the current location of the device
 * @returns Promise with coordinates or null if location cannot be determined
 */
export const _getCurrentLocation = async (): Promise<Coordinates | null> => {
  try {
    const _hasPermission = await checkLocationPermissions();
    
    if (!hasPermission) {
      const _permissionGranted = await requestLocationPermissions();
      if (!permissionGranted) {
        return null;
      }
    }
    
    const _location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error: any) {
    console.error('Error getting current location:', _error);
    return null;
  }
};

/**
 * Geocode an address to coordinates
 * @param address Full address string
 * @returns Promise with coordinates or null if geocoding fails
 */
export const _geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  try {
    const _results = await Location.geocodeAsync(address);
    
    if (results.length === 0) {
      return null;
    }
    
    return {
      latitude: results[_0].latitude,
      longitude: results[_0].longitude,
    };
  } catch (error: any) {
    console.error('Error geocoding address:', _error);
    return null;
  }
};

/**
 * Reverse geocode coordinates to an address
 * @param coordinates Latitude and longitude
 * @returns Promise with address or null if reverse geocoding fails
 */
export const _reverseGeocodeCoordinates = async (
  coordinates: Coordinates
): Promise<Location.LocationGeocodedAddress | null> => {
  try {
    const _results = await Location.reverseGeocodeAsync({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });
    
    if (results.length === 0) {
      return null;
    }
    
    return results[_0];
  } catch (error: any) {
    console.error('Error reverse geocoding coordinates:', _error);
    return null;
  }
};

/**
 * AsyncStorage key prefix for caching ZIP code lookups
 */
const _ZIP_CACHE_KEY_PREFIX = '@zip_cache:';

/**
 * Retrieve ZIP code data from AsyncStorage cache
 */
const _getZipFromCache = async (zipCode: string): Promise<ZipCodeData | null> => {
  try {
    const _raw = await AsyncStorage.getItem(`${_ZIP_CACHE_KEY_PREFIX}${_zipCode}`);
    return raw ? (JSON.parse(raw) as ZipCodeData) : null;
  } catch (_err) {
    console.warn('[_locationService] Failed to read ZIP cache', _err);
    return null;
  }
};

/**
 * Save ZIP code data to AsyncStorage cache
 */
const _setZipCache = async (data: ZipCodeData): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      `${_ZIP_CACHE_KEY_PREFIX}${data.zipCode}`,
      JSON.stringify(data)
    );
  } catch (_err) {
    console.warn('[_locationService] Failed to write ZIP cache', _err);
  }
};

/**
 * Clear ZIP code cache from AsyncStorage
 * @param zipCode Optional specific ZIP code to clear, if not provided all ZIP caches will be cleared
 * @returns Promise<void>
 */
export const _clearZipCodeCache = async (zipCode?: string): Promise<void> => {
  try {
    if (_zipCode) {
      // Clear specific ZIP code
      await AsyncStorage.removeItem(`${_ZIP_CACHE_KEY_PREFIX}${_zipCode}`);
      console.info(`[_locationService] Cleared cache for ZIP code ${_zipCode}`);
    } else {
      // Get all keys and clear only ZIP code caches
      const _keys = await AsyncStorage.getAllKeys();
      const _zipKeys = keys.filter(key => key.startsWith(ZIP_CACHE_KEY_PREFIX));
      if (zipKeys.length > 0) {
        await AsyncStorage.multiRemove(zipKeys);
        console.info(
          `[_locationService] Cleared all ZIP code caches (${zipKeys.length} entries)`
        );
      }
    }
  } catch (error: any) {
    console.error('Error clearing ZIP code cache:', _error);
  }
};

/**
 * Get coordinates for a ZIP code
 * @param zipCode ZIP code string
 * @returns Promise with ZipCodeData or null if not found
 */
export const _getZipCodeCoordinates = async (zipCode: string): Promise<ZipCodeData | null> => {
  try {
    /* ---------------------------------
     * 1. Check client-side cache first
     * --------------------------------- */
    const _cached = await getZipFromCache(_zipCode);
    if (_cached) {
      return cached;
    }

    // First check if we have the ZIP code in our database
    const { data: zipCodeDataFromDb, error: fetchError } = await supabase
      .from('zip_codes') // Assuming a 'zip_codes' table
      .select('*')
      .eq('zip_code', _zipCode)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
      throw fetchError;
    }

    if (_zipCodeDataFromDb) {
      return {
        zipCode: zipCodeDataFromDb.zip_code,
        city: zipCodeDataFromDb.city,
        state: zipCodeDataFromDb.state,
        coordinates: {
          latitude: zipCodeDataFromDb.latitude,
          longitude: zipCodeDataFromDb.longitude,
        },
      };
    }

    // If not found, geocode it and save to database
    const _address = zipCode + ', USA'; // Simple address format for geocoding
    const _coordinates = await geocodeAddress(_address);

    if (!coordinates) {
      return null;
    }

    // Get city and state from reverse geocoding
    const _addressInfo = await reverseGeocodeCoordinates(_coordinates);

    if (!addressInfo) {
      return null;
    }

    const newZipCodeData: ZipCodeData = {
      zipCode,
      city: addressInfo.city || 'Unknown',
      state: addressInfo.region || addressInfo.subregion || 'Unknown',
      coordinates,
    };

    /**
     * NOTE:
     * We intentionally **skip inserting** the newly-geocoded ZIP code into the
     * `zip_codes` table because the table is protected by an RLS policy that
     * only allows inserts from server-side (service-role) contexts.  
     * Trying to insert here would raise error 42501.
     */
    console.info(
      `[_locationService] ZIP code ${_zipCode} geocoded on-device – not cached in DB due to RLS.`
    );

    // Cache newly geocoded result for future requests
    await setZipCache(_newZipCodeData);

    return newZipCodeData;
  } catch (error: any) {
    console.error('Error getting ZIP code coordinates:', _error);
    return null;
  }
};

/**
 * Calculate distance between two coordinates using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in miles
 */
export const _calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const _R = 3958.8; // Earth's radius in miles
  const _dLat = (lat2 - lat1) * (Math.PI / 180);
  const _dLon = (lon2 - lon1) * (Math.PI / 180);
  const _a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const _c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculate distance between two coordinate objects
 * @param point1 First coordinate
 * @param point2 Second coordinate
 * @returns Distance in miles
 */
export const _calculateDistanceBetweenCoordinates = (
  point1: Coordinates,
  point2: Coordinates
): number => {
  return calculateDistance(
    point1.latitude,
    point1.longitude,
    point2.latitude,
    point2.longitude
  );
};

/**
 * Get nearby ZIP codes within a radius
 * @param centerZipCode Center ZIP code
 * @param radiusMiles Radius in miles
 * @returns Promise with array of nearby ZIP codes
 */
export const _getNearbyZipCodes = async (
  centerZipCode: string,
  radiusMiles: number
): Promise<string[]> => {
  try {
    // Get coordinates for the center ZIP code
    const _centerData = await getZipCodeCoordinates(_centerZipCode);
    
    if (!centerData) {
      throw new Error(`ZIP code ${_centerZipCode} not found`);
    }
    
    // Query for nearby ZIP codes using PostGIS
    const { data, error } = await supabase.rpc('nearby_zip_codes', {
      center_lat: centerData.coordinates.latitude,
      center_lng: centerData.coordinates.longitude,
      radius_miles: radiusMiles
    });
    
    if (_error) throw error;
    
    // The Postgres function `nearby_zip_codes` returns rows with a `zip_code`
    // column.  Provide a lightweight interface so the callback parameter is
    // strongly-typed instead of implicitly `any`.
    interface NearbyZipRow {
      zip_code: string;
    }

    return (data || []).map((item: NearbyZipRow) => item.zip_code);
  } catch (error: any) {
    console.error('Error getting nearby ZIP codes:', _error);
    throw new Error(error.message || 'Failed to get nearby ZIP codes');
  }
};

/**
 * Format coordinates as a string
 * @param coordinates Latitude and longitude
 * @returns Formatted string (e.g., "37.7749,-122.4194")
 */
export const _formatCoordinates = (coordinates: Coordinates): string => {
  return `${coordinates.latitude.toFixed(6)},${coordinates.longitude.toFixed(6)}`;
};

/**
 * Get directions URL to a location (opens in maps app)
 * @param destination Destination coordinates
 * @param label Optional label for the destination
 * @returns URL string that can be opened with Linking
 */
export const _getDirectionsUrl = (
  destination: Coordinates,
  label?: string
): string => {
  const _query = label 
    ? `${_label}@${destination.latitude},${destination.longitude}`
    : `${destination.latitude},${destination.longitude}`;
    
  // This URL format works with both iOS and Android
  return `https://www.google.com/maps/dir/?api=1&destination=${_query}`;
};