// src/screens/ClaimShowScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import { getCardShowDetails, updateCardShow } from '../services/firebaseApi';
import { upgradeToShowOrganizer } from '../services/authService';

const ClaimShowScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { currentUser, userProfile, refreshUserProfile } = useUser();
  
  // Get show ID from route params
  const { showId } = route.params || {};
  
  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showDetails, setShowDetails] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Load show details on mount
  useEffect(() => {
    const fetchShowDetails = async () => {
      if (!showId) {
        setError('Show ID is missing');
        return;
      }
      
      try {
        setLoading(true);
        const { show, error } = await getCardShowDetails(showId);
        
        if (error) {
          setError(`Failed to load show details: ${error}`);
          return;
        }
        
        setShowDetails(show);
        
        // Pre-fill form with user's name if available
        if (userProfile?.firstName) {
          setName(userProfile.firstName);
        }
      } catch (err) {
        console.error('Error fetching show details:', err);
        setError('Failed to load show details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchShowDetails();
  }, [showId, userProfile]);
  
  // Format phone number as user types
  const formatPhoneNumber = (text) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    
    // Format: (XXX) XXX-XXXX
    let formatted = cleaned;
    if (cleaned.length > 0) {
      formatted = cleaned.substring(0, 10); // Limit to 10 digits
      
      if (formatted.length > 6) {
        formatted = `(${formatted.substring(0, 3)}) ${formatted.substring(3, 6)}-${formatted.substring(6)}`;
      } else if (formatted.length > 3) {
        formatted = `(${formatted.substring(0, 3)}) ${formatted.substring(3)}`;
      } else if (formatted.length > 0) {
        formatted = `(${formatted}`;
      }
    }
    
    setPhone(formatted);
  };
  
  // Clean phone number for comparison
  const cleanPhoneNumber = (phoneStr) => {
    return phoneStr.replace(/\D/g, '');
  };
  
  // Handle claim submission
  const handleClaimShow = async () => {
    // Basic validation
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    
    if (!phone.trim() || cleanPhoneNumber(phone).length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }
    
    if (!showDetails) {
      Alert.alert('Error', 'Show details not available');
      return;
    }
    
    try {
      setValidating(true);
      
      // Verify the name and phone match the show's promoter info
      const showPromoterName = showDetails.promoterName || '';
      const showPromoterPhone = showDetails.promoterPhone || '';
      
      const nameMatches = name.trim().toLowerCase() === showPromoterName.trim().toLowerCase();
      const phoneMatches = cleanPhoneNumber(phone) === cleanPhoneNumber(showPromoterPhone);
      
      if (!nameMatches || !phoneMatches) {
        Alert.alert(
          'Verification Failed',
          'The name and phone number you entered do not match the show organizer information on file.'
        );
        setValidating(false);
        return;
      }
      
      // Upgrade user to Show Organizer role if they're not already
      if (userProfile.role !== 'showOrganizer') {
        const { success, error } = await upgradeToShowOrganizer(currentUser.uid);
        
        if (!success) {
          Alert.alert('Error', `Failed to upgrade account: ${error}`);
          return;
        }
        
        // Refresh user profile to get updated role
        await refreshUserProfile();
      }
      
      // Update the show with the user's ID as promoter
      const updateData = {
        promoterId: currentUser.uid,
        claimed: true,
        claimedAt: new Date()
      };
      
      const { success, error } = await updateCardShow(showId, updateData);
      
      if (!success) {
        Alert.alert('Error', `Failed to claim show: ${error}`);
        return;
      }
      
      // Show success message and navigate back
      setSuccess(true);
      
      setTimeout(() => {
        navigation.navigate('ShowDetails', { showId });
      }, 2000);
      
    } catch (err) {
      console.error('Error claiming show:', err);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setValidating(false);
    }
  };
  
  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading show details...</Text>
      </View>
    );
  }
  
  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#dc3545" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.goBackButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Success state
  if (success) {
    return (
      <View style={styles.successContainer}>
        <Ionicons name="checkmark-circle" size={64} color="#28a745" />
        <Text style={styles.successTitle}>Show Claimed Successfully!</Text>
        <Text style={styles.successText}>
          You are now the official organizer of this show.
        </Text>
      </View>
    );
  }
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Claim Show Ownership</Text>
          <Text style={styles.subtitle}>
            Please verify your information to claim this show
          </Text>
        </View>
        
        {/* Show details */}
        <View style={styles.showInfoContainer}>
          <Text style={styles.showTitle}>{showDetails?.title || 'Show'}</Text>
          <Text style={styles.showDate}>
            {showDetails?.date instanceof Date 
              ? showDetails.date.toLocaleDateString() 
              : new Date(showDetails?.date).toLocaleDateString()}
          </Text>
          <Text style={styles.showLocation}>{showDetails?.location || ''}</Text>
        </View>
        
        {/* Verification form */}
        <View style={styles.formContainer}>
          <Text style={styles.formLabel}>Your Name (as Show Organizer)</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
            autoCapitalize="words"
          />
          
          <Text style={styles.formLabel}>Your Phone Number (as listed for the show)</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={formatPhoneNumber}
            placeholder="(555) 555-5555"
            keyboardType="phone-pad"
          />
          
          <Text style={styles.infoText}>
            <Ionicons name="information-circle" size={16} color="#3498db" />
            {' '}Your name and phone number must match the information listed for this show.
          </Text>
        </View>
        
        {/* Claim button */}
        <TouchableOpacity
          style={styles.claimButton}
          onPress={handleClaimShow}
          disabled={validating}
        >
          {validating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.claimButtonText}>Claim Show</Text>
            </>
          )}
        </TouchableOpacity>
        
        {/* Cancel button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={validating}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
  },
  showInfoContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  showTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  showDate: {
    fontSize: 16,
    color: '#495057',
    marginBottom: 4,
  },
  showLocation: {
    fontSize: 16,
    color: '#495057',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  formLabel: {
    fontSize: 16,
    color: '#495057',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
  },
  claimButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonIcon: {
    marginRight: 8,
  },
  claimButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6c757d',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  goBackButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  goBackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#28a745',
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: '#212529',
    textAlign: 'center',
  },
});

export default ClaimShowScreen;
