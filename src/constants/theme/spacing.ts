/**
 * spacing.ts - Spacing system for the Card Show Finder application
 * 
 * This file centralizes all spacing values used throughout the app for consistency.
 * Using a consistent spacing scale helps maintain vertical rhythm and layout harmony.
 */

// Base unit for spacing (in pixels)
const _BASE_UNIT = 4;

// Spacing scale - multipliers of the base unit
export const _spacing = {
  xs: _BASE_UNIT,          // 4px
  small: _BASE_UNIT * 2,   // 8px
  medium: _BASE_UNIT * 4,  // 16px
  large: _BASE_UNIT * 6,   // 24px
  xl: _BASE_UNIT * 8,      // 32px
  xxl: _BASE_UNIT * 12,    // 48px
  
  // Function to get custom spacing values based on multiplier
  getValue: (multiplier: number) => _BASE_UNIT * multiplier,
  
  // Object with predefined spacing values (0-10)
  values: {
    0: 0,
    1: _BASE_UNIT,         // 4px
    2: _BASE_UNIT * 2,     // 8px
    3: _BASE_UNIT * 3,     // 12px
    4: _BASE_UNIT * 4,     // 16px
    5: _BASE_UNIT * 5,     // 20px
    6: _BASE_UNIT * 6,     // 24px
    7: _BASE_UNIT * 7,     // 28px
    8: _BASE_UNIT * 8,     // 32px
    9: _BASE_UNIT * 9,     // 36px
    10: _BASE_UNIT * 10,   // 40px
  } as const,
};

// Layout-specific spacing constants
export const _layout = {
  screenPadding: _spacing.medium,      // Standard screen padding
  sectionSpacing: _spacing.large,      // Spacing between major sections
  elementSpacing: _spacing.small,      // Spacing between related elements
  stackSpacing: _spacing.medium,       // Vertical stack spacing
  inlineSpacing: _spacing.small,       // Horizontal inline spacing
  borderRadius: {
    small: _spacing.xs,                // 4px
    medium: _spacing.small,            // 8px
    large: _spacing.medium,            // 16px
    pill: 100,                        // Rounded pill shape
  },
};

export default {
  spacing: _spacing,
  layout: _layout,
};

// Backward-compatible exports
export const spacing = _spacing;
export const layout = _layout;
