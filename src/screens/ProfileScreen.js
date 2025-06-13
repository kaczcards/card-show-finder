// src/screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import { logoutUser, updateUserProfile } from '../services/authService';
import { handleDealerUpgrade } from '../services/paymentService';
import { useStripe } from '@stripe/stripe-react-native';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { currentUser, userProfile, refreshUserProfile } = useUser();
  const [upgrading, setUpgrading] = useState(false);
  const stripe = useStripe();
  
  const [settings, setSettings] = useState({
    notifications: true,
    locationServices: true,
    emailUpdates: false,
    darkMode: false
  });
  
  // Initialize settings from user profile when available
  useEffect(() => {
    if (userProfile && userProfile.notificationPreferences) {
      setSettings(prev => ({
        ...prev,
        notifications: userProfile.notificationPreferences.showAlerts || true,
        emailUpdates: userProfile.notificationPreferences.upcomingShows || false,
      }));
    }
  }, [userProfile]);
  
  // Handle logout
  const handleLogout = async () => {
    try {
      const { error } = await logoutUser();
      if (error) {
        Alert.alert('Logout Failed', error);
        return;
      }
      
      // Navigate to login
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred.');
      console.error(error);
    }
  };
  
  // Handle upgrading to dealer account
  const handleUpgrade = async () => {
    try {
      setUpgrading(true);
      const { success, error } = await handleDealerUpgrade(currentUser.uid, stripe);
      
      if (!success) {
        Alert.alert('Upgrade Failed', error || 'Failed to process payment');
        return;
      }
      
      // Refresh user profile to show updated role
      await refreshUserProfile();
      Alert.alert('Success', 'Your account has been upgraded to Dealer!');
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred during upgrade.');
      console.error(error);
    } finally {
      setUpgrading(false);
    }
  };
  
  // Toggle setting
  const toggleSetting = async (setting) => {
    const newValue = !settings[setting];
    
    setSettings({
      ...settings,
      [setting]: newValue
    });
    
    // Update user profile if this is a notification preference
    if (currentUser && userProfile) {
      if (setting === 'notifications' || setting === 'emailUpdates') {
        try {
          await updateUserProfile(currentUser.uid, {
            notificationPreferences: {
              ...userProfile.notificationPreferences,
              showAlerts: setting === 'notifications' ? newValue : userProfile.notificationPreferences.showAlerts,
              upcomingShows: setting === 'emailUpdates' ? newValue : userProfile.notificationPreferences.upcomingShows
            }
          });
          await refreshUserProfile();
        } catch (error) {
          console.error('Failed to update notification preferences:', error);
        }
      }
    }
  };
  
  // If not authenticated, show login prompt
  if (!currentUser) {
    return (
      <View style={styles.container}>
        <View style={styles.loginContainer}>
          <Ionicons name="person-circle-outline" size={80} color="#3498db" />
          <Text style={styles.loginTitle}>Sign in to your account</Text>
          <Text style={styles.loginSubtext}>
            Create a free account to save your favorite card shows and get personalized recommendations.
          </Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.registerButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileInfo}>
          <View style={styles.profileImageContainer}>
            <Ionicons name="person-circle" size={80} color="#3498db" />
          </View>
          <View>
            <Text style={styles.profileName}>
              {userProfile?.firstName || 'Card Collector'}
            </Text>
            <Text style={styles.profileEmail}>
              {currentUser?.email || 'user@example.com'}
            </Text>
            {/* 
              Navigates to ProfileSetup screen so the user can update
              existing profile details such as name, ZIP code, interests, etc.
            */}
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('ProfileSetup', { userId: currentUser.uid })
              }
            >
              <Text style={styles.editProfileText}>Edit My Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Settings Section */}
      <View style={styles.settingsContainer}>
        <Text style={styles.sectionTitle}>Settings</Text>
        
        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingTitle}>Show Notifications</Text>
            <Text style={styles.settingDescription}>
              Get alerts about upcoming shows
            </Text>
          </View>
          <Switch
            value={settings.notifications}
            onValueChange={() => toggleSetting('notifications')}
            trackColor={{ false: '#e9ecef', true: '#bde0fe' }}
            thumbColor={settings.notifications ? '#3498db' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingTitle}>Location Services</Text>
            <Text style={styles.settingDescription}>
              Show trading card shows near you
            </Text>
          </View>
          <Switch
            value={settings.locationServices}
            onValueChange={() => toggleSetting('locationServices')}
            trackColor={{ false: '#e9ecef', true: '#bde0fe' }}
            thumbColor={settings.locationServices ? '#3498db' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingTitle}>Email Updates</Text>
            <Text style={styles.settingDescription}>
              Receive emails about new shows in your area
            </Text>
          </View>
          <Switch
            value={settings.emailUpdates}
            onValueChange={() => toggleSetting('emailUpdates')}
            trackColor={{ false: '#e9ecef', true: '#bde0fe' }}
            thumbColor={settings.emailUpdates ? '#3498db' : '#f4f3f4'}
          />
        </View>
      </View>
      
      {/* Account Type Section */}
      <View style={styles.accountContainer}>
        <Text style={styles.sectionTitle}>Account Type</Text>
        
        <View style={styles.accountTypeInfo}>
          <View>
            <View style={styles.accountTypeRow}>
              <Text style={styles.accountTypeTitle}>
                {userProfile?.role === 'dealer' ? 'Dealer Account' : 'Collector Account'}
              </Text>
              
              {userProfile?.role === 'dealer' && (
                <View style={styles.promoterBadge}>
                  <Ionicons name="star" size={14} color="#fff" />
                  <Text style={styles.promoterBadgeText}>DEALER</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.accountTypeDescription}>
              {userProfile?.role === 'dealer' 
                ? 'You can add and manage your card shows in the app.'
                : 'Upgrade to a dealer account to add your card shows to the app.'}
            </Text>
          </View>
          
          {userProfile?.role !== 'dealer' && (
            <TouchableOpacity 
              style={styles.upgradeButton}
              onPress={handleUpgrade}
              disabled={upgrading}
            >
              {upgrading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.upgradeButtonText}>Upgrade to Dealer</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        
        {userProfile?.role === 'dealer' && (
          <>
            <View style={styles.promoterFeatures}>
              <View style={styles.featureItem}>
                <Ionicons
                  name="add-circle-outline"
                  size={24}
                  color="#3498db"
                  style={styles.featureIcon}
                />
                <Text style={styles.featureText}>Add your card shows</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons
                  name="analytics-outline"
                  size={24}
                  color="#3498db"
                  style={styles.featureIcon}
                />
                <Text style={styles.featureText}>View attendance analytics</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons
                  name="megaphone-outline"
                  size={24}
                  color="#3498db"
                  style={styles.featureIcon}
                />
                <Text style={styles.featureText}>Promote to targeted collectors</Text>
              </View>
            </View>

            {/* Manage My Shows button */}
            <TouchableOpacity
              style={styles.manageButton}
              onPress={() => navigation.navigate('MyShows')}
            >
              <Ionicons
                name="albums-outline"
                size={20}
                color="#fff"
                style={styles.manageIcon}
              />
              <Text style={styles.manageButtonText}>Manage My Shows</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      
      {/* Show History & Badges */}
      <View style={styles.historyContainer}>
        <Text style={styles.sectionTitle}>My Show History</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>8</Text>
            <Text style={styles.statLabel}>Shows Attended</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>12</Text>
            <Text style={styles.statLabel}>Reviews Written</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>4.6</Text>
            <Text style={styles.statLabel}>Avg Rating Given</Text>
          </View>
        </View>

        <View style={styles.badgesSection}>
          <Text style={styles.badgesTitle}>Achievements</Text>
          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Ionicons name="trophy" size={24} color="#ffc107" />
              <Text style={styles.badgeText}>First Show</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="star" size={24} color="#3498db" />
              <Text style={styles.badgeText}>5 Shows</Text>
            </View>
            <View style={[styles.badge, styles.lockedBadge]}>
              <Ionicons name="lock-closed" size={24} color="#adb5bd" />
              <Text style={styles.lockedBadgeText}>10 Shows</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.historyButton}>
          <Text style={styles.historyButtonText}>View Complete History</Text>
          <Ionicons name="chevron-forward" size={20} color="#3498db" />
        </TouchableOpacity>
      </View>

      {/* Support Section */}
      <View style={styles.supportContainer}>
        <Text style={styles.sectionTitle}>Support</Text>
        
        <TouchableOpacity style={styles.supportItem}>
          <Ionicons name="help-circle-outline" size={24} color="#3498db" style={styles.supportIcon} />
          <Text style={styles.supportText}>Help & FAQs</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.supportItem}>
          <Ionicons name="mail-outline" size={24} color="#3498db" style={styles.supportIcon} />
          <Text style={styles.supportText}>Contact Us</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.supportItem}>
          <Ionicons name="document-text-outline" size={24} color="#3498db" style={styles.supportIcon} />
          <Text style={styles.supportText}>Terms & Privacy</Text>
        </TouchableOpacity>
      </View>
      
      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color="#fff" style={styles.logoutIcon} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
      
      {/* App Version */}
      <Text style={styles.versionText}>Card Show Finder v1.0.0</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: '#212529',
  },
  loginSubtext: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#6c757d',
    paddingHorizontal: 20,
  },
  loginButton: {
    backgroundColor: '#3498db',
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 10,
    marginBottom: 15,
    width: '100%',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerButton: {
    borderWidth: 1,
    borderColor: '#3498db',
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#3498db',
    fontSize: 16,
    fontWeight: 'bold',
  },
  profileHeader: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImageContainer: {
    marginRight: 20,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
  },
  profileEmail: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 8,
  },
  editProfileText: {
    color: '#3498db',
    fontSize: 16,
  },
  settingsContainer: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  accountContainer: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  accountTypeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  accountTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  accountTypeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginRight: 10,
  },
  accountTypeDescription: {
    fontSize: 14,
    color: '#6c757d',
    maxWidth: 250,
  },
  promoterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  promoterBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  upgradeButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  promoterFeatures: {
    marginTop: 15,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  featureIcon: {
    marginRight: 15,
  },
  featureText: {
    fontSize: 14,
    color: '#212529',
  },
  /* Manage My Shows button */
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  manageIcon: {
    marginRight: 6,
  },
  manageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyContainer: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
  badgesSection: {
    marginBottom: 20,
  },
  badgesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  badge: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    minWidth: 80,
  },
  lockedBadge: {
    opacity: 0.5,
  },
  badgeText: {
    fontSize: 12,
    color: '#212529',
    marginTop: 4,
    textAlign: 'center',
  },
  lockedBadgeText: {
    fontSize: 12,
    color: '#adb5bd',
    marginTop: 4,
    textAlign: 'center',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  historyButtonText: {
    color: '#3498db',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#212529',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  settingTitle: {
    fontSize: 16,
    color: '#212529',
    marginBottom: 5,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6c757d',
    maxWidth: 250,
  },
  supportContainer: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  supportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  supportIcon: {
    marginRight: 15,
  },
  supportText: {
    fontSize: 16,
    color: '#212529',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  logoutIcon: {
    marginRight: 10,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  versionText: {
    textAlign: 'center',
    color: '#adb5bd',
    marginBottom: 30,
    fontSize: 14,
  },
});

export default ProfileScreen;
