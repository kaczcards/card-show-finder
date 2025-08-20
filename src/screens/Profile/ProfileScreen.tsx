import React, { useState, useEffect as _useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Image, Switch as _Switch, Platform as _Platform, FlatList as _FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SocialIcon from '../../components/ui/SocialIcon';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../supabase';
import { openExternalLink, DEFAULT_WHITELIST_HOSTS } from '../../utils/safeLinking';

const ProfileScreen: React.FC = () => {
  const { authState, logout, updateProfile, clearError, refreshUserRole, resetPassword } = useAuth();
  // Pull favoriteCount from authState so it can be displayed below.
  // We intentionally omit `authState.error` from UI display here; each action
  // (e.g., saveChanges) surfaces its own errors inline.
  const { user, isLoading, favoriteCount: _favoriteCount } = authState;
  const navigation = useNavigation();
  
  // State for edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // session refresh loading
  const [isRefreshingRole, setIsRefreshingRole] = useState(false);
  // Password reset loading
  const [isPasswordResetLoading, setIsPasswordResetLoading] = useState(false);
  // Admin status
  const [isAdmin, _setIsAdmin] = useState(false);
  const [_checkingAdmin, _setCheckingAdmin] = useState(false);
  
  // State for editable fields
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [homeZipCode, setHomeZipCode] = useState(user?.homeZipCode || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  
  // State for social media fields
  const [facebookUrl, setFacebookUrl] = useState(user?.facebookUrl || '');
  const [instagramUrl, setInstagramUrl] = useState(user?.instagramUrl || '');
  const [twitterUrl, setTwitterUrl] = useState(user?.twitterUrl || '');
  const [whatnotUrl, setWhatnotUrl] = useState(user?.whatnotUrl || '');
  const [ebayStoreUrl, setEbayStoreUrl] = useState(user?.ebayStoreUrl || '');

  // ---------------------------------------------------------------------------
  // Favorite shows – local count & helper
  // ---------------------------------------------------------------------------
  // State for favorite shows count
  const [localFavoriteCount, setLocalFavoriteCount] = useState(0);

  /**
   * Fetch the authoritative favourite-show count from the DB.
   * Tries to read the `favorite_shows_count` column, but gracefully falls
   * back to counting rows in `user_favorite_shows` when the column does
   * not exist (e.g. migration hasn't run yet).
   */
  const fetchFavoriteCount = useCallback(async () => {
    if (!user?.id) {
      setLocalFavoriteCount(0);
      return;
    }

    try {
      /* -----------------------------------------------------------
       * Try 1 – read the counter column directly
       * --------------------------------------------------------- */
      const { data, error } = await supabase
        .from('profiles')
        .select('favorite_shows_count')
        .eq('id', user.id)
        .single();

      if (error) {
        console.warn(
          '[ProfileScreen] Error fetching favorite_shows_count:',
          error.message
        );

        /* 42703 = column does not exist -> migration not applied yet  */
        if (error.code === '42703') {
          console.warn(
            '[ProfileScreen] Falling back to counting records in user_favorite_shows'
          );

          /* -----------------------------------------------------------
           * Fallback – count rows in join table
           * --------------------------------------------------------- */
          const {
            count,
            error: countError,
          } = await supabase
            .from('user_favorite_shows')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

          if (countError) {
            console.error(
              '[ProfileScreen] Error counting favorites:',
              countError
            );
            return;
          }

          setLocalFavoriteCount(count || 0);
          return;
        }

        // Other errors – log and exit early
        console.error(
          '[ProfileScreen] Unexpected error fetching favorite_shows_count:',
          error
        );
        return;
      }

      // Success path – column exists
      const count = data?.favorite_shows_count ?? 0;
       
console.warn('[ProfileScreen] Fetched favorite_shows_count:', count);
      setLocalFavoriteCount(count);
    } catch (err) {
      console.error('[ProfileScreen] Unexpected error in fetchFavoriteCount:', err);
      // keep previous count on unexpected error
    }
  }, [user?.id]);

  /* ------------------------------------------------------------------
   * Refresh data each time the screen gains focus
   * ------------------------------------------------------------------ */
  useFocusEffect(
    useCallback(() => {
       
console.warn('[ProfileScreen] Screen focused – refreshing counts/badges');
      fetchFavoriteCount();
      // no cleanup needed
    }, [fetchFavoriteCount, user])
  );
  
  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      // The auth context will handle navigation to the login screen
    } catch (error: any) {
      Alert.alert('Logout Failed', error.message || 'Please try again');
    }
  };
  
  // Toggle edit mode
  const toggleEditMode = () => {
    if (isEditMode) {
      // If exiting edit mode, reset fields to current values
      setFirstName(user?.firstName || '');
      setLastName(user?.lastName || '');
      setHomeZipCode(user?.homeZipCode || '');
      setPhoneNumber(user?.phoneNumber || '');
      setFacebookUrl(user?.facebookUrl || '');
      setInstagramUrl(user?.instagramUrl || '');
      setTwitterUrl(user?.twitterUrl || '');
      setWhatnotUrl(user?.whatnotUrl || '');
      setEbayStoreUrl(user?.ebayStoreUrl || '');
      clearError(); // Clear any previous errors
    }
    setIsEditMode(!isEditMode);
  };
  
  // Validate form
  const validateForm = () => {
    // ---- Basic required fields ---------------------------------------------
    if (!firstName.trim()) {
      Alert.alert('Error', 'First name is required');
      return false;
    }

    // ZIP code validation (US format - 5 digits)
    const zipRegex = /^\d{5}$/;
    if (!zipRegex.test(homeZipCode.trim())) {
      Alert.alert('Error', 'Please enter a valid 5-digit ZIP code');
      return false;
    }

    // Phone validation (optional – allow punctuation then strip)
    if (phoneNumber) {
      const cleaned = phoneNumber.replace(/\D/g, '');
      if (cleaned && cleaned.length !== 10) {
        Alert.alert('Error', 'Please enter a valid 10-digit phone number');
        return false;
      }
    }

    /* ----------------------------------------------------------------------
     * Social links — lenient validation + normalisation
     * -------------------------------------------------------------------- */
    const simpleDomainRegex =
      /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    const validateAndNormalizeUrl = (
      url: string,
      platformLabel: string,
    ): string | undefined | false => {
      if (!url.trim()) return undefined; // treat empty as undefined

      // Already has protocol -> accept
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url.trim();
      }

      // Remove leading www. for validation
      const domainPart = url.trim().replace(/^www\./i, '');
      if (!simpleDomainRegex.test(domainPart)) {
        Alert.alert('Error', `Please enter a valid ${platformLabel} URL`);
        return false;
      }

      // Auto-prefix https:// for storage
      return `https://${url.trim()}`;
    };

    const normalizedFacebook = validateAndNormalizeUrl(
      facebookUrl,
      'Facebook',
    );
    if (normalizedFacebook === false) return false;

    const normalizedInstagram = validateAndNormalizeUrl(
      instagramUrl,
      'Instagram',
    );
    if (normalizedInstagram === false) return false;

    const normalizedTwitter = validateAndNormalizeUrl(
      twitterUrl,
      'Twitter/X',
    );
    if (normalizedTwitter === false) return false;

    const normalizedWhatnot = validateAndNormalizeUrl(
      whatnotUrl,
      'Whatnot',
    );
    if (normalizedWhatnot === false) return false;

    const normalizedEbay = validateAndNormalizeUrl(
      ebayStoreUrl,
      'eBay store',
    );
    if (normalizedEbay === false) return false;

    // Persist normalized values into state so `saveChanges` uses them
    if (normalizedFacebook !== undefined) setFacebookUrl(normalizedFacebook);
    if (normalizedInstagram !== undefined) setInstagramUrl(normalizedInstagram);
    if (normalizedTwitter !== undefined) setTwitterUrl(normalizedTwitter);
    if (normalizedWhatnot !== undefined) setWhatnotUrl(normalizedWhatnot);
    if (normalizedEbay !== undefined) setEbayStoreUrl(normalizedEbay);

    return true;
  };
  
  // Save profile changes
  const saveChanges = async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      console.warn('[ProfileScreen] Saving profile changes:', {
        firstName,
        lastName: lastName || undefined,
        homeZipCode,
        phoneNumber: phoneNumber || undefined,
        facebookUrl: facebookUrl || undefined,
        instagramUrl: instagramUrl || undefined,
        twitterUrl: twitterUrl || undefined,
        whatnotUrl: whatnotUrl || undefined,
        ebayStoreUrl: ebayStoreUrl || undefined,
      });
      
      await updateProfile({
        firstName,
        lastName: lastName || undefined,
        homeZipCode,
        phoneNumber: phoneNumber || undefined,
        facebookUrl: facebookUrl || undefined,
        instagramUrl: instagramUrl || undefined,
        twitterUrl: twitterUrl || undefined,
        whatnotUrl: whatnotUrl || undefined,
        ebayStoreUrl: ebayStoreUrl || undefined,
      });
      
      setIsEditMode(false);
       
console.warn('[ProfileScreen] Profile updated successfully');
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err: any) {
      console.error('[ProfileScreen] Error updating profile:', err);
      Alert.alert('Update Failed', err.message || 'Please try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Force-refresh JWT / role - This function is fine and used by the button
  const handleRefreshRole = async () => {
    try {
      setIsRefreshingRole(true);
      const success = await refreshUserRole();
      if (success) {
        Alert.alert('Session Refreshed', 'Your account information has been updated.');
      } else {
        Alert.alert('Refresh Failed', 'Unable to refresh session right now. Please try again later.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Unexpected error refreshing session');
    } finally {
      setIsRefreshingRole(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async () => {
    if (!user?.email) {
      Alert.alert('Error', 'No email address found for your account.');
      return;
    }

    try {
      setIsPasswordResetLoading(true);
      await resetPassword(user.email);
      
      Alert.alert(
        'Password Reset Email Sent',
        'Check your email for a link to reset your password. The link will expire after 24 hours.'
      );
      
    } catch (error: any) {
      console.error('[ProfileScreen] Error sending password reset:', error);
      Alert.alert('Password Reset Failed', error.message || 'Please try again later.');
    } finally {
      setIsPasswordResetLoading(false);
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
  
  // Check if user is a dealer (using current user directly)
  const isDealer = () => {
    if (!user) return false;
    const dealerLike =
      user.role === UserRole.DEALER ||
      user.role === UserRole.MVP_DEALER ||
      user.role === UserRole.SHOW_ORGANIZER ||
      user.accountType === 'dealer' ||
      user.accountType === 'organizer';

    /* Debug logging to diagnose access-control issues */
    console.warn('[ProfileScreen] isDealer check', {
      userId: user.id,
      role: user.role,
      accountType: user.accountType,
      isDealer: dealerLike,
    });

    return dealerLike;
  };
  
  // Check if user can edit social media links (only MVP Dealers and Show Organizers)
  const canEditSocialMedia = () => {
    if (!user) return false;
    return (
      user.role === UserRole.MVP_DEALER || 
      user.role === UserRole.SHOW_ORGANIZER
    );
  };
  
  // Get role display name
  const getRoleDisplayName = (role: UserRole) => {
    // Debug logging to track what role is being passed
    console.warn('[ProfileScreen] getRoleDisplayName called with role:', role, 
      'for user ID:', user?.id);
    
    // Special case for the specific user ID that needs to show as Dealer
    if (user?.id === '7d792f27-9112-4837-926f-42e4eb1f0577') {
       
console.warn('[ProfileScreen] Forcing display as Dealer for specific user ID');
      return 'Dealer';
    }
    
    switch (role) {
      case UserRole.ATTENDEE:
        return 'Attendee';
      case UserRole.DEALER:
        return 'Dealer';
      case UserRole.MVP_DEALER:
        return 'MVP Dealer';
      case UserRole.SHOW_ORGANIZER:
        return 'Show Organizer';
      default:
        // Add a console log here to debug what 'role' is if it hits 'Unknown'
        console.warn('Unknown UserRole encountered:', role);
        return 'Unknown';
    }
  };

  // Helper function to open a URL with robust protocol handling
  const openUrl = (url: string | undefined) => {
    if (!url) return;
    openExternalLink(url, { whitelistHosts: DEFAULT_WHITELIST_HOSTS });
  };

  // Navigate to Admin Map screen
  const navigateToAdminMap = () => {
    // Navigate directly to the Admin stack; deep linking param removed
    navigation.navigate('Admin' as never);
  };
  
  // If user is not loaded yet
  if (isLoading || !user) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }
  /* ------------------------------------------------------------------ */
  /* Debug – log role + dealer status each render                        */
  /* ------------------------------------------------------------------ */
  console.warn('[ProfileScreen] render', {
    userId: user.id,
    role: user.role,
    accountType: user.accountType,
    dealerStatus: isDealer(),
  });
  
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileImageContainer}>
            {user.profileImageUrl ? (
              <Image source={{ uri: user.profileImageUrl }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileImagePlaceholderText}>
                  {user.firstName.charAt(0)}{user.lastName ? user.lastName.charAt(0) : ''}
                </Text>
              </View>
            )}
          </View>
          
          <Text style={styles.userName}>
            {user.firstName} {user.lastName}
          </Text>
          
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{getRoleDisplayName(user.role)}</Text>
          </View>
          
          <TouchableOpacity
            style={styles.editButton}
            onPress={toggleEditMode}
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
        
        {/* Profile Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          {isEditMode ? (
            <View style={styles.editForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>First Name *</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First Name"
                  editable={!isSubmitting}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last Name (Optional)"
                  editable={!isSubmitting}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Home ZIP Code *</Text>
                <TextInput
                  style={styles.input}
                  value={homeZipCode}
                  onChangeText={setHomeZipCode}
                  placeholder="ZIP Code"
                  keyboardType="numeric"
                  maxLength={5}
                  editable={!isSubmitting}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="Phone Number (Optional)"
                  keyboardType="phone-pad"
                  editable={!isSubmitting}
                />
              </View>
              
              <TouchableOpacity
                style={[styles.saveButton, isSubmitting && styles.buttonDisabled]}
                onPress={saveChanges}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.infoList}>
              <View style={styles.infoItem}>
                <Ionicons name="person-outline" size={20} color="#666" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Name</Text>
                  <Text style={styles.infoValue}>
                    {user.firstName} {user.lastName || ''}
                  </Text>
                </View>
              </View>
              
              <View style={styles.infoItem}>
                <Ionicons name="mail-outline" size={20} color="#666" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{user.email}</Text>
                </View>
              </View>
              
              <View style={styles.infoItem}>
                <Ionicons name="location-outline" size={20} color="#666" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Home ZIP Code</Text>
                  <Text style={styles.infoValue}>{user.homeZipCode}</Text>
                </View>
              </View>
              
              {user.phoneNumber && (
                <View style={styles.infoItem}>
                  <Ionicons name="call-outline" size={20} color="#666" />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Phone</Text>
                    <Text style={styles.infoValue}>{formatPhoneNumber(user.phoneNumber)}</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Social Media Links Section - Only shown for MVP Dealers and Show Organizers */}
        {canEditSocialMedia() && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Social Media & Marketplace Links</Text>
            
            {isEditMode ? (
              <View style={styles.editForm}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Facebook Profile URL</Text>
                  <TextInput
                    style={styles.input}
                    value={facebookUrl}
                    onChangeText={setFacebookUrl}
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
                    value={instagramUrl}
                    onChangeText={setInstagramUrl}
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
                    value={twitterUrl}
                    onChangeText={setTwitterUrl}
                    placeholder="https://twitter.com/username"
                    keyboardType="url"
                    autoCapitalize="none"
                    editable={!isSubmitting}
                  />
                </View>
                
                {isDealer() && (
                  <>
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Whatnot Store URL</Text>
                      <TextInput
                        style={styles.input}
                        value={whatnotUrl}
                        onChangeText={setWhatnotUrl}
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
                        value={ebayStoreUrl}
                        onChangeText={setEbayStoreUrl}
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
                {!user.facebookUrl && !user.instagramUrl && !user.twitterUrl && 
                 !user.whatnotUrl && !user.ebayStoreUrl ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No social media links added yet</Text>
                    <TouchableOpacity onPress={toggleEditMode}>
                      <Text style={styles.emptyStateActionText}>Add links</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    {user.facebookUrl && (
                      <TouchableOpacity style={styles.infoItem} onPress={() => openUrl(user.facebookUrl)}>
                        <Ionicons name="logo-facebook" size={20} color="#1877F2" />
                        <View style={styles.infoTextContainer}>
                          <Text style={styles.infoLabel}>Facebook</Text>
                          <Text style={styles.infoValueLink}>{user.facebookUrl}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    
                    {user.instagramUrl && (
                      <TouchableOpacity style={styles.infoItem} onPress={() => openUrl(user.instagramUrl)}>
                        <Ionicons name="logo-instagram" size={20} color="#C13584" />
                        <View style={styles.infoTextContainer}>
                          <Text style={styles.infoLabel}>Instagram</Text>
                          <Text style={styles.infoValueLink}>{user.instagramUrl}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    
                    {user.twitterUrl && (
                      <TouchableOpacity style={styles.infoItem} onPress={() => openUrl(user.twitterUrl)}>
                        <Ionicons name="logo-twitter" size={20} color="#1DA1F2" />
                        <View style={styles.infoTextContainer}>
                          <Text style={styles.infoLabel}>Twitter/X</Text>
                          <Text style={styles.infoValueLink}>{user.twitterUrl}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    
                    {user.whatnotUrl && (
                      <TouchableOpacity style={styles.infoItem} onPress={() => openUrl(user.whatnotUrl)}>
                        <SocialIcon 
                          platform="whatnot" 
                          size={20} 
                          onPress={() => openUrl(user.whatnotUrl)} 
                          style={{backgroundColor: 'transparent'}}
                        />
                        <View style={styles.infoTextContainer}>
                          <Text style={styles.infoLabel}>Whatnot Store</Text>
                          <Text style={styles.infoValueLink}>{user.whatnotUrl}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    
                    {user.ebayStoreUrl && (
                      <TouchableOpacity style={styles.infoItem} onPress={() => openUrl(user.ebayStoreUrl)}>
                        <SocialIcon 
                          platform="ebay" 
                          size={20} 
                          onPress={() => openUrl(user.ebayStoreUrl)} 
                          style={{backgroundColor: 'transparent'}}
                        />
                        <View style={styles.infoTextContainer}>
                          <Text style={styles.infoLabel}>eBay Store</Text>
                          <Text style={styles.infoValueLink}>{user.ebayStoreUrl}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {/* Account Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          
          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#666" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Account Type</Text>
                {/* Display user.role directly, as it should now be correct from Supabase */}
                <Text style={styles.infoValue}>{getRoleDisplayName(user.role)}</Text>
              </View>
            </View>
            
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={20} color="#666" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Member Since</Text>
                <Text style={styles.infoValue}>
                  {(() => {
                    // Ensure the day shown matches the value in the DB
                    const date = new Date(user.createdAt);
                    const utcDate = new Date(
                      date.getTime() + date.getTimezoneOffset() * 60 * 1000
                    );
                    return utcDate.toLocaleDateString();
                  })()}
                </Text>
              </View>
            </View>
            
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#666" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Email Verified</Text>
                <View style={styles.verificationStatus}>
                  {user.isEmailVerified ? (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                      <Text style={[styles.verificationText, { color: '#4CAF50' }]}>Verified</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="close-circle" size={16} color="#F44336" />
                      <Text style={[styles.verificationText, { color: '#F44336' }]}>Not Verified</Text>
                    </>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
        
        {/* Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Activity</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              {/* Use authoritative DB-backed favourite count */}
              <Text style={styles.statValue}>{localFavoriteCount}</Text>
              <Text style={styles.statLabel}>Favorite Shows</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user.attendedShows?.length || 0}</Text>
              <Text style={styles.statLabel}>Shows Attended</Text>
            </View>
          </View>
        </View>
        
        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Actions</Text>
          
          {/* Admin Tools (visible only for admin users) */}
          {isAdmin && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={navigateToAdminMap}
            >
              <Ionicons name="construct-outline" size={20} color="#007AFF" />
              <Text style={styles.actionButtonText}>Admin: Coordinate Validation</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color="#ccc"
                style={styles.actionButtonIcon}
              />
            </TouchableOpacity>
          )}

          {/* Manage Show Participation (visible only for MVP Dealers and Show Organizers) */}
{(user?.role === UserRole.MVP_DEALER || user?.role === UserRole.SHOW_ORGANIZER) && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('ShowParticipationScreen' as never)}
            >
              <Ionicons name="storefront-outline" size={20} color="#007AFF" />
              <Text style={styles.actionButtonText}>Manage Show Participation</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color="#ccc"
                style={styles.actionButtonIcon}
              />
            </TouchableOpacity>
          )}
          
          {/* Subscription management */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('SubscriptionScreen' as never)}
          >
            <Ionicons name="star-outline" size={20} color="#007AFF" />
            <Text style={styles.actionButtonText}>Manage Subscription</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color="#ccc"
              style={styles.actionButtonIcon}
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handlePasswordChange}
            disabled={isPasswordResetLoading}
          >
            {isPasswordResetLoading ? (
              <ActivityIndicator size="small" color="#007AFF" style={{ marginHorizontal: 2 }} />
            ) : (
              <Ionicons name="lock-closed-outline" size={20} color="#007AFF" />
            )}
            <Text style={styles.actionButtonText}>Change Password</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" style={styles.actionButtonIcon} />
          </TouchableOpacity>

          {/* Refresh Session */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRefreshRole}
            disabled={isRefreshingRole}
          >
            {isRefreshingRole ? (
              <ActivityIndicator size="small" color="#007AFF" style={{ marginHorizontal: 2 }} />
            ) : (
              <Ionicons name="refresh-outline" size={20} color="#007AFF" />
            )}
            <Text style={styles.actionButtonText}>Refresh Session</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color="#ccc"
              style={styles.actionButtonIcon}
            />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
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
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
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
  section: {
    backgroundColor: 'white',
    marginTop: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  infoList: {
    paddingLeft: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
  },
  infoValueLink: {
    fontSize: 16,
    color: '#007AFF',
    textDecorationLine: 'underline',
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
  verificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationText: {
    fontSize: 16,
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  actionButtonIcon: {
    marginLeft: 'auto',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    color: '#FF3B30',
    marginLeft: 12,
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
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#99C9FF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;
