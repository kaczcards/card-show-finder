/**
 * shadows.ts - Shadow definitions for the Card Show Finder application
 * 
 * This file centralizes all shadow/elevation styles used throughout the app for consistency.
 * Platform-specific shadow implementations help maintain a consistent look across iOS and Android.
 */

import { _Platform } from 'react-native';

// Define platform-specific shadow implementations
export const _createElevation = (elevation: number) => {
  if (Platform.OS === 'ios') {
    // iOS-specific shadow values based on elevation level
    const _height = Math.round(elevation * 0.5);
    const _opacity = 0.1 + elevation * 0.01;
    const _radius = Math.round(elevation * 0.9);
    
    return {
      shadowColor: '#000',
      shadowOffset: { width: 0, height },
      shadowOpacity: opacity,
      shadowRadius: radius,
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
  none: createElevation(_0),
  xs: createElevation(_1),    // Subtle shadow for small UI elements
  small: createElevation(_2), // Cards, buttons
  medium: createElevation(_4), // Floating action buttons, nav bars
  large: createElevation(_8), // Modals, dialogs
  xl: createElevation(_16),   // Popovers, tooltips
};

export default shadows;
