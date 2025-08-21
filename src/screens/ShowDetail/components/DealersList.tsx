import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SocialLinksRow from '../../../components/ui/SocialLinksRow';
import { UserRole } from '../../../types';

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

/* ------------------------------------------------------------------ */
/* Helper utilities                                                    */
/* ------------------------------------------------------------------ */
// Normalise any role / accountType string to a predictable format
const normalize = (v?: string) =>
  (v || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

// Determine if a dealer should be treated as "privileged" (clickable row +
// social icons exposed).  Covers Show Organizers acting as dealers, MVP
// Dealers (role OR accountType), as well as legacy boolean flags.
const isPrivilegedDealer = (dealer: Dealer | any): boolean => {
  const role = normalize(dealer?.role as any) || normalize(dealer?.role_name as any);
  const acct = normalize(dealer?.accountType as any) || normalize(dealer?.account_type as any);
  const isMvpFlag = dealer?.isMvp === true || dealer?.is_mvp === true;

  return (
    role === 'mvp_dealer' ||
    role === 'show_organizer' ||
    acct === 'mvp_dealer' ||
    acct === 'organizer' ||
    isMvpFlag
  );
};

// Section header helper for consistent typography
const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

// Social media icons component for MVP Dealers
const SocialMediaIcons: React.FC<{ dealer: Dealer }> = ({ dealer }) => {
  // Show social icons for MVP Dealers **and** Show Organizers acting as dealers
  if (!isPrivilegedDealer(dealer)) return null;
  return (
    <SocialLinksRow
      variant="icons"
      containerStyle={styles.socialMediaContainer}
      urls={{
        facebookUrl: (dealer as any).facebookUrl || (dealer as any).facebook_url,
        instagramUrl: (dealer as any).instagramUrl || (dealer as any).instagram_url,
        twitterUrl: (dealer as any).twitterUrl || (dealer as any).twitter_url,
        whatnotUrl: (dealer as any).whatnotUrl || (dealer as any).whatnot_url,
        ebayStoreUrl: (dealer as any).ebayStoreUrl || (dealer as any).ebay_store_url,
      }}
    />
  );
};

/* ------------------------------------------------------------------ */
/* Main Component                                                     */
/* ------------------------------------------------------------------ */

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
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(
          '[DealersList] Navigation already in progress, ignoring click'
        );
      }
      return;
    }
    
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

            // Determine label suffix (MVP / Organizer)
            const roleLabel = (() => {
              const role = normalize((dealer as any).role);
              const acct = normalize((dealer as any).accountType || (dealer as any).account_type);
              if (role === 'show_organizer' || acct === 'organizer') return ' (Organizer)';
              if (role === 'mvp_dealer' || acct === 'mvp_dealer' || (dealer as any).isMvp || (dealer as any).is_mvp)
                return ' (MVP)';
              return '';
            })();
            
            return (
              <View key={dealer.id} style={styles.dealerItem}>
                {isPrivilegedDealer(dealer) ? (
                  // Make the entire row clickable for privileged dealers
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
                      <Text
                        style={[
                          styles.dealerName,
                          isPressed && styles.dealerNamePressed,
                        ]}
                      >
                        {dealer.name}
                        {roleLabel}
                      </Text>
                      {dealer.boothLocation && (
                        <Text style={styles.boothLocation}>Booth: {dealer.boothLocation}</Text>
                      )}
                    </View>
                    
                    {/* Display social media icons only for privileged dealers */}
                    <SocialMediaIcons dealer={dealer} />
                    {/* Right chevron to indicate the row is clickable */}
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#8E8E93"
                      style={{ marginLeft: 4 }}
                    />
                  </TouchableOpacity>
                ) : (
                  // Non-privileged dealers aren't clickable
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
