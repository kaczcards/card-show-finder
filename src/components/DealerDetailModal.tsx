import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import SocialIcon from './ui/SocialIcon';

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
  const [social, setSocial] = useState<{
    facebookUrl?: string;
    instagramUrl?: string;
    twitterUrl?: string;
    whatnotUrl?: string;
    ebayStoreUrl?: string;
  } | null>(null);

  // Safely open a URL with proper protocol
  const handleOpenLink = (url?: string) => {
    if (!url) return;

    // Ensure protocol prefix exists
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    Linking.openURL(formattedUrl).catch(err => {
      console.error('Error opening URL:', err);
      Alert.alert(
        'Cannot Open Link',
        'The link could not be opened. Please check that it is a valid URL.',
        [{ text: 'OK' }],
      );
    });
  };

  useEffect(() => {
    if (!isVisible || !dealerId || !showId) {
      return;
    }

    const fetchBoothInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        /* ------------------------------------------------------------------
         * 0. Prefer the public RPC used by ShowDetail so that attendees who
         *    do not have RLS permission on show_participants can still view
         *    organiser / MVP dealer booth info.
         * ------------------------------------------------------------------ */
        try {
          const { data: showDetails } = await supabase.rpc(
            'get_show_details_by_id',
            { show_id: showId },
          );

          if (
            showDetails &&
            Array.isArray(showDetails.participatingDealers)
          ) {
            const match = showDetails.participatingDealers.find(
              (d: any) => d.id === dealerId,
            );

            if (match) {
              const normalise = (row: any) => ({
                booth_location:
                  row.booth_location ??
                  row.boothLocation ??
                  row.booth_number ??
                  row.boothNumber ??
                  '',
                card_types: row.card_types ?? row.cardTypes ?? [],
                specialty: row.specialty ?? '',
                price_range: row.price_range ?? row.priceRange ?? '',
                notable_items: row.notable_items ?? row.notableItems ?? '',
                payment_methods:
                  row.payment_methods ?? row.paymentMethods ?? [],
                open_to_trades:
                  row.open_to_trades ?? row.openToTrades ?? false,
                buying_cards: row.buying_cards ?? row.buyingCards ?? false,
              });

              setBoothInfo(normalise(match));
              
              // Set social links from match if present
              if (match.facebookUrl || match.instagramUrl || match.twitterUrl || 
                  match.whatnotUrl || match.ebayStoreUrl) {
                setSocial({
                  facebookUrl: match.facebookUrl,
                  instagramUrl: match.instagramUrl,
                  twitterUrl: match.twitterUrl,
                  whatnotUrl: match.whatnotUrl,
                  ebayStoreUrl: match.ebayStoreUrl,
                });
              } else {
                // Fetch social links from profiles if not in match
                try {
                  const { data: profileData } = await supabase
                    .from('profiles')
                    .select('facebook_url, instagram_url, twitter_url, whatnot_url, ebay_store_url')
                    .eq('id', dealerId)
                    .single();
                    
                  if (profileData) {
                    setSocial({
                      facebookUrl: profileData.facebook_url,
                      instagramUrl: profileData.instagram_url,
                      twitterUrl: profileData.twitter_url,
                      whatnotUrl: profileData.whatnot_url,
                      ebayStoreUrl: profileData.ebay_store_url,
                    });
                  }
                } catch (socialErr) {
                  // Non-fatal; continue without social links
                  if (__DEV__) console.warn('Failed to fetch social links:', socialErr);
                }
              }
              
              return; // Success – skip direct table queries
            }
          }
        } catch (rpcErr) {
          // Non-fatal; continue to fallback queries
          if (__DEV__) console.warn('DealerDetailModal RPC fallback error', rpcErr);
        }

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
           * a similar "no rows" condition.
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
        let boothRow = data ?? null;

        /* ------------------------------------------------------------------
         * Secondary query – try alternate snake_case column names
         * ------------------------------------------------------------------ */
        if (!boothRow) {
          const { data: altData } = await supabase
            .from('show_participants')
            .select('*')
            .eq('user_id', dealerId)
            .eq('show_id', showId)
            .maybeSingle();
          boothRow = altData ?? null;
        }

        /* ------------------------------------------------------------------
         * Tertiary query – broad OR-based fallback, grab most recent match
         * ------------------------------------------------------------------ */
        if (!boothRow) {
          const { data: fallbackRows } = await supabase
            .from('show_participants')
            .select('*')
            .or(
              `userid.eq.${dealerId},user_id.eq.${dealerId}`
            )
            .or(
              `showid.eq.${showId},show_id.eq.${showId}`
            )
            // Order by whichever timestamp column exists
            .order('createdat', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          boothRow = fallbackRows ?? null;
        }

        // If still nothing – leave as null (empty state)
        if (!boothRow) {
          setBoothInfo(null);
          return;
        }

        /* ------------------------------------------------------------------
         * Normalise column names so downstream UI can rely on a stable shape
         * ------------------------------------------------------------------ */
        const normalise = (row: any) => ({
          booth_location:
            row.booth_location ??
            row.boothLocation ??
            row.booth_number ??
            row.boothNumber ??
            '',
          card_types: row.card_types ?? row.cardTypes ?? [],
          specialty: row.specialty ?? '',
          price_range: row.price_range ?? row.priceRange ?? '',
          notable_items: row.notable_items ?? row.notableItems ?? '',
          payment_methods:
            row.payment_methods ?? row.paymentMethods ?? [],
          open_to_trades:
            row.open_to_trades ?? row.openToTrades ?? false,
          buying_cards: row.buying_cards ?? row.buyingCards ?? false,
        });

        setBoothInfo(normalise(boothRow));
        
        // Fetch social links from profiles table
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('facebook_url, instagram_url, twitter_url, whatnot_url, ebay_store_url')
            .eq('id', dealerId)
            .single();
            
          if (profileData) {
            setSocial({
              facebookUrl: profileData.facebook_url,
              instagramUrl: profileData.instagram_url,
              twitterUrl: profileData.twitter_url,
              whatnotUrl: profileData.whatnot_url,
              ebayStoreUrl: profileData.ebay_store_url,
            });
          }
        } catch (socialErr) {
          // Non-fatal; continue without social links
          if (__DEV__) console.warn('Failed to fetch social links:', socialErr);
        }
        
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
              
              {/* Web Links Section */}
              {social && (
                social.facebookUrl || social.instagramUrl || social.twitterUrl || 
                social.whatnotUrl || social.ebayStoreUrl
              ) && (
                <View style={styles.webLinksSection}>
                  <Text style={styles.webLinksTitle}>Web Links</Text>
                  <View style={styles.socialIconsRow}>
                    {social.facebookUrl && (
                      <TouchableOpacity 
                        style={styles.socialIcon} 
                        onPress={() => handleOpenLink(social.facebookUrl)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="logo-facebook" size={24} color="#4267B2" />
                      </TouchableOpacity>
                    )}
                    
                    {social.instagramUrl && (
                      <TouchableOpacity 
                        style={styles.socialIcon} 
                        onPress={() => handleOpenLink(social.instagramUrl)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="logo-instagram" size={24} color="#E1306C" />
                      </TouchableOpacity>
                    )}
                    
                    {social.twitterUrl && (
                      <TouchableOpacity 
                        style={styles.socialIcon} 
                        onPress={() => handleOpenLink(social.twitterUrl)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="logo-twitter" size={24} color="#1DA1F2" />
                      </TouchableOpacity>
                    )}
                    
                    {social.whatnotUrl && (
                      <SocialIcon
                        platform="whatnot"
                        onPress={() => handleOpenLink(social.whatnotUrl)}
                      />
                    )}
                    
                    {social.ebayStoreUrl && (
                      <SocialIcon
                        platform="ebay"
                        onPress={() => handleOpenLink(social.ebayStoreUrl)}
                      />
                    )}
                  </View>
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
  webLinksSection: {
    width: '100%',
    marginTop: 10,
    marginBottom: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  webLinksTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 10,
  },
  socialIconsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
  },
  socialIcon: {
    marginRight: 15,
    marginBottom: 10,
    padding: 5,
  },
});

export default DealerDetailModal;
