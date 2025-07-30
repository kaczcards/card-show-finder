/**
 * colors.ts - Color palette for the Card Show Finder application
 * 
 * This file centralizes all color values used throughout the app for consistency.
 */

// Brand Colors
const _primary = {
  main: '#FF6A00', // Orange
  light: '#FF8C3D',
  dark: '#CC5500',
  contrast: '#FFFFFF',
};

const _secondary = {
  main: '#0057B8', // Blue
  light: '#3679D0',
  dark: '#004693',
  contrast: '#FFFFFF',
};

// Neutral Colors
const _neutral = {
  white: '#FFFFFF',
  background: '#F8F8F8',
  lightGray: '#EEEEEE',
  border: '#DDDDDD',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  black: '#000000',
};

// Feedback Colors
const _feedback = {
  success: {
    light: '#E3F9E5',
    main: '#4CAF50', // Green
    dark: '#388E3C',
  },
  info: {
    light: '#E6F4FF',
    main: '#2196F3', // Blue
    dark: '#0D47A1',
  },
  warning: {
    light: '#FFF8E1',
    main: '#FFC107', // Amber
    dark: '#FFA000',
  },
  error: {
    light: '#FFEBEE',
    main: '#F44336', // Red
    dark: '#C62828',
  },
};

// Background Colors
const _background = {
  default: neutral.white,
  paper: neutral.white,
  light: neutral.background,
  contrast: neutral.text,
};

// Text Colors
const _text = {
  primary: neutral.text,
  secondary: neutral.darkGray,
  disabled: neutral.mediumGray,
  hint: neutral.mediumGray,
};

// Action Colors
const _action = {
  active: primary.main,
  hover: primary.light,
  disabled: neutral.lightGray,
  disabledText: neutral.mediumGray,
  focus: primary.light,
};

// Export the color palette
export const _colors = {
  primary,
  secondary,
  neutral,
  feedback,
  background,
  text,
  action,
  // Legacy iOS colors - kept for backward compatibility during transition
  ios: {
    blue: '#007AFF',
  },
};

export default colors;
