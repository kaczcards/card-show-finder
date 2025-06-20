import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// Domain / context / services
import { useAuth } from '../../contexts/AuthContext';
import {
  getUserCards,
  addUserCard,
  updateUserCard,
  deleteUserCard,
  getUserWantList,
} from '../../services/collectionService';
import { getUpcomingShows } from '../../services/showService';
import { UserCard, WantList, Show } from '../../types';

// UI components
import CardGrid from '../../components/CardGrid';
import CardDetailModal from '../../components/CardDetailModal';
import WantListEditor from '../../components/WantListEditor';

enum TabType {
  CARDS = 'cards',
  WANT_LIST = 'wantlist',
}

const CollectionScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>(TabType.CARDS);

  // ===== Auth =====
  const {
    authState: { user },
  } = useAuth();
  const userId = user?.id ?? '';

  // ===== Card Collection State =====
  const [cards, setCards] = useState<UserCard[]>([]);
  const [loadingCards, setLoadingCards] = useState<boolean>(true);

  // Modal for add / edit
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCard, setModalCard] = useState<UserCard | null>(null);
  const isNewCard = modalCard == null;

  // ===== Want List State =====
  const [wantList, setWantList] = useState<WantList | null>(null);
  const [loadingWantList, setLoadingWantList] = useState<boolean>(true);
  
  // ===== Upcoming Shows State =====
  const [upcomingShows, setUpcomingShows] = useState<Show[]>([]);
  const [loadingShows, setLoadingShows] = useState<boolean>(true);

  // Button handlers
  const handleAddCard = () => {
    setModalCard(null);
    setModalVisible(true);
  };

  const handleCreateWantList = () => {
    // handled inside WantListEditor
  };

  /* ------------------------------------------------------------------
   * Data Loading
   * ------------------------------------------------------------------ */
  const loadCards = async () => {
    if (!userId) return;
    setLoadingCards(true);
    const { data, error } = await getUserCards(userId);
    if (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load your cards.');
    } else if (data) {
      setCards(data);
    }
    setLoadingCards(false);
  };

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
      loadCards();
      loadWantList();
      loadUpcomingShows();
    }, [userId])
  );

  /* ------------------------------------------------------------------
   * Card CRUD helpers
   * ------------------------------------------------------------------ */
  const saveCard = async (updated: Partial<UserCard>) => {
    if (!userId) return;
    if (isNewCard) {
      const { data, error } = await addUserCard(userId, updated as any);
      if (error) {
        Alert.alert('Error', error.message ?? 'Could not add card');
      } else if (data) {
        setCards((prev) => [data, ...prev]);
      }
    } else if (modalCard) {
      const { data, error } = await updateUserCard(modalCard.id, userId, updated);
      if (error) {
        Alert.alert('Error', error.message ?? 'Could not update card');
      } else if (data) {
        setCards((prev) => prev.map((c) => (c.id === data.id ? data : c)));
      }
    }
  };

  const removeCard = async (card: UserCard) => {
    if (!userId) return;
    const { success, error } = await deleteUserCard(card.id, userId);
    if (error || !success) {
      Alert.alert('Error', error?.message ?? 'Could not delete card');
      return;
    }
    setCards((prev) => prev.filter((c) => c.id !== card.id));
  };

  // Render cards tab content
  const renderCardsTab = () => (
    <View style={styles.tabContent}>
      <CardGrid
        cards={cards}
        onAddCard={handleAddCard}
        onCardPress={(card) => {
          setModalCard(card);
          setModalVisible(true);
        }}
        onCardLongPress={removeCard}
        isLoading={loadingCards}
      />

      {/* Add / Edit Modal */}
      <CardDetailModal
        visible={modalVisible}
        card={modalCard}
        onClose={() => setModalVisible(false)}
        onSave={saveCard}
        isNewCard={isNewCard}
      />
    </View>
  );

  // Render want list tab content
  const renderWantListTab = () => (
    <View style={styles.tabContent}>
      <WantListEditor
        wantList={wantList}
        userId={userId}
        upcomingShows={upcomingShows}
        onSave={(list) => setWantList(list)}
        isLoading={loadingWantList || loadingShows}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Collection</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === TabType.CARDS && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab(TabType.CARDS)}
        >
          <Ionicons
            name={activeTab === TabType.CARDS ? 'images' : 'images-outline'}
            size={20}
            color={activeTab === TabType.CARDS ? '#007AFF' : '#666'}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === TabType.CARDS && styles.activeTabButtonText,
            ]}
          >
            My Cards
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === TabType.WANT_LIST && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab(TabType.WANT_LIST)}
        >
          <Ionicons
            name={activeTab === TabType.WANT_LIST ? 'list' : 'list-outline'}
            size={20}
            color={activeTab === TabType.WANT_LIST ? '#007AFF' : '#666'}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === TabType.WANT_LIST && styles.activeTabButtonText,
            ]}
          >
            Want List
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === TabType.CARDS ? renderCardsTab() : renderWantListTab()}
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 4,
  },
  activeTabButtonText: {
    color: '#007AFF',
  },
  tabContent: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 400,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 6,
  },
});

export default CollectionScreen;
