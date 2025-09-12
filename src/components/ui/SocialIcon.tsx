import React from 'react';
import { TouchableOpacity, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { SvgUri } from 'react-native-svg';

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
  platform,
  onPress,
  style,
  iconStyle,
  size = 22, // bump default for better visibility
  activeOpacity = 0.7,
}) => {
  // Map of platform to image source (for remote/png icons)
  const getImageSource = () => {
    switch (platform) {
      case 'facebook':
        // Fallback to Ionicons for platforms we haven't created custom icons for yet
        return { uri: 'https://cdn.iconscout.com/icon/free/png-256/free-facebook-logo-2019-1597680-1350125.png' };
      case 'instagram':
        return { uri: 'https://cdn.iconscout.com/icon/free/png-256/free-instagram-1868978-1583142.png' };
      case 'twitter':
        return { uri: 'https://cdn.iconscout.com/icon/free/png-256/free-twitter-241-721979.png' };
      default:
        // Fallback to Instagram icon since Whatnot/eBay are rendered via inline SVG
        return { uri: 'https://cdn.iconscout.com/icon/free/png-256/free-instagram-1868978-1583142.png' };
    }
  };

  // Render icon node (SVG for Whatnot/eBay, Image for others)
  const renderIcon = () => {
    if (platform === 'whatnot') {
      return (
        <SvgUri
          uri="https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/svg/whatnot.svg"
          width={size}
          height={size}
        />
      );
    }

    if (platform === 'ebay') {
      return (
        <SvgUri
          uri="https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg"
          width={size}
          height={size}
        />
      );
    }

    // default image usage
    return (
      <Image
        source={getImageSource()}
        style={[
          styles.iconImage,
          { width: size, height: size },
          iconStyle,
        ]}
        resizeMode="contain"
      />
    );
  };

  return (
    <TouchableOpacity
      style={[styles.socialIconButton, style]}
      onPress={onPress}
      activeOpacity={activeOpacity}
      accessibilityLabel={`${platform} link`}
      accessibilityRole="button"
    >
      {renderIcon()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
