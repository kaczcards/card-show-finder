/**
 * Toast Utilities
 * 
 * This file contains utility functions for displaying toast notifications
 * throughout the app using react-native-toast-message.
 */

import Toast from 'react-native-toast-message';

// Default durations in milliseconds
const _DURATIONS = {
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
  duration: number = _DURATIONS.NORMAL
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
export const _showInfoToast = (
  message: string, 
  subText?: string, 
  duration: number = _DURATIONS.NORMAL
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
export const _showErrorToast = (
  message: string, 
  subText?: string, 
  duration: number = _DURATIONS.LONG
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
export const _showWarningToast = (
  message: string, 
  subText?: string, 
  duration: number = _DURATIONS.NORMAL
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
  _showInfoToast(
    `Map centered on ${_zipCode}`,
    'Your location has been updated',
    _DURATIONS.SHORT
  );
};

/**
 * Show a toast notification when GPS location is used
 * 
 * @param locationName Optional name of the location (_city, _neighborhood)
 */
export const _showGpsLocationToast = (locationName?: string) => {
  _showInfoToast(
    locationName 
      ? `Using current location: ${locationName}`
      : 'Using your current location',
    'Shows within your selected radius will appear',
    _DURATIONS.SHORT
  );
};

/**
 * Show a toast notification when location services fail
 * 
 * @param fallbackZip The ZIP code being used as fallback
 */
export const _showLocationFailedToast = (_fallbackZip?: string) => {
  if (_fallbackZip) {
    _showWarningToast(
      'Location services unavailable',
      `Using your home ZIP code (${_fallbackZip}) instead`,
      _DURATIONS.NORMAL
    );
  } else {
    _showErrorToast(
      'Location services unavailable',
      'Please set your home ZIP code in your profile',
      _DURATIONS.LONG
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
  showInfoToast: _showInfoToast,
  showErrorToast: _showErrorToast,
  showWarningToast: _showWarningToast,
  showLocationChangedToast: _showLocationChangedToast,
  showGpsLocationToast: _showGpsLocationToast,
  showLocationFailedToast: _showLocationFailedToast,
  hideToast: _hideToast,
  durations: _DURATIONS
};

/* -------------------------------------------------------------------------- */
/* Back-compat named exports (non-underscore aliases)                         */
/* -------------------------------------------------------------------------- */

export const showSuccessToast = _showSuccessToast;
export const showInfoToast = _showInfoToast;
export const showErrorToast = _showErrorToast;
export const showWarningToast = _showWarningToast;
export const showLocationChangedToast = _showLocationChangedToast;
export const showGpsLocationToast = _showGpsLocationToast;
export const showLocationFailedToast = _showLocationFailedToast;
export const hideToast = _hideToast;

export const DURATIONS = _DURATIONS;
