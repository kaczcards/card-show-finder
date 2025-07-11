import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';

type UserRole = 'SHOW_ORGANIZER' | 'MVP_DEALER' | 'DEALER' | 'USER';

interface Dealer {
  id: string;
  name: string;
  profileImageUrl?: string;
  role: UserRole;
  accountType?: string;
}

interface DealersListProps {
  dealers: Dealer[];
  isLoading: boolean;
  onViewDealerDetails: (dealerId: string, dealerName: string) => void;
  onMessageDealer: (dealerId: string, dealerName: string) => void;
}

// Section header helper for consistent typography
const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

const DealersList: React.FC<DealersListProps> = ({
  dealers,
  isLoading,
  onViewDealerDetails,
  onMessageDealer
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
              {dealer.role === 'MVP_DEALER' ? (
                <TouchableOpacity 
                  style={styles.dealerNameButton} 
                  onPress={() => onViewDealerDetails(dealer.id, dealer.name)}
                >
                  <Text style={styles.dealerName}>{dealer.name} (MVP)</Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.dealerName, styles.nonClickableDealerName]}>
                  {dealer.name}
                </Text>
              )}
              
              {dealer.role === 'MVP_DEALER' && (
                <TouchableOpacity 
                  style={styles.messageDealerButton} 
                  onPress={() => onMessageDealer(dealer.id, dealer.name)}
                >
                  <Text style={styles.messageDealerButtonText}>Message</Text>
                </TouchableOpacity>
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
