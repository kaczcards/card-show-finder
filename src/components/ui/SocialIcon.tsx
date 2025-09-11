import React from 'react';
import { TouchableOpacity, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';

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
        <Svg width={size} height={size} viewBox="0 0 20 20">
          <Path
            fill="#FF001F"
            d="M3.5,4h2.5c0.3,0,0.5,0.2,0.6,0.4l2.4,7.2l2.4-7.2C11.5,4.2,11.7,4,12,4h2.5c0.3,0,0.5,0.2,0.5,0.5v11
              c0,0.3-0.2,0.5-0.5,0.5h-1.8c-0.3,0-0.5-0.2-0.5-0.5v-6.1L10.7,14c-0.1,0.3-0.3,0.4-0.6,0.4h-0.2c-0.3,0-0.5-0.2-0.6-0.4L7.8,9.4
              v6.1c0,0.3-0.2,0.5-0.5,0.5H5.5C5.2,16,5,15.8,5,15.5v-11C5,4.2,5.2,4,3.5,4z"
          />
        </Svg>
      );
    }

    if (platform === 'ebay') {
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20">
          <G transform="translate(1.5, 6)" fillRule="evenodd">
            {/* e in red */}
            <Path
              fill="#E53238"
              d="M3.8,4.2c-0.7,0-1.3-0.2-1.7-0.5C1.7,3.3,1.5,2.9,1.5,2.4c0-0.5,0.2-1,0.6-1.3C2.5,0.7,3.1,0.5,3.8,0.5
              c0.4,0,0.8,0.1,1.1,0.2v1C4.6,1.5,4.3,1.4,4,1.4c-0.4,0-0.7,0.1-0.9,0.3C2.9,1.9,2.8,2.1,2.8,2.4c0,0.3,0.1,0.5,0.3,0.7
              c0.2,0.2,0.5,0.3,0.9,0.3c0.3,0,0.6-0.1,0.9-0.2v0.9C4.6,4.2,4.2,4.2,3.8,4.2z"
            />
            {/* b in blue */}
            <Path
              fill="#0064D2"
              d="M7.1,4.2C6.5,4.2,6,4,5.7,3.7C5.3,3.4,5.2,3,5.2,2.4c0-0.6,0.2-1.1,0.5-1.4C6.1,0.7,6.6,0.5,7.2,0.5
              c0.5,0,1,0.2,1.3,0.5c0.3,0.3,0.5,0.8,0.5,1.3c0,0.6-0.2,1.1-0.5,1.4C8.1,4,7.7,4.2,7.1,4.2z M7.2,1.4C6.9,1.4,6.7,1.5,6.6,1.7
              C6.4,1.9,6.4,2.1,6.4,2.4c0,0.6,0.3,0.9,0.8,0.9c0.5,0,0.8-0.3,0.8-0.9C8,1.7,7.7,1.4,7.2,1.4z"
            />
            {/* a in yellow */}
            <Path
              fill="#F5AF02"
              d="M11.5,0.6l-0.2,0.8c-0.3-0.1-0.5-0.2-0.8-0.2c-0.4,0-0.7,0.1-0.9,0.4c-0.2,0.3-0.3,0.7-0.3,1.2
              c0,0.5,0.1,0.9,0.3,1.1c0.2,0.2,0.5,0.4,0.9,0.4c0.2,0,0.5-0.1,0.7-0.2l0.2,0.8c-0.3,0.1-0.7,0.2-1.1,0.2c-0.6,0-1.1-0.2-1.5-0.6
              c-0.4-0.4-0.6-0.9-0.6-1.6c0-0.7,0.2-1.3,0.6-1.7c0.4-0.4,1-0.6,1.7-0.6C10.8,0.5,11.2,0.5,11.5,0.6z"
            />
            {/* y in green */}
            <Path
              fill="#86B817"
              d="M14.8,4.1h-1.2l-0.8-1.3l-0.8,1.3h-1.1l1.3-2L11,0.6h1.1l0.7,1.2l0.7-1.2h1.1l-1.2,1.6L14.8,4.1z"
            />
          </G>
        </Svg>
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
