import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

interface ErrorDisplayProps {
  /**
   * Display type: 'fullScreen' for entire screen error, 
   * 'inline' for within-component error
   */
  type?: 'fullScreen' | 'inline';
  
  /**
   * The error title (for fullScreen type)
   */
  title?: string;
  
  /**
   * The error message
   */
  message: string;
  
  /**
   * Optional retry action
   */
  onRetry?: () => void;
  
  /**
   * Custom retry button text
   */
  retryText?: string;
  
  /**
   * Optional custom style for the container
   */
  style?: StyleProp<ViewStyle>;
}

/**
 * ErrorDisplay - A standardized error display component
 * 
 * This component provides a consistent error state display throughout the app,
 * with support for both full-screen and inline error states.
 */
const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  type = 'inline',
  title = 'Error',
  message,
  onRetry,
  retryText = 'Retry',
  style,
}) => {
  // Get theme from context
  const { theme } = useTheme();
  
  // Get error styles based on type
  const errorStyle = type === 'fullScreen'
    ? theme.components.errorStates.fullScreen
    : theme.components.errorStates.inline;
  
  // For inline errors
  if (type === 'inline') {
    return (
      <View style={[errorStyle.container, style]}>
        <Ionicons 
          name="alert-circle" 
          size={20} 
          style={errorStyle.icon} 
        />
        <Text style={errorStyle.text}>{message}</Text>
      </View>
    );
  }
  
  // For full screen errors
  return (
    <View style={[errorStyle.container, style]}>
      <Ionicons 
        name="alert-circle-outline" 
        size={60} 
        style={errorStyle.icon} 
      />
      <Text style={errorStyle.title}>{title}</Text>
      <Text style={errorStyle.message}>{message}</Text>
      
      {onRetry && (
        <TouchableOpacity
          style={errorStyle.button.container}
          onPress={onRetry}
        >
          <Text style={errorStyle.button.text}>{retryText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default ErrorDisplay;
