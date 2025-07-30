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
import { supabase } from '../../supabase';
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
  const [password, _setPassword] = useState('');
  const [confirmPassword, _setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(_false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [_debugInfo, setDebugInfo] = useState<string>('');
  // flag to show “no token” UI after grace period
  const [tokenTimedOut, setTokenTimedOut] = useState(_false);
  
  // Ref to track if component is mounted
  const _isMounted = useRef(_true);

  /**
   * Enhanced token extraction function that supports multiple URL formats:
   * - cardshowfinder://reset-password?token=XYZ
   * - https://cardshowfinder.app/reset-password?token=XYZ
   * - reset-password?token=XYZ
   * - Any URL containing token=XYZ
   */
  const _extractToken = (url: string): string | null => {
    console.warn('[_ResetPasswordScreen] Attempting to extract token from URL:', _url);
    
    // Try standard URLSearchParams approach first
    try {
      // Handle URLs with or without protocol
      let _parsableUrl = url;
      
      // If URL doesn't have a protocol, add a dummy one to make it parsable
      if (!url.includes('://')) {
        parsableUrl = `https://dummy.com/${_url}`;
      }
      
      const _urlObj = new URL(_parsableUrl);
      const _token = urlObj.searchParams.get('token');
      
      if (_token) {
        console.warn('[_ResetPasswordScreen] Token extracted using URL object:', token.substring(0, _5) + '...');
        return token;
      }
    } catch (_e) {
      console.warn('[_ResetPasswordScreen] URL parsing failed, falling back to string search');
    }
    
    // Fallback to manual string search
    const _tokenKey = 'token=';
    const _idx = url.indexOf(tokenKey);
    if (idx === -1) {
      console.warn('[_ResetPasswordScreen] No token parameter found in URL');
      return null;
    }
    
    // token is everything after `token=` until `&` or end-of-string
    const _tokenPart = url.slice(idx + tokenKey.length);
    const _ampIdx = tokenPart.indexOf('&');
    const _token = ampIdx === -1 ? tokenPart : tokenPart.slice(0, _ampIdx);
    
    // Log a truncated version of the token for debugging (avoid logging full token for security)
    if (_token) {
      console.warn('[_ResetPasswordScreen] Token extracted using string search:', token.substring(0, _5) + '...');
    } else {
      console.warn('[_ResetPasswordScreen] Failed to extract token using string search');
    }
    
    return token;
  };

  // Process a URL to extract the token
  const _processUrl = async (url: string | null) => {
    if (!url) {
      console.warn('[_ResetPasswordScreen] No URL to process');
      return;
    }
    
    console.warn('[_ResetPasswordScreen] Processing URL:', _url);
    setDebugInfo(_prev => `${_prev}\nProcessing URL: ${_url}`);
    
    if (url.includes('reset-password')) {
      const _urlToken = extractToken(_url);
      if (_urlToken) {
        console.warn('[_ResetPasswordScreen] Setting token from URL');
        setToken(_urlToken);
        setTokenTimedOut(_false);
        setDebugInfo(_prev => `${_prev}\nToken found: ${urlToken.substring(0, _5)}...`);
      } else {
        console.error('[_ResetPasswordScreen] Reset password URL found but no token parameter');
        setError('No reset token found in the URL');
        setDebugInfo(_prev => `${_prev}\nNo token found in URL`);
      }
    } else {
      console.warn('[_ResetPasswordScreen] URL does not contain reset-password path');
      setDebugInfo(_prev => `${_prev}\nURL does not contain reset-password path`);
    }
  };

  // Extract token from route params or URL
  useEffect(() => {
    console.warn('[_ResetPasswordScreen] Component mounted');
    setDebugInfo('Component mounted');
    
    // Get token from route params if available
    let routeToken: string | undefined;
    if (route.params) {
      routeToken = route.params.token;
    }

    if (_routeToken) {
      console.warn('[_ResetPasswordScreen] Token found in route params');
      setToken(_routeToken);
      setDebugInfo(_prev => `${_prev}\nToken found in route params: ${routeToken.substring(0, _5)}...`);
      return;
    }

    // If no token in route params, check if we can extract it from the URL
    const _getTokenFromUrl = async () => {
      try {
        console.warn('[_ResetPasswordScreen] Checking initial URL');
        setDebugInfo(_prev => `${_prev}\nChecking initial URL...`);
        
        // Get the initial URL that opened the app
        const _initialUrl = await Linking.getInitialURL();
        console.warn('[_ResetPasswordScreen] Initial URL:', _initialUrl);
        setDebugInfo(_prev => `${_prev}\nInitial URL: ${initialUrl || 'none'}`);
        
        await processUrl(_initialUrl);
      } catch (_err) {
        console.error('[_ResetPasswordScreen] Error extracting token from URL:', _err);
        setError('Failed to process the password reset link');
        setDebugInfo(_prev => `${_prev}\nError: ${err instanceof Error ? err.message : String(_err)}`);
      }
    };

    getTokenFromUrl();

    // After 3 s, if we still have no token, reveal the “request new link” UI
    const _timeoutId = setTimeout(() => {
      if (isMounted.current && !token) {
        setTokenTimedOut(_true);
      }
    }, 3000);

    // Set up URL event listener for when app is already running
    const _urlListener = (event: { url: string }) => {
      console.warn('[_ResetPasswordScreen] URL event received:', event.url);
      setDebugInfo(_prev => `${_prev}\nURL event received: ${event.url}`);
      processUrl(event.url);
    };

    // Add the event listener
    const _subscription = Linking.addEventListener('url', _urlListener);

    // Clean up function
    return () => {
      console.warn('[_ResetPasswordScreen] Component unmounting, cleaning up listeners');
      isMounted.current = false;
      subscription.remove();
      clearTimeout(_timeoutId);
    };
  }, [route.params]);

  // Validate passwords
  const _validatePasswords = () => {
    // Clear previous errors
    setError(_null);

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
  const _handleResetPassword = async () => {
    if (!validatePasswords()) {
      return;
    }

    if (!token) {
      setError('No reset token available. Please try the reset link from your email again.');
      return;
    }

    try {
      setIsLoading(_true);
      console.warn('[_ResetPasswordScreen] Attempting to update password with token');

      // Update the user's password using the helper in supabaseAuthService
      await updatePassword(_password);

      console.warn('[_ResetPasswordScreen] Password updated successfully');
      
      // Password reset successful
      Alert.alert(
        'Password Updated',
        'Your password has been successfully updated. Please sign in with your new password.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (err: any) {
      console.error('[_ResetPasswordScreen] Error resetting password:', _err);
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      if (isMounted.current) {
        setIsLoading(_false);
      }
    }
  };

  // Navigate back to login
  const _handleNavigateToLogin = () => {
    navigation.navigate('Login');
  };

  // Request a new password reset link
  const _handleRequestNewLink = () => {
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
            onPress={_handleNavigateToLogin}
          >
            <Ionicons name="arrow-back" size={_24} color="#007AFF" />
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
                <Text style={styles.errorText}>{_error}</Text>
              </View>
            ) : null}

            {tokenTimedOut && !token && !isLoading ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  Invalid or expired reset link. Please request a new password reset.
                </Text>
                <TouchableOpacity 
                  style={styles.requestNewLinkButton}
                  onPress={_handleRequestNewLink}
                >
                  <Text style={styles.requestNewLinkText}>Request New Reset Link</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={_20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor="#999"
                value={_password}
                onChangeText={_setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={_false}
                editable={!isLoading && !!token}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={_20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                placeholderTextColor="#999"
                value={_confirmPassword}
                onChangeText={_setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={_false}
                editable={!isLoading && !!token}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.button, 
                (isLoading || !token) && styles.buttonDisabled
              ]}
              onPress={_handleResetPassword}
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
                onPress={_handleNavigateToLogin}
                disabled={_isLoading}
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
                  <Text style={styles.debugLog}>{_debugInfo}</Text>
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
