// src/screens/ProfileSetupScreen.js
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
import { updateUserProfile, getUserProfile } from '../services/authService';
import { useUser } from '../context/UserContext';

// Predefined card interest options
const CARD_INTEREST_OPTIONS = [
  'Sports Cards',
  'Baseball Cards',
  'Basketball Cards',
  'Football Cards',
  'Hockey Cards',
  'Pokemon Cards',
  'Magic: The Gathering',
  'Yu-Gi-Oh!',
  'Other TCGs',
  'Vintage Cards',
  'Modern Cards',
  'Autographs',
  'Memorabilia'
];

const ProfileSetupScreen = ({ navigation, route }) => {
  const { refreshUserProfile } = useUser();
  const { userId } = route.params;
  
  const [firstName, setFirstName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [notifications, setNotifications] = useState({
    showAlerts: true,
    upcomingShows: true,
    newShowsInArea: true
  });
  const [loading, setLoading] = useState(false);
  
  const toggleInterest = (interest) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(item => item !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };
  
  const handleSaveProfile = async () => {
    if (!firstName.trim()) {
      Alert.alert('Error', 'Please enter your first name');
      return;
    }
    
    if (!zipCode.trim()) {
      Alert.alert('Error', 'Please enter your ZIP code');
      return;
    }
    
    setLoading(true);
    
    try {
      const profileData = {
        firstName,
        zipCode,
        cardInterests: selectedInterests,
        notificationPreferences: notifications,
        profileCompleted: true
      };
      
      const { success, error } = await updateUserProfile(userId, profileData);
      
      if (error) {
        Alert.alert('Error', error);
        return;
      }
      
      // Refresh the user context
      await refreshUserProfile();
      
      // Navigate to home or welcome screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Help us personalize your home page</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About You</Text>
        
        <Text style={styles.label}>First Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your first name"
          value={firstName}
          onChangeText={setFirstName}
        />
        
        <Text style={styles.label}>ZIP Code</Text>
        <TextInput
          style={styles.input}
          placeholder="Your ZIP code"
          value={zipCode}
          onChangeText={setZipCode}
          keyboardType="numeric"
          maxLength={5}
        />
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Card Interests</Text>
        <Text style={styles.sectionSubtitle}>Select all that apply</Text>
        
        <View style={styles.interestsContainer}>
          {CARD_INTEREST_OPTIONS.map((interest) => (
            <TouchableOpacity
              key={interest}
              style={[
                styles.interestChip,
                selectedInterests.includes(interest) && styles.selectedInterest
              ]}
              onPress={() => toggleInterest(interest)}
            >
              <Text
                style={[
                  styles.interestText,
                  selectedInterests.includes(interest) && styles.selectedInterestText
                ]}
              >
                {interest}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notification Preferences</Text>
        
        <View style={styles.switchRow}>
          <View style={styles.switchTextContainer}>
            <Text style={styles.switchLabel}>Show Alerts</Text>
            <Text style={styles.switchDescription}>
              Get notified about shows on the day of the event
            </Text>
          </View>
          <Switch
            value={notifications.showAlerts}
            onValueChange={(value) => 
              setNotifications({...notifications, showAlerts: value})
            }
            trackColor={{ false: '#e9ecef', true: '#bde0fe' }}
            thumbColor={notifications.showAlerts ? '#3498db' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.switchRow}>
          <View style={styles.switchTextContainer}>
            <Text style={styles.switchLabel}>Upcoming Shows</Text>
            <Text style={styles.switchDescription}>
              Get notified about shows a week before they happen
            </Text>
          </View>
          <Switch
            value={notifications.upcomingShows}
            onValueChange={(value) => 
              setNotifications({...notifications, upcomingShows: value})
            }
            trackColor={{ false: '#e9ecef', true: '#bde0fe' }}
            thumbColor={notifications.upcomingShows ? '#3498db' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.switchRow}>
          <View style={styles.switchTextContainer}>
            <Text style={styles.switchLabel}>New Shows In Your Area</Text>
            <Text style={styles.switchDescription}>
              Get notified when new shows are announced near you
            </Text>
          </View>
          <Switch
            value={notifications.newShowsInArea}
            onValueChange={(value) => 
              setNotifications({...notifications, newShowsInArea: value})
            }
            trackColor={{ false: '#e9ecef', true: '#bde0fe' }}
            thumbColor={notifications.newShowsInArea ? '#3498db' : '#f4f3f4'}
          />
        </View>
      </View>
      
      <TouchableOpacity
        style={styles.button}
        onPress={handleSaveProfile}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Save & Continue</Text>
        )}
      </TouchableOpacity>
      
      <View style={styles.spacer}></View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 20, // Added margin to move the title further down
    color: '#212529',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#212529',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: '#495057',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  interestChip: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 4,
    backgroundColor: '#f8f9fa',
  },
  selectedInterest: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  interestText: {
    fontSize: 14,
    color: '#495057',
  },
  selectedInterestText: {
    color: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  switchTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  switchLabel: {
    fontSize: 16,
    color: '#212529',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 14,
    color: '#6c757d',
  },
  button: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  spacer: {
    height: 40,
  },
});

export default ProfileSetupScreen;