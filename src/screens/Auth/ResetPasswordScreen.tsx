import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import { updatePassword } from '../../services/supabaseAuthService';

// Define the auth navigation param list type
type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
};

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

const ResetPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  // State for form fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Extract token from route params or URL
  useEffect(() => {
    // Get token from route params if available
    const routeToken = route.params?.token;
    if (routeToken) {
      setToken(routeToken);
      return;
    }

    // If no token in route params, check if we can extract it from the URL
    // This is a fallback for deep links that might not properly parse the token
    const getTokenFromUrl = async () => {
      try {
        // Get the initial URL that opened the app
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && initialUrl.includes('reset-password')) {
          /**
           * Extract the token irrespective of the prefix style:
           *   • cardshowfinder://reset-password?token=XYZ
           *   • reset-password?token=XYZ
           */
          const extractToken = (url: string): string | null => {
            const tokenKey = 'token=';
            const idx = url.indexOf(tokenKey);
            if (idx === -1) return null;
            // token is everything after `token=` until `&` or end-of-string
            const tokenPart = url.slice(idx + tokenKey.length);
            const ampIdx = tokenPart.indexOf('&');
            return ampIdx === -1 ? tokenPart : tokenPart.slice(0, ampIdx);
          };

          const urlToken = extractToken(initialUrl);
          if (urlToken) {
            setToken(urlToken);
          } else {
            setError('No reset token found in the URL');
          }
        }
      } catch (err) {
        console.error('Error extracting token from URL:', err);
        setError('Failed to process the password reset link');
      }
    };

    getTokenFromUrl();
  }, [route.params]);

  // Validate passwords
  const validatePasswords = () => {
    // Clear previous errors
    setError(null);

    if (!password) {
      setError('Please enter a new password');
      return false;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  // Handle password reset
  const handleResetPassword = async () => {
    if (!validatePasswords()) {
      return;
    }

    if (!token) {
      setError('No reset token available. Please try the reset link from your email again.');
      return;
    }

    try {
      setIsLoading(true);

      // Update the user's password using the helper in supabaseAuthService
      await updatePassword(password, token);

      // Password reset successful
      Alert.alert(
        'Password Updated',
        'Your password has been successfully updated. Please sign in with your new password.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (err: any) {
      console.error('Error resetting password:', err);
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate back to login
  const handleNavigateToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleNavigateToLogin}
          >
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/splash-icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Card Show Finder</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.subtitle}>
              Please enter and confirm your new password.
            </Text>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {!token && !isLoading ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  Invalid or expired reset link. Please request a new password reset.
                </Text>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading && !!token}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading && !!token}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.button, 
                (isLoading || !token) && styles.buttonDisabled
              ]}
              onPress={handleResetPassword}
              disabled={isLoading || !token}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Update Password</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Remember your password? </Text>
              <TouchableOpacity
                onPress={handleNavigateToLogin}
                disabled={isLoading}
              >
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Mini logo at bottom */}
          <View style={styles.miniLogoContainer}>
            <Image
              source={require('../../../assets/splash-icon.png')}
              style={styles.miniLogo}
              resizeMode="contain"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  backButton: {
    padding: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  appName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF6A00',
  },
  miniLogoContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 10,
  },
  miniLogo: {
    width: 60,
    height: 60,
  },
  formContainer: {
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 10,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#333',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#99C9FF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  loginText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ResetPasswordScreen;
