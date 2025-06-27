import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { CommonActions, useNavigation } from '@react-navigation/native';

interface DealerDetailModalProps {
  isVisible: boolean;
  onClose: () => void;
  dealerId: string;
  showId: string;
  dealerName: string;
}

const DealerDetailModal: React.FC<DealerDetailModalProps> = ({
  isVisible,
  onClose,
  dealerId,
  showId,
  dealerName,
}) => {
  const [boothInfo, setBoothInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();

  useEffect(() => {
    if (!isVisible || !dealerId || !showId) {
      return;
    }

    const fetchBoothInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        /* ------------------------------------------------------------------
         * DEBUG-HELPERS – log everything we can about this query so we can
         * see why booth fields might appear as "Not specified".
         * ---------------------------------------------------------------- */
        console.log(
          '[DealerDetailModal] fetching booth info',
          JSON.stringify({ dealerId, showId })
        );

        // Primary query for this dealer / show pair
        const { data, error: fetchError } = await supabase
          .from('show_participants')
          .select('*')
          .eq('userid', dealerId)
          .eq('showid', showId)
          .single();

        if (fetchError) {
          console.error('Error fetching booth info:', fetchError);
          setError('Failed to load booth information.');
          setBoothInfo(null);
          return;
        }
        // ---- Additional debug logging -----------------------------------
        if (data) {
          console.log(
            '[DealerDetailModal] raw boothInfo:',
            JSON.stringify(data, null, 2)
          );

          // Log the exact keys present so we know naming conventions
          console.log('[DealerDetailModal] boothInfo keys:', Object.keys(data));
        }
        // ------------------------------------------------------------------

        setBoothInfo(data);
      } catch (err: any) {
        console.error('Unexpected error in fetchBoothInfo:', err);
        setError(err.message || 'An unexpected error occurred.');
        setBoothInfo(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBoothInfo();
  }, [isVisible, dealerId, showId]);

  const handleMessageDealer = () => {
    onClose(); // Close the modal before navigating
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs', // Assuming 'MainTabs' is the name of your tab navigator
            params: {
              screen: 'Messages', // Name of the tab screen for messages
              params: {
                recipientId: dealerId,
                recipientName: dealerName,
                isNewConversation: true,
              },
            },
          },
        ],
      })
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close-circle" size={30} color="#666" />
          </TouchableOpacity>

          <Text style={styles.modalTitle}>{dealerName}'s Booth Info</Text>

          {loading ? (
            <ActivityIndicator size="large" color="#0057B8" style={styles.loadingIndicator} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : boothInfo ? (
            <View style={styles.infoContainer}>
              <View style={styles.infoRow}>
                <Ionicons name="location" size={20} color="#666" style={styles.infoIcon} />
                <Text style={styles.infoLabel}>Booth Location:</Text>
                <Text style={styles.infoValue}>
                  {boothInfo.booth_location || 'Not specified'}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Ionicons name="star" size={20} color="#666" style={styles.infoIcon} />
                <Text style={styles.infoLabel}>Specialty:</Text>
                <Text style={styles.infoValue}>
                  {boothInfo.specialty || 'Not specified'}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Ionicons name="pricetag" size={20} color="#666" style={styles.infoIcon} />
                <Text style={styles.infoLabel}>Price Range:</Text>
                <Text style={styles.infoValue}>
                  {boothInfo.price_range || 'Not specified'}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Ionicons name="trophy" size={20} color="#666" style={styles.infoIcon} />
                <Text style={styles.infoLabel}>Notable Items:</Text>
                <Text style={styles.infoValue}>
                  {boothInfo.notable_items || 'None specified'}
                </Text>
              </View>

              {boothInfo.card_types && boothInfo.card_types.length > 0 && (
                <View style={styles.infoRow}>
                  <Ionicons name="albums" size={20} color="#666" style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>Card Types:</Text>
                  <Text style={styles.infoValue}>
                    {Array.isArray(boothInfo.card_types) 
                      ? boothInfo.card_types.join(', ') 
                      : boothInfo.card_types || 'None specified'}
                  </Text>
                </View>
              )}
              
              {boothInfo.payment_methods && boothInfo.payment_methods.length > 0 && (
                <View style={styles.infoRow}>
                  <Ionicons name="card" size={20} color="#666" style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>Payment Methods:</Text>
                  <Text style={styles.infoValue}>
                    {Array.isArray(boothInfo.payment_methods) 
                      ? boothInfo.payment_methods.join(', ') 
                      : boothInfo.payment_methods || 'None specified'}
                  </Text>
                </View>
              )}
              
              <View style={styles.infoRowSmaller}>
                <Ionicons 
                  name={boothInfo.open_to_trades ? "checkmark-circle" : "close-circle"} 
                  size={20} 
                  color={boothInfo.open_to_trades ? "#4CAF50" : "#F44336"} 
                  style={styles.infoIcon} 
                />
                <Text style={styles.infoValue}>
                  {boothInfo.open_to_trades ? 'Open to trades' : 'Not open to trades'}
                </Text>
              </View>
              
              <View style={styles.infoRowSmaller}>
                <Ionicons 
                  name={boothInfo.buying_cards ? "checkmark-circle" : "close-circle"} 
                  size={20} 
                  color={boothInfo.buying_cards ? "#4CAF50" : "#F44336"} 
                  style={styles.infoIcon} 
                />
                <Text style={styles.infoValue}>
                  {boothInfo.buying_cards ? 'Buying cards' : 'Not buying cards'}
                </Text>
              </View>

              {/* Debug section - keep for additional troubleshooting */}
              <View style={styles.debugSection}>
                <Text style={styles.debugTitle}>All Available Data:</Text>
                {Object.entries(boothInfo)
                  .filter(
                    ([key, value]) =>
                      typeof value !== 'object' &&
                      !['id', 'created_at', 'updated_at', 'userid', 'showid', 'createdat'].includes(key)
                  )
                  .map(([key, value]) => (
                    <View key={key} style={styles.debugRow}>
                      <Text style={styles.debugKey}>{key}:</Text>
                      <Text style={styles.debugValue}>{String(value ?? '-')}</Text>
                    </View>
                  ))}
              </View>
            </View>
          ) : (
            <Text style={styles.noInfoText}>No booth information available for this show.</Text>
          )}

          <TouchableOpacity style={styles.messageButton} onPress={handleMessageDealer}>
            <Ionicons name="chatbubbles" size={20} color="white" style={styles.messageButtonIcon} />
            <Text style={styles.messageButtonText}>Message {dealerName}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
    maxHeight: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  loadingIndicator: {
    marginVertical: 30,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
  },
  infoContainer: {
    width: '100%',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoIcon: {
    marginRight: 10,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    width: 120, // Fixed width for labels for alignment
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  noInfoText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 20,
  },
  messageButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  messageButtonIcon: {
    marginRight: 10,
  },
  messageButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },

  /* ----------  Debug styles ---------- */
  debugSection: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#495057',
  },
  debugRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  debugKey: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '600',
    width: 120,
  },
  debugValue: {
    fontSize: 12,
    color: '#212529',
    flex: 1,
  },
  infoRowSmaller: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 4,
  },
});

export default DealerDetailModal;
