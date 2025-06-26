import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { supabase } from '../../supabase';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useMessagePermissions } from '../../hooks/useMessagePermissions';
import MessageButton from '../../components/MessageButton';

// Get dealer profile by ID
const getDealerProfile = async (dealerId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, dealer_profiles(*)')
    .eq('id', dealerId)
    .single();
    
  if (error) throw error;
  return data;
};

const DealerProfileScreen = ({ route, navigation }) => {
  const { dealerId } = route.params;
  const { user } = useAuth();
  
  const [dealer, setDealer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Check if the current user can message this dealer
  const { canMessage } = useMessagePermissions(dealerId, dealer?.role);
  
  // Load dealer profile
  useEffect(() => {
    const loadDealerProfile = async () => {
      try {
        setLoading(true);
        const profile = await getDealerProfile(dealerId);
        setDealer(profile);
      } catch (err) {
        console.error('Error loading dealer profile:', err);
        setError('Failed to load dealer profile');
      } finally {
        setLoading(false);
      }
    };
    
    loadDealerProfile();
  }, [dealerId]);
  
  // Set navigation title
  useEffect(() => {
    if (dealer) {
      navigation.setOptions({
        title: dealer.full_name || 'Dealer Profile'
      });
    }
  }, [dealer, navigation]);
  
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0057B8" />
      </View>
    );
  }
  
  if (error || !dealer) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Dealer not found'}</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  const dealerProfile = dealer.dealer_profiles?.[0] || {};
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        {dealer.avatar_url ? (
          <Image source={{ uri: dealer.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {dealer.full_name ? dealer.full_name[0].toUpperCase() : 'D'}
            </Text>
          </View>
        )}
        
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{dealer.full_name || 'Unknown Dealer'}</Text>
          <Text style={styles.roleBadge}>{dealer.role || 'DEALER'}</Text>
        </View>
      </View>
      
      {/* Message button */}
      <View style={styles.actionContainer}>
        <MessageButton 
          profileId={dealerId}
          profileRole={dealer.role}
          profileName={dealer.full_name || 'Dealer'}
        />
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dealer Information</Text>
        
        <View style={styles.infoRow}>
          <Ionicons name="business" size={18} color="#666" />
          <Text style={styles.infoLabel}>Business Name:</Text>
          <Text style={styles.infoValue}>{dealerProfile.business_name || 'N/A'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="card" size={18} color="#666" />
          <Text style={styles.infoLabel}>Specialties:</Text>
          <Text style={styles.infoValue}>{dealerProfile.specialties || 'N/A'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="location" size={18} color="#666" />
          <Text style={styles.infoLabel}>Location:</Text>
          <Text style={styles.infoValue}>{dealerProfile.location || 'N/A'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="globe" size={18} color="#666" />
          <Text style={styles.infoLabel}>Website:</Text>
          <Text style={styles.infoValue}>{dealerProfile.website || 'N/A'}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.bioText}>{dealerProfile.bio || 'No information provided.'}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Shows</Text>
        <TouchableOpacity
          style={styles.showsButton}
          onPress={() => navigation.navigate('ShowParticipation', { dealerId })}
        >
          <Text style={styles.showsButtonText}>View Upcoming Shows</Text>
          <Ionicons name="arrow-forward" size={18} color="#0057B8" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0057B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  headerInfo: {
    marginLeft: 16,
    flex: 1,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  roleBadge: {
    fontSize: 14,
    color: '#0057B8',
    fontWeight: 'bold',
    marginTop: 4,
  },
  actionContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 15,
    color: '#666',
    marginLeft: 8,
    width: 100,
  },
  infoValue: {
    fontSize: 15,
    flex: 1,
    color: '#333',
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  showsButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  showsButtonText: {
    fontSize: 16,
    color: '#0057B8',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#0057B8',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default DealerProfileScreen;
