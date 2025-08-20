import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import SocialLinksRow from '../../../components/ui/SocialLinksRow';

interface SocialLinksValues {
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  whatnotUrl?: string;
  ebayStoreUrl?: string;
}

interface SocialLinksSetters {
  setFacebookUrl: (v: string) => void;
  setInstagramUrl: (v: string) => void;
  setTwitterUrl: (v: string) => void;
  setWhatnotUrl: (v: string) => void;
  setEbayStoreUrl: (v: string) => void;
}

interface SocialLinksSectionProps {
  isEditMode: boolean;
  canEdit: boolean;
  isDealer: boolean;
  values: SocialLinksValues;
  onChange: SocialLinksSetters;
  isSubmitting?: boolean;
  onPressAddLinks?: () => void;
}

const SocialLinksSection: React.FC<SocialLinksSectionProps> = ({
  isEditMode,
  canEdit,
  isDealer,
  values,
  onChange,
  isSubmitting = false,
  onPressAddLinks,
}) => {
  if (!canEdit) return null;

  const hasAnyLinks = !!(
    values.facebookUrl ||
    values.instagramUrl ||
    values.twitterUrl ||
    values.whatnotUrl ||
    values.ebayStoreUrl
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Social Media & Marketplace Links</Text>
      
      {isEditMode ? (
        <View style={styles.editForm}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Facebook Profile URL</Text>
            <TextInput
              style={styles.input}
              value={values.facebookUrl}
              onChangeText={onChange.setFacebookUrl}
              placeholder="https://facebook.com/username"
              keyboardType="url"
              autoCapitalize="none"
              editable={!isSubmitting}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Instagram Profile URL</Text>
            <TextInput
              style={styles.input}
              value={values.instagramUrl}
              onChangeText={onChange.setInstagramUrl}
              placeholder="https://instagram.com/username"
              keyboardType="url"
              autoCapitalize="none"
              editable={!isSubmitting}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Twitter/X Profile URL</Text>
            <TextInput
              style={styles.input}
              value={values.twitterUrl}
              onChangeText={onChange.setTwitterUrl}
              placeholder="https://twitter.com/username"
              keyboardType="url"
              autoCapitalize="none"
              editable={!isSubmitting}
            />
          </View>
          
          {isDealer && (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Whatnot Store URL</Text>
                <TextInput
                  style={styles.input}
                  value={values.whatnotUrl}
                  onChangeText={onChange.setWhatnotUrl}
                  placeholder="https://whatnot.com/user/username"
                  keyboardType="url"
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>eBay Store URL</Text>
                <TextInput
                  style={styles.input}
                  value={values.ebayStoreUrl}
                  onChangeText={onChange.setEbayStoreUrl}
                  placeholder="https://ebay.com/usr/storename"
                  keyboardType="url"
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
              </View>
            </>
          )}
        </View>
      ) : (
        <View style={styles.infoList}>
          {!hasAnyLinks ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No social media links added yet</Text>
              {onPressAddLinks && (
                <TouchableOpacity onPress={onPressAddLinks}>
                  <Text style={styles.emptyStateActionText}>Add links</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <SocialLinksRow
              variant="list"
              urls={values}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    backgroundColor: 'white',
    marginTop: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  editForm: {
    paddingHorizontal: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  infoList: {
    paddingLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptyStateActionText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
});

export default SocialLinksSection;
