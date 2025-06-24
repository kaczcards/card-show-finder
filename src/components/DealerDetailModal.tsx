import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Define the props type for the dealer participation data
export interface DealerDetailModalProps {
  visible: boolean;
  onClose: () => void;
  dealer: {
    id: string;
    userId: string;
    showId: string;
    dealerName: string;
    dealerEmail?: string;
    dealerProfileImage?: string;
    cardTypes: string[];
    specialty?: string;
    priceRange?: 'budget' | 'mid-range' | 'high-end';
    notableItems?: string;
    boothLocation?: string;
    paymentMethods: string[];
    openToTrades: boolean;
    buyingCards: boolean;
    status: 'registered' | 'confirmed' | 'cancelled' | 'completed';
  } | null;
}

// Price range display mapping
const PRICE_RANGE_LABELS: Record<string, string> = {
  'budget': 'Budget-Friendly',
  'mid-range': 'Mid-Range',
  'high-end': 'High-End',
};

const DealerDetailModal: React.FC<DealerDetailModalProps> = ({
  visible,
  onClose,
  dealer,
}) => {
  if (!dealer) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header with close button */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Dealer Information</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Dealer Profile */}
            <View style={styles.dealerProfile}>
              {dealer.dealerProfileImage ? (
                <Image 
                  source={{ uri: dealer.dealerProfileImage }} 
                  style={styles.profileImage} 
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Ionicons name="person" size={40} color="#ccc" />
                </View>
              )}
              <View style={styles.dealerInfo}>
                <Text style={styles.dealerName}>{dealer.dealerName}</Text>
                {dealer.status && (
                  <View style={[
                    styles.statusBadge,
                    dealer.status === 'confirmed' ? styles.confirmedBadge : 
                    dealer.status === 'cancelled' ? styles.cancelledBadge : 
                    styles.registeredBadge
                  ]}>
                    <Text style={styles.statusText}>
                      {dealer.status.charAt(0).toUpperCase() + dealer.status.slice(1)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Booth Location */}
            {dealer.boothLocation && (
              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <Ionicons name="location-outline" size={22} color="#0057B8" />
                  <Text style={styles.infoHeaderText}>Booth Location</Text>
                </View>
                <Text style={styles.infoText}>{dealer.boothLocation}</Text>
              </View>
            )}

            {/* Card Types */}
            {dealer.cardTypes && dealer.cardTypes.length > 0 && (
              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <Ionicons name="card-outline" size={22} color="#0057B8" />
                  <Text style={styles.infoHeaderText}>Card Types</Text>
                </View>
                <View style={styles.tagsContainer}>
                  {dealer.cardTypes.map((type, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{type}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Specialty */}
            {dealer.specialty && (
              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <Ionicons name="star-outline" size={22} color="#0057B8" />
                  <Text style={styles.infoHeaderText}>Specialty</Text>
                </View>
                <Text style={styles.infoText}>{dealer.specialty}</Text>
              </View>
            )}

            {/* Price Range */}
            {dealer.priceRange && (
              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <Ionicons name="cash-outline" size={22} color="#0057B8" />
                  <Text style={styles.infoHeaderText}>Price Range</Text>
                </View>
                <Text style={styles.infoText}>
                  {PRICE_RANGE_LABELS[dealer.priceRange] || dealer.priceRange}
                </Text>
              </View>
            )}

            {/* Notable Items */}
            {dealer.notableItems && (
              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <Ionicons name="trophy-outline" size={22} color="#0057B8" />
                  <Text style={styles.infoHeaderText}>Notable Items</Text>
                </View>
                <Text style={styles.infoText}>{dealer.notableItems}</Text>
              </View>
            )}

            {/* Payment Methods */}
            {dealer.paymentMethods && dealer.paymentMethods.length > 0 && (
              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <Ionicons name="wallet-outline" size={22} color="#0057B8" />
                  <Text style={styles.infoHeaderText}>Payment Methods</Text>
                </View>
                <View style={styles.tagsContainer}>
                  {dealer.paymentMethods.map((method, index) => (
                    <View key={index} style={[styles.tag, styles.paymentTag]}>
                      <Text style={styles.tagText}>{method}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Trading & Buying */}
            <View style={styles.infoSection}>
              <View style={styles.infoHeader}>
                <Ionicons name="swap-horizontal-outline" size={22} color="#0057B8" />
                <Text style={styles.infoHeaderText}>Trading & Buying</Text>
              </View>
              <View style={styles.flagsContainer}>
                <View style={styles.flagItem}>
                  <Ionicons 
                    name={dealer.openToTrades ? "checkmark-circle" : "close-circle"} 
                    size={22} 
                    color={dealer.openToTrades ? "#4CAF50" : "#F44336"} 
                  />
                  <Text style={styles.flagText}>
                    {dealer.openToTrades ? "Open to trades" : "Not trading"}
                  </Text>
                </View>
                <View style={styles.flagItem}>
                  <Ionicons 
                    name={dealer.buyingCards ? "checkmark-circle" : "close-circle"} 
                    size={22} 
                    color={dealer.buyingCards ? "#4CAF50" : "#F44336"} 
                  />
                  <Text style={styles.flagText}>
                    {dealer.buyingCards ? "Buying cards" : "Not buying"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Contact Button - Only show if email is available */}
            {dealer.dealerEmail && (
              <TouchableOpacity
                style={styles.contactButton}
                // In a real implementation, this would open the email app
                // or a contact form
              >
                <Ionicons name="mail-outline" size={20} color="white" />
                <Text style={styles.contactButtonText}>Contact Dealer</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
  },
  dealerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  profileImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  dealerInfo: {
    flex: 1,
  },
  dealerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  registeredBadge: {
    backgroundColor: '#e6f2ff',
  },
  confirmedBadge: {
    backgroundColor: '#e6ffe6',
  },
  cancelledBadge: {
    backgroundColor: '#ffe6e6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoSection: {
    marginBottom: 20,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    paddingLeft: 30,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: 30,
  },
  tag: {
    backgroundColor: '#e6f2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  paymentTag: {
    backgroundColor: '#f0f0f0',
  },
  tagText: {
    fontSize: 14,
    color: '#0057B8',
  },
  flagsContainer: {
    paddingLeft: 30,
  },
  flagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  flagText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  contactButton: {
    backgroundColor: '#FF6A00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  contactButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default DealerDetailModal;
