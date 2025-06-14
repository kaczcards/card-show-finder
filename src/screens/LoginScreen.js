// src/screens/LoginScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch
} from 'react-native';
import { loginUser } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // On mount, attempt auto-login if credentials are saved
  useEffect(() => {
    const tryAutoLogin = async () => {
      try {
        const stored = await AsyncStorage.getItem('csf_credentials');
        if (!stored) return;
        const creds = JSON.parse(stored);
        if (creds?.email && creds?.password) {
          setEmail(creds.email);
          setPassword(creds.password);
          setLoading(true);
          const { user, error } = await loginUser(creds.email, creds.password);
          if (!error && user) {
            navigation.replace('Main');
          }
        }
      } catch (e) {
        console.log('Auto-login failed:', e);
      } finally {
        setLoading(false);
      }
    };
    tryAutoLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);

    try {
      const { user, error } = await loginUser(email, password);

      if (error) {
        Alert.alert('Login Error', error);
        setLoading(false);
        return;
      }

      // Success - Navigate to main app
      // Use replace instead of reset to avoid navigation errors
      if (user) {
        // Store or clear credentials based on rememberMe
        try {
          if (rememberMe) {
            await AsyncStorage.setItem(
              'csf_credentials',
              JSON.stringify({ email, password })
            );
          } else {
            await AsyncStorage.removeItem('csf_credentials');
          }
        } catch (e) {
          console.log('Persist credentials error:', e);
        }
        navigation.replace('Main');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.logoContainer}>
          <Text style={styles.appTitle}>Card Show Finder</Text>
          <Text style={styles.tagline}>Find trading card events near you</Text>
        </View>

        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCompleteType="email"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCompleteType="password"
          />

        {/* Remember Me */}
        <View style={styles.rememberRow}>
          <Text style={styles.rememberLabel}>Remember me</Text>
          <Switch
            value={rememberMe}
            onValueChange={setRememberMe}
            trackColor={{ false: '#e9ecef', true: '#bde0fe' }}
            thumbColor={rememberMe ? '#3498db' : '#f4f3f4'}
          />
        </View>

          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() => {
              // Handle forgot password
              Alert.alert('Reset Password', 'This feature will be available soon!');
            }}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Log In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerButtonText}>Create an Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 10,
  },
  tagline: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  input: {
    backgroundColor: '#f5f6fa',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#3498db',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    paddingHorizontal: 15,
    color: '#7f8c8d',
  },
  /* ---- Remember Me ---- */
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  rememberLabel: {
    fontSize: 14,
    color: '#333',
  },
  registerButton: {
    borderWidth: 1,
    borderColor: '#3498db',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#3498db',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LoginScreen;
