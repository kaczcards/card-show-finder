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
  default: _neutral.white,
  paper: _neutral.white,
  light: _neutral.background,
  contrast: _neutral.text,
};

// Text Colors
const _text = {
  primary: _neutral.text,
  secondary: _neutral.darkGray,
  disabled: _neutral.mediumGray,
  hint: _neutral.mediumGray,
};

// Action Colors
const _action = {
  active: _primary.main,
  hover: _primary.light,
  disabled: _neutral.lightGray,
  disabledText: _neutral.mediumGray,
  focus: _primary.light,
};

// Export the color palette
export const _colors = {
  primary: _primary,
  secondary: _secondary,
  neutral: _neutral,
  feedback: _feedback,
  background: _background,
  text: _text,
  action: _action,
  // Legacy iOS colors - kept for backward compatibility during transition
  ios: {
    blue: '#007AFF',
  },
};

export default _colors;

// Backward-compatible exports
export const colors = _colors;
export const primary = _primary;
export const secondary = _secondary;
export const neutral = _neutral;
export const feedback = _feedback;
export const background = _background;
export const text = _text;
export const action = _action;
