import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SocialIcon from '../../../components/ui/SocialIcon';

interface OrganizerInfoProps {
  organizer?: {
    id?: string;
    avatar_url?: string;
    profile_image_url?: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    facebook_url?: string;
    instagram_url?: string;
    twitter_url?: string;
    whatnot_url?: string;
    ebay_store_url?: string;
  };
}

// Section header helper for consistent typography
const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

const OrganizerInfo: React.FC<OrganizerInfoProps> = ({ organizer }) => {
  if (!organizer) return null;

  // Get avatar URL from either avatar_url or profile_image_url
  const avatarUrl = organizer.avatar_url || organizer.profile_image_url;
  
  // Get display name from full_name, or first_name + last_name, or username, or fallback
  const displayName = 
    organizer.full_name || 
    ((organizer.first_name || organizer.last_name) ? 
      `${organizer.first_name || ''} ${organizer.last_name || ''}`.trim() : 
      organizer.username || 'Show Organizer');
  
  // Get first letter for avatar placeholder
  const firstLetter = displayName[0] || 'O';

  // Social URLs
  const social = {
    facebook: organizer.facebook_url,
    instagram: organizer.instagram_url,
    twitter: organizer.twitter_url,
    whatnot: organizer.whatnot_url,
    ebay: organizer.ebay_store_url,
  };

  const handleOpenLink = (url?: string) => {
    if (!url) return;
    let formatted = url.trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = `https://${formatted}`;
    }
    Linking.openURL(formatted).catch(() =>
      Alert.alert('Unable to open link', 'Please make sure the URL is valid.'),
    );
  };

  return (
    <View style={styles.organizerContainer}>
      <SectionHeader>Organized by:</SectionHeader>
      <View style={styles.organizer}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.organizerAvatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{firstLetter}</Text>
          </View>
        )}
        <Text style={styles.organizerName}>{displayName}</Text>
      </View>

      {/* Social links row */}
      {(social.facebook ||
        social.instagram ||
        social.twitter ||
        social.whatnot ||
        social.ebay) && (
        <View style={styles.socialRow}>
          {social.facebook && (
            <TouchableOpacity
              style={styles.socialIcon}
              onPress={() => handleOpenLink(social.facebook)}
            >
              <Ionicons name="logo-facebook" size={22} color="#4267B2" />
            </TouchableOpacity>
          )}
          {social.instagram && (
            <TouchableOpacity
              style={styles.socialIcon}
              onPress={() => handleOpenLink(social.instagram)}
            >
              <Ionicons name="logo-instagram" size={22} color="#E1306C" />
            </TouchableOpacity>
          )}
          {social.twitter && (
            <TouchableOpacity
              style={styles.socialIcon}
              onPress={() => handleOpenLink(social.twitter)}
            >
              <Ionicons name="logo-twitter" size={22} color="#1DA1F2" />
            </TouchableOpacity>
          )}
          {social.whatnot && (
            <SocialIcon
              platform="whatnot"
              onPress={() => handleOpenLink(social.whatnot)}
            />
          )}
          {social.ebay && (
            <SocialIcon
              platform="ebay"
              onPress={() => handleOpenLink(social.ebay)}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  organizerContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  organizer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0057B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  organizerName: {
    fontSize: 16,
    fontWeight: '500',
  },
  socialRow: {
    flexDirection: 'row',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  socialIcon: {
    marginRight: 12,
    marginBottom: 6,
  },
});

export default OrganizerInfo;
