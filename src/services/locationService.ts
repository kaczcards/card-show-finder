import * as Location from 'expo-location';
import { supabase } from '../supabase';
import { Coordinates, ZipCodeData } from '../types';

/**
 * Request location permissions from the user
 * @returns Promise with boolean indicating if permissions were granted
 */
export const requestLocationPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error: any) {
    console.error('Error requesting location permissions:', error);
    return false;
  }
};

/**
 * Check if location permissions are granted
 * @returns Promise with boolean indicating if permissions are granted
 */
export const checkLocationPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error: any) {
    console.error('Error checking location permissions:', error);
    return false;
  }
};

/**
 * Get the current location of the device
 * @returns Promise with coordinates or null if location cannot be determined
 */
export const getCurrentLocation = async (): Promise<Coordinates | null> => {
  try {
    const hasPermission = await checkLocationPermissions();
    
    if (!hasPermission) {
      const permissionGranted = await requestLocationPermissions();
      if (!permissionGranted) {
        return null;
      }
    }
    
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error: any) {
    console.error('Error getting current location:', error);
    return null;
  }
};

/**
 * Geocode an address to coordinates
 * @param address Full address string
 * @returns Promise with coordinates or null if geocoding fails
 */
export const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  try {
    const results = await Location.geocodeAsync(address);
    
    if (results.length === 0) {
      return null;
    }
    
    return {
      latitude: results[0].latitude,
      longitude: results[0].longitude,
    };
  } catch (error: any) {
    console.error('Error geocoding address:', error);
    return null;
  }
};

/**
 * Reverse geocode coordinates to an address
 * @param coordinates Latitude and longitude
 * @returns Promise with address or null if reverse geocoding fails
 */
export const reverseGeocodeCoordinates = async (
  coordinates: Coordinates
): Promise<Location.LocationGeocodedAddress | null> => {
  try {
    const results = await Location.reverseGeocodeAsync({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });
    
    if (results.length === 0) {
      return null;
    }
    
    return results[0];
  } catch (error: any) {
    console.error('Error reverse geocoding coordinates:', error);
    return null;
  }
};

/**
 * Get coordinates for a ZIP code
 * @param zipCode ZIP code string
 * @returns Promise with ZipCodeData or null if not found
 */
export const getZipCodeCoordinates = async (zipCode: string): Promise<ZipCodeData | null> => {
  try {
    // First check if we have the ZIP code in our database
    const { data: zipCodeDataFromDb, error: fetchError } = await supabase
      .from('zip_codes') // Assuming a 'zip_codes' table
      .select('*')
      .eq('zip_code', zipCode)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
      throw fetchError;
    }

    if (zipCodeDataFromDb) {
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
    const address = zipCode + ', USA'; // Simple address format for geocoding
    const coordinates = await geocodeAddress(address);

    if (!coordinates) {
      return null;
    }

    // Get city and state from reverse geocoding
    const addressInfo = await reverseGeocodeCoordinates(coordinates);

    if (!addressInfo) {
      return null;
    }

    const newZipCodeData: ZipCodeData = {
      zipCode,
      city: addressInfo.city || 'Unknown',
      state: addressInfo.region || addressInfo.subregion || 'Unknown',
      coordinates,
    };

    // Save to database for future use
    const { error: insertError } = await supabase
      .from('zip_codes')
      .insert({
        zip_code: newZipCodeData.zipCode,
        city: newZipCodeData.city,
        state: newZipCodeData.state,
        latitude: newZipCodeData.coordinates.latitude,
        longitude: newZipCodeData.coordinates.longitude,
      });

    if (insertError) throw insertError;

    return newZipCodeData;
  } catch (error: any) {
    console.error('Error getting ZIP code coordinates:', error);
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
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 3958.8; // Earth's radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculate distance between two coordinate objects
 * @param point1 First coordinate
 * @param point2 Second coordinate
 * @returns Distance in miles
 */
export const calculateDistanceBetweenCoordinates = (
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
export const getNearbyZipCodes = async (
  centerZipCode: string,
  radiusMiles: number
): Promise<string[]> => {
  try {
    // Get coordinates for the center ZIP code
    const centerData = await getZipCodeCoordinates(centerZipCode);
    
    if (!centerData) {
      throw new Error(`ZIP code ${centerZipCode} not found`);
    }
    
    // Query for nearby ZIP codes using PostGIS
    const { data, error } = await supabase.rpc('nearby_zip_codes', {
      center_lat: centerData.coordinates.latitude,
      center_lng: centerData.coordinates.longitude,
      radius_miles: radiusMiles
    });
    
    if (error) throw error;
    
    return (data || []).map(item => item.zip_code);
  } catch (error: any) {
    console.error('Error getting nearby ZIP codes:', error);
    throw new Error(error.message || 'Failed to get nearby ZIP codes');
  }
};

/**
 * Format coordinates as a string
 * @param coordinates Latitude and longitude
 * @returns Formatted string (e.g., "37.7749,-122.4194")
 */
export const formatCoordinates = (coordinates: Coordinates): string => {
  return `${coordinates.latitude.toFixed(6)},${coordinates.longitude.toFixed(6)}`;
};

/**
 * Get directions URL to a location (opens in maps app)
 * @param destination Destination coordinates
 * @param label Optional label for the destination
 * @returns URL string that can be opened with Linking
 */
export const getDirectionsUrl = (
  destination: Coordinates,
  label?: string
): string => {
  const query = label 
    ? `${label}@${destination.latitude},${destination.longitude}`
    : `${destination.latitude},${destination.longitude}`;
    
  // This URL format works with both iOS and Android
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
};