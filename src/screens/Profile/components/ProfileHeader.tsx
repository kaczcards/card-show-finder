import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ProfileHeaderProps {
  avatarUrl?: string;
  firstName: string;
  lastName?: string;
  roleLabel: string;
  isEditMode: boolean;
  isSubmitting?: boolean;
  onToggleEdit: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  avatarUrl,
  firstName,
  lastName,
  roleLabel,
  isEditMode,
  isSubmitting = false,
  onToggleEdit,
}) => {
  const initials = `${firstName.charAt(0)}${lastName ? lastName.charAt(0) : ''}`;

  return (
    <View style={styles.header}>
      <View style={styles.profileImageContainer}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.profileImage} />
        ) : (
          <View style={styles.profileImagePlaceholder}>
            <Text style={styles.profileImagePlaceholderText}>
              {initials}
            </Text>
          </View>
        )}
      </View>
      
      <Text style={styles.userName}>
        {firstName} {lastName}
      </Text>
      
      <View style={styles.roleBadge}>
        <Text style={styles.roleText}>{roleLabel}</Text>
      </View>
      
      <TouchableOpacity
        style={styles.editButton}
        onPress={onToggleEdit}
        disabled={isSubmitting}
      >
        <Ionicons
          name={isEditMode ? "close-outline" : "create-outline"}
          size={20}
          color="white"
        />
        <Text style={styles.editButtonText}>
          {isEditMode ? "Cancel" : "Edit Profile"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImagePlaceholderText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#e6f2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  roleText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
});

export default ProfileHeader;
