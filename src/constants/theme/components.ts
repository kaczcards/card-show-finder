/**
 * components.ts - Component style definitions for the Card Show Finder application
 * 
 * This file centralizes styles for common components used throughout the app for consistency.
 * Components can reference these styles instead of defining their own.
 */

import { TextStyle, ViewStyle } from 'react-native';
import colors from './colors';
import typography from './typography';
import shadows from './shadows';
import spacing from './spacing';

// Button styles
export const _buttons = {
  // Primary button
  primary: {
    container: {
      backgroundColor: colors.primary.main,
      paddingVertical: spacing.spacing.medium,
      paddingHorizontal: spacing.spacing.large,
      borderRadius: spacing.layout.borderRadius.medium,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      ...shadows.small,
    } as ViewStyle,
    text: {
      ...typography.variant.button,
      color: colors.primary.contrast,
      textAlign: 'center' as const,
    } as TextStyle,
    pressedContainer: {
      backgroundColor: colors.primary.dark,
    } as ViewStyle,
    disabledContainer: {
      backgroundColor: colors.action.disabled,
    } as ViewStyle,
    disabledText: {
      color: colors.action.disabledText,
    } as TextStyle,
  },
  
  // Secondary button
  secondary: {
    container: {
      backgroundColor: colors.secondary.main,
      paddingVertical: spacing.spacing.medium,
      paddingHorizontal: spacing.spacing.large,
      borderRadius: spacing.layout.borderRadius.medium,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      ...shadows.small,
    } as ViewStyle,
    text: {
      ...typography.variant.button,
      color: colors.secondary.contrast,
      textAlign: 'center' as const,
    } as TextStyle,
    pressedContainer: {
      backgroundColor: colors.secondary.dark,
    } as ViewStyle,
    disabledContainer: {
      backgroundColor: colors.action.disabled,
    } as ViewStyle,
    disabledText: {
      color: colors.action.disabledText,
    } as TextStyle,
  },
  
  // Outline button
  outline: {
    container: {
      backgroundColor: 'transparent',
      paddingVertical: spacing.spacing.medium,
      paddingHorizontal: spacing.spacing.large,
      borderRadius: spacing.layout.borderRadius.medium,
      borderWidth: 1,
      borderColor: colors.primary.main,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    } as ViewStyle,
    text: {
      ...typography.variant.button,
      color: colors.primary.main,
      textAlign: 'center' as const,
    } as TextStyle,
    pressedContainer: {
      backgroundColor: colors.primary.light + '20', // 20% opacity
      borderColor: colors.primary.dark,
    } as ViewStyle,
    disabledContainer: {
      borderColor: colors.action.disabled,
    } as ViewStyle,
    disabledText: {
      color: colors.action.disabledText,
    } as TextStyle,
  },
  
  // Text button (no background)
  text: {
    container: {
      backgroundColor: 'transparent',
      paddingVertical: spacing.spacing.small,
      paddingHorizontal: spacing.spacing.medium,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    } as ViewStyle,
    text: {
      ...typography.variant.button,
      color: colors.primary.main,
      textAlign: 'center' as const,
    } as TextStyle,
    pressedContainer: {
      backgroundColor: colors.primary.light + '10', // 10% opacity
    } as ViewStyle,
    disabledContainer: {},
    disabledText: {
      color: colors.action.disabledText,
    } as TextStyle,
  },
};

// Card styles
export const _cards = {
  // Standard card
  standard: {
    container: {
      backgroundColor: colors.background.paper,
      borderRadius: spacing.layout.borderRadius.medium,
      padding: spacing.spacing.medium,
      ...shadows.small,
    } as ViewStyle,
    title: {
      ...typography.variant.title,
      marginBottom: spacing.spacing.small,
    } as TextStyle,
    content: {
      ...typography.variant.body1,
    } as TextStyle,
    footer: {
      marginTop: spacing.spacing.medium,
      flexDirection: 'row' as const,
      justifyContent: 'flex-end' as const,
    } as ViewStyle,
  },
  
  // Flat card (no shadow)
  flat: {
    container: {
      backgroundColor: colors.background.paper,
      borderRadius: spacing.layout.borderRadius.medium,
      padding: spacing.spacing.medium,
      borderWidth: 1,
      borderColor: colors.neutral.border,
    } as ViewStyle,
    title: {
      ...typography.variant.title,
      marginBottom: spacing.spacing.small,
    } as TextStyle,
    content: {
      ...typography.variant.body1,
    } as TextStyle,
    footer: {
      marginTop: spacing.spacing.medium,
      flexDirection: 'row' as const,
      justifyContent: 'flex-end' as const,
    } as ViewStyle,
  },
  
  // Compact card
  compact: {
    container: {
      backgroundColor: colors.background.paper,
      borderRadius: spacing.layout.borderRadius.medium,
      padding: spacing.spacing.small,
      ...shadows.xs,
    } as ViewStyle,
    title: {
      ...typography.variant.subtitle,
      marginBottom: spacing.spacing.xs,
    } as TextStyle,
    content: {
      ...typography.variant.body2,
    } as TextStyle,
    footer: {
      marginTop: spacing.spacing.small,
      flexDirection: 'row' as const,
      justifyContent: 'flex-end' as const,
    } as ViewStyle,
  },
};

// Input styles
export const _inputs = {
  // Standard text input
  standard: {
    container: {
      marginBottom: spacing.spacing.medium,
    } as ViewStyle,
    label: {
      ...typography.variant.caption,
      marginBottom: spacing.spacing.xs,
      color: colors.text.secondary,
    } as TextStyle,
    input: {
      backgroundColor: colors.background.paper,
      borderWidth: 1,
      borderColor: colors.neutral.border,
      borderRadius: spacing.layout.borderRadius.medium,
      paddingHorizontal: spacing.spacing.medium,
      paddingVertical: spacing.spacing.small + 2, // Additional 2px for better touch area
      fontSize: typography.fontSize.body,
      color: colors.text.primary,
    } as TextStyle,
    focusedInput: {
      borderColor: colors.primary.main,
      borderWidth: 2,
    } as TextStyle,
    errorInput: {
      borderColor: colors.feedback.error.main,
    } as TextStyle,
    helperText: {
      ...typography.variant.caption,
      marginTop: spacing.spacing.xs,
      color: colors.text.secondary,
    } as TextStyle,
    errorText: {
      ...typography.variant.caption,
      marginTop: spacing.spacing.xs,
      color: colors.feedback.error.main,
    } as TextStyle,
  },
};

// List item styles
export const _listItems = {
  // Standard list item
  standard: {
    container: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: spacing.spacing.medium,
      paddingHorizontal: spacing.spacing.medium,
      borderBottomWidth: 1,
      borderBottomColor: colors.neutral.lightGray,
      backgroundColor: colors.background.paper,
    } as ViewStyle,
    content: {
      flex: 1,
    } as ViewStyle,
    title: {
      ...typography.variant.subtitle,
      color: colors.text.primary,
    } as TextStyle,
    description: {
      ...typography.variant.body2,
      color: colors.text.secondary,
      marginTop: spacing.spacing.xs,
    } as TextStyle,
  },
};

// Loading state styles
export const _loadingStates = {
  // Screen loading state
  fullScreen: {
    container: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      backgroundColor: colors.background.default,
    } as ViewStyle,
    text: {
      ...typography.variant.body1,
      color: colors.text.secondary,
      marginTop: spacing.spacing.medium,
    } as TextStyle,
    indicatorColor: colors.primary.main,
  },
  
  // In-component loading state
  inline: {
    container: {
      padding: spacing.spacing.medium,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    } as ViewStyle,
    text: {
      ...typography.variant.body2,
      color: colors.text.secondary,
      marginTop: spacing.spacing.small,
    } as TextStyle,
    indicatorColor: colors.primary.main,
  },
};

// Error state styles
export const _errorStates = {
  // Screen error state
  fullScreen: {
    container: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      backgroundColor: colors.background.default,
      padding: spacing.spacing.large,
    } as ViewStyle,
    icon: {
      color: colors.primary.main,
      marginBottom: spacing.spacing.medium,
    },
    title: {
      ...typography.variant.h2,
      color: colors.text.primary,
      textAlign: 'center' as const,
      marginBottom: spacing.spacing.small,
    } as TextStyle,
    message: {
      ...typography.variant.body1,
      color: colors.text.secondary,
      textAlign: 'center' as const,
      marginBottom: spacing.spacing.large,
    } as TextStyle,
    button: _buttons.primary,
  },
  
  // Inline error state
  inline: {
    container: {
      backgroundColor: colors.feedback.error.light,
      borderRadius: spacing.layout.borderRadius.medium,
      padding: spacing.spacing.medium,
      marginVertical: spacing.spacing.small,
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
    } as ViewStyle,
    icon: {
      color: colors.feedback.error.main,
      marginRight: spacing.spacing.small,
      marginTop: 2, // Align with text
    },
    text: {
      ...typography.variant.body2,
      color: colors.feedback.error.dark,
      flex: 1,
    } as TextStyle,
  },
};

export default {
  buttons: _buttons,
  cards: _cards,
  inputs: _inputs,
  listItems: _listItems,
  loadingStates: _loadingStates,
  errorStates: _errorStates,
};

// ------------------------------------------------------------------
// Backward-compatible named exports
// ------------------------------------------------------------------
export const buttons = _buttons;
export const cards = _cards;
export const inputs = _inputs;
export const listItems = _listItems;
export const loadingStates = _loadingStates;
export const errorStates = _errorStates;
