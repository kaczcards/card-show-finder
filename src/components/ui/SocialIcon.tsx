import React from 'react';
import { TouchableOpacity, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';

/**
 * Supported social media platforms
 */
export type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'whatnot' | 'ebay';

/**
 * Props for the SocialIcon component
 */
interface SocialIconProps {
  /**
   * The social media platform to display
   */
  platform: SocialPlatform;
  
  /**
   * Function to call when the icon is pressed
   */
  onPress: () => void;
  
  /**
   * Optional style to apply to the container
   */
  style?: ViewStyle;
  
  /**
   * Optional style to apply to the icon image
   */
  iconStyle?: ImageStyle;
  
  /**
   * Optional size override (default: 20)
   */
  size?: number;
  
  /**
   * Optional active opacity (default: 0.7)
   */
  activeOpacity?: number;
}

/**
 * A reusable component for displaying social media icons
 * Replaces Ionicons with custom platform logo images
 */
const SocialIcon: React.FC<SocialIconProps> = ({
  _platform,
  _onPress,
  style,
  iconStyle,
  size = 20,
  _activeOpacity = 0.7,
}) => {
  // Map of platform to image source
  const _getImageSource = () => {
    switch (_platform) {
      case 'whatnot':
        return require('../../../assets/images/social/whatnot-logo.png');
      case 'ebay':
        return require('../../../assets/images/social/ebay-logo.png');
      case 'facebook':
        // Fallback to Ionicons for platforms we haven't created custom icons for yet
        return { uri: 'https://cdn.iconscout.com/icon/free/png-256/free-facebook-logo-2019-1597680-1350125.png' };
      case 'instagram':
        return { uri: 'https://cdn.iconscout.com/icon/free/png-256/free-instagram-1868978-1583142.png' };
      case 'twitter':
        return { uri: 'https://cdn.iconscout.com/icon/free/png-256/free-twitter-241-721979.png' };
      default:
        return require('../../../assets/images/social/whatnot-logo.png');
    }
  };

  // Map of platform to brand color
  const _getPlatformColor = (): string => {
    switch (_platform) {
      case 'whatnot':
        return '#FF001F';
      case 'ebay':
        return '#E53238';
      case 'facebook':
        return '#1877F2';
      case 'instagram':
        return '#C13584';
      case 'twitter':
        return '#1DA1F2';
      default:
        return '#FF001F';
    }
  };

  return (
    <TouchableOpacity
      style={[styles.socialIconButton, style]}
      onPress={_onPress}
      activeOpacity={_activeOpacity}
      accessibilityLabel={`${_platform} link`}
      accessibilityRole="button"
    >
      <Image
        source={getImageSource()}
        style={[
          styles.iconImage,
          { width: size, height: size },
          iconStyle,
        ]}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
};

const _styles = StyleSheet.create({
  socialIconButton: {
    width: 40, // Match existing size from MapShowCluster.tsx
    height: 40, // Match existing size from MapShowCluster.tsx
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  iconImage: {
    width: 20,
    height: 20,
  },
});

export default SocialIcon;
