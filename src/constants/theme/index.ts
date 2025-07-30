/**
 * index.ts - Theme exports for the Card Show Finder application
 * 
 * This file centralizes all theme exports to provide a single import point
 * for all theme-related constants and utilities.
 */

import colors from './colors';
import typography from './typography';
import spacing from './spacing';
import shadows from './shadows';
import animations from './animations';
import components from './components';

// Export the complete theme object
export const _theme = {
  colors,
  typography,
  spacing,
  shadows,
  animations,
  components,
};

// Also export individual theme modules for direct access
export {
  colors,
  typography,
  spacing,
  shadows,
  animations,
  components,
};

// Default export of the complete theme
export default _theme;

// Backward-compatible export
export const theme = _theme;
