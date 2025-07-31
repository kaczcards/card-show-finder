/**
 * Utility functions for working with geographic coordinates
 */
import { Coordinates } from '../types';

/**
 * Sanitizes coordinates to ensure they are valid
 * 
 * This function:
 * 1. Verifies both latitude and longitude are numbers
 * 2. Detects and swaps swapped coordinates (a common error)
 * 3. Ensures latitude is between -90 and 90
 * 4. Ensures longitude is between -180 and 180
 * 
 * @param coordinates The coordinates to sanitize
 * @returns Sanitized coordinates or null if invalid
 */
export const sanitizeCoordinates = (coordinates?: Coordinates | null): Coordinates | null => {
  // If no coordinates provided, return null
  if (!coordinates) {
    console.warn('No coordinates provided to sanitize');
    return null;
  }

  const { latitude, longitude } = coordinates;

  // Verify both values are numbers
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    isNaN(latitude) ||
    isNaN(longitude)
  ) {
    console.warn('Invalid coordinates: latitude or longitude is not a number', { latitude, longitude });
    return null;
  }

  // Check for swapped coordinates
  // This is often the case when lat > 90 or long > 180
  if (Math.abs(latitude) > 90 && Math.abs(longitude) <= 90) {
    console.warn('Coordinates appear to be swapped - fixing automatically', { 
      originalLat: latitude, 
      originalLong: longitude 
    });
    
    // Swap them and proceed with the rest of the validation
    return sanitizeCoordinates({
      latitude: longitude,
      longitude: latitude
    });
  }

  // Validate latitude range (-90 to 90)
  if (latitude < -90 || latitude > 90) {
    console.warn('Invalid latitude value outside -90 to 90 range:', latitude);
    return null;
  }

  // Validate longitude range (-180 to 180)
  if (longitude < -180 || longitude > 180) {
    console.warn('Invalid longitude value outside -180 to 180 range:', longitude);
    return null;
  }

  // Return the valid coordinates
  return { latitude, longitude };
};

/**
 * Calculates the distance between two points using the Haversine formula
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in miles
 */
export const calculateDistance = (
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number => {
  // Radius of the earth in miles
  const R = 3958.8;
  
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
