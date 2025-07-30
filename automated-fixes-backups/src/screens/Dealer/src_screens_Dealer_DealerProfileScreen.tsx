import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Switch, Platform, Linking,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { CardCategory, UserRole } from '../../types';
import { supabase } from '../../supabase';
import { useNavigation } from '@react-navigation/native';

// Define the dealer profile data structure
interface DealerProfile {
  id: string;
  userId: string;
  businessName: string;
  description: string;
  websiteUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  facebookUrl: string;
  businessEmail: string;
  businessPhone: string;
  categories: string[];
  otherCategories: string;
  createdAt: string;
  updatedAt: string;
}

const DealerProfileScreen: React.FC = () => {
  const { authState } = useAuth();
  const { user, isLoading: authLoading } = authState;
  const navigation = useNavigation();

  // State for dealer profile
  const [dealerProfile, setDealerProfile] = useState<DealerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [otherCategories, setOtherCategories] = useState('');

  // Load dealer profile data
  useEffect(() => {
    if (user?.id) {
      fetchDealerProfile();
    } else {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Fetch dealer profile from Supabase
  const fetchDealerProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('dealer_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is expected for new dealers
        throw error;
      }

      if (data) {
        setDealerProfile(data as unknown as DealerProfile);
        // Initialize form state with existing data
        setBusinessName(data.business_name || '');
        setDescription(data.description || '');
        setWebsiteUrl(data.website_url || '');
        setInstagramUrl(data.instagram_url || '');
        setTwitterUrl(data.twitter_url || '');
        setFacebookUrl(data.facebook_url || '');
        setBusinessEmail(data.business_email || '');
        setBusinessPhone(data.business_phone || '');
        setSelectedCategories(data.categories || []);
        setOtherCategories(data.other_categories || '');
      } else {
        // Initialize with empty values for new dealer
        resetForm();
      }
    } catch (err: any) {
      console.error('Error fetching dealer profile:', err);
      setError(err.message || 'Failed to load dealer profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form to initial values or empty
  const resetForm = () => {
    if (dealerProfile) {
      // Reset to existing profile data
      setBusinessName(dealerProfile.businessName || '');
      setDescription(dealerProfile.description || '');
      setWebsiteUrl(dealerProfile.websiteUrl || '');
      setInstagramUrl(dealerProfile.instagramUrl || '');
      setTwitterUrl(dealerProfile.twitterUrl || '');
      setFacebookUrl(dealerProfile.facebookUrl || '');
      setBusinessEmail(dealerProfile.businessEmail || '');
      setBusinessPhone(dealerProfile.businessPhone || '');
      setSelectedCategories(dealerProfile.categories || []);
      setOtherCategories(dealerProfile.otherCategories || '');
    } else {
      // Reset to empty
      setBusinessName('');
      setDescription('');
      setWebsiteUrl('');
      setInstagramUrl('');
      setTwitterUrl('');
      setFacebookUrl('');
      setBusinessEmail('');
      setBusinessPhone('');
      setSelectedCategories([]);
      setOtherCategories('');
    }
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    if (isEditMode) {
      // Cancel edit - reset form to original values
      resetForm();
    }
    setIsEditMode(!isEditMode);
  };

  // Toggle category selection
  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  // Validate form inputs
  const validateForm = () => {
    // Business name is required
    if (!businessName.trim()) {
      Alert.alert('Error', 'Business name is required');
      return false;
    }

    // Website URL validation (if provided)
    if (websiteUrl.trim()) {
      try {
        const url = new URL(websiteUrl);
        if (!url.protocol.startsWith('http')) {
          Alert.alert('Error', 'Website URL must start with http:// or https://');
          return false;
        }
      } catch (e) {
        Alert.alert('Error', 'Please enter a valid website URL');
        return false;
      }
    }

    // Email validation (if provided)
    if (businessEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(businessEmail)) {
        Alert.alert('Error', 'Please enter a valid email address');
        return false;
      }
    }

    // Phone validation (if provided)
    if (businessPhone.trim()) {
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(businessPhone.replace(/\D/g, ''))) {
        Alert.alert('Error', 'Please enter a valid 10-digit phone number');
        return false;
      }
    }

    // At least one category should be selected
    if (selectedCategories.length === 0) {
      Alert.alert('Error', 'Please select at least one card category');
      return false;
    }

    // If "Other" is selected, require other categories text
    if (selectedCategories.includes(CardCategory.OTHER) && !otherCategories.trim()) {
      Alert.alert('Error', 'Please specify other card categories');
      return false;
    }

    return true;
  };

  // Save dealer profile
  const saveProfile = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const profileData = {
        user_id: user?.id,
        business_name: businessName.trim(),
        description: description.trim(),
        website_url: websiteUrl.trim(),
        instagram_url: instagramUrl.trim(),
        twitter_url: twitterUrl.trim(),
        facebook_url: facebookUrl.trim(),
        business_email: businessEmail.trim(),
        business_phone: businessPhone.replace(/\D/g, ''),
        categories: selectedCategories,
        other_categories: otherCategories.trim(),
        updated_at: new Date().toISOString(),
      };

      let result;
      if (dealerProfile) {
        // Update existing profile
        result = await supabase
          .from('dealer_profiles')
          .update(profileData)
          .eq('user_id', user?.id);
      } else {
        // Insert new profile
        result = await supabase
          .from('dealer_profiles')
          .insert({
            ...profileData,
            created_at: new Date().toISOString(),
          });
      }

      if (result.error) {
        throw result.error;
      }

      // Refresh dealer profile data
      await fetchDealerProfile();
      setIsEditMode(false);
      Alert.alert('Success', 'Dealer profile saved successfully');
    } catch (err: any) {
      console.error('Error saving dealer profile:', err);
      setError(err.message || 'Failed to save dealer profile');
      Alert.alert('Error', 'Failed to save dealer profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Format phone number for display
  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Open URL in browser
  const openUrl = (url: string) => {
    if (!url) return;
    
    // Add http:// if missing
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      finalUrl = `https://${url}`;
    }
    
    Linking.openURL(finalUrl).catch(err => {
      console.error('Error opening URL:', err);
      Alert.alert('Error', 'Could not open the URL');
    });
  };

  // Check if user is a dealer
  const isDealer = () => {
    return (
      user?.role === UserRole.DEALER ||
      user?.role === UserRole.MVP_DEALER ||
      user?.role === UserRole.SHOW_ORGANIZER
    );
  };

  // Render category checkbox
  const renderCategoryCheckbox = (category: string) => {
    const isSelected = selectedCategories.includes(category);
    
    return (
      <TouchableOpacity
        style={styles.categoryItem}
        onPress={() => toggleCategory(category)}
        disabled={!isEditMode || isSaving}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
        </View>
        <Text style={styles.categoryText}>{category}</Text>
      </TouchableOpacity>
    );
  };

  // If auth is still loading or user is not authenticated
  if (authLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0057B8" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  // If user is not a dealer
  if (!isDealer()) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <View style={styles.notDealerContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#666" />
          <Text style={styles.notDealerTitle}>Dealer Access Only</Text>
          <Text style={styles.notDealerText}>
            This section is only available to users with a dealer subscription.
            Please upgrade your account to access dealer features.
          </Text>
          <TouchableOpacity
            style={styles.subscriptionButton}
            onPress={() => navigation.navigate('Subscription' as never)}
          >
            <Text style={styles.subscriptionButtonText}>Manage Subscription</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Main content - dealer profile
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dealer Profile</Text>
          <Text style={styles.headerSubtitle}>
            Manage your business information and card specialties
          </Text>
          
          <TouchableOpacity
            style={styles.editButton}
            onPress={toggleEditMode}
            disabled={isSaving}
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

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0057B8" />
            <Text style={styles.loadingText}>Loading dealer profile...</Text>
          </View>
        ) : (
          <>
            {/* Business Information Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Business Information</Text>
              
              {isEditMode ? (
                <View style={styles.editForm}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Business/Store Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={businessName}
                      onChangeText={setBusinessName}
                      placeholder="Your business or store name"
                      editable={!isSaving}
                    />
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Description/Bio</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Tell collectors about your business..."
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      editable={!isSaving}
                    />
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Website URL</Text>
                    <TextInput
                      style={styles.input}
                      value={websiteUrl}
                      onChangeText={setWebsiteUrl}
                      placeholder="https://yourbusiness.com"
                      autoCapitalize="none"
                      keyboardType="url"
                      editable={!isSaving}
                    />
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Business Email</Text>
                    <TextInput
                      style={styles.input}
                      value={businessEmail}
                      onChangeText={setBusinessEmail}
                      placeholder="contact@yourbusiness.com"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      editable={!isSaving}
                    />
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Business Phone</Text>
                    <TextInput
                      style={styles.input}
                      value={businessPhone}
                      onChangeText={setBusinessPhone}
                      placeholder="(123) 456-7890"
                      keyboardType="phone-pad"
                      editable={!isSaving}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.viewForm}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Business Name:</Text>
                    <Text style={styles.infoValue}>
                      {businessName || 'Not provided'}
                    </Text>
                  </View>
                  
                  {description ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Description:</Text>
                      <Text style={styles.infoValue}>{description}</Text>
                    </View>
                  ) : null}
                  
                  {websiteUrl ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Website:</Text>
                      <TouchableOpacity onPress={() => openUrl(websiteUrl)}>
                        <Text style={styles.infoLink}>{websiteUrl}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  
                  {businessEmail ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Email:</Text>
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`mailto:${businessEmail}`)}
                      >
                        <Text style={styles.infoLink}>{businessEmail}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  
                  {businessPhone ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Phone:</Text>
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`tel:${businessPhone}`)}
                      >
                        <Text style={styles.infoLink}>
                          {formatPhoneNumber(businessPhone)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              )}
            </View>

            {/* Social Media Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Social Media</Text>
              
              {isEditMode ? (
                <View style={styles.editForm}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Instagram</Text>
                    <View style={styles.socialInputContainer}>
                      <Text style={styles.socialPrefix}>instagram.com/</Text>
                      <TextInput
                        style={styles.socialInput}
                        value={instagramUrl}
                        onChangeText={setInstagramUrl}
                        placeholder="username"
                        autoCapitalize="none"
                        editable={!isSaving}
                      />
                    </View>
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Twitter</Text>
                    <View style={styles.socialInputContainer}>
                      <Text style={styles.socialPrefix}>twitter.com/</Text>
                      <TextInput
                        style={styles.socialInput}
                        value={twitterUrl}
                        onChangeText={setTwitterUrl}
                        placeholder="username"
                        autoCapitalize="none"
                        editable={!isSaving}
                      />
                    </View>
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Facebook</Text>
                    <View style={styles.socialInputContainer}>
                      <Text style={styles.socialPrefix}>facebook.com/</Text>
                      <TextInput
                        style={styles.socialInput}
                        value={facebookUrl}
                        onChangeText={setFacebookUrl}
                        placeholder="username"
                        autoCapitalize="none"
                        editable={!isSaving}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.viewForm}>
                  {instagramUrl || twitterUrl || facebookUrl ? (
                    <View style={styles.socialLinks}>
                      {instagramUrl && (
                        <TouchableOpacity
                          style={styles.socialButton}
                          onPress={() =>
                            openUrl(`https://instagram.com/${instagramUrl}`)
                          }
                        >
                          <Ionicons name="logo-instagram" size={24} color="#E1306C" />
                          <Text style={styles.socialButtonText}>Instagram</Text>
                        </TouchableOpacity>
                      )}
                      
                      {twitterUrl && (
                        <TouchableOpacity
                          style={styles.socialButton}
                          onPress={() => openUrl(`https://twitter.com/${twitterUrl}`)}
                        >
                          <Ionicons name="logo-twitter" size={24} color="#1DA1F2" />
                          <Text style={styles.socialButtonText}>Twitter</Text>
                        </TouchableOpacity>
                      )}
                      
                      {facebookUrl && (
                        <TouchableOpacity
                          style={styles.socialButton}
                          onPress={() =>
                            openUrl(`https://facebook.com/${facebookUrl}`)
                          }
                        >
                          <Ionicons name="logo-facebook" size={24} color="#4267B2" />
                          <Text style={styles.socialButtonText}>Facebook</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.noDataText}>No social media links provided</Text>
                  )}
                </View>
              )}
            </View>

            {/* Card Categories Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Card Categories</Text>
              <Text style={styles.sectionSubtitle}>
                Select the card categories you specialize in
              </Text>
              
              {isEditMode ? (
                <View style={styles.categoriesContainer}>
                  {Object.values(CardCategory).map(category => 
                    renderCategoryCheckbox(category)
                  )}
                  
                  {/* Other Categories Input */}
                  {selectedCategories.includes(CardCategory.OTHER) && (
                    <View style={styles.otherCategoriesContainer}>
                      <Text style={styles.inputLabel}>Specify Other Categories</Text>
                      <TextInput
                        style={styles.input}
                        value={otherCategories}
                        onChangeText={setOtherCategories}
                        placeholder="E.g., Vintage, Non-Sports, etc."
                        editable={!isSaving}
                      />
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.viewForm}>
                  {selectedCategories.length > 0 ? (
                    <View style={styles.categoriesList}>
                      {selectedCategories.map((category, index) => (
                        <View key={index} style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText}>{category}</Text>
                        </View>
                      ))}
                      
                      {selectedCategories.includes(CardCategory.OTHER) &&
                        otherCategories && (
                          <View style={styles.otherCategoriesView}>
                            <Text style={styles.infoLabel}>Other Categories:</Text>
                            <Text style={styles.infoValue}>{otherCategories}</Text>
                          </View>
                        )}
                    </View>
                  ) : (
                    <Text style={styles.noDataText}>No categories selected</Text>
                  )}
                </View>
              )}
            </View>

            {/* Action Buttons */}
            {isEditMode && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.saveButton, isSaving && styles.disabledButton]}
                  onPress={saveProfile}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={20} color="white" />
                      <Text style={styles.saveButtonText}>Save Profile</Text>
                    </>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={toggleEditMode}
                  disabled={isSaving}
                >
                  <Ionicons name="close-outline" size={20} color="#666" />
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#FF3B30" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#0057B8',
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
  section: {
    backgroundColor: 'white',
    marginTop: 12,
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  editForm: {
    marginTop: 8,
  },
  viewForm: {
    marginTop: 8,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  socialInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  socialPrefix: {
    paddingLeft: 12,
    fontSize: 16,
    color: '#666',
  },
  socialInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333',
    paddingRight: 12,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
  },
  infoLink: {
    fontSize: 16,
    color: '#0057B8',
  },
  socialLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  socialButtonText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 6,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 16,
    width: '45%',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#0057B8',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxSelected: {
    backgroundColor: '#0057B8',
  },
  categoryText: {
    fontSize: 16,
    color: '#333',
  },
  otherCategoriesContainer: {
    width: '100%',
    marginTop: 8,
  },
  categoriesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryBadge: {
    backgroundColor: '#e6f2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryBadgeText: {
    fontSize: 14,
    color: '#0057B8',
  },
  otherCategoriesView: {
    width: '100%',
    marginTop: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF6A00',
    paddingVertical: 14,
    borderRadius: 8,
    marginRight: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingVertical: 14,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 12,
    marginTop: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  notDealerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  notDealerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  notDealerText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  subscriptionButton: {
    backgroundColor: '#FF6A00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  subscriptionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DealerProfileScreen;
