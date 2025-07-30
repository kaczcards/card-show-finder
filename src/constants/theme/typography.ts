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
    fontFamily: _fontFamily.heading,
    fontWeight: _fontWeight.bold,
    fontSize: _fontSize.h1,
    lineHeight: _lineHeight.small,
    letterSpacing: _letterSpacing.tight,
  },
  h2: {
    fontFamily: _fontFamily.heading,
    fontWeight: _fontWeight.bold,
    fontSize: _fontSize.h2,
    lineHeight: _lineHeight.small,
    letterSpacing: _letterSpacing.tight,
  },
  h3: {
    fontFamily: _fontFamily.heading,
    fontWeight: _fontWeight.semiBold,
    fontSize: _fontSize.h3,
    lineHeight: _lineHeight.small,
    letterSpacing: _letterSpacing.normal,
  },
  title: {
    fontFamily: _fontFamily.base,
    fontWeight: _fontWeight.semiBold,
    fontSize: _fontSize.title,
    lineHeight: _lineHeight.normal,
    letterSpacing: _letterSpacing.normal,
  },
  subtitle: {
    fontFamily: _fontFamily.base,
    fontWeight: _fontWeight.medium,
    fontSize: _fontSize.body,
    lineHeight: _lineHeight.normal,
    letterSpacing: _letterSpacing.normal,
  },
  body1: {
    fontFamily: _fontFamily.base,
    fontWeight: _fontWeight.regular,
    fontSize: _fontSize.body,
    lineHeight: _lineHeight.normal,
    letterSpacing: _letterSpacing.normal,
  },
  body2: {
    fontFamily: _fontFamily.base,
    fontWeight: _fontWeight.regular,
    fontSize: _fontSize.small,
    lineHeight: _lineHeight.normal,
    letterSpacing: _letterSpacing.normal,
  },
  button: {
    fontFamily: _fontFamily.base,
    fontWeight: _fontWeight.medium,
    fontSize: _fontSize.button,
    lineHeight: _lineHeight.small,
    letterSpacing: _letterSpacing.normal,
    textTransform: 'none' as const,
  },
  caption: {
    fontFamily: _fontFamily.base,
    fontWeight: _fontWeight.regular,
    fontSize: _fontSize.small,
    lineHeight: _lineHeight.small,
    letterSpacing: _letterSpacing.normal,
  },
  overline: {
    fontFamily: _fontFamily.base,
    fontWeight: _fontWeight.medium,
    fontSize: _fontSize.xs,
    lineHeight: _lineHeight.small,
    letterSpacing: _letterSpacing.wide,
    textTransform: 'uppercase' as const,
  },
};

// Export the typography system
export const _typography = {
  fontFamily: _fontFamily,
  fontWeight: _fontWeight,
  fontSize: _fontSize,
  lineHeight: _lineHeight,
  letterSpacing: _letterSpacing,
  variant: _variant,
};

export default _typography;

// Backward-compatible exports
export const typography = _typography;
export const fontFamily = _fontFamily;
export const fontWeight = _fontWeight;
export const fontSize = _fontSize;
export const lineHeight = _lineHeight;
export const letterSpacing = _letterSpacing;
export const variant = _variant;
