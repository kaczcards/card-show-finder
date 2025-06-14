// src/screens/RegisterScreen.js
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerUser } from '../services/authService';

const RegisterScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Default to Attendee
  const [role, setRole] = useState('attendee');
  const [loading, setLoading] = useState(false);
  // Remember-me toggle
  const [rememberMe, setRememberMe] = useState(true);
  
  const handleRegister = async () => {
    // Basic validation
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    
    setLoading(true);
    
    try {
      const { user, error } = await registerUser(email, password, {}, role);
      
      if (error) {
        Alert.alert('Registration Error', error);
        return;
      }
      
      // Persist credentials if user opted-in
      if (rememberMe) {
        try {
          await AsyncStorage.setItem(
            'csf_credentials',
            JSON.stringify({ email, password })
          );
        } catch (e) {
          console.log('Failed to save credentials locally:', e);
        }
      }

      // Navigate to profile setup
      navigation.navigate('ProfileSetup', { userId: user.uid });
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>The easiest way to find trading card shows near you</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      
      {/* Remember-me switch */}
      <View style={styles.rememberRow}>
        <Text style={styles.rememberLabel}>Remember me</Text>
        <Switch
          value={rememberMe}
          onValueChange={setRememberMe}
          trackColor={{ false: '#e9ecef', true: '#bde0fe' }}
          thumbColor={rememberMe ? '#3498db' : '#f4f3f4'}
        />
      </View>
      
      <View style={styles.roleSection}>
        <Text style={styles.roleTitle}>I am a:</Text>
        <Text style={styles.roleDescription}>
          Collectors, for those that attend, Dealers for those that setup and promote
        </Text>
        
        <View style={styles.roleToggleContainer}>
          <TouchableOpacity 
            style={[
            styles.roleButton, 
            role === 'attendee' && styles.roleButtonActive
            ]}
          onPress={() => setRole('attendee')}
          >
            <Text style={[
              styles.roleButtonText,
            role === 'attendee' && styles.roleButtonTextActive
          ]}>Attendee</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.roleButton, 
              role === 'dealer' && styles.roleButtonActive
            ]}
            onPress={() => setRole('dealer')}
          >
            <Text style={[
              styles.roleButtonText,
              role === 'dealer' && styles.roleButtonTextActive
            ]}>Dealer</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.button}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create Account</Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.loginText}>
          Already have an account? <Text style={styles.loginLink}>Login</Text>
        </Text>
      </TouchableOpacity>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  roleSection: {
    marginBottom: 20,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  roleDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  roleToggleContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  roleButtonActive: {
    backgroundColor: '#3498db',
  },
  roleButtonText: {
    fontSize: 16,
    color: '#666',
  },
  roleButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  /* ------------ Remember-me styles ------------ */
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  rememberLabel: {
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginText: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    color: '#3498db',
    fontWeight: 'bold',
  },
});

export default RegisterScreen;
