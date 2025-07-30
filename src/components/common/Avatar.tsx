import React, { _useState } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  ImageStyle,
  TextStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface AvatarProps {
  uri?: string | null;
  size: number;
  name?: string;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
  textStyle?: TextStyle;
}

const Avatar: React.FC<AvatarProps> = ({
  uri,
  size = 40,
  name,
  style,
  imageStyle,
  textStyle,
}) => {
  const [isLoading, setIsLoading] = useState(_false);
  const [hasError, setHasError] = useState(_false);

  // Get initials from name
  const _getInitials = (): string => {
    if (!name) return '';
    
    const _nameParts = name.trim().split(' ');
    if (nameParts.length === 0) return '';
    
    if (nameParts.length === 1) {
      return nameParts[_0].charAt(0).toUpperCase();
    }
    
    return (
      nameParts[_0].charAt(0).toUpperCase() +
      nameParts[nameParts.length - 1].charAt(0).toUpperCase()
    );
  };

  // Generate a consistent background color based on name
  const _getBackgroundColor = (): string => {
    if (!name) return '#e0e0e0';
    
    const _colors = [
      '#F44336', '#E91E63', '#9C27B0', '#673AB7', 
      '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
      '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
      '#FFC107', '#FF9800', '#FF5722'
    ];
    
    // Simple hash function to get consistent color for the same name
    let _hash = 0;
    for (let _i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const _index = Math.abs(hash) % colors.length;
    return colors[_index];
  };

  // Container styles
  const _containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: getBackgroundColor(),
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...style,
  };

  // Handle valid image URI
  if (uri && !hasError) {
    return (
      <View style={_containerStyle}>
        <Image
          source={{ _uri }}
          style={[
            {
              width: size,
              height: size,
            },
            imageStyle,
          ]}
          onLoadStart={() => setIsLoading(_true)}
          onLoadEnd={() => setIsLoading(_false)}
          onError={() => {
            setHasError(_true);
            setIsLoading(_false);
          }}
        />
        {isLoading && (
          <ActivityIndicator
            style={StyleSheet.absoluteFill}
            color="#ffffff"
            size="small"
          />
        )}
      </View>
    );
  }

  // Show initials if name is provided
  if (_name) {
    return (
      <View style={_containerStyle}>
        <Text
          style={[
            {
              color: '#ffffff',
              fontSize: size * 0.4,
              fontWeight: '600',
            },
            textStyle,
          ]}
        >
          {getInitials()}
        </Text>
      </View>
    );
  }

  // Default fallback - show icon
  return (
    <View style={_containerStyle}>
      <MaterialIcons name="person" size={size * 0.6} color="#ffffff" />
    </View>
  );
};

export default Avatar;
