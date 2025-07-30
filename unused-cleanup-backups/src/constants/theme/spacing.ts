/**
 * spacing.ts - Spacing system for the Card Show Finder application
 * 
 * This file centralizes all spacing values used throughout the app for consistency.
 * Using a consistent spacing scale helps maintain vertical rhythm and layout harmony.
 */

// Base unit for spacing (in pixels)
const BASE_UNIT = 4;

// Spacing scale - multipliers of the base unit
export const spacing = {
  xs: BASE_UNIT,          // 4px
  small: BASE_UNIT * 2,   // 8px
  medium: BASE_UNIT * 4,  // 16px
  large: BASE_UNIT * 6,   // 24px
  xl: BASE_UNIT * 8,      // 32px
  xxl: BASE_UNIT * 12,    // 48px
  
  // Function to get custom spacing values based on multiplier
  getValue: (multiplier: number) => BASE_UNIT * multiplier,
  
  // Object with predefined spacing values (0-10)
  values: {
    0: 0,
    1: BASE_UNIT,         // 4px
    2: BASE_UNIT * 2,     // 8px
    3: BASE_UNIT * 3,     // 12px
    4: BASE_UNIT * 4,     // 16px
    5: BASE_UNIT * 5,     // 20px
    6: BASE_UNIT * 6,     // 24px
    7: BASE_UNIT * 7,     // 28px
    8: BASE_UNIT * 8,     // 32px
    9: BASE_UNIT * 9,     // 36px
    10: BASE_UNIT * 10,   // 40px
  } as const,
};

// Layout-specific spacing constants
export const layout = {
  screenPadding: spacing.medium,      // Standard screen padding
  sectionSpacing: spacing.large,      // Spacing between major sections
  elementSpacing: spacing.small,      // Spacing between related elements
  stackSpacing: spacing.medium,       // Vertical stack spacing
  inlineSpacing: spacing.small,       // Horizontal inline spacing
  borderRadius: {
    small: spacing.xs,                // 4px
    medium: spacing.small,            // 8px
    large: spacing.medium,            // 16px
    pill: 100,                        // Rounded pill shape
  },
};

export default {
  spacing,
  layout,
};
