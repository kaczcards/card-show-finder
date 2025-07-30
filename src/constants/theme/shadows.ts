/**
 * shadows.ts - Shadow definitions for the Card Show Finder application
 * 
 * This file centralizes all shadow/elevation styles used throughout the app for consistency.
 * Platform-specific shadow implementations help maintain a consistent look across iOS and Android.
 */

import { Platform } from 'react-native';

// Define platform-specific shadow implementations
export const _createElevation = (elevation: number) => {
  if (Platform.OS === 'ios') {
    // iOS-specific shadow values based on elevation level
    const _height = Math.round(elevation * 0.5);
    const _opacity = 0.1 + elevation * 0.01;
    const _radius = Math.round(elevation * 0.9);
    
    return {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: _height },
      shadowOpacity: _opacity,
      shadowRadius: _radius,
    };
  } else {
    // Android elevation - simple and direct
    return {
      elevation,
    };
  }
};

// Predefined shadow levels
export const _shadows = {
  none: _createElevation(0),
  xs: _createElevation(1),    // Subtle shadow for small UI elements
  small: _createElevation(2), // Cards, buttons
  medium: _createElevation(4), // Floating action buttons, nav bars
  large: _createElevation(8), // Modals, dialogs
  xl: _createElevation(16),   // Popovers, tooltips
};

export default _shadows;

// Backward-compatible exports
export const shadows = _shadows;
export const createElevation = _createElevation;
