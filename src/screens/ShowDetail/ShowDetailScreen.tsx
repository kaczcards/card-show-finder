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
import { CommonActions } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import * as userRoleService from '../../services/userRoleService';
import GroupMessageComposer from '../../components/GroupMessageComposer';
import DealerDetailModal from '../../components/DealerDetailModal';
import ReviewForm from '../../components/ReviewForm';

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

// Import formatters and hooks
import { formatShowDate } from './utils/formatters';
import { useShowDetail } from './hooks/useShowDetail';

interface ShowDetailProps {
  route: any;
  navigation: any;
}

interface ShowSeries {
  id: string;
  organizerId: string;
}

const ShowDetailScreen: React.FC<ShowDetailProps> = ({ route, navigation }) => {
  const { showId } = route.params;
  const authContext = useAuth();
  const user = authContext.authState?.user || null;

  // State for modals and UI elements
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showSeries, setShowSeries] = useState<ShowSeries | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showDealerDetailModal, setShowDealerDetailModal] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<{ id: string; name: string } | null>(null);

  // Use the custom hook for show details
  const {
    show,
    loading,
    error,
    isFavorite,
    isShowOrganizer,
    isCurrentUserOrganizer,
    isClaimingShow,
    participatingDealers,
    loadingDealers,
    fetchShowDetails,
    toggleFavorite,
    shareShow: shareShowDetails,
    openMapLocation
  } = useShowDetail(
    showId,
    async (show) => {
      if (!show) return;
      try {
        const message = `Check out this card show: ${show.title}\n\nWhen: ${formatShowDate(show)}\nWhere: ${show.location || show.address}\n\nShared from Card Show Finder app`;
        await Share.share({ message, title: show.title });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    },
    (address) => {
      const encodedAddress = encodeURIComponent(address);
      const url = `https://maps.apple.com/?q=${encodedAddress}`;
      Linking.openURL(url).catch(() => {
        const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        Linking.openURL(googleUrl);
      });
    }
  );

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

  // Handle show management
  const handleClaimShow = () => Alert.alert("Claim Show", "This feature is coming soon!");
  const navigateToEditShow = () => navigation.navigate('EditShow', { showId });

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
        <TouchableOpacity style={styles.retryButton} onPress={fetchShowDetails}>
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
        onShare={shareShowDetails}
        onReview={() => setShowReviewForm(true)}
        onBroadcast={() => setShowBroadcastModal(true)}
      />

      <View style={styles.detailsContainer}>
        {/* Basic Show Info */}
        <ShowBasicInfo show={show} />
        
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
        {show.profiles && <OrganizerInfo organizer={show.profiles} />}
        
        {/* Show Description */}
        <ShowDescription description={show.description} />
        
        {/* Dealers List */}
        <DealersList
          dealers={participatingDealers}
          isLoading={loadingDealers}
          onViewDealerDetails={handleViewDealerDetails}
          onMessageDealer={handleMessageDealer}
        />
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
  detailsContainer: {
    padding: 16,
    backgroundColor: 'white',
    marginTop: 10,
  }
});

export default ShowDetailScreen;
