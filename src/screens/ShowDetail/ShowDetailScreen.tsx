import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
  Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import * as userRoleService from '../../services/userRoleService';
import DealerDetailModal from '../../components/DealerDetailModal';
import ReviewForm from '../../components/ReviewForm';
import { UserRole } from '../../types'; // Import UserRole enum

// Import components from the components folder
import {
  ShowHeaderActions,
  ShowBasicInfo,
  ShowTimeInfo,
  OrganizerInfo,
  DealersList,
  ShowDescription,
  ShowManagementButtons
} from './components';

// Import the new hook
import { useShowDetailQuery } from '../../hooks/useShowDetailQuery';

interface ShowDetailProps {
  route: any;
  navigation: any;
}

interface ShowSeries {
  id: string;
  organizerId: string;
}

/**
 * Local superset of a Show row that satisfies the prop-type
 * requirements of the downstream UI components.  It augments the
 * shape returned by useShowDetailQuery with the additional fields
 * those components expect (they are marked optional so we can pass
 * through whatever the API gives us without extra mapping).
 */
interface Show {
  id: string;
  /* Optional series identifier so ReviewForm and other components
     can associate this show with a broader series when available. */
  seriesId?: string;
  title?: string;
  description?: string;
  location?: string;
  address?: string;
  /* --- additional fields required by other components ------------- */
  startDate?: string | Date;
  endDate?: string | Date;
  entryFee?: number | string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  } | null;
  /* --- raw column names from Supabase ‘shows’ table ---------------- */
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  entry_fee?: number | string;
  organizer_id?: string;
  claimed_by?: string;
  /** organiser profile returned via join in useShowDetailQuery */
  profiles?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
  } | null;
  /* catch-all so TS doesn’t complain about any extra keys */
  [key: string]: any;
}

const ShowDetailScreen: React.FC<ShowDetailProps> = ({ route, navigation }) => {
  const { showId } = route.params;
  const authContext = useAuth();
  const user = authContext.authState?.user || null;
  // Hook-based navigation (needed for hyperlink handler)
  const nav = useNavigation<any>();

  // State for modals and UI elements
  const [showSeries, setShowSeries] = useState<ShowSeries | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showDealerDetailModal, setShowDealerDetailModal] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<{ id: string; name: string } | null>(null);

  // Use the new custom hook for show details
  const {
    show,
    organizer,
    participatingDealers,
    loading,
    error,
    isFavorite,
    isShowOrganizer,
    isCurrentUserOrganizer,
    isClaimingShow,
    fetchShowDetails,
    toggleFavorite,
    shareShow,
    openMapLocation
  } = useShowDetailQuery(showId);

  // Set navigation title when show data is loaded
  useEffect(() => {
    if (show) {
      navigation.setOptions({ title: show.title || 'Show Details' });
    }
  }, [show, navigation]);

  // Handle dealer interactions
  const handleViewDealerDetails = (dealerId: string, dealerName: string) => {
    setSelectedDealer({ id: dealerId, name: dealerName });
    setShowDealerDetailModal(true);
  };

  // Handle show management
  const handleClaimShow = () => Alert.alert("Claim Show", "This feature is coming soon!");
  const navigateToEditShow = () => navigation.navigate('EditShow', { showId });

  // Navigate dealer to the Subscription upgrade screen inside Profile tab
  const navigateToSubscription = () => {
    nav.dispatch(
      CommonActions.navigate({
        name: 'MainTabs', // parent tab navigator
        params: {
          screen: 'My Profile', // profile tab
          params: {
            screen: 'SubscriptionScreen', // nested stack screen
          },
        },
      })
    );
  };

  // MVP Dealer upgrade message component
  const MVPDealerUpgradeMessage = () => {
    if (user?.role !== UserRole.DEALER) return null;
    
    return (
      <View style={styles.upgradeMessageContainer}>
        <Ionicons name="star" size={24} color="#FF6A00" style={styles.upgradeIcon} />
        <Text style={styles.upgradeMessageText}>
          <Text style={styles.upgradeLink} onPress={navigateToSubscription}>
            Upgrade to MVP Dealer
          </Text>{' '}
          to be featured in shows you set up for and find out what people are looking for in advance of the show.
        </Text>
      </View>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6A00" />
        <Text style={styles.loadingText}>Loading show details...</Text>
      </View>
    );
  }

  // Error state
  if (error || !show) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={60} color="#FF6A00" />
        <Text style={styles.errorText}>{error || 'Show not found'}</Text>
        {/* wrap the call so we pass a function, not the promise */}
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => fetchShowDetails()}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header Actions */}
      <ShowHeaderActions
        isFavorite={isFavorite}
        isCurrentUserOrganizer={isCurrentUserOrganizer}
        onToggleFavorite={toggleFavorite}
        onOpenMap={openMapLocation}
        onShare={shareShow}
        onReview={() => setShowReviewForm(true)}
        show={show}
      />

      <View style={styles.detailsContainer}>
        {/* Basic Show Info */}
        <ShowBasicInfo show={show} />
        
        {/* MVP Dealer Upgrade Message - conditionally rendered */}
        <MVPDealerUpgradeMessage />
        
        {/* Show Time Info */}
        <ShowTimeInfo show={show} />
        
        {/* Show Management Buttons */}
        <ShowManagementButtons
          isShowOrganizer={isShowOrganizer}
          isCurrentUserOrganizer={isCurrentUserOrganizer}
          isClaimingShow={isClaimingShow}
          onClaimShow={handleClaimShow}
          onEditShow={navigateToEditShow}
        />
        
        {/* Organizer Info */}
        {organizer && <OrganizerInfo organizer={organizer} />}
        
        {/* Show Description */}
        <ShowDescription description={show.description} />
        
        {/* Dealers List */}
        <DealersList
          dealers={participatingDealers}
          isLoading={false}
          onViewDealerDetails={handleViewDealerDetails}
        />
      </View>

      {/* Modals */}
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
  detailsContainer: {
    padding: 16,
    backgroundColor: 'white',
    marginTop: 10,
  },
  upgradeMessageContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 16,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6A00',
    flexDirection: 'row',
    alignItems: 'center',
  },
  upgradeIcon: {
    marginRight: 12,
  },
  upgradeMessageText: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
  },
  /* Highlighted hyperlink style for “Upgrade to MVP Dealer” */
  upgradeLink: {
    color: '#FF6A00',           /* Brand orange */
    fontWeight: 'bold',         /* Make it stand out */
    textDecorationLine: 'underline', /* Clearly indicate it's clickable */
  }
});

export default ShowDetailScreen;
