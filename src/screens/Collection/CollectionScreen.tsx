import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// Domain / context / services
import { useAuth } from '../../contexts/AuthContext';
import {
  getUserWantList,
  createWantList,
  updateWantList,
  shareWantList,
} from '../../services/collectionService';
import { getUpcomingShows } from '../../services/showService';
// UI
import WantListEditor from '../../components/WantListEditor';

const CollectionScreen: React.FC = () => {
  // ===== Auth =====
  const {
    authState: { user },
  } = useAuth();
  const userId = user?.id ?? '';

  // ===== Want List State =====
  const [wantList, setWantList] = useState<any | null>(null); // Using 'any' for now
  const [loadingWantList, setLoadingWantList] = useState<boolean>(true);

  // ===== Upcoming Shows State =====
  const [upcomingShows, setUpcomingShows] = useState<any[]>([]); // Using 'any' for now
  const [loadingShows, setLoadingShows] = useState<boolean>(true);

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
        setUpcomingShows(data as any[]); // Cast to any[]
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
      if (userId) {
        loadWantList();
        loadUpcomingShows();
      }
    }, [userId])
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Want List</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <WantListEditor
          wantList={wantList}
          userId={userId}
          upcomingShows={upcomingShows}
          onSave={(list) => setWantList(list)}
          isLoading={loadingWantList || loadingShows}
        />
      </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
});

export default CollectionScreen;