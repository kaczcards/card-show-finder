import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleProp,
  ViewStyle,
  TextStyle,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface ButtonProps {
  /**
   * Button type: primary, secondary, outline, or text
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  
  /**
   * The text label for the button
   */
  label: string;
  
  /**
   * The function to call when the button is pressed
   */
  onPress: () => void;
  
  /**
   * Whether the button should be disabled
   */
  disabled?: boolean;
  
  /**
   * Whether the button should show a loading indicator
   */
  loading?: boolean;
  
  /**
   * Optional custom style for the button container
   */
  style?: StyleProp<ViewStyle>;
  
  /**
   * Optional custom style for the button text
   */
  textStyle?: StyleProp<TextStyle>;
  
  /**
   * Whether to animate the button press
   */
  animated?: boolean;
}

/**
 * Button - A standardized button component
 * 
 * This component provides a consistent button style throughout the app,
 * with support for different variants, loading states, and animations.
 */
const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
  animated = true,
}) => {
  // Get theme from context
  const { theme } = useTheme();
  
  // Animation value for scale
  const scaleValue = useRef(new Animated.Value(1)).current;
  
  // Get button styles based on variant
  const buttonStyle = theme.components.buttons[variant];
  
  // Setup animation handlers if animated is true
  // When animations are disabled, this will remain undefined
  const _animationHandlers = animated 
    ? theme.animations.animation.buttonPress(scaleValue) 
    : undefined;
  
  // Determine final styles based on state
  const _containerStyle = [
    buttonStyle.container,
    disabled && buttonStyle.disabledContainer,
    style,
  ];
  
  const _labelStyle = [
    buttonStyle.text,
    disabled && buttonStyle.disabledText,
    textStyle,
  ];
  
  return (
    <Animated.View style={animationHandlers?.style}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        disabled={disabled || loading}
        style={_containerStyle}
        {...(animated
          ? {
              onPressIn: animationHandlers?.onPressIn,
              onPressOut: animationHandlers?.onPressOut,
            }
          : {})}
      >
        {loading ? (
          <ActivityIndicator 
            color={buttonStyle.text.color} 
            size="small" 
          />
        ) : (
          <Text style={_labelStyle}>{_label}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default Button;
