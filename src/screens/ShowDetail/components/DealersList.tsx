import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';

type UserRole = 'SHOW_ORGANIZER' | 'MVP_DEALER' | 'DEALER' | 'USER';

interface Dealer {
  id: string;
  name: string;
  profileImageUrl?: string;
  role: UserRole;
  accountType?: string;
  boothLocation?: string;
  // Social media fields
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  whatnotUrl?: string;
  ebayStoreUrl?: string;
}

interface DealersListProps {
  dealers: Dealer[];
  isLoading: boolean;
  onViewDealerDetails: (dealerId: string, dealerName: string) => void;
}

// Section header helper for consistent typography
const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

// Social media icons component for MVP Dealers
const SocialMediaIcons: React.FC<{ dealer: Dealer }> = ({ dealer }) => {
  if (dealer.role !== 'MVP_DEALER') return null;
  
  const handleOpenLink = (url?: string) => {
    if (!url) return;
    Linking.openURL(url).catch(err => console.error('Error opening URL:', err));
  };
  
  return (
    <View style={styles.socialMediaContainer}>
      {dealer.facebookUrl && (
        <TouchableOpacity 
          style={styles.socialIcon} 
          onPress={() => handleOpenLink(dealer.facebookUrl)}
        >
          <FontAwesome name="facebook-square" size={22} color="#4267B2" />
        </TouchableOpacity>
      )}
      
      {dealer.instagramUrl && (
        <TouchableOpacity 
          style={styles.socialIcon} 
          onPress={() => handleOpenLink(dealer.instagramUrl)}
        >
          <FontAwesome name="instagram" size={22} color="#E1306C" />
        </TouchableOpacity>
      )}
      
      {dealer.twitterUrl && (
        <TouchableOpacity 
          style={styles.socialIcon} 
          onPress={() => handleOpenLink(dealer.twitterUrl)}
        >
          <FontAwesome name="twitter-square" size={22} color="#1DA1F2" />
        </TouchableOpacity>
      )}
      
      {dealer.whatnotUrl && (
        <TouchableOpacity 
          style={styles.socialIcon} 
          onPress={() => handleOpenLink(dealer.whatnotUrl)}
        >
          <MaterialCommunityIcons name="shopping" size={22} color="#FF5A5F" />
        </TouchableOpacity>
      )}
      
      {dealer.ebayStoreUrl && (
        <TouchableOpacity 
          style={styles.socialIcon} 
          onPress={() => handleOpenLink(dealer.ebayStoreUrl)}
        >
          <FontAwesome name="shopping-cart" size={22} color="#e53238" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const DealersList: React.FC<DealersListProps> = ({
  dealers,
  isLoading,
  onViewDealerDetails
}) => {
  return (
    <View style={styles.mvpDealersContainer}>
      <SectionHeader>Participating Dealers</SectionHeader>
      
      {isLoading ? (
        <ActivityIndicator size="small" color="#FF6A00" />
      ) : dealers.length > 0 ? (
        <View style={styles.dealersList}>
          {dealers.map(dealer => (
            <View key={dealer.id} style={styles.dealerItem}>
              <View style={styles.dealerInfoContainer}>
                {dealer.role === 'MVP_DEALER' ? (
                  <TouchableOpacity 
                    style={styles.dealerNameButton} 
                    onPress={() => onViewDealerDetails(dealer.id, dealer.name)}
                  >
                    <Text style={styles.dealerName}>{dealer.name} (MVP)</Text>
                    {dealer.boothLocation && (
                      <Text style={styles.boothLocation}>Booth: {dealer.boothLocation}</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View>
                    <Text style={[styles.dealerName, styles.nonClickableDealerName]}>
                      {dealer.name}
                    </Text>
                    {dealer.boothLocation && (
                      <Text style={styles.boothLocation}>Booth: {dealer.boothLocation}</Text>
                    )}
                  </View>
                )}
              </View>
              
              {/* Display social media icons only for MVP Dealers */}
              {dealer.role === 'MVP_DEALER' && (
                <SocialMediaIcons dealer={dealer} />
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noDataText}>
          No participating dealers listed for this show yet.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mvpDealersContainer: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dealersList: {
    marginTop: 8,
  },
  dealerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  dealerInfoContainer: {
    flex: 1,
  },
  dealerNameButton: {
    flex: 1,
  },
  dealerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0057B8',
  },
  nonClickableDealerName: {
    color: '#333333',
  },
  boothLocation: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  socialMediaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  socialIcon: {
    marginHorizontal: 4,
    padding: 4,
  },
  messageDealerButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  messageDealerButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  noDataText: {
    fontSize: 16,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
});

export default DealersList;
