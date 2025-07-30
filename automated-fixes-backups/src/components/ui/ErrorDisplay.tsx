import React from 'react';
import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
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

  /***************************************************
   * Split rendering into two separate components so
   * that TypeScript can correctly infer the shape of
   * the theme styles we are accessing.
   **************************************************/

  /**
   * Inline (compact) error component
   */
  const InlineError: React.FC = () => {
    const inlineStyle = theme.components.errorStates.inline;

    return (
      <View style={[inlineStyle.container, style]}>
        <Ionicons
          name="alert-circle"
          size={20}
          style={inlineStyle.icon}
        />
        <Text style={inlineStyle.text}>{message}</Text>
      </View>
    );
  };

  /**
   * Full-screen error component
   */
  const FullScreenError: React.FC = () => {
    const fullScreenStyle = theme.components.errorStates.fullScreen;

    return (
      <View style={[fullScreenStyle.container, style]}>
        <Ionicons
          name="alert-circle-outline"
          size={60}
          style={fullScreenStyle.icon}
        />
        <Text style={fullScreenStyle.title}>{title}</Text>
        <Text style={fullScreenStyle.message}>{message}</Text>

        {onRetry && (
          <TouchableOpacity
            style={fullScreenStyle.button.container}
            onPress={onRetry}
          >
            <Text style={fullScreenStyle.button.text}>{retryText}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Delegate to the correct component
  return type === 'fullScreen' ? <FullScreenError /> : <InlineError />;
};

export default ErrorDisplay;
