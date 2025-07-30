import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  _TouchableOpacity,
  _StyleSheet,
  _ActivityIndicator,
  KeyboardAvoidingView,
  _Platform,
  ScrollView,
  _Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
// Removed unused import: import { _useAuth } from '../../contexts/AuthContext';

import { resendEmailVerification } from '../../services/supabaseAuthService';

// Define the auth navigation param list type
type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  // State for form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Get auth context
  const { login, clearError, error, isLoading, isAuthenticated } = useAuth();

  // Handle login
  const handleLogin = async () => {
    // Basic validation
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    try {
      // Attempt to log in – login() will throw if it fails.
      // Successful navigation is handled automatically by the
      // AuthContext listener once a valid session is detected.
      await login({ email, password });
    } catch (err: any) {
      // Extract a human-readable message from the caught error
      const message = err?.message || '';

      // Special handling when the account exists but email is unverified
      if (
        message.toLowerCase().includes('verify') ||
        message.toLowerCase().includes('confirmed')
      ) {
        setVerificationRequired(true);
      } else {
        // Display the error message, which is now properly handled
        Alert.alert('Login Failed', message || 'Please check your credentials and try again');
      }
    }
  };

  // Resend verification email
  const handleResendVerification = async () => {
    if (!email) {
      Alert.alert('Email Required', 'Enter your email first so we know where to send the verification link.');
      return;
    }
    try {
      setIsResending(true);
      await resendEmailVerification(email);
      Alert.alert('Verification Email Sent', 'Please check your inbox for the confirmation link.');
    } catch (err: any) {
      Alert.alert('Error', _err?.message || 'Unable to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  // Clear any existing errors when navigating
  const handleNavigate = (screen: keyof AuthStackParamList) => {
    clearError();
    setVerificationRequired(false);
    navigation.navigate(screen);
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
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/splash-icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Card Show Finder</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>

            {error || verificationRequired ? (
              <View style={styles.errorContainer}>
                {verificationRequired ? (
                  <>
                    <Text style={styles.errorText}>
                      Your email has not been verified. Please check your inbox for the
                      verification link.
                    </Text>
                    <TouchableOpacity
                      style={styles.resendButton}
                      onPress={handleResendVerification}
                      disabled={isResending}
                    >
                      {isResending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.resendButtonText}>Resend verification email</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.errorText}>{_error}</Text>
                )}
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={22} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={22} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color="#888"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => handleNavigate('ForgotPassword')}
              disabled={isLoading}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => handleNavigate('Register')}
                disabled={isLoading}
              >
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const BRAND_COLORS = {
  primaryBlue: '#007AFF',
  primaryOrange: '#FF6A00',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  darkText: '#333333',
  subtleText: '#666666',
  lightBorder: '#E0E0E0',
  errorRed: '#DC2626',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.lightGray,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingVertical: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
    /* ---------- Drop-shadow for the logo ---------- */
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4, // Android
  },
  logo: {
    width: 150,
    height: 150,
    maxWidth: '80%',
  },
  appName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: BRAND_COLORS.primaryOrange,
  },
  formContainer: {
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: BRAND_COLORS.darkText,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: BRAND_COLORS.subtleText,
    textAlign: 'center',
    marginBottom: 30,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  errorText: {
    color: BRAND_COLORS.errorRed,
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_COLORS.white,
    borderRadius: 12,
    marginBottom: 18,
    height: 55,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: BRAND_COLORS.lightBorder,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    color: BRAND_COLORS.darkText,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 5,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: BRAND_COLORS.primaryBlue,
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    backgroundColor: BRAND_COLORS.primaryBlue,
    borderRadius: 12,
    height: 55,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2, // Shadow for Android
    shadowColor: '#000', // Shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonDisabled: {
    backgroundColor: '#99C9FF',
  },
  buttonText: {
    color: BRAND_COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 25,
  },
  registerText: {
    color: BRAND_COLORS.subtleText,
    fontSize: 14,
  },
  registerLink: {
    color: BRAND_COLORS.primaryBlue,
    fontSize: 14,
    fontWeight: 'bold',
  },
  resendButton: {
    backgroundColor: BRAND_COLORS.errorRed,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendButtonText: {
    color: BRAND_COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Removed miniLogo styles as they were redundant
});

export default LoginScreen;