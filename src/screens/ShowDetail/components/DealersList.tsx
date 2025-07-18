import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Linking, Alert } from 'react-native';
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
  // Show social icons for MVP Dealers **and** Show Organizers acting as dealers
  if (dealer.role !== 'MVP_DEALER' && dealer.role !== 'SHOW_ORGANIZER') return null;
  
  /**
   * Safely open a URL.  If a user entered their link without a protocol
   * (e.g. "www.example.com") we prepend `https://` so React-Native treats it
   * as a web URL instead of a local file path.
   */
  const handleOpenLink = (url?: string) => {
    if (!url) return;

    // Ensure protocol prefix exists
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('[DealersList] Opening URL:', formattedUrl);

    Linking.openURL(formattedUrl).catch(err => {
      console.error('Error opening URL:', err);
      Alert.alert(
        'Cannot Open Link',
        'The link could not be opened. Please check that it is a valid URL.',
        [{ text: 'OK' }],
      );
    });
  };
  
  return (
    <View style={styles.socialMediaContainer}>
      {dealer.facebookUrl && (
        <TouchableOpacity 
          style={styles.socialIcon} 
          onPress={() => handleOpenLink(dealer.facebookUrl)}
          activeOpacity={0.7}
        >
          <FontAwesome name="facebook-square" size={22} color="#4267B2" />
        </TouchableOpacity>
      )}
      
      {dealer.instagramUrl && (
        <TouchableOpacity 
          style={styles.socialIcon} 
          onPress={() => handleOpenLink(dealer.instagramUrl)}
          activeOpacity={0.7}
        >
          <FontAwesome name="instagram" size={22} color="#E1306C" />
        </TouchableOpacity>
      )}
      
      {dealer.twitterUrl && (
        <TouchableOpacity 
          style={styles.socialIcon} 
          onPress={() => handleOpenLink(dealer.twitterUrl)}
          activeOpacity={0.7}
        >
          <FontAwesome name="twitter-square" size={22} color="#1DA1F2" />
        </TouchableOpacity>
      )}
      
      {dealer.whatnotUrl && (
        <TouchableOpacity 
          style={styles.socialIcon} 
          onPress={() => handleOpenLink(dealer.whatnotUrl)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="shopping" size={22} color="#FF5A5F" />
        </TouchableOpacity>
      )}
      
      {dealer.ebayStoreUrl && (
        <TouchableOpacity 
          style={styles.socialIcon} 
          onPress={() => handleOpenLink(dealer.ebayStoreUrl)}
          activeOpacity={0.7}
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
  // State to track which dealer is currently being pressed and navigation status
  const [pressedDealerId, setPressedDealerId] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Debounced handler for dealer detail navigation
  const handleViewDealerDetails = useCallback((dealerId: string, dealerName: string) => {
    // Prevent multiple rapid clicks
    if (isNavigating) {
      console.log('[DealersList] Navigation already in progress, ignoring click');
      return;
    }

    console.log('[DealersList] Dealer pressed:', dealerId, dealerName);
    
    // Set visual feedback and prevent double-clicks
    setIsNavigating(true);
    setPressedDealerId(dealerId);
    
    // Add a small delay for visual feedback before navigation
    setTimeout(() => {
      try {
        onViewDealerDetails(dealerId, dealerName);
      } catch (err) {
        console.error('[DealersList] Error during navigation:', err);
      } finally {
        // Reset state after navigation (with slight delay to prevent rapid re-clicks)
        setTimeout(() => {
          setIsNavigating(false);
          setPressedDealerId(null);
        }, 300);
      }
    }, 50); // Small delay for visual feedback
  }, [onViewDealerDetails, isNavigating]);

  return (
    <View style={styles.mvpDealersContainer}>
      <SectionHeader>Participating Dealers</SectionHeader>
      
      {isLoading ? (
        <ActivityIndicator size="small" color="#FF6A00" />
      ) : dealers.length > 0 ? (
        <View style={styles.dealersList}>
          {dealers.map(dealer => {
            // Check if this dealer's button is currently pressed
            const isPressed = pressedDealerId === dealer.id;
            
            return (
              <View key={dealer.id} style={styles.dealerItem}>
                {dealer.role === 'MVP_DEALER' || dealer.role === 'SHOW_ORGANIZER' ? (
                  // Make the entire row clickable for MVP dealers
                  <TouchableOpacity 
                    style={[
                      styles.mvpDealerRow,
                      isPressed && styles.mvpDealerRowPressed
                    ]} 
                    onPress={() => handleViewDealerDetails(dealer.id, dealer.name)}
                    activeOpacity={0.7}
                    disabled={isNavigating}
                  >
                    <View style={styles.dealerInfoContainer}>
                      <Text style={[
                        styles.dealerName,
                        isPressed && styles.dealerNamePressed
                      ]}>
                        {dealer.name} (MVP)
                      </Text>
                      {dealer.boothLocation && (
                        <Text style={styles.boothLocation}>Booth: {dealer.boothLocation}</Text>
                      )}
                    </View>
                    
                    {/* Display social media icons only for MVP Dealers */}
                    <SocialMediaIcons dealer={dealer} />
                  </TouchableOpacity>
                ) : (
                  // Non-MVP dealers aren't clickable
                  <View style={styles.regularDealerRow}>
                    <View style={styles.dealerInfoContainer}>
                      <Text style={[styles.dealerName, styles.nonClickableDealerName]}>
                        {dealer.name}
                      </Text>
                      {dealer.boothLocation && (
                        <Text style={styles.boothLocation}>Booth: {dealer.boothLocation}</Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
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
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  mvpDealerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16, // Increased from 12 for better touch target
    paddingHorizontal: 12, // Increased from 8 for better touch target
    borderRadius: 6, // Add slight rounding for visual feedback
  },
  mvpDealerRowPressed: {
    backgroundColor: '#E6F0FF', // Light blue background when pressed
  },
  regularDealerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  dealerInfoContainer: {
    flex: 1,
    paddingRight: 8, // Add padding for spacing from social icons
  },
  dealerNameButton: {
    flex: 1,
  },
  dealerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0057B8',
  },
  dealerNamePressed: {
    color: '#003C80', // Darker blue when pressed
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
    padding: 6, // Increased from 4 for better touch target
    borderRadius: 20, // Add border radius for better visual
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
