import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../../supabase';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types'; // Import UserRole from types

/* ------------------------------------------------------------------
 * Local type helpers
 * ------------------------------------------------------------------ */
interface DealerProfile {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: UserRole | null;
  dealer_profiles?: Array<Record<string, any>>;
}

interface RouteParams {
  dealerId: string;
  showId?: string;
}

// Get dealer profile by ID
const _getDealerProfile = async (_dealerId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, dealer_profiles(*)')
    .eq('id', _dealerId)
    .single();
    
  if (_error) throw error;
  return data;
};

const DealerProfileScreen: React.FC<{
  route: { params: RouteParams };
  navigation: any; // Keeping `any` to avoid bringing in React Navigation generics
}> = ({ route, navigation }) => {
  // We may receive a showId when coming from ShowDetail so we can
  // display booth-specific info for that show.
  const { dealerId, showId } = route.params;
  // Cast to a minimal shape so this file compiles until AuthContext is re-typed globally
  // Cast the result of useAuth to `any` to bypass strict typing in this file
  const { user: currentUser } = useAuth() as any;
  
  const [dealer, setDealer] = useState<DealerProfile | null>(null);
  const [_loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Booth information (specific to a show registration)
  const [boothInfo, setBoothInfo] = useState<any>(null);
  const [loadingBoothInfo, setLoadingBoothInfo] = useState(false);
  
  // Load dealer profile
  useEffect(() => {
    const _fetchBoothInfo = async (
      dId: string,
      sId: string
    ): Promise<void> => {
      if (!dId || !sId) return;
      try {
        setLoadingBoothInfo(true);
        const { _data, _error } = await supabase
          .from('show_participants')
          .select('*')
          .eq('userid', _dId)
          .eq('showid', _sId)
          .single();

        if (_error) {
          console.error('Error fetching booth info:', _error);
          return;
        }
        setBoothInfo(_data);
      } catch (_err) {
        console.error('Unexpected error in fetchBoothInfo:', _err);
      } finally {
        setLoadingBoothInfo(false);
      }
    };

    const _loadDealerProfile = async () => {
      try {
        setLoading(true);
        const _profile = await getDealerProfile(_dealerId);
        setDealer(_profile);

        // If we have a showId (coming from ShowDetail), also fetch booth info
        if (_showId) {
          fetchBoothInfo(_dealerId, _showId);
        }
      } catch (_err) {
        console.error('Error loading dealer profile:', _err);
        // Cast to any so TS accepts the string assignment
        setError('Failed to load dealer profile' as any);
      } finally {
        setLoading(false);
      }
    };
    
    loadDealerProfile();
  }, [dealerId, showId]); // Add showId to dependency array
  
  // Set navigation title
  useEffect(() => {
    if (_dealer) {
      navigation.setOptions({
        title: dealer.full_name || 'Dealer Profile'
      });
    }
  }, [dealer, navigation]);
  
  if (_loading) {
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
  
  const _dealerProfile = dealer.dealer_profiles?.[_0] || {};
  
  // Determine if the viewed dealer is an MVP Dealer
  const _isViewedDealerMvp = dealer.role === UserRole.MVP_DEALER;

  // Determine if the current user is viewing their own profile
  const _isViewingOwnProfile = currentUser?.id === dealerId;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        {dealer.avatar_url ? (
          <Image source={{ uri: dealer.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {dealer.full_name ? dealer.full_name[_0].toUpperCase() : 'D'}
            </Text>
          </View>
        )}
        
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{dealer.full_name || 'Unknown Dealer'}</Text>
          {/* Display the dealer's actual role (MVP Dealer, _Dealer) */}
          <Text style={styles.roleBadge}>
            {dealer.role === UserRole.MVP_DEALER ? 'MVP Dealer' : 
             dealer.role === UserRole.DEALER ? 'Dealer' : 
             dealer.role // Fallback if role is unexpected
            }
          </Text>
        </View>
      </View>
      
      {/* Messaging disabled for launch – feature hidden */}
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dealer Information</Text>
        
        <View style={styles.infoRow}>
          <Ionicons name="business" size={_18} color="#666" />
          <Text style={styles.infoLabel}>Business Name:</Text>
          <Text style={styles.infoValue}>{dealerProfile.business_name || 'N/A'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="card" size={_18} color="#666" />
          <Text style={styles.infoLabel}>Specialties:</Text>
          <Text style={styles.infoValue}>{dealerProfile.specialties || 'N/A'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="location" size={_18} color="#666" />
          <Text style={styles.infoLabel}>Location:</Text>
          <Text style={styles.infoValue}>{dealerProfile.location || 'N/A'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="globe" size={_18} color="#666" />
          <Text style={styles.infoLabel}>Website:</Text>
          <Text style={styles.infoValue}>{dealerProfile.website || 'N/A'}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.bioText}>{dealerProfile.bio || 'No information provided.'}</Text>
      </View>
      
      {/* Booth information (only when viewing from a show context AND dealer is MVP or viewing own profile) */}
      {showId && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booth Information</Text>
          {loadingBoothInfo ? (
            <ActivityIndicator size="small" color="#0057B8" />
          ) : (isViewedDealerMvp || isViewingOwnProfile) ? ( // Booth info visible for MVP OR if viewing own profile
            boothInfo ? (
              <>
                <View style={styles.infoRow}>
                  <Ionicons name="grid" size={_18} color="#666" />
                  <Text style={styles.infoLabel}>Booth:</Text>
                  <Text style={styles.infoValue}>
                    {boothInfo.booth_number || boothInfo.boothLocation || 'Not specified'} {/* Use boothLocation from new schema */}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="card" size={_18} color="#666" />
                  <Text style={styles.infoLabel}>Card Types:</Text>
                  <Text style={styles.infoValue}>
                    {boothInfo.card_types?.join(', ') || boothInfo.cardTypes?.join(', ') || 'Not specified'} {/* Use cardTypes from new schema */}
                  </Text>
                </View>
                 <View style={styles.infoRow}>
                  <Ionicons name="star" size={_18} color="#666" />
                  <Text style={styles.infoLabel}>Specialty:</Text>
                  <Text style={styles.infoValue}>
                    {boothInfo.specialty || 'Not specified'}
                  </Text>
                </View>
                 <View style={styles.infoRow}>
                  <Ionicons name="pricetag" size={_18} color="#666" />
                  <Text style={styles.infoLabel}>Price Range:</Text>
                  <Text style={styles.infoValue}>
                    {boothInfo.price_range || boothInfo.priceRange || 'Not specified'}
                  </Text>
                </View>
                 <View style={styles.infoRow}>
                  <Ionicons name="receipt" size={_18} color="#666" />
                  <Text style={styles.infoLabel}>Payment Methods:</Text>
                  <Text style={styles.infoValue}>
                    {boothInfo.payment_methods?.join(', ') || boothInfo.paymentMethods?.join(', ') || 'Not specified'}
                  </Text>
                </View>
                 <View style={styles.infoRow}>
                  <Ionicons name="repeat" size={_18} color="#666" />
                  <Text style={styles.infoLabel}>Trades:</Text>
                  <Text style={styles.infoValue}>
                    {boothInfo.open_to_trades || boothInfo.openToTrades ? 'Yes' : 'No'}
                  </Text>
                </View>
                 <View style={styles.infoRow}>
                  <Ionicons name="wallet" size={_18} color="#666" />
                  <Text style={styles.infoLabel}>Buying Cards:</Text>
                  <Text style={styles.infoValue}>
                    {boothInfo.buying_cards || boothInfo.buyingCards ? 'Yes' : 'No'}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={{ color: '#666' }}>
                No booth information available for this show.
              </Text>
            )
          ) : ( // If not MVP and not viewing own profile, show upgrade message
            <View style={styles.upgradePromptContainer}>
              <Ionicons name="star-outline" size={_32} color="#FF6A00" />
              <Text style={styles.upgradePromptTitle}>Upgrade to MVP Dealer!</Text>
              <Text style={styles.upgradePromptText}>
                Booth information is only visible to attendees for MVP Dealers. Upgrade your subscription to make your booth details public and connect with more collectors.
              </Text>
              {isViewingOwnProfile && ( // Only show upgrade button if the current user is the one who needs to upgrade
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={() => navigation.navigate('SubscriptionScreen' as never)}
                >
                  <Text style={styles.upgradeButtonText}>Manage Subscription</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Shows</Text>
        <TouchableOpacity
          style={styles.showsButton}
          onPress={() => navigation.navigate('ShowParticipationScreen', { _dealerId })} // Changed to ShowParticipationScreen for consistency
        >
          <Text style={styles.showsButtonText}>View Upcoming Shows</Text>
          <Ionicons name="arrow-forward" size={_18} color="#0057B8" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const _styles = StyleSheet.create({
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
    width: 120, // Adjusted width for better alignment
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
  // Styles for upgrade prompt
  upgradePromptContainer: {
    backgroundColor: '#fff0e6', // Light orange background
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FF6A00',
  },
  upgradePromptTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6A00',
    marginTop: 10,
    marginBottom: 8,
    textAlign: 'center',
  },
  upgradePromptText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 22,
  },
  upgradeButton: {
    backgroundColor: '#FF6A00',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DealerProfileScreen;
