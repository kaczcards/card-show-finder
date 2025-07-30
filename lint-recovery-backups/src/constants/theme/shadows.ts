/**
 * shadows.ts - Shadow definitions for the Card Show Finder application
 * 
 * This file centralizes all shadow/elevation styles used throughout the app for consistency.
 * Platform-specific shadow implementations help maintain a consistent look across iOS and Android.
 */

// Removed unused import: import { _Platform } from 'react-native';

// Define platform-specific shadow implementations
export const createElevation = (elevation: number) => {
  if (Platform.OS === 'ios') {
    // iOS-specific shadow values based on elevation level
    const height = Math.round(elevation * 0.5);
    const opacity = 0.1 + elevation * 0.01;
    const radius = Math.round(elevation * 0.9);
    
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
export const shadows = {
  none: createElevation(0),
  xs: createElevation(1),    // Subtle shadow for small UI elements
  small: createElevation(2), // Cards, buttons
  medium: createElevation(4), // Floating action buttons, nav bars
  large: createElevation(8), // Modals, dialogs
  xl: createElevation(16),   // Popovers, tooltips
};

export default shadows;
