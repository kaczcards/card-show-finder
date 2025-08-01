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
export const _showSuccessToast = (
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
export const _showLocationChangedToast = (_zipCode: string) => {
  showInfoToast(
    `Map centered on ${_zipCode}`,
    'Your location has been updated',
    DURATIONS.SHORT
  );
};

/**
 * Show a toast notification when GPS location is used
 * 
 * @param locationName Optional name of the location (_city, _neighborhood)
 */
export const _showGpsLocationToast = (locationName?: string) => {
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
export const _showLocationFailedToast = (_fallbackZip?: string) => {
  if (_fallbackZip) {
    showWarningToast(
      'Location services unavailable',
      `Using your home ZIP code (${_fallbackZip}) instead`,
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
export const _hideToast = () => {
  Toast.hide();
};

// Export all toast functions
export default {
  showSuccessToast: _showSuccessToast,
  showInfoToast: showInfoToast,
  showErrorToast: showErrorToast,
  showWarningToast: showWarningToast,
  showLocationChangedToast: _showLocationChangedToast,
  showGpsLocationToast: _showGpsLocationToast,
  showLocationFailedToast: _showLocationFailedToast,
  hideToast: _hideToast,
  durations: DURATIONS
};

/* -------------------------------------------------------------------------- */
/* Back-compat named exports (non-underscore aliases)                         */
/* -------------------------------------------------------------------------- */

// ---------------------------------------------------------------------------
// Additional named exports for backward compatibility with existing imports
// ---------------------------------------------------------------------------
export const showSuccessToast = _showSuccessToast;
export const showLocationChangedToast = _showLocationChangedToast;
export const showGpsLocationToast = _showGpsLocationToast;
export const showLocationFailedToast = _showLocationFailedToast;
export const hideToast = _hideToast;

// Note: explicit re-exports are unnecessary; the functions are already
// exported above (either directly or via default export). Removing the
// duplicates prevents identifier conflicts.
