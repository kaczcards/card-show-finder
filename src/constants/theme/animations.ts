/**
 * animations.ts - Animation definitions for the Card Show Finder application
 * 
 * This file centralizes animation utilities, timing, and presets for consistent 
 * animations throughout the app.
 */

import { 
  Animated, 
  Easing, 
  ViewStyle, 
  EasingFunction, 
  LayoutAnimation 
} from 'react-native';

// Animation Durations
export const duration = {
  shortest: 150,
  shorter: 200,
  short: 250,
  standard: 300,
  longer: 400,
  longest: 500,
};

// Easing Presets
export const easing = {
  easeIn: Easing.in(Easing.ease),
  easeOut: Easing.out(Easing.ease),
  easeInOut: Easing.inOut(Easing.ease),
  sharp: Easing.bezier(0.4, 0.0, 0.6, 1),
  smooth: Easing.bezier(0.4, 0.2, 0.0, 1),
  bounce: Easing.bezier(0.0, 0.2, 0.5, 1.0),
};

// Animation Presets
export const animation = {
  // Fade In
  fadeIn: (value: Animated.Value, config?: { duration?: number; easing?: EasingFunction }) => {
    return Animated.timing(value, {
      toValue: 1,
      duration: config?.duration || duration.standard,
      easing: config?.easing || easing.easeOut,
      useNativeDriver: true,
    });
  },
  
  // Fade Out
  fadeOut: (value: Animated.Value, config?: { duration?: number; easing?: EasingFunction }) => {
    return Animated.timing(value, {
      toValue: 0,
      duration: config?.duration || duration.standard,
      easing: config?.easing || easing.easeIn,
      useNativeDriver: true,
    });
  },
  
  // Slide In from Bottom
  slideInFromBottom: (value: Animated.Value, config?: { distance?: number; duration?: number; easing?: EasingFunction }) => {
    const distance = config?.distance || 100;
    return Animated.timing(value, {
      toValue: 0,
      duration: config?.duration || duration.standard,
      easing: config?.easing || easing.easeOut,
      useNativeDriver: true,
    });
  },
  
  // Slide Out to Bottom
  slideOutToBottom: (value: Animated.Value, config?: { distance?: number; duration?: number; easing?: EasingFunction }) => {
    const distance = config?.distance || 100;
    return Animated.timing(value, {
      toValue: distance,
      duration: config?.duration || duration.standard,
      easing: config?.easing || easing.easeIn,
      useNativeDriver: true,
    });
  },

  // Scale Up
  scaleUp: (value: Animated.Value, config?: { toValue?: number; duration?: number; easing?: EasingFunction }) => {
    return Animated.timing(value, {
      toValue: config?.toValue || 1,
      duration: config?.duration || duration.standard,
      easing: config?.easing || easing.easeOut,
      useNativeDriver: true,
    });
  },

  // Scale Down
  scaleDown: (value: Animated.Value, config?: { toValue?: number; duration?: number; easing?: EasingFunction }) => {
    return Animated.timing(value, {
      toValue: config?.toValue || 0,
      duration: config?.duration || duration.standard,
      easing: config?.easing || easing.easeIn,
      useNativeDriver: true,
    });
  },

  // Button Press Animation
  buttonPress: (scaleValue: Animated.Value) => {
    const downScale = Animated.timing(scaleValue, {
      toValue: 0.95,
      duration: duration.shortest,
      easing: easing.easeOut,
      useNativeDriver: true,
    });
    
    const upScale = Animated.timing(scaleValue, {
      toValue: 1,
      duration: duration.shortest,
      easing: easing.easeOut,
      useNativeDriver: true,
    });
    
    return {
      onPressIn: () => {
        downScale.start();
      },
      onPressOut: () => {
        upScale.start();
      },
      style: {
        transform: [{ scale: scaleValue }],
      },
    };
  },
};

// Layout Animation Presets
export const layoutAnimation = {
  // Configure LayoutAnimation with a preset
  configureNext: (preset: 'spring' | 'easeInEaseOut' | 'linear' = 'easeInEaseOut', config?: LayoutAnimation.Config) => {
    switch (preset) {
      case 'spring':
        LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
        break;
      case 'linear':
        LayoutAnimation.configureNext(LayoutAnimation.Presets.linear);
        break;
      case 'easeInEaseOut':
      default:
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        break;
    }
  },
  
  // Custom layout animation configuration
  custom: (config: LayoutAnimation.Config) => {
    LayoutAnimation.configureNext(config);
  },
};

export default {
  duration,
  easing,
  animation,
  layoutAnimation,
};
