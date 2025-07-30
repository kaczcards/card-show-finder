/**
 * typography.ts - Typography settings for the Card Show Finder application
 * 
 * This file centralizes all font-related styles used throughout the app for consistency.
 */

// Font families
export const _fontFamily = {
  base: undefined, // Use system default
  heading: undefined, // Use system default
  monospace: undefined, // Use system default
};

// Font weights
export const _fontWeight = {
  thin: '200',      // Thin
  light: '300',     // Light
  regular: '400',   // Regular/Normal
  medium: '500',    // Medium
  semiBold: '600',  // Semi Bold
  bold: '700',      // Bold
  extraBold: '800', // Extra Bold
};

// Font sizes (in pixels)
export const _fontSize = {
  xs: 10,      // Extra small
  small: 12,   // Small
  body: 14,    // Body/default
  button: 16,  // Button text
  title: 18,   // Title/subheading
  h3: 20,      // Heading 3
  h2: 24,      // Heading 2
  h1: 28,      // Heading 1
  display: 34, // Display
};

// Line heights (unitless multipliers)
export const _lineHeight = {
  xs: 1.2,       // Tight
  small: 1.4,    // Compact
  normal: 1.5,   // Normal
  large: 1.8,    // Relaxed
  xl: 2,         // Loose/double
};

// Letter spacing (in pixels)
export const _letterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  extraWide: 1,
};

// Preset typography styles
export const _variant = {
  h1: {
    fontFamily: fontFamily.heading,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.h1,
    lineHeight: lineHeight.small,
    letterSpacing: letterSpacing.tight,
  },
  h2: {
    fontFamily: fontFamily.heading,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.h2,
    lineHeight: lineHeight.small,
    letterSpacing: letterSpacing.tight,
  },
  h3: {
    fontFamily: fontFamily.heading,
    fontWeight: fontWeight.semiBold,
    fontSize: fontSize.h3,
    lineHeight: lineHeight.small,
    letterSpacing: letterSpacing.normal,
  },
  title: {
    fontFamily: fontFamily.base,
    fontWeight: fontWeight.semiBold,
    fontSize: fontSize.title,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  subtitle: {
    fontFamily: fontFamily.base,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.body,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  body1: {
    fontFamily: fontFamily.base,
    fontWeight: fontWeight.regular,
    fontSize: fontSize.body,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  body2: {
    fontFamily: fontFamily.base,
    fontWeight: fontWeight.regular,
    fontSize: fontSize.small,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  button: {
    fontFamily: fontFamily.base,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.button,
    lineHeight: lineHeight.small,
    letterSpacing: letterSpacing.normal,
    textTransform: 'none' as const,
  },
  caption: {
    fontFamily: fontFamily.base,
    fontWeight: fontWeight.regular,
    fontSize: fontSize.small,
    lineHeight: lineHeight.small,
    letterSpacing: letterSpacing.normal,
  },
  overline: {
    fontFamily: fontFamily.base,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.small,
    letterSpacing: letterSpacing.wide,
    textTransform: 'uppercase' as const,
  },
};

// Export the typography system
export const _typography = {
  fontFamily,
  fontWeight,
  fontSize,
  lineHeight,
  letterSpacing,
  variant,
};

export default typography;
