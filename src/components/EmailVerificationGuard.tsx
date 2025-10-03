import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { resendEmailVerification } from '../services/supabaseAuthService';

interface EmailVerificationGuardProps {
  children: React.ReactNode;
}

/**
 * EmailVerificationGuard - Prevents unverified users from accessing the main app
 * 
 * This component:
 * 1. Checks if the user's email is verified
 * 2. If not verified, shows verification screen with resend option
 * 3. Auto-checks verification status periodically
 * 4. Automatically logs out users after a timeout period
 */
const EmailVerificationGuard: React.FC<EmailVerificationGuardProps> = ({ children }) => {
  const { authState, logout, refreshUserRole } = useAuth();
  const { user, isAuthenticated } = authState;
  
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [timeUntilLogout, setTimeUntilLogout] = useState(600); // 10 minutes
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);

  // Auto logout timeout (10 minutes)
  const LOGOUT_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
  const COOLDOWN_TIME = 60; // 1 minute cooldown between resends

  // Auto-logout timer
  useEffect(() => {
    if (!user?.isEmailVerified && isAuthenticated) {
      const logoutTimer = setTimeout(() => {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please sign in again and verify your email.',
          [
            {
              text: 'OK',
              onPress: logout,
            },
          ],
          { cancelable: false }
        );
      }, LOGOUT_TIMEOUT);

      // Countdown timer
      const countdownInterval = setInterval(() => {
        setTimeUntilLogout(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearTimeout(logoutTimer);
        clearInterval(countdownInterval);
      };
    }
  }, [user?.isEmailVerified, isAuthenticated, logout]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const cooldownInterval = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);

      return () => clearInterval(cooldownInterval);
    }
  }, [resendCooldown]);

  // Periodic verification check (every 10 seconds for better UX)
  useEffect(() => {
    if (!user?.isEmailVerified && isAuthenticated) {
      const verificationCheck = setInterval(async () => {
        setIsCheckingVerification(true);
        try {
          // Refresh the user session to check if email is now verified
          const { supabase } = await import('../supabase');
          const { data: session } = await supabase.auth.getSession();
          
          if (session?.session?.user?.email_confirmed_at) {
            // Email is now verified! Refresh the auth context to update the UI
            console.log('[EmailVerificationGuard] Email verified! Refreshing user session...');
            await refreshUserRole();
            // The component will re-render and show the main app
          }
        } catch (error) {
          console.error('Error checking verification status:', error);
        } finally {
          setIsCheckingVerification(false);
        }
      }, 10000); // Check every 10 seconds

      return () => clearInterval(verificationCheck);
    }
  }, [user?.isEmailVerified, isAuthenticated, refreshUserRole]);

  const handleResendEmail = async () => {
    if (!user?.email || isResending || resendCooldown > 0) return;

    try {
      setIsResending(true);
      await resendEmailVerification(user.email);
      
      Alert.alert(
        'Email Sent',
        'A new verification email has been sent to your email address. Please check your inbox and spam folder.',
        [{ text: 'OK' }]
      );
      
      setResendCooldown(COOLDOWN_TIME);
    } catch (error: any) {
      console.error('Failed to resend verification email:', error);
      Alert.alert(
        'Error',
        'Failed to send verification email. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You can sign back in anytime, but you will need to verify your email to access the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // If user is not authenticated, show children (auth screens)
  if (!isAuthenticated || !user) {
    return <>{children}</>;
  }

  // If user email is verified, show the main app
  if (user.isEmailVerified) {
    return <>{children}</>;
  }

  // Show email verification required screen
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="mail-outline" size={80} color="#007AFF" />
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We sent a verification link to:
          </Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <View style={styles.step}>
            <Ionicons name="mail-open-outline" size={24} color="#666" />
            <Text style={styles.stepText}>
              Check your email inbox (and spam folder)
            </Text>
          </View>
          
          <View style={styles.step}>
            <Ionicons name="link-outline" size={24} color="#666" />
            <Text style={styles.stepText}>
              Click the verification link in the email
            </Text>
          </View>
          
          <View style={styles.step}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#666" />
            <Text style={styles.stepText}>
              Return to the app - you'll be automatically signed in
            </Text>
          </View>
        </View>

        {/* Verification status */}
        {isCheckingVerification && (
          <View style={styles.checkingStatus}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.checkingText}>Checking verification status...</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.resendButton,
              (isResending || resendCooldown > 0) && styles.disabledButton,
            ]}
            onPress={handleResendEmail}
            disabled={isResending || resendCooldown > 0}
          >
            {isResending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={20} color="#fff" />
                <Text style={styles.resendButtonText}>
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend Email'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Timeout warning */}
        <View style={styles.timeoutWarning}>
          <Ionicons name="time-outline" size={16} color="#FF6B6B" />
          <Text style={styles.timeoutText}>
            Auto-logout in {formatTime(timeUntilLogout)}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'center',
  },
  instructions: {
    marginBottom: 32,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  stepText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
    flex: 1,
  },
  checkingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  checkingText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
  },
  actions: {
    gap: 12,
  },
  resendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#B0C4DE',
  },
  resendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  timeoutWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    gap: 8,
  },
  timeoutText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '500',
  },
});

export default EmailVerificationGuard;