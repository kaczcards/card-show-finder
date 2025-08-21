import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SocialIcon from './SocialIcon';
import { openExternalLink, DEFAULT_WHITELIST_HOSTS } from '../../utils/safeLinking';

type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'whatnot' | 'ebay';

interface SocialUrls {
  facebookUrl?: string;
  facebook_url?: string;
  instagramUrl?: string;
  instagram_url?: string;
  twitterUrl?: string;
  twitter_url?: string;
  whatnotUrl?: string;
  whatnot_url?: string;
  ebayStoreUrl?: string;
  ebay_store_url?: string;
}

interface SocialLinksRowProps {
  urls: Partial<SocialUrls>;
  variant?: 'icons' | 'list';
  iconSize?: number;
  containerStyle?: StyleProp<ViewStyle>;
  onLinkPress?: (platform: SocialPlatform, url: string) => void;
}

export const SocialLinksRow: React.FC<SocialLinksRowProps> = ({
  urls,
  variant = 'icons',
  iconSize = 22,
  containerStyle,
  onLinkPress,
}) => {
  // Normalize URLs (handle both camelCase and snake_case)
  const normalizedUrls = {
    facebook: urls.facebookUrl || urls.facebook_url,
    instagram: urls.instagramUrl || urls.instagram_url,
    twitter: urls.twitterUrl || urls.twitter_url,
    whatnot: urls.whatnotUrl || urls.whatnot_url,
    ebay: urls.ebayStoreUrl || urls.ebay_store_url,
  };

  // Platform colors
  const platformColors = {
    facebook: '#4267B2',
    instagram: '#E1306C',
    twitter: '#1DA1F2',
    whatnot: '#FF3C4C',
    ebay: '#0064D2',
  };

  // Platform labels for list variant
  const platformLabels = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    twitter: 'Twitter/X',
    whatnot: 'Whatnot Store',
    ebay: 'eBay Store',
  };

  const handlePress = (platform: SocialPlatform, url: string) => {
    if (onLinkPress) {
      onLinkPress(platform, url);
    }
    openExternalLink(url, { whitelistHosts: DEFAULT_WHITELIST_HOSTS });
  };

  // Skip rendering if no URLs are provided
  if (!Object.values(normalizedUrls).some(Boolean)) {
    return null;
  }

  if (variant === 'list') {
    return (
      <View style={[styles.listContainer, containerStyle]}>
        {Object.entries(normalizedUrls).map(([platform, url]) => {
          if (!url) return null;
          
          const typedPlatform = platform as SocialPlatform;
          
          return (
            <TouchableOpacity
              key={platform}
              style={styles.listItem}
              onPress={() => handlePress(typedPlatform, url)}
              activeOpacity={0.7}
            >
              {(typedPlatform === 'whatnot' || typedPlatform === 'ebay') ? (
                <SocialIcon
                  platform={typedPlatform}
                  size={iconSize}
                  style={styles.listIcon}
                  onPress={() => handlePress(typedPlatform, url)}
                />
              ) : (
                <Ionicons
                  name={`logo-${platform}` as any}
                  size={iconSize}
                  color={platformColors[typedPlatform]}
                  style={styles.listIcon}
                />
              )}
              <View style={styles.listTextContainer}>
                <Text style={styles.listLabel}>
                  {platformLabels[typedPlatform]}
                </Text>
                <Text style={styles.listUrl} numberOfLines={1} ellipsizeMode="middle">
                  {url}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // Default: icons variant
  return (
    <View style={[styles.iconsContainer, containerStyle]}>
      {Object.entries(normalizedUrls).map(([platform, url]) => {
        if (!url) return null;
        
        const typedPlatform = platform as SocialPlatform;
        
        if (typedPlatform === 'whatnot' || typedPlatform === 'ebay') {
          return (
            <SocialIcon
              key={platform}
              platform={typedPlatform}
              size={iconSize}
              style={styles.icon}
              onPress={() => handlePress(typedPlatform, url)}
            />
          );
        }
        
        return (
          <TouchableOpacity
            key={platform}
            style={styles.icon}
            onPress={() => handlePress(typedPlatform, url)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={`logo-${platform}` as any}
              size={iconSize}
              color={platformColors[typedPlatform]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  icon: {
    marginRight: 12,
    marginBottom: 6,
    padding: 4,
  },
  listContainer: {
    width: '100%',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  listIcon: {
    marginRight: 12,
  },
  listTextContainer: {
    flex: 1,
  },
  listLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  listUrl: {
    fontSize: 16,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
});

export default SocialLinksRow;
