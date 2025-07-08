import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// Domain / context / services
import { useAuth } from '../../contexts/AuthContext';
import {
  getUserWantList,
} from '../../services/collectionService';
import { getUpcomingShows } from '../../services/showService';
import { WantList, Show, UserRole } from '../../types';

// UI components
import WantListEditor from '../../components/WantListEditor';

const CollectionScreen: React.FC = () => {
  // ===== Auth =====
  const {
    authState: { user },
  } = useAuth();
  const userId = user?.id ?? '';
  const userRole = user?.role || UserRole.ATTENDEE;

  // ===== Want List State =====
  const [wantList, setWantList] = useState<WantList | null>(null);
  const [loadingWantList, setLoadingWantList] = useState<boolean>(true);
  
  // ===== Upcoming Shows State =====
  const [upcomingShows, setUpcomingShows] = useState<Show[]>([]);
  const [loadingShows, setLoadingShows] = useState<boolean>(true);

  /* ------------------------------------------------------------------
   * Data Loading
   * ------------------------------------------------------------------ */
  const loadWantList = async () => {
    if (!userId) return;
    setLoadingWantList(true);
    const { data, error } = await getUserWantList(userId);
    if (error) {
      console.error(error);
    } else {
      setWantList(data);
    }
    setLoadingWantList(false);
  };
  
  const loadUpcomingShows = async () => {
    if (!userId) return;
    setLoadingShows(true);
    try {
      // Get shows the user is planning to attend
      const { data, error } = await getUpcomingShows({
        userId,
        // Filter for upcoming shows only
        startDate: new Date().toISOString(),
        // Optional: limit to next 30 days or similar
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      
      if (error) {
        console.error('Error fetching upcoming shows:', error);
      } else if (data) {
        setUpcomingShows(data);
      }
    } catch (error) {
      console.error('Error in loadUpcomingShows:', error);
    } finally {
      setLoadingShows(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      // Refresh each time screen comes into focus
      loadWantList();
      loadUpcomingShows();
    }, [userId])
  );

  // Render different content based on user role
  const renderContent = () => {
    // Check if user is a dealer or show organizer
    const isDealerOrOrganizer = 
      userRole === UserRole.DEALER || 
      userRole === UserRole.MVP_DEALER || 
      userRole === UserRole.SHOW_ORGANIZER;

    return (
      <View style={styles.contentContainer}>
        {isDealerOrOrganizer && (
          <View style={styles.dealerBanner}>
            <Text style={styles.dealerBannerText}>
              As a {userRole === UserRole.SHOW_ORGANIZER ? 'Show Organizer' : 'Dealer'}, 
              your want list is visible to other users at shows you're participating in.
            </Text>
          </View>
        )}
        
        <WantListEditor
          wantList={wantList}
          userId={userId}
          upcomingShows={upcomingShows}
          onSave={(list) => setWantList(list)}
          isLoading={loadingWantList || loadingShows}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Want List</Text>
      </View>

      {/* Content */}
      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  contentContainer: {
    flex: 1,
  },
  dealerBanner: {
    backgroundColor: '#e6f2ff',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0057B8',
  },
  dealerBannerText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});

export default CollectionScreen;
