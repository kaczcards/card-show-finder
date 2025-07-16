/**
 * Toast Utilities
 * 
 * This file contains utility functions for displaying toast notifications
 * throughout the app using react-native-toast-message.
 */

import Toast from 'react-native-toast-message';

// Default durations in milliseconds
const DURATIONS = {
  SHORT: 2000,
  NORMAL: 3500,
  LONG: 5000
};

/**
 * Show a success toast notification
 * 
 * @param message Primary message text
 * @param subText Optional secondary text
 * @param duration Time in ms to show the toast
 */
export const showSuccessToast = (
  message: string, 
  subText?: string, 
  duration: number = DURATIONS.NORMAL
) => {
  Toast.show({
    type: 'success',
    text1: message,
    text2: subText,
    visibilityTime: duration,
    position: 'bottom',
  });
};

/**
 * Show an info toast notification
 * 
 * @param message Primary message text
 * @param subText Optional secondary text
 * @param duration Time in ms to show the toast
 */
export const showInfoToast = (
  message: string, 
  subText?: string, 
  duration: number = DURATIONS.NORMAL
) => {
  Toast.show({
    type: 'info',
    text1: message,
    text2: subText,
    visibilityTime: duration,
    position: 'bottom',
  });
};

/**
 * Show an error toast notification
 * 
 * @param message Primary message text
 * @param subText Optional secondary text
 * @param duration Time in ms to show the toast
 */
export const showErrorToast = (
  message: string, 
  subText?: string, 
  duration: number = DURATIONS.LONG
) => {
  Toast.show({
    type: 'error',
    text1: message,
    text2: subText,
    visibilityTime: duration,
    position: 'bottom',
  });
};

/**
 * Show a warning toast notification
 * 
 * @param message Primary message text
 * @param subText Optional secondary text
 * @param duration Time in ms to show the toast
 */
export const showWarningToast = (
  message: string, 
  subText?: string, 
  duration: number = DURATIONS.NORMAL
) => {
  Toast.show({
    type: 'warning',
    text1: message,
    text2: subText,
    visibilityTime: duration,
    position: 'bottom',
  });
};

/**
 * Location-specific toast notifications
 */

/**
 * Show a toast notification when the map location changes to a new ZIP code
 * 
 * @param zipCode The ZIP code the map has centered on
 */
export const showLocationChangedToast = (zipCode: string) => {
  showInfoToast(
    `Map centered on ${zipCode}`,
    'Your location has been updated',
    DURATIONS.SHORT
  );
};

/**
 * Show a toast notification when GPS location is used
 * 
 * @param locationName Optional name of the location (city, neighborhood)
 */
export const showGpsLocationToast = (locationName?: string) => {
  showInfoToast(
    locationName 
      ? `Using current location: ${locationName}`
      : 'Using your current location',
    'Shows within your selected radius will appear',
    DURATIONS.SHORT
  );
};

/**
 * Show a toast notification when location services fail
 * 
 * @param fallbackZip The ZIP code being used as fallback
 */
export const showLocationFailedToast = (fallbackZip?: string) => {
  if (fallbackZip) {
    showWarningToast(
      'Location services unavailable',
      `Using your home ZIP code (${fallbackZip}) instead`,
      DURATIONS.NORMAL
    );
  } else {
    showErrorToast(
      'Location services unavailable',
      'Please set your home ZIP code in your profile',
      DURATIONS.LONG
    );
  }
};

/**
 * Hide any currently displayed toast
 */
export const hideToast = () => {
  Toast.hide();
};

// Export all toast functions
export default {
  showSuccessToast,
  showInfoToast,
  showErrorToast,
  showWarningToast,
  showLocationChangedToast,
  showGpsLocationToast,
  showLocationFailedToast,
  hideToast,
  durations: DURATIONS
};
