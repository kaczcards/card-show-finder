import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Switch,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole, Badge } from '../../types';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../supabase';
import * as badgeService from '../../services/badgeService';

const ProfileScreen: React.FC = () => {
  const { authState, logout, updateProfile, clearError, refreshUserRole } = useAuth();
  // Pull favoriteCount from authState so it can be displayed below
  const { user, isLoading, error, favoriteCount } = authState;
  const navigation = useNavigation();
  
  // State for edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // session refresh loading
  const [isRefreshingRole, setIsRefreshingRole] = useState(false);
  // Admin status
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  
  // State for editable fields
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [homeZipCode, setHomeZipCode] = useState(user?.homeZipCode || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');

  // State for badges
  const [featuredBadges, setFeaturedBadges] = useState<Badge[]>([]);
  const [isLoadingBadges, setIsLoadingBadges] = useState(false);
  const [badgeError, setBadgeError] = useState<string | null>(null);
  const [nextBadge, setNextBadge] = useState<Badge | null>(null);
  const [badgeProgress, setBadgeProgress] = useState<{
    current: number;
    required: number;
    percent: number;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // Favorite shows – local count & helper
  // ---------------------------------------------------------------------------
  // State for favorite shows count
  const [localFavoriteCount, setLocalFavoriteCount] = useState(0);

  /**
   * Fetch the authoritative favourite-show count from the DB.
   * Tries to read the `favorite_shows_count` column, but gracefully falls
   * back to counting rows in `user_favorite_shows` when the column does
   * not exist (e.g. migration hasn’t run yet).
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
        console.log(
          '[ProfileScreen] Error fetching favorite_shows_count:',
          error.message
        );

        /* 42703 = column does not exist -> migration not applied yet  */
        if (error.code === '42703') {
          console.log(
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
      console.log('[ProfileScreen] Fetched favorite_shows_count:', count);
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
      console.log('[ProfileScreen] Screen focused – refreshing counts/badges');
      fetchFavoriteCount();
      if (user) {
        loadUserBadges();
      }
      // no cleanup needed
    }, [fetchFavoriteCount, user])
  );

  // Load user badges with improved error handling
  const loadUserBadges = async () => {
    if (!user) return;
    
    setIsLoadingBadges(true);
    setBadgeError(null);
    
    try {
      // Get featured badges - will return empty array if error occurs
      const featured = await badgeService.getUserFeaturedBadges(user.id, 3);
      setFeaturedBadges(featured || []);
      
      // Get next badge to earn - will return null if error occurs
      const next = await badgeService.getUserNextBadge(user.id);
      setNextBadge(next);
      
      // If there's a next badge, get progress - will return null if error occurs
      if (next) {
        const progress = await badgeService.getBadgeProgress(user.id, next.id);
        setBadgeProgress(progress);
      } else {
        setBadgeProgress(null);
      }
    } catch (error: any) {
      console.error('Error loading badges:', error);
      setBadgeError(error.message || 'Failed to load badges');
    } finally {
      setIsLoadingBadges(false);
    }
  };
  
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
      clearError(); // Clear any previous errors
    }
    setIsEditMode(!isEditMode);
  };
  
  // Validate form
  const validateForm = () => {
    if (!firstName) {
      Alert.alert('Error', 'First name is required');
      return false;
    }
    
    // ZIP code validation (US format - 5 digits)
    const zipRegex = /^\d{5}$/;
    if (!zipRegex.test(homeZipCode)) {
      Alert.alert('Error', 'Please enter a valid 5-digit ZIP code');
      return false;
    }
    
    // Phone validation (optional)
    if (phoneNumber) {
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(phoneNumber.replace(/\D/g, ''))) {
        Alert.alert('Error', 'Please enter a valid 10-digit phone number');
        return false;
      }
    }
    
    return true;
  };
  
  // Save profile changes
  const saveChanges = async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      await updateProfile({
        firstName,
        lastName: lastName || undefined,
        homeZipCode,
        phoneNumber: phoneNumber || undefined,
      });
      
      setIsEditMode(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err: any) {
      Alert.alert('Update Failed', error || 'Please try again');
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
    console.debug('[ProfileScreen] isDealer check', {
      userId: user.id,
      role: user.role,
      accountType: user.accountType,
      isDealer: dealerLike,
    });

    return dealerLike;
  };
  
  // Get role display name
  const getRoleDisplayName = (role: UserRole) => {
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

  // Get the color for a badge tier
  const getBadgeColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'bronze':
        return '#CD7F32';
      case 'silver':
        return '#C0C0C0';
      case 'gold':
        return '#FFD700';
      case 'platinum':
        return '#E5E4E2';
      default:
        return '#999999';
    }
  };

  // Navigate to Badges screen
  const navigateToBadges = () => {
    navigation.navigate('Badges' as never);
  };

  // Navigate to Admin Map screen
  const navigateToAdminMap = () => {
    navigation.navigate('Admin' as never, { screen: 'AdminMap' } as never);
  };

  // Retry loading badges if there was an error
  const handleRetryLoadBadges = () => {
    loadUserBadges();
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
        
        {/* Badges Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Badges</Text>
            <TouchableOpacity onPress={navigateToBadges}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {isLoadingBadges ? (
            <ActivityIndicator size="small" color="#007AFF" style={{ marginVertical: 20 }} />
          ) : badgeError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={40} color="#FF3B30" />
              <Text style={styles.errorText}>
                There was an error loading your badges.
              </Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={handleRetryLoadBadges}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : featuredBadges.length > 0 ? (
            <View style={styles.badgesContainer}>
              <FlatList
                data={featuredBadges}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.badgeItem}>
                    <View 
                      style={[
                        styles.badgeCircle, 
                        { backgroundColor: getBadgeColor(item.tier) }
                      ]}
                    >
                      <Ionicons name="trophy" size={28} color="white" />
                    </View>
                    <Text style={styles.badgeName}>{item.name}</Text>
                    <Text style={styles.badgeTier}>{item.tier}</Text>
                  </View>
                )}
                contentContainerStyle={styles.badgesList}
              />
              
              {nextBadge && badgeProgress && (
                <View style={styles.nextBadgeContainer}>
                  <Text style={styles.nextBadgeTitle}>Next Badge:</Text>
                  <View style={styles.nextBadgeContent}>
                    <View style={[styles.nextBadgeIcon, { backgroundColor: getBadgeColor(nextBadge.tier) }]}>
                      <Ionicons name="trophy-outline" size={24} color="white" />
                    </View>
                    <View style={styles.nextBadgeInfo}>
                      <Text style={styles.nextBadgeName}>{nextBadge.name}</Text>
                      <Text style={styles.nextBadgeDescription}>{nextBadge.description}</Text>
                      <View style={styles.progressBarContainer}>
                        <View style={styles.progressBarBackground}>
                          <View 
                            style={[
                              styles.progressBar, 
                              { width: `${badgeProgress.percent}%` }
                            ]} 
                          />
                        </View>
                        <Text style={styles.progressText}>
                          {badgeProgress.current}/{badgeProgress.required} shows attended
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noBadgesContainer}>
              <Ionicons name="trophy-outline" size={40} color="#cccccc" />
              <Text style={styles.noBadgesText}>
                You haven't earned any badges yet. Attend card shows to earn badges!
              </Text>
            </View>
          )}
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
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="lock-closed-outline" size={20} color="#007AFF" />
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
  badgesContainer: {
    marginBottom: 8,
  },
  badgesList: {
    paddingBottom: 12,
  },
  badgeItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 100,
  },
  badgeCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    marginBottom: 2,
  },
  badgeTier: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  noBadgesContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noBadgesText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
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
  nextBadgeContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  nextBadgeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  nextBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextBadgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  nextBadgeInfo: {
    flex: 1,
  },
  nextBadgeName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  nextBadgeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressBarContainer: {
    marginTop: 4,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
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
