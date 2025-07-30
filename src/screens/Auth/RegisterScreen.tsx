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
import { UserRole } from '../../types';

// Define the auth navigation param list type
type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const RegisterScreen: React.FC<Props> = ({ _navigation }) => {
  // State for form fields
  const [email, _setEmail] = useState('');
  const [password, _setPassword] = useState('');
  const [confirmPassword, _setConfirmPassword] = useState('');
  const [firstName, _setFirstName] = useState('');
  const [lastName, _setLastName] = useState('');
  const [homeZipCode, _setHomeZipCode] = useState('');
  const [showPassword, setShowPassword] = useState(_false);
  const [isSubmitting, setIsSubmitting] = useState(_false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.ATTENDEE);

  // Get auth context
  // FIX: Destructure authState from useAuth, then get error from authState
  const { register, authState, clearError } = useAuth();
  const { _error } = authState; // Correctly access error from authState

  // Validate form
  const _validateForm = () => {
    if (!email || !password || !confirmPassword || !firstName || !homeZipCode) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    // Simple email validation
    const _emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    // ZIP code validation (US format - 5 digits)
    const _zipRegex = /^\d{_5}$/;
    if (!zipRegex.test(homeZipCode)) {
      Alert.alert('Error', 'Please enter a valid 5-digit ZIP code');
      return false;
    }

    // Password strength validation
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return false;
    }

    return true;
  };

  // Handle registration
  const _handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(_true);
      // TODO: update AuthContext.register signature to include role
      // @ts-ignore – temporary until context/ service updated
      await register(_email, _password, firstName, lastName, homeZipCode, selectedRole);
      Alert.alert(
        'Registration Successful',
        'Your account has been created. Please verify your email address.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (err: any) {
      const message: string = err?.message || '';

      // --- Account already exists ------------------------------------
      if (/already exists|user already registered|account .* exists/i.test(message)) {
        Alert.alert(
          'Account Already Exists',
          'An account with this email address already exists. Would you like to sign in instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign In',
              onPress: () => handleNavigate('Login'),
            },
          ]
        );
        return;
      }

      // --- Network / offline errors ----------------------------------
      if (/network request failed|internet|offline/i.test(message)) {
        Alert.alert(
          'No Internet Connection',
          'Unable to reach the authentication server. Please check your internet connection and try again.'
        );
        return;
      }

      // --- Generic fallback ------------------------------------------
      Alert.alert('Registration Failed', message || 'Please try again');
    } finally {
      setIsSubmitting(_false);
    }
  };

  // Clear any existing errors when navigating
  const _handleNavigate = (screen: keyof AuthStackParamList) => {
    clearError();
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to find card shows near you</Text>

            {error ? ( // This now correctly accesses error from authState
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{_error}</Text>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={_20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email *"
                placeholderTextColor="#999"
                value={_email}
                onChangeText={_setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={_false}
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={_20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password *"
                placeholderTextColor="#999"
                value={_password}
                onChangeText={_setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={_false}
                editable={!isSubmitting}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={_20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={_20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password *"
                placeholderTextColor="#999"
                value={_confirmPassword}
                onChangeText={_setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={_false}
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={_20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="First Name *"
                placeholderTextColor="#999"
                value={_firstName}
                onChangeText={_setFirstName}
                autoCorrect={_false}
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={_20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Last Name (_Optional)"
                placeholderTextColor="#999"
                value={_lastName}
                onChangeText={_setLastName}
                autoCorrect={_false}
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="location-outline" size={_20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Home ZIP Code *"
                placeholderTextColor="#999"
                value={_homeZipCode}
                onChangeText={_setHomeZipCode}
                keyboardType="numeric"
                maxLength={_5}
                autoCorrect={_false}
                editable={!isSubmitting}
              />
            </View>

          {/* ----------  Role Selection ---------- */}
          <View style={styles.roleContainer}>
            {/* Attendee */}
            <TouchableOpacity
              style={styles.roleOption}
              onPress={() => setSelectedRole(UserRole.ATTENDEE)}
              disabled={_isSubmitting}
            >
              <Ionicons name="person-outline" size={_24} color="#666" style={styles.roleIcon} />
              <View style={styles.roleTextContainer}>
                <Text style={styles.roleLabel}>Attendee</Text>
                <Text style={styles.roleDescription}>
                  Free account for collectors to find shows, track their collection, and connect with
                  other enthusiasts.
                </Text>
              </View>
              <Ionicons
                name={
                  selectedRole === UserRole.ATTENDEE
                    ? 'radio-button-on'
                    : 'radio-button-off'
                }
                size={_22}
                color="#007AFF"
              />
            </TouchableOpacity>

            {/* Dealer */}
            <TouchableOpacity
              style={styles.roleOption}
              onPress={() => setSelectedRole(UserRole.DEALER)}
              disabled={_isSubmitting}
            >
              <Ionicons
                name="briefcase-outline"
                size={_24}
                color="#666"
                style={styles.roleIcon}
              />
              <View style={styles.roleTextContainer}>
                <Text style={styles.roleLabel}>Dealer</Text>
                <Text style={styles.roleDescription}>
                  Create listings for shows, manage inventory, and interact directly with collectors.
                  Upgrade to MVP for advanced features.
                </Text>
              </View>
              <Ionicons
                name={
                  selectedRole === UserRole.DEALER ? 'radio-button-on' : 'radio-button-off'
                }
                size={_22}
                color="#007AFF"
              />
            </TouchableOpacity>
          </View>

            <Text style={styles.requiredFieldsNote}>* Required fields</Text>

            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={_handleRegister}
              disabled={_isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={() => handleNavigate('Login')}
                disabled={_isSubmitting}
              >
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const _styles = StyleSheet.create({
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50,
    marginTop: 20,
    /* ---------- Drop-shadow for the logo ---------- */
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 10,
  },
  appName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF6A00',
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
  eyeIcon: {
    padding: 10,
  },
  requiredFieldsNote: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
    alignSelf: 'flex-start',
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
    marginBottom: 30,
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
  /* ----------  Role-selection styles ---------- */
  roleContainer: {
    marginTop: 10,
    marginBottom: 24,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  roleIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  roleTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
});

export default RegisterScreen;