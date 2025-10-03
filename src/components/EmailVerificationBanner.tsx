import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

interface EmailVerificationBannerProps {
  visible?: boolean;
}

const EmailVerificationBanner: React.FC<EmailVerificationBannerProps> = ({ 
  visible = true 
}) => {
  const { authState, logout } = useAuth();
  const { user } = authState;
  const [isResending, setIsResending] = useState(false);
  const [lastResent, setLastResent] = useState<Date | null>(null);

  // Only show banner if user is logged in but email is not verified
  const shouldShow = visible && user && !user.isEmailVerified;

  // Handle resending verification email
  const handleResendVerification = async () => {
    if (!user?.email) return;
    
    // Rate limiting - allow resend only once per minute
    if (lastResent && Date.now() - lastResent.getTime() < 60000) {
      Alert.alert(
        'Please Wait', 
        'You can only resend verification emails once per minute.'
      );
      return;
    }

    try {
      setIsResending(true);
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });

      if (error) {
        throw error;
      }

      setLastResent(new Date());
      Alert.alert(
        'Email Sent',
        'A new verification email has been sent to your email address.'
      );
    } catch (error: any) {
      console.error('Error resending verification email:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to resend verification email. Please try again.'
      );
    } finally {
      setIsResending(false);
    }
  };

  // Handle sign out to allow user to try different email
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You\'ll need to verify your email to access the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: logout
        }
      ]
    );
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Ionicons name="mail-outline" size={24} color="#F59E0B" style={styles.icon} />
        
        <View style={styles.content}>
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.message}>
            Please check your email and click the verification link to access all features.
          </Text>
          
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.button}
              onPress={handleResendVerification}
              disabled={isResending}
            >
              <Text style={styles.buttonText}>
                {isResending ? 'Sending...' : 'Resend Email'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]}
              onPress={handleSignOut}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <TouchableOpacity style={styles.closeButton}>
          <Ionicons name="close" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: 50, // Account for status bar
  },
  banner: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  icon: {
    marginRight: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 18,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#F59E0B',
  },
  closeButton: {
    padding: 4,
  },
});

export default EmailVerificationBanner;