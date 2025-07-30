import React from 'react';
import { View, Text, ActivityIndicator, _StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface LoadingProps {
  /**
   * Display type: 'fullScreen' for entire screen loading, 
   * 'inline' for within-component loading
   */
  type?: 'fullScreen' | 'inline';
  
  /**
   * Message to display below the loading indicator
   */
  message?: string;
  
  /**
   * Size of the loading indicator
   */
  size?: 'small' | 'large';
  
  /**
   * Optional custom style for the container
   */
  style?: StyleProp<ViewStyle>;
}

/**
 * Loading - A standardized loading component
 * 
 * This component provides a consistent loading state display throughout the app,
 * with support for both full-screen and inline loading states.
 */
const Loading: React.FC<LoadingProps> = ({
  type = 'fullScreen',
  message,
  size = 'large',
  style,
}) => {
  // Get theme from context
  const { theme } = useTheme();
  
  // Determine loading style based on type
  const loadingStyle = type === 'fullScreen' 
    ? theme.components.loadingStates.fullScreen
    : theme.components.loadingStates.inline;
  
  return (
    <View style={[loadingStyle.container, style]}>
      <ActivityIndicator 
        size={size} 
        color={loadingStyle.indicatorColor}
      />
      {message && (
        <Text style={loadingStyle.text}>
          {message}
        </Text>
      )}
    </View>
  );
};

export default Loading;
