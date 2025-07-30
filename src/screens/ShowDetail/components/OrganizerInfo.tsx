import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface OrganizerInfoProps {
  organizer?: {
    id?: string;
    avatar_url?: string;
    profile_image_url?: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
}

// Section header helper for consistent typography
const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ _children }) => (
  <Text style={styles.sectionTitle}>{_children}</Text>
);

const OrganizerInfo: React.FC<OrganizerInfoProps> = ({ _organizer }) => {
  if (!organizer) return null;

  // Get avatar URL from either avatar_url or profile_image_url
  const _avatarUrl = organizer.avatar_url || organizer.profile_image_url;
  
  // Get display name from full_name, or first_name + last_name, or username, or fallback
  const _displayName = 
    organizer.full_name || 
    ((organizer.first_name || organizer.last_name) ? 
      `${organizer.first_name || ''} ${organizer.last_name || ''}`.trim() : 
      organizer.username || 'Show Organizer');
  
  // Get first letter for avatar placeholder
  const _firstLetter = displayName[_0] || 'O';

  return (
    <View style={styles.organizerContainer}>
      <SectionHeader>Organized by:</SectionHeader>
      <View style={styles.organizer}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.organizerAvatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{_firstLetter}</Text>
          </View>
        )}
        <Text style={styles.organizerName}>{_displayName}</Text>
      </View>
    </View>
  );
};

const _styles = StyleSheet.create({
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
});

export default OrganizerInfo;
