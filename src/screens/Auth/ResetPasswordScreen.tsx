import React, { useState, useEffect, useRef } from 'react';
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
import { supabase as _supabase } from '../../supabase';
import { updatePassword } from '../../services/supabaseAuthService';

// Define the auth navigation param list type
type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
};

// Exporting Props so that navigators and other components can import it
export type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

const ResetPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  // State for form fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  // flag to show "no token" UI after grace period
  const [tokenTimedOut, setTokenTimedOut] = useState(false);
  
  // Ref to track if component is mounted
  const isMounted = useRef(true);

  /**
   * Enhanced token extraction function that supports multiple URL formats:
   * - cardshowfinder://reset-password?token=XYZ
   * - https://cardshowfinder.app/reset-password?token=XYZ
   * - reset-password?token=XYZ
   * - Any URL containing token=XYZ
   */
  const extractToken = (url: string): string | null => {
    console.warn('[ResetPasswordScreen] Attempting to extract token from URL:', url);
    
    // Try standard URLSearchParams approach first
    try {
      // Handle URLs with or without protocol
      let parsableUrl = url;
      
      // If URL doesn't have a protocol, add a dummy one to make it parsable
      if (!url.includes('://')) {
        parsableUrl = `https://dummy.com/${url}`;
      }
      
      const urlObj = new URL(parsableUrl);
      const token = urlObj.searchParams.get('token');
      
      if (token) {
        console.warn('[ResetPasswordScreen] Token extracted using URL object:', token.substring(0, 5) + '...');
        return token;
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e) {
      console.warn('[ResetPasswordScreen] URL parsing failed, falling back to string search');
    }
    
    // Fallback to manual string search
    const tokenKey = 'token=';
    const idx = url.indexOf(tokenKey);
    if (idx === -1) {
      console.warn('[ResetPasswordScreen] No token parameter found in URL');
      return null;
    }
    
    // token is everything after `token=` until `&` or end-of-string
    const tokenPart = url.slice(idx + tokenKey.length);
    const ampIdx = tokenPart.indexOf('&');
    const token = ampIdx === -1 ? tokenPart : tokenPart.slice(0, ampIdx);
    
    // Log a truncated version of the token for debugging (avoid logging full token for security)
    if (token) {
      console.warn('[ResetPasswordScreen] Token extracted using string search:', token.substring(0, 5) + '...');
    } else {
      console.warn('[ResetPasswordScreen] Failed to extract token using string search');
    }
    
    return token;
  };

  // Process a URL to extract the token
  const processUrl = async (url: string | null) => {
    if (!url) {
      console.warn('[ResetPasswordScreen] No URL to process');
      return;
    }
    
    console.warn('[ResetPasswordScreen] Processing URL:', url);
    setDebugInfo(prev => `${prev}\nProcessing URL: ${url}`);
    
    if (url.includes('reset-password')) {
      const urlToken = extractToken(url);
      if (urlToken) {
        console.warn('[ResetPasswordScreen] Setting token from URL');
        setToken(urlToken);
        setTokenTimedOut(false);
        setDebugInfo(prev => `${prev}\nToken found: ${urlToken.substring(0, 5)}...`);
      } else {
        console.error('[ResetPasswordScreen] Reset password URL found but no token parameter');
        setError('No reset token found in the URL');
        setDebugInfo(prev => `${prev}\nNo token found in URL`);
      }
    } else {
      console.warn('[ResetPasswordScreen] URL does not contain reset-password path');
      setDebugInfo(prev => `${prev}\nURL does not contain reset-password path`);
    }
  };

  // Extract token from route params or URL
  useEffect(() => {
    console.warn('[ResetPasswordScreen] Component mounted');
    setDebugInfo('Component mounted');
    
    // Get token from route params if available
    let routeToken: string | undefined;
    if (route.params) {
      routeToken = route.params.token;
    }

    if (routeToken) {
      console.warn('[ResetPasswordScreen] Token found in route params');
      setToken(routeToken);
      setDebugInfo(prev => `${prev}\nToken found in route params: ${routeToken.substring(0, 5)}...`);
      return;
    }

    // If no token in route params, check if we can extract it from the URL
    const getTokenFromUrl = async () => {
      try {
        console.warn('[ResetPasswordScreen] Checking initial URL');
        setDebugInfo(prev => `${prev}\nChecking initial URL...`);
        
        // Get the initial URL that opened the app
        const initialUrl = await Linking.getInitialURL();
        console.warn('[ResetPasswordScreen] Initial URL:', initialUrl);
        setDebugInfo(prev => `${prev}\nInitial URL: ${initialUrl || 'none'}`);
        
        await processUrl(initialUrl);
      } catch (err) {
        console.error('[ResetPasswordScreen] Error extracting token from URL:', err);
        setError('Failed to process the password reset link');
        setDebugInfo(prev => `${prev}\nError: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    getTokenFromUrl();

    // After 3 s, if we still have no token, reveal the "request new link" UI
    const timeoutId = setTimeout(() => {
      if (isMounted.current && !token) {
        setTokenTimedOut(true);
      }
    }, 3000);

    // Set up URL event listener for when app is already running
    const urlListener = (event: { url: string }) => {
      console.warn('[ResetPasswordScreen] URL event received:', event.url);
      setDebugInfo(prev => `${prev}\nURL event received: ${event.url}`);
      processUrl(event.url);
    };

    // Add the event listener
    const subscription = Linking.addEventListener('url', urlListener);

    // Clean up function
    return () => {
      console.warn('[ResetPasswordScreen] Component unmounting, cleaning up listeners');
      isMounted.current = false;
      subscription.remove();
      clearTimeout(timeoutId);
    };
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
      console.warn('[ResetPasswordScreen] Attempting to update password with token');

      // Update the user's password using the helper in supabaseAuthService
      await updatePassword(password);

      console.warn('[ResetPasswordScreen] Password updated successfully');
      
      // Password reset successful
      Alert.alert(
        'Password Updated',
        'Your password has been successfully updated. Please sign in with your new password.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (err: any) {
      console.error('[ResetPasswordScreen] Error resetting password:', err);
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  // Navigate back to login
  const handleNavigateToLogin = () => {
    navigation.navigate('Login');
  };

  // Request a new password reset link
  const handleRequestNewLink = () => {
    navigation.navigate('ForgotPassword');
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

            {tokenTimedOut && !token && !isLoading ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  Invalid or expired reset link. Please request a new password reset.
                </Text>
                <TouchableOpacity 
                  style={styles.requestNewLinkButton}
                  onPress={handleRequestNewLink}
                >
                  <Text style={styles.requestNewLinkText}>Request New Reset Link</Text>
                </TouchableOpacity>
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

            {/* Debug information section - can be removed in production */}
            {__DEV__ && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug Information</Text>
                <Text style={styles.debugText}>Token Status: {token ? 'Present' : 'Missing'}</Text>
                <Text style={styles.debugText}>Debug Log:</Text>
                <ScrollView style={styles.debugScroll}>
                  <Text style={styles.debugLog}>{debugInfo}</Text>
                </ScrollView>
              </View>
            )}
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
    marginBottom: 8,
  },
  requestNewLinkButton: {
    backgroundColor: '#DC2626',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  requestNewLinkText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
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
  // Debug styles
  debugContainer: {
    marginTop: 30,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  debugScroll: {
    maxHeight: 150,
    marginTop: 8,
  },
  debugLog: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#333',
  },
});

export default ResetPasswordScreen;
