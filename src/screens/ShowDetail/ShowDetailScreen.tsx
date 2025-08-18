import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  /* Linking and Share removed – not used in this component */
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import * as _userRoleService from '../../services/userRoleService';
import DealerDetailModal from '../../components/DealerDetailModal';
import ReviewForm from '../../components/ReviewForm';
import { UserRole, Show as ShowType } from '../../types'; // Import enums & primary Show model
// Use the wrapped Sentry helpers to avoid direct SDK calls that may be treeshaken out
import { captureMessage } from '../../services/sentryConfig';

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

const ShowDetailScreen: React.FC<ShowDetailProps> = ({ route, navigation }) => {
  // Guard against missing navigation params to avoid runtime crash
  // `route.params` can be undefined if the navigate() call forgets to pass extras.
  // Using a fallback empty object lets the screen render an error state gracefully.
  const { showId } = route.params || {};
  const authContext = useAuth();
  const user = authContext.authState?.user || null;
  // Hook-based navigation (needed for hyperlink handler)
  const nav = useNavigation<any>();

  // State for modals and UI elements
  const [_showSeries, _setShowSeries] = useState<ShowSeries | null>(null);
  const [_loadingSeries, _setLoadingSeries] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showDealerDetailModal, setShowDealerDetailModal] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<{ id: string; name: string } | null>(null);

  // ------------------------------------------------------------------
  // Guard clause – ensure we have a valid showId *before* running queries
  // ------------------------------------------------------------------
  if (!showId) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={60} color="#FF6A00" />
        <Text style={styles.errorText}>Error: Show ID not provided</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
    openMapLocation,
  } = useShowDetailQuery(showId);

  /* ------------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------------ */
  /**
   * Convert the raw record coming from `useShowDetailQuery` (which still
   * contains snake_case columns directly from the DB) into the strongly
   * typed {@link ShowType} expected by downstream UI components.
   *
   * NOTE: Only the fields actually used by those components are mapped.
   *       Default fall-backs ensure we never violate the required props.
   */
  const mapShowDetailsToShow = (details: any): ShowType => ({
    /* ---------------- Core identifiers ---------------- */
    id: details.id,
    seriesId: details.series_id ?? undefined,

    /* ---------------- Display info -------------------- */
    title: details.title ?? '',
    description: details.description ?? '',
    location: details.location ?? '',
    address: details.address ?? '',

    /* ---------------- Timing -------------------------- */
    startDate: details.start_date ?? details.startDate ?? '',
    endDate: details.end_date ?? details.endDate ?? '',
    // map time fields so ShowTimeInfo can display them
    startTime: details.start_time ?? details.startTime ?? undefined,
    endTime:   details.end_time   ?? details.endTime   ?? undefined,

    /* ---------------- Pricing / status --------------- */
    entryFee: details.entry_fee ?? details.entryFee ?? 0,
    status: details.status ?? 'upcoming',

    /* ---------------- Misc ---------------------------- */
    imageUrl: details.image_url ?? undefined,
    rating: details.rating ?? undefined,
    coordinates:
      details.coordinates ??
      (details.latitude && details.longitude
        ? { latitude: details.latitude, longitude: details.longitude }
        : undefined),
    organizerId: details.organizer_id ?? details.organizerId ?? '',
    createdAt: details.created_at ?? details.createdAt ?? '',
    updatedAt: details.updated_at ?? details.updatedAt ?? '',
  });

  // Memoise so we only transform when raw `show` changes
  const parsedShow: ShowType | null = show ? mapShowDetailsToShow(show) : null;

  // Set navigation title when show data is loaded
  useEffect(() => {
    if (parsedShow) {
      navigation.setOptions({ title: parsedShow.title || 'Show Details' });
    }
  }, [parsedShow, navigation]);

  // Handle marking a show as attended
  const handleMarkAsAttended = async () => {
    if (!user || !parsedShow) {
      Alert.alert("Error", "You must be logged in to mark a show as attended");
      return;
    }
    
    try {
      // Logic to mark the show as attended would go here
      // This would typically call a service function
      
      // For now, just show a success message
      Alert.alert("Success", "You've marked this show as attended!");
      
      // Track this business event in Sentry
      captureMessage(
        'Show Attended',
        'info',
        {
          tags: { event_type: 'business' },
          extra: {
            showId: parsedShow.id,
            userId: user.id,
          },
        }
      );
    } catch (error) {
      Alert.alert("Error", "Failed to mark show as attended");
      console.error("Error marking show as attended:", error);
    }
  };

  // Handle dealer interactions
  const handleViewDealerDetails = (dealerId: string, dealerName: string) => {
    setSelectedDealer({ id: dealerId, name: dealerName });
    setShowDealerDetailModal(true);
  };

  // Handle show management
  const handleClaimShow = () => Alert.alert("Claim Show", "This feature is coming soon!");
  const navigateToEditShow = () => navigation.navigate('EditShow', { showId });

  // Navigate directly to the dealer participation screen with this show pre-selected
  const navigateToManageParticipation = () =>
    nav.dispatch(
      CommonActions.navigate({
        name: 'MainTabs',
        params: {
          screen: 'My Profile',
          params: {
            screen: 'ShowParticipationScreen',
            params: { preselectShowId: showId, forceRegister: true },
          },
        },
      }),
    );

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
      {parsedShow && (
        <ShowHeaderActions
        isFavorite={isFavorite}
        _isCurrentUserOrganizer={isCurrentUserOrganizer}
        onToggleFavorite={toggleFavorite}
        onOpenMap={openMapLocation}
        onShare={shareShow}
        onReview={() => setShowReviewForm(true)}
          show={parsedShow}
        />
      )}

      <View style={styles.detailsContainer}>
        {/* Basic Show Info */}
        {parsedShow && <ShowBasicInfo show={parsedShow} />}
        
        {/* MVP Dealer Upgrade Message - conditionally rendered */}
        <MVPDealerUpgradeMessage />
        
        {/* Show Time Info */}
        {/* Always provide the raw DB object so ShowTimeInfo can access
            snake_case fields like start_time / end_time without relying
            on the mapped subset.  The existence of `show` is already
            guarded earlier in the render path. */}
        <ShowTimeInfo show={show} />
        
        {/* Show Management Buttons */}
        <ShowManagementButtons
          isShowOrganizer={isShowOrganizer}
          isCurrentUserOrganizer={isCurrentUserOrganizer}
          isClaimingShow={isClaimingShow}
          onClaimShow={handleClaimShow}
          onEditShow={navigateToEditShow}
          onManageMyParticipation={navigateToManageParticipation}
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
        
        {/* Attendance Button */}
        {user && parsedShow && (
          <TouchableOpacity 
            style={styles.attendanceButton}
            onPress={handleMarkAsAttended}
          >
            <Ionicons name="checkmark-circle-outline" size={24} color="white" />
            <Text style={styles.attendanceButtonText}>Mark as Attended</Text>
          </TouchableOpacity>
        )}
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
      
      {showReviewForm && _showSeries && (
        <ReviewForm
          _showId={showId}
          _seriesId={_showSeries?.id || ''}
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
  /* Highlighted hyperlink style for "Upgrade to MVP Dealer" */
  upgradeLink: {
    color: '#FF6A00',           /* Brand orange */
    fontWeight: 'bold',         /* Make it stand out */
    textDecorationLine: 'underline', /* Clearly indicate it's clickable */
  },
  /* Attendance button styles */
  attendanceButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attendanceButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  }
});

export default ShowDetailScreen;
