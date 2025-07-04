import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
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
  const { authState, login, clearError } = useAuth();
  const { isLoading, error } = authState;

  // Handle login
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    try {
      await login({ email, password });
    } catch (err: any) {
      const message = err?.message || '';
      if (message.toLowerCase().includes('verify') || message.toLowerCase().includes('confirmed')) {
        setVerificationRequired(true);
      } else {
        Alert.alert('Login Failed', error || 'Please check your credentials and try again');
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
      Alert.alert('Error', err?.message || 'Unable to resend verification email.');
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
                  <Text style={styles.errorText}>{error}</Text>
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

// --- NEW STYLES ---
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
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 12,
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
