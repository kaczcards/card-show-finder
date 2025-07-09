import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// Domain / context / services
import { useAuth } from '../../contexts/AuthContext';
import {
  getUserCards,
  getUserWantList,
  createWantList,
  updateWantList,
  shareWantList,
} from '../../services/collectionService';
import { getUpcomingShows } from '../../services/showService';
import { UserCard, WantList, Show, UserRole } from '../../types';

// UI components
import WantListEditor from '../../components/WantListEditor';
import AttendeeWantLists from '../../components/AttendeeWantLists';

const CollectionScreen: React.FC = () => {
  // ===== Auth =====
  const {
    authState: { user },
  } = useAuth();
  const userId = user?.id ?? '';

  // ===== Selling List State =====
  const [sellingList, setSellingList] = useState<string>('');
  const [loadingSellingList, setLoadingSellingList] = useState<boolean>(true);
  const [savingSellingList, setSavingSellingList] = useState<boolean>(false);

  // ===== Want List State =====
  const [wantList, setWantList] = useState<WantList | null>(null);
  const [loadingWantList, setLoadingWantList] = useState<boolean>(true);
  
  // ===== Upcoming Shows State =====
  const [upcomingShows, setUpcomingShows] = useState<Show[]>([]);
  const [loadingShows, setLoadingShows] = useState<boolean>(true);

  // Check if user is MVP Dealer or Show Organizer
  const isAdvancedUser = user?.role === UserRole.MVP_DEALER || user?.role === UserRole.SHOW_ORGANIZER;
  const isAttendee = user?.role === UserRole.ATTENDEE;
  const isRegularDealer = user?.role === UserRole.DEALER;

  /* ------------------------------------------------------------------
   * Data Loading
   * ------------------------------------------------------------------ */
  const loadSellingList = async () => {
    if (!userId) return;
    setLoadingSellingList(true);
    
    try {
      // For now, we'll simulate loading selling list data
      // In a real implementation, you would fetch from a database
      setTimeout(() => {
        setSellingList(''); // Default empty selling list
        setLoadingSellingList(false);
      }, 500);
    } catch (error) {
      console.error('Error loading selling list:', error);
      setLoadingSellingList(false);
    }
  };

  const saveSellingList = async () => {
    if (!userId) return;
    setSavingSellingList(true);
    
    try {
      // For now, we'll simulate saving selling list data
      // In a real implementation, you would save to a database
      setTimeout(() => {
        Alert.alert('Success', 'Your selling list has been saved.');
        setSavingSellingList(false);
      }, 500);
    } catch (error) {
      console.error('Error saving selling list:', error);
      Alert.alert('Error', 'Failed to save your selling list.');
      setSavingSellingList(false);
    }
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
      loadSellingList();
      loadWantList();
      loadUpcomingShows();
    }, [userId])
  );

  // Render selling section with text box
  const renderSellingSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>What I'm Selling</Text>
        <Ionicons name="pricetags" size={22} color="#333" />
      </View>
      <View style={styles.sectionContent}>
        {loadingSellingList ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6A00" />
            <Text style={styles.loadingText}>Loading your selling list...</Text>
          </View>
        ) : (
          <View style={styles.textEditorContainer}>
            <Text style={styles.editorLabel}>
              List the cards and items you're selling at upcoming shows:
            </Text>
            <TextInput
              style={styles.textEditor}
              multiline
              placeholder="Example: 2021 Topps Chrome #1-100, 2020 Panini Prizm Basketball, Various PSA slabs..."
              value={sellingList}
              onChangeText={setSellingList}
              textAlignVertical="top"
            />
            <View style={styles.editorActions}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveSellingList}
                disabled={savingSellingList}
              >
                {savingSellingList ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Save Selling List</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  // Render want list section
  const renderWantListSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Want List</Text>
        <Ionicons name="list" size={22} color="#333" />
      </View>
      <View style={styles.sectionContent}>
        <WantListEditor
          wantList={wantList}
          userId={userId}
          upcomingShows={upcomingShows}
          onSave={(list) => setWantList(list)}
          isLoading={loadingWantList || loadingShows}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Collection</Text>
      </View>

      <ScrollView style={styles.scrollContainer}>
        {/* Render sections in the correct order based on user role */}
        {isAdvancedUser ? (
          // MVP Dealers and Show Organizers: Selling first, then Want List, then Attendee Want Lists
          <>
            {renderSellingSection()}
            {renderWantListSection()}
            
            {/* Role-based info note */}
            <View style={styles.infoNoteContainer}>
              <AttendeeWantLists />
            </View>
          </>
        ) : (
          // Attendees and Regular Dealers: Want List first, then Selling
          <>
            {renderWantListSection()}
            {renderSellingSection()}
            
            {/* Role-based info notes */}
            <View style={styles.infoNoteContainer}>
              {isAttendee && (
                <Text style={styles.infoNoteText}>
                  Note: Your lists are shared with MVP Dealers and Show Organizers to help you grow your collection.
                </Text>
              )}

              {isRegularDealer && (
                <>
                  <Text style={styles.infoNoteText}>
                    Note: Your lists are shared with MVP Dealers and Show Organizers to help you grow your collection.
                  </Text>
                  <Text style={styles.upgradeText}>
                    Upgrade to an MVP Dealer account to access attendee want lists and increase your sales at shows!
                  </Text>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
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
  scrollContainer: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionContent: {
    flex: 1,
  },
  infoNoteContainer: {
    backgroundColor: 'white',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoNoteText: {
    fontStyle: 'italic',
    color: '#444',
    marginBottom: 8,
  },
  upgradeText: {
    fontWeight: '600',
    color: '#c60',
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  loadingText: {
    marginTop: 12,
    color: '#666666',
    fontSize: 14,
  },
  textEditorContainer: {
    backgroundColor: 'white',
    padding: 16,
  },
  editorLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textEditor: {
    height: 150,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    textAlignVertical: 'top',
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6A00',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 6,
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
