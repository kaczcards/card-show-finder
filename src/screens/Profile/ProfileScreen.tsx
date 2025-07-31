import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Image, Switch, Platform, FlatList, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SocialIcon from '../../components/ui/SocialIcon';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../supabase';

const ProfileScreen: React.FC = () => {
  const { authState, logout, updateProfile, clearError, refreshUserRole, resetPassword } = useAuth();
  // Pull favoriteCount from authState so it can be displayed below.
  // We intentionally omit `authState.error` from UI display here; each action
  // (e.g., _saveChanges) surfaces its own errors inline.
  const { user, isLoading, _favoriteCount } = authState;
  const _navigation = useNavigation();
  
  // State for edit mode
  const [isEditMode, setIsEditMode] = useState(_false);
  const [isSubmitting, setIsSubmitting] = useState(_false);
  // session refresh loading
  const [isRefreshingRole, setIsRefreshingRole] = useState(_false);
  // Password reset loading
  const [isPasswordResetLoading, setIsPasswordResetLoading] = useState(_false);
  // Admin status
  const [isAdmin, _setIsAdmin] = useState(_false);
  const [_checkingAdmin, _setCheckingAdmin] = useState(_false);
  
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
  const [_localFavoriteCount, setLocalFavoriteCount] = useState(_0);

  /**
   * Fetch the authoritative favourite-show count from the DB.
   * Tries to read the `favorite_shows_count` column, but gracefully falls
   * back to counting rows in `user_favorite_shows` when the column does
   * not exist (e.g. migration hasn't run yet).
   */
  const _fetchFavoriteCount = useCallback(async () => {
    if (!user?.id) {
      setLocalFavoriteCount(_0);
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

      if (_error) {
        console.warn(
          '[_ProfileScreen] Error fetching favorite_shows_count:',
          error.message
        );

        /* 42703 = column does not exist -> migration not applied yet  */
        if (error.code === '42703') {
          console.warn(
            '[_ProfileScreen] Falling back to counting records in user_favorite_shows'
          );

          /* -----------------------------------------------------------
           * Fallback – count rows in join table
           * --------------------------------------------------------- */
          const {
            count,
            error: _countError,
          } = await supabase
            .from('user_favorite_shows')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

          if (_countError) {
            console.error(
              '[_ProfileScreen] Error counting favorites:',
              _countError
            );
            return;
          }

          setLocalFavoriteCount(count || 0);
          return;
        }

        // Other errors – log and exit early
        console.error(
          '[_ProfileScreen] Unexpected error fetching favorite_shows_count:',
          _error
        );
        return;
      }

      // Success path – column exists
      const _count = data?.favorite_shows_count ?? 0;
       
console.warn('[_ProfileScreen] Fetched favorite_shows_count:', _count);
      setLocalFavoriteCount(_count);
    } catch (_err) {
      console.error('[_ProfileScreen] Unexpected error in fetchFavoriteCount:', _err);
      // keep previous count on unexpected error
    }
  }, [user?.id]);

  /* ------------------------------------------------------------------
   * Refresh data each time the screen gains focus
   * ------------------------------------------------------------------ */
  useFocusEffect(
    useCallback(() => {
       
console.warn('[_ProfileScreen] Screen focused – refreshing counts/badges');
      fetchFavoriteCount();
      // no cleanup needed
    }, [fetchFavoriteCount, user])
  );
  
  // Handle logout
  const _handleLogout = async () => {
    try {
      await logout();
      // The auth context will handle navigation to the login screen
    } catch (error: any) {
      Alert.alert('Logout Failed', error.message || 'Please try again');
    }
  };
  
  // Toggle edit mode
  const _toggleEditMode = () => {
    if (_isEditMode) {
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
  const _validateForm = () => {
    // ---- Basic required fields ---------------------------------------------
    if (!firstName.trim()) {
      Alert.alert('Error', 'First name is required');
      return false;
    }

    // ZIP code validation (US format - 5 digits)
    const _zipRegex = /^\d{_5}$/;
    if (!zipRegex.test(homeZipCode.trim())) {
      Alert.alert('Error', 'Please enter a valid 5-digit ZIP code');
      return false;
    }

    // Phone validation (optional – allow punctuation then strip)
    if (_phoneNumber) {
      const _cleaned = phoneNumber.replace(/\D/g, '');
      if (cleaned && cleaned.length !== 10) {
        Alert.alert('Error', 'Please enter a valid 10-digit phone number');
        return false;
      }
    }

    /* ----------------------------------------------------------------------
     * Social links — lenient validation + normalisation
     * -------------------------------------------------------------------- */
    const _simpleDomainRegex =
      /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    const _validateAndNormalizeUrl = (
      url: string,
      _platformLabel: string,
    ): string | undefined | false => {
      if (!url.trim()) return undefined; // treat empty as undefined

      // Already has protocol -> accept
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url.trim();
      }

      // Remove leading www. for validation
      const _domainPart = url.trim().replace(/^www\./i, '');
      if (!simpleDomainRegex.test(domainPart)) {
        Alert.alert('Error', `Please enter a valid ${_platformLabel} URL`);
        return false;
      }

      // Auto-prefix https:// for storage
      return `https://${url.trim()}`;
    };

    const _normalizedFacebook = validateAndNormalizeUrl(
      _facebookUrl,
      'Facebook',
    );
    if (normalizedFacebook === false) return false;

    const _normalizedInstagram = validateAndNormalizeUrl(
      _instagramUrl,
      'Instagram',
    );
    if (normalizedInstagram === false) return false;

    const _normalizedTwitter = validateAndNormalizeUrl(
      _twitterUrl,
      'Twitter/X',
    );
    if (normalizedTwitter === false) return false;

    const _normalizedWhatnot = validateAndNormalizeUrl(
      _whatnotUrl,
      'Whatnot',
    );
    if (normalizedWhatnot === false) return false;

    const _normalizedEbay = validateAndNormalizeUrl(
      _ebayStoreUrl,
      'eBay store',
    );
    if (normalizedEbay === false) return false;

    // Persist normalized values into state so `saveChanges` uses them
    if (normalizedFacebook !== undefined) setFacebookUrl(_normalizedFacebook);
    if (normalizedInstagram !== undefined) setInstagramUrl(_normalizedInstagram);
    if (normalizedTwitter !== undefined) setTwitterUrl(_normalizedTwitter);
    if (normalizedWhatnot !== undefined) setWhatnotUrl(_normalizedWhatnot);
    if (normalizedEbay !== undefined) setEbayStoreUrl(_normalizedEbay);

    return true;
  };
  
  // Save profile changes
  const _saveChanges = async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(_true);
      console.warn('[_ProfileScreen] Saving profile changes:', {
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
      
      setIsEditMode(_false);
       
console.warn('[_ProfileScreen] Profile updated successfully');
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err: any) {
      console.error('[_ProfileScreen] Error updating profile:', _err);
      Alert.alert('Update Failed', err.message || 'Please try again');
    } finally {
      setIsSubmitting(_false);
    }
  };

  // Force-refresh JWT / role - This function is fine and used by the button
  const _handleRefreshRole = async () => {
    try {
      setIsRefreshingRole(_true);
      const _success = await refreshUserRole();
      if (_success) {
        Alert.alert('Session Refreshed', 'Your account information has been updated.');
      } else {
        Alert.alert('Refresh Failed', 'Unable to refresh session right now. Please try again later.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Unexpected error refreshing session');
    } finally {
      setIsRefreshingRole(_false);
    }
  };

  // Handle password change
  const _handlePasswordChange = async () => {
    if (!user?.email) {
      Alert.alert('Error', 'No email address found for your account.');
      return;
    }

    try {
      setIsPasswordResetLoading(_true);
      await resetPassword(user.email);
      
      Alert.alert(
        'Password Reset Email Sent',
        'Check your email for a link to reset your password. The link will expire after 24 hours.'
      );
      
    } catch (error: any) {
      console.error('[_ProfileScreen] Error sending password reset:', _error);
      Alert.alert('Password Reset Failed', error.message || 'Please try again later.');
    } finally {
      setIsPasswordResetLoading(_false);
    }
  };
  
  // Format phone number for display
  const _formatPhoneNumber = (phone: string) => {
    const _cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, _3)}) ${cleaned.slice(3, _6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };
  
  // Check if user is a dealer (using current user directly)
  const _isDealer = () => {
    if (!user) return false;
    const _dealerLike =
      user.role === UserRole.DEALER ||
      user.role === UserRole.MVP_DEALER ||
      user.role === UserRole.SHOW_ORGANIZER ||
      user.accountType === 'dealer' ||
      user.accountType === 'organizer';

    /* Debug logging to diagnose access-control issues */
    console.warn('[_ProfileScreen] isDealer check', {
      userId: user.id,
      role: user.role,
      accountType: user.accountType,
      isDealer: dealerLike,
    });

    return dealerLike;
  };
  
  // Check if user can edit social media links (only MVP Dealers and Show Organizers)
  const _canEditSocialMedia = () => {
    if (!user) return false;
    return (
      user.role === UserRole.MVP_DEALER || 
      user.role === UserRole.SHOW_ORGANIZER
    );
  };
  
  // Get role display name
  const _getRoleDisplayName = (_role: UserRole) => {
    // Debug logging to track what role is being passed
    console.warn('[_ProfileScreen] getRoleDisplayName called with role:', _role, 
      'for user ID:', user?.id);
    
    // Special case for the specific user ID that needs to show as Dealer
    if (user?.id === '7d792f27-9112-4837-926f-42e4eb1f0577') {
       
console.warn('[_ProfileScreen] Forcing display as Dealer for specific user ID');
      return 'Dealer';
    }
    
    switch (_role) {
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
        console.warn('Unknown UserRole encountered:', _role);
        return 'Unknown';
    }
  };

  // Helper function to open a URL with robust protocol handling
  const _openUrl = (url: string | undefined) => {
    if (!url) return;

    // Auto-prefix protocol if the user omitted it
    let _formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${_formattedUrl}`;
    }

     
console.warn('[_ProfileScreen] Opening URL:', _formattedUrl);

    Linking.openURL(formattedUrl).catch(_err => {
      console.error('Error opening URL:', _err);
      Alert.alert(
        'Cannot Open Link',
        'The link could not be opened. Please check that it is a valid URL.',
        [{ text: 'OK' }],
      );
    });
  };

  // Navigate to Admin Map screen
  const _navigateToAdminMap = () => {
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
  console.warn('[_ProfileScreen] render', {
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
            onPress={_toggleEditMode}
            disabled={_isSubmitting}
          >
            <Ionicons
              name={isEditMode ? "close-outline" : "create-outline"}
              size={_20}
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
                  value={_firstName}
                  onChangeText={_setFirstName}
                  placeholder="First Name"
                  editable={!isSubmitting}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={_lastName}
                  onChangeText={_setLastName}
                  placeholder="Last Name (_Optional)"
                  editable={!isSubmitting}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Home ZIP Code *</Text>
                <TextInput
                  style={styles.input}
                  value={_homeZipCode}
                  onChangeText={_setHomeZipCode}
                  placeholder="ZIP Code"
                  keyboardType="numeric"
                  maxLength={_5}
                  editable={!isSubmitting}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={_phoneNumber}
                  onChangeText={_setPhoneNumber}
                  placeholder="Phone Number (_Optional)"
                  keyboardType="phone-pad"
                  editable={!isSubmitting}
                />
              </View>
              
              <TouchableOpacity
                style={[styles.saveButton, isSubmitting && styles.buttonDisabled]}
                onPress={_saveChanges}
                disabled={_isSubmitting}
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
                <Ionicons name="person-outline" size={_20} color="#666" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Name</Text>
                  <Text style={styles.infoValue}>
                    {user.firstName} {user.lastName || ''}
                  </Text>
                </View>
              </View>
              
              <View style={styles.infoItem}>
                <Ionicons name="mail-outline" size={_20} color="#666" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{user.email}</Text>
                </View>
              </View>
              
              <View style={styles.infoItem}>
                <Ionicons name="location-outline" size={_20} color="#666" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Home ZIP Code</Text>
                  <Text style={styles.infoValue}>{user.homeZipCode}</Text>
                </View>
              </View>
              
              {user.phoneNumber && (
                <View style={styles.infoItem}>
                  <Ionicons name="call-outline" size={_20} color="#666" />
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
                    value={_facebookUrl}
                    onChangeText={_setFacebookUrl}
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
                    value={_instagramUrl}
                    onChangeText={_setInstagramUrl}
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
                    value={_twitterUrl}
                    onChangeText={_setTwitterUrl}
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
                        value={_whatnotUrl}
                        onChangeText={_setWhatnotUrl}
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
                        value={_ebayStoreUrl}
                        onChangeText={_setEbayStoreUrl}
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
                    <TouchableOpacity onPress={_toggleEditMode}>
                      <Text style={styles.emptyStateActionText}>Add links</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    {user.facebookUrl && (
                      <TouchableOpacity style={styles.infoItem} onPress={() => openUrl(user.facebookUrl)}>
                        <Ionicons name="logo-facebook" size={_20} color="#1877F2" />
                        <View style={styles.infoTextContainer}>
                          <Text style={styles.infoLabel}>Facebook</Text>
                          <Text style={styles.infoValueLink}>{user.facebookUrl}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    
                    {user.instagramUrl && (
                      <TouchableOpacity style={styles.infoItem} onPress={() => openUrl(user.instagramUrl)}>
                        <Ionicons name="logo-instagram" size={_20} color="#C13584" />
                        <View style={styles.infoTextContainer}>
                          <Text style={styles.infoLabel}>Instagram</Text>
                          <Text style={styles.infoValueLink}>{user.instagramUrl}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    
                    {user.twitterUrl && (
                      <TouchableOpacity style={styles.infoItem} onPress={() => openUrl(user.twitterUrl)}>
                        <Ionicons name="logo-twitter" size={_20} color="#1DA1F2" />
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
                          size={_20} 
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
                          size={_20} 
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
              <Ionicons name="shield-checkmark-outline" size={_20} color="#666" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Account Type</Text>
                {/* Display user.role directly, as it should now be correct from Supabase */}
                <Text style={styles.infoValue}>{getRoleDisplayName(user.role)}</Text>
              </View>
            </View>
            
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={_20} color="#666" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Member Since</Text>
                <Text style={styles.infoValue}>
                  {(() => {
                    // Ensure the day shown matches the value in the DB
                    const _date = new Date(user.createdAt);
                    const _utcDate = new Date(
                      date.getTime() + date.getTimezoneOffset() * 60 * 1000
                    );
                    return utcDate.toLocaleDateString();
                  })()}
                </Text>
              </View>
            </View>
            
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle-outline" size={_20} color="#666" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Email Verified</Text>
                <View style={styles.verificationStatus}>
                  {user.isEmailVerified ? (
                    <>
                      <Ionicons name="checkmark-circle" size={_16} color="#4CAF50" />
                      <Text style={[styles.verificationText, { color: '#4CAF50' }]}>Verified</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="close-circle" size={_16} color="#F44336" />
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
              <Text style={styles.statValue}>{_localFavoriteCount}</Text>
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
              onPress={_navigateToAdminMap}
            >
              <Ionicons name="construct-outline" size={_20} color="#007AFF" />
              <Text style={styles.actionButtonText}>Admin: Coordinate Validation</Text>
              <Ionicons
                name="chevron-forward"
                size={_20}
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
              <Ionicons name="storefront-outline" size={_20} color="#007AFF" />
              <Text style={styles.actionButtonText}>Manage Show Participation</Text>
              <Ionicons
                name="chevron-forward"
                size={_20}
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
            <Ionicons name="star-outline" size={_20} color="#007AFF" />
            <Text style={styles.actionButtonText}>Manage Subscription</Text>
            <Ionicons
              name="chevron-forward"
              size={_20}
              color="#ccc"
              style={styles.actionButtonIcon}
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={_handlePasswordChange}
            disabled={_isPasswordResetLoading}
          >
            {isPasswordResetLoading ? (
              <ActivityIndicator size="small" color="#007AFF" style={{ marginHorizontal: 2 }} />
            ) : (
              <Ionicons name="lock-closed-outline" size={_20} color="#007AFF" />
            )}
            <Text style={styles.actionButtonText}>Change Password</Text>
            <Ionicons name="chevron-forward" size={_20} color="#ccc" style={styles.actionButtonIcon} />
          </TouchableOpacity>

          {/* Refresh Session */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={_handleRefreshRole}
            disabled={_isRefreshingRole}
          >
            {isRefreshingRole ? (
              <ActivityIndicator size="small" color="#007AFF" style={{ marginHorizontal: 2 }} />
            ) : (
              <Ionicons name="refresh-outline" size={_20} color="#007AFF" />
            )}
            <Text style={styles.actionButtonText}>Refresh Session</Text>
            <Ionicons
              name="chevron-forward"
              size={_20}
              color="#ccc"
              style={styles.actionButtonIcon}
            />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.logoutButton} onPress={_handleLogout}>
            <Ionicons name="log-out-outline" size={_20} color="#FF3B30" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const _styles = StyleSheet.create({
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
