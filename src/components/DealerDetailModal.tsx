import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';

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

  useEffect(() => {
    if (!isVisible || !dealerId || !showId) {
      return;
    }

    const fetchBoothInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        // Primary query for this dealer / show pair
        const { data, error: fetchError } = await supabase
          .from('show_participants')
          .select('*')
          .eq('userid', dealerId)
          .eq('showid', showId)
          // `.maybeSingle()` returns `null` when no rows match instead of throwing
          .maybeSingle();

        if (fetchError) {
          /* --------------------------------------------------------------
           * Supabase returns PGRST116 when `.single()` expected a row but
           * received zero.  With `.maybeSingle()` this should be rare, but
           * we guard anyway in case the signature changes or we encounter
           * a similar “no rows” condition.
           * -------------------------------------------------------------- */
          const isNoRowsError =
            fetchError.code === 'PGRST116' ||
            fetchError.message?.includes('JSON object requested');

          if (isNoRowsError) {
            // Graceful empty-state – no booth info for this dealer/show
            setBoothInfo(null);
            return;
          }

          // Any other error: surface it
          console.error('Error fetching booth info:', fetchError);
          setError('Failed to load booth information.');
          setBoothInfo(null);
          return;
        }

        // `data` can be `null` when no rows were found
        setBoothInfo(data ?? null);
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

          <Text style={styles.modalTitle}>{`${dealerName}'s Booth Info`}</Text>

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
            </View>
          ) : (
            <Text style={styles.noInfoText}>No booth information available for this show.</Text>
          )}

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
  infoRowSmaller: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 4,
  },
});

export default DealerDetailModal;
