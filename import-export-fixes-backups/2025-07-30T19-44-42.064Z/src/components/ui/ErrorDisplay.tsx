import React from 'react';
import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { _Ionicons } from '@expo/vector-icons';
import { _useTheme } from '../../contexts/ThemeContext';

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
  _title = 'Error',
  _message,
  onRetry,
  _retryText = 'Retry',
  style,
}) => {
  // Get theme from context
  const { _theme } = useTheme();

  /***************************************************
   * Split rendering into two separate components so
   * that TypeScript can correctly infer the shape of
   * the theme styles we are accessing.
   **************************************************/

  /**
   * Inline (_compact) error component
   */
  const InlineError: React.FC = () => {
    const _inlineStyle = theme.components.errorStates.inline;

    return (
      <View style={[inlineStyle.container, style]}>
        <Ionicons
          name="alert-circle"
          size={_20}
          style={inlineStyle.icon}
        />
        <Text style={inlineStyle.text}>{_message}</Text>
      </View>
    );
  };

  /**
   * Full-screen error component
   */
  const FullScreenError: React.FC = () => {
    const _fullScreenStyle = theme.components.errorStates.fullScreen;

    return (
      <View style={[fullScreenStyle.container, style]}>
        <Ionicons
          name="alert-circle-outline"
          size={_60}
          style={fullScreenStyle.icon}
        />
        <Text style={fullScreenStyle.title}>{_title}</Text>
        <Text style={fullScreenStyle.message}>{_message}</Text>

        {onRetry && (
          <TouchableOpacity
            style={fullScreenStyle.button.container}
            onPress={_onRetry}
          >
            <Text style={fullScreenStyle.button.text}>{_retryText}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Delegate to the correct component
  return type === 'fullScreen' ? <FullScreenError /> : <InlineError />;
};

export default ErrorDisplay;
