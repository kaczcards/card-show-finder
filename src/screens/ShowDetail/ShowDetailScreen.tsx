import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Share,
  ActivityIndicator,
  Alert,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CommonActions } from '@react-navigation/native';
import * as userRoleService from '../../services/userRoleService';
import GroupMessageComposer from '../../components/GroupMessageComposer';
import DealerDetailModal from '../../components/DealerDetailModal';
import ReviewsList from '../../components/ReviewsList';
import ReviewForm from '../../components/ReviewForm';

const placeholderShowImage = require('../../../assets/images/placeholder-show.png');

// Define missing types for robustness
type UserRole = 'SHOW_ORGANIZER' | 'MVP_DEALER' | 'DEALER' | 'USER';
interface ShowSeries {
  id: string;
  organizerId: string;
}
interface Review {
  id: string;
  // ... other review properties
}

interface ShowDetailProps {
  route: any;
  navigation: any;
}

/* -------------------------------------------------------------------------- */
/* Utility presentation components (kept local to avoid extra files)          */
/* -------------------------------------------------------------------------- */
type InfoRowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text?: string;
  children?: React.ReactNode;
};

/** Renders a consistent "icon + text" row */
const InfoRow: React.FC<InfoRowProps> = ({ icon, text, children }) => {
  const renderContent = () => {
    if (children === undefined || children === null) {
      return <Text style={styles.infoText}>{text}</Text>;
    }
    if (typeof children === 'string' || typeof children === 'number') {
      return <Text style={styles.infoText}>{children}</Text>;
    }
    return children;
  };

  return (
    <View style={styles.infoRow}>
      <Ionicons
        name={icon}
        size={20}
        color="#666666"
        style={styles.infoIcon}
      />
      {renderContent()}
    </View>
  );
};

/** Section header helper for consistent typography */
const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

const ShowDetailScreen: React.FC<ShowDetailProps> = ({ route, navigation }) => {
  const { showId } = route.params;
  const authContext = useAuth();
  const user = authContext.authState?.user || null;

  const [show, setShow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showSeries, setShowSeries] = useState<ShowSeries | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [isShowOrganizer, setIsShowOrganizer] = useState(false);
  const [isCurrentUserOrganizer, setIsCurrentUserOrganizer] = useState(false);
  const [isClaimingShow, setIsClaimingShow] = useState(false);
  const [isShowClaimed, setIsShowClaimed] = useState(false);
  const [participatingDealers, setParticipatingDealers] = useState<any[]>([]);
  const [loadingDealers, setLoadingDealers] = useState(false);
  const [showDealerDetailModal, setShowDealerDetailModal] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (user) {
      const userRole = user.role as UserRole;
      const hasOrganizerRole = userRole === 'SHOW_ORGANIZER';
      setIsShowOrganizer(hasOrganizerRole);
      if (userRoleService.IS_TEST_MODE) {
        setIsShowOrganizer(true);
      }
    } else {
      setIsShowOrganizer(false);
    }
  }, [user]);

  useEffect(() => {
    fetchShowDetails();
    fetchParticipatingDealers(showId);
    checkIfFavorite();
  }, [showId]);

  const fetchShowDetails = async () => {
    try {
      setLoading(true);
      /* ------------------------------------------------------------------
       * Step 1: Fetch the show row on its own (no joins)
       * ------------------------------------------------------------------ */
      const {
        data: showData,
        error: showError,
      } = await supabase.from('shows').select('*').eq('id', showId).single();

      if (showError) throw showError;
      if (!showData) throw new Error('Show not found');

      /* ------------------------------------------------------------------
       * Step 2: If the show has an organiser, fetch their profile
       * ------------------------------------------------------------------ */
      let organizerProfile: any = null;
      if (showData.organizer_id) {
        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select(
            'id, first_name, last_name, profile_image_url, username, full_name, avatar_url'
          )
          .eq('id', showData.organizer_id)
          .single();

        if (!profileError && profileData) {
          organizerProfile = profileData;
        }
      }

      /* ------------------------------------------------------------------
       * Step 3: Combine the data and update component state
       * ------------------------------------------------------------------ */
      const combinedData = {
        ...showData,
        profiles: organizerProfile,
      };

      setShow(combinedData);
      navigation.setOptions({ title: showData.title || 'Show Details' });
      setIsCurrentUserOrganizer(user?.id === showData.organizer_id);
      setIsShowClaimed(!!showData.claimed_by);
    } catch (error) {
      console.error('Error fetching show details:', error);
      setError('Failed to load show details');
    } finally {
      setLoading(false);
    }
  };

    const fetchParticipatingDealers = async (showId: string) => {
        setLoadingDealers(true);
        try {
            const { data: participants, error: participantsError } = await supabase
                .from('show_participants')
                .select('userid')
                .eq('showid', showId);

            if (participantsError) throw participantsError;
            if (!participants || participants.length === 0) {
                setParticipatingDealers([]);
                return;
            }

            const participantUserIds = [...new Set(participants.map((p) => p.userid))];
            const { data: dealerProfiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, profile_image_url, role, account_type')
                .in('id', participantUserIds)
                // Roles are stored lowercase in DB, so query accordingly
                .or('role.eq.mvp_dealer,role.eq.dealer');

            if (profilesError) throw profilesError;

            const dealers = (dealerProfiles || []).map((profile) => ({
                id: profile.id,
                name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.id.substring(0, 8),
                profileImageUrl: profile.profile_image_url,
                // Normalise role to uppercase so downstream comparisons
                // (`dealer.role === 'MVP_DEALER'`, etc.) work reliably.
                role: ((profile.role ?? '') as string).toUpperCase() as UserRole,
                accountType: profile.account_type,
            }));
            setParticipatingDealers(dealers);
        } catch (error) {
            console.error('Error in fetchParticipatingDealers:', error);
        } finally {
            setLoadingDealers(false);
        }
    };


  const checkIfFavorite = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setIsFavorite(false);
        return;
      }
      const { data, error } = await supabase
        .from('user_favorite_shows')
        .select()
        .eq('user_id', session.user.id)
        .eq('show_id', showId)
        .single();
      setIsFavorite(!error && !!data);
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

    const toggleFavorite = async () => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session?.user) {
                Alert.alert('Sign In Required', 'Please sign in to save favorites');
                return;
            }
            const userId = session.user.id;

            if (isFavorite) {
                const { error } = await supabase
                    .from('user_favorite_shows')
                    .delete()
                    .eq('user_id', userId)
                    .eq('show_id', showId);
                if (error) throw error;
                setIsFavorite(false);
            } else {
                const { error } = await supabase
                    .from('user_favorite_shows')
                    .insert([{ user_id: userId, show_id: showId }]);
                if (error) throw error;
                setIsFavorite(true);
            }
        } catch (error: any) {
            console.error('🚨 UNEXPECTED ERROR in toggleFavorite:', error);
            Alert.alert('Error', 'An unexpected error occurred while updating favorites.');
        }
    };


    const shareShow = async () => {
        if (!show) return;
        try {
            const message = `Check out this card show: ${show.title}\n\nWhen: ${formatShowDate(show)}\nWhere: ${show.location}\n\nShared from Card Show Finder app`;
            await Share.share({ message, title: show.title });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const formatShowDate = (show: any) => {
        if (!show?.start_date) return '';
        try {
            const startIso = (show.start_date as string).split('T')[0];
            const endIso = show.end_date ? (show.end_date as string).split('T')[0] : null;
            const startDate = new Date(`${startIso}T12:00:00`);
            const endDate = endIso ? new Date(`${endIso}T12:00:00`) : null;
            const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

            if (endDate && startDate.toDateString() !== endDate.toDateString()) {
                return `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
            }
            return startDate.toLocaleDateString(undefined, options);
        } catch (e) {
            return show.start_date || 'Date unavailable';
        }
    };

    const formatTime = (timeString?: string | null) => {
        if (!timeString) return '';
        try {
            return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return timeString ?? '';
        }
    };

    const getFormattedShowHours = (show: any): string => {
        if (!show) return 'Time not specified';
        const start = show.start_time ?? show.startTime ?? show.time ?? null;
        const end = show.end_time ?? show.endTime ?? null;

        if (start && end && start !== end) return `${formatTime(start)} - ${formatTime(end)}`;
        if (start) return formatTime(start);
        if (end) return formatTime(end);

        if (show.description) {
            return extractTimeFromDescription(show.description) || 'Time not specified';
        }
        return 'Time not specified';
    };

  const extractTimeFromDescription = (description: string): string | null => {
    if (!description) return null;
    const timePattern1 = /(\d{1,2})(:\d{2})?\s*(am|pm)\s*[-–—to]\s*(\d{1,2})(:\d{2})?\s*(am|pm)/i;
    const match1 = description.match(timePattern1);
    if (match1) return `${match1[1]}${match1[2] || ''}${match1[3].toLowerCase()} - ${match1[4]}${match1[5] || ''}${match1[6].toLowerCase()}`;

    const timePattern2 = /\b(\d{1,2})\s*[-–—to]\s*(\d{1,2})(\s*[ap]m)?\b/i;
    const match2 = description.match(timePattern2);
    if (match2) {
      if (match2[3]) return `${match2[1]}${match2[3].toLowerCase()} - ${match2[2]}${match2[3].toLowerCase()}`;
      return `${match2[1]}am - ${match2[2]}pm`;
    }
    return null;
  };


    const openMapLocation = () => {
        if (!show) return;
        const address = encodeURIComponent(show.address || show.location);
        const url = `https://maps.apple.com/?q=${address}`;
        Linking.openURL(url).catch(() => {
            const googleUrl = `https://www.google.com/maps/search/?api=1&query=${address}`;
            Linking.openURL(googleUrl);
        });
    };

  const handleViewDealerDetails = (dealerId: string, dealerName: string) => {
    setSelectedDealer({ id: dealerId, name: dealerName });
    setShowDealerDetailModal(true);
  };

  const handleMessageDealer = (dealerId: string, dealerName: string) => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{
          name: 'MainTabs',
          params: {
            screen: 'Messages',
            params: { recipientId: dealerId, recipientName: dealerName, isNewConversation: true },
          },
        }],
      })
    );
  };

  const handleClaimShow = () => Alert.alert("Claim Show", "This feature is coming soon!");
  const handleClaimShowSeries = () => Alert.alert("Claim Show Series", "This feature is coming soon!");
  const navigateToEditShow = () => navigation.navigate('EditShow', { showId });


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6A00" />
        <Text style={styles.loadingText}>Loading show details...</Text>
      </View>
    );
  }

  if (error || !show) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={60} color="#FF6A00" />
        <Text style={styles.errorText}>{error || 'Show not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchShowDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={toggleFavorite}>
          <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={24} color={isFavorite ? '#FF6A00' : '#333333'} />
          <Text style={styles.actionText}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={openMapLocation}>
          <Ionicons name="location" size={24} color="#333333" />
          <Text style={styles.actionText}>Map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={shareShow}>
          <Ionicons name="share-outline" size={24} color="#333333" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => setShowReviewForm(true)}>
          <Ionicons name="star-outline" size={24} color="#333333" />
          <Text style={styles.actionText}>Review</Text>
        </TouchableOpacity>
        {isCurrentUserOrganizer && (
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowBroadcastModal(true)}>
            <Ionicons name="megaphone-outline" size={24} color="#FF6A00" />
            <Text style={[styles.actionText, { color: '#FF6A00' }]}>Broadcast</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Show Details */}
      <View style={styles.detailsContainer}>
        <Text style={styles.title}>{show.title}</Text>

        <View style={styles.timeContainer}>
          <SectionHeader>Show Hours</SectionHeader>
          <Text style={styles.timeText}>{getFormattedShowHours(show)}</Text>
        </View>

        <InfoRow icon="location" text={show.address || show.location || 'Location not specified'} />

        {show.entry_fee && (
          <InfoRow
            icon="cash"
            text={`Entry Fee: $${Number(show.entry_fee).toFixed(2)}`}
          />
        )}

        {isShowOrganizer && !isCurrentUserOrganizer && (
          <TouchableOpacity style={styles.claimShowButton} onPress={handleClaimShow} disabled={isClaimingShow}>
            {isClaimingShow ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
              <>
                <Ionicons name="flag" size={20} color="#FFFFFF" style={styles.claimButtonIcon} />
                <Text style={styles.claimButtonText}>Claim This Show</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isCurrentUserOrganizer && (
          <TouchableOpacity style={styles.editShowButton} onPress={navigateToEditShow}>
            <Ionicons name="create" size={20} color="#FFFFFF" style={styles.claimButtonIcon} />
            <Text style={styles.claimButtonText}>Edit Show Details</Text>
          </TouchableOpacity>
        )}

        {show.profiles && (
          <View style={styles.organizerContainer}>
            <SectionHeader>Organized by:</SectionHeader>
            <View style={styles.organizer}>
              {show.profiles.avatar_url ? (
                <Image source={{ uri: show.profiles.avatar_url }} style={styles.organizerAvatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {show.profiles.full_name?.[0] || show.profiles.username?.[0] || 'O'}
                  </Text>
                </View>
              )}
              <Text style={styles.organizerName}>{show.profiles.full_name || show.profiles.username || 'Show Organizer'}</Text>
            </View>
          </View>
        )}

        <View style={styles.descriptionContainer}>
          <SectionHeader>About this show</SectionHeader>
          <Text style={styles.description}>{show.description || 'No description available'}</Text>
        </View>
        
        <View style={styles.mvpDealersContainer}>
          <SectionHeader>Participating Dealers</SectionHeader>
          {loadingDealers ? (
            <ActivityIndicator size="small" color="#FF6A00" />
          ) : participatingDealers.length > 0 ? (
            <View style={styles.dealersList}>
              {participatingDealers.map(dealer => (
                <View key={dealer.id} style={styles.dealerItem}>
                  {dealer.role === 'MVP_DEALER' ? (
                    <TouchableOpacity style={styles.dealerNameButton} onPress={() => handleViewDealerDetails(dealer.id, dealer.name)}>
                      <Text style={styles.dealerName}>{dealer.name} (MVP)</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.dealerName, styles.nonClickableDealerName]}>{dealer.name}</Text>
                  )}
                  {dealer.role === 'MVP_DEALER' && (
                    <TouchableOpacity style={styles.messageDealerButton} onPress={() => handleMessageDealer(dealer.id, dealer.name)}>
                      <Text style={styles.messageDealerButtonText}>Message</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noDataText}>No participating dealers listed for this show yet.</Text>
          )}
        </View>
        
      </View>

      {/* Modals */}
      <GroupMessageComposer
        visible={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        showId={showId}
        showTitle={show.title}
        onMessageSent={() => Alert.alert('Success', 'Broadcast message sent successfully')}
      />
      {selectedDealer && (
        <DealerDetailModal
          isVisible={showDealerDetailModal}
          onClose={() => setShowDealerDetailModal(false)}
          dealerId={selectedDealer.id}
          showId={showId}
          dealerName={selectedDealer.name}
        />
      )}
      {showReviewForm && showSeries && (
        <ReviewForm
          seriesId={showSeries.id}
          onSubmit={() => {}}
          onCancel={() => setShowReviewForm(false)}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#FF6A00',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#FF6A00',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#F0F0F0',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageLoader: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    zIndex: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    marginTop: 4,
    fontSize: 12,
  },
  detailsContainer: {
    padding: 16,
    backgroundColor: 'white',
    marginTop: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    marginRight: 10,
  },
  infoText: {
    fontSize: 16,
    flex: 1,
  },
  claimShowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6A00',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  editShowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0057B8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  claimButtonIcon: {
    marginRight: 8,
  },
  claimButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  organizerContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  organizer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0057B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  organizerName: {
    fontSize: 16,
    fontWeight: '500',
  },
  descriptionContainer: {
    marginTop: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  timeContainer: {
    marginVertical: 10,
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  timeText: {
    fontSize: 16,
    color: '#333',
  },
  mvpDealersContainer: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
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
  loadingDealersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingDealersText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666666',
  },
});

export default ShowDetailScreen;