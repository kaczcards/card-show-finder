import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

// Domain / context / services
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import {
  getUserWantList,
  createWantList,
  updateWantList,
  shareWantList,
} from '../../services/collectionService';
import { getUpcomingShows } from '../../services/showService';
import { supabase } from '../../supabase';
// UI
import WantListEditor from '../../components/WantListEditor';
import AttendeeWantLists from '../../components/AttendeeWantLists';

const INVENTORY_PREFIX = "[INVENTORY]";

const CollectionScreen: React.FC = () => {
  // ===== Navigation =====
  const navigation = useNavigation();

  // ===== Auth =====
  const {
    authState: { user },
  } = useAuth();
  const userId = user?.id ?? '';

  // ===== Want List State =====
  const [wantList, setWantList] = useState<any | null>(null); // Using 'any' for now
  const [loadingWantList, setLoadingWantList] = useState<boolean>(true);
  const [wantListError, setWantListError] = useState<string | null>(null);

  // ===== Dealer Inventory State =====
  const [inventoryContent, setInventoryContent] = useState<string>('');
  const [loadingInventory, setLoadingInventory] = useState<boolean>(true);
  const [savingInventory, setSavingInventory] = useState<boolean>(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventoryId, setInventoryId] = useState<string | null>(null);

  // ===== Upcoming Shows State =====
  const [upcomingShows, setUpcomingShows] = useState<any[]>([]); // Using 'any' for now
  const [loadingShows, setLoadingShows] = useState<boolean>(true);
  const [showsError, setShowsError] = useState<string | null>(null);
  
  // ===== FlatList Data =====
  // Single item array for the FlatList - we only need one AttendeeWantLists component
  const flatListData = user?.role === UserRole.MVP_DEALER || user?.role === UserRole.SHOW_ORGANIZER 
    ? [{ id: 'attendee-want-lists' }] 
    : [];

  // ===== Navigation Handlers =====
  const handleNavigateToSubscription = () => {
    navigation.navigate('My Profile', { 
      screen: 'SubscriptionScreen' 
    } as never);
  };

  // Helper to check if there are database issues
  const hasDatabaseIssues = () => {
    // Check if any of the database-related functions encountered errors
    return !!(wantListError || showsError || inventoryError);
  };

  // ---------------- Dealer Inventory helpers ----------------
  const loadDealerInventory = async () => {
    if (!userId) return;
    setLoadingInventory(true);
    setInventoryError(null);
    
    try {
      // Query all want_lists for this user
      const { data, error } = await supabase
        .from('want_lists')
        .select('id, content')
        .eq('userid', userId);

      if (error) {
        console.error('Error loading dealer inventory:', error);
        setInventoryError('Failed to load your inventory. Please try again.');
        // Set empty content so UI doesn't break
        setInventoryContent('');
        return;
      }

      // Find the one with the inventory prefix
      const inventoryItem = data?.find(item => 
        item.content && item.content.startsWith(INVENTORY_PREFIX)
      );
      
      if (inventoryItem) {
        // Remove the prefix for display
        setInventoryContent(inventoryItem.content.substring(INVENTORY_PREFIX.length));
        setInventoryId(inventoryItem.id);
      } else {
        setInventoryContent('');
        setInventoryId(null);
      }
    } catch (err) {
      console.error('Error loading dealer inventory:', err);
      setInventoryError('An unexpected error occurred. Please try again.');
      setInventoryContent('');
    } finally {
      setLoadingInventory(false);
    }
  };

  const saveDealerInventory = async () => {
    if (!userId) return;
    setInventoryError(null);
    
    try {
      setSavingInventory(true);
      
      // Add the inventory prefix to the content
      const contentWithPrefix = `${INVENTORY_PREFIX}${inventoryContent.trim()}`;
      
      let result;
      if (inventoryId) {
        // Update existing inventory
        result = await supabase.from('want_lists').update({
          content: contentWithPrefix,
          updatedat: new Date().toISOString(),
        })
        .eq('id', inventoryId)
        .eq('userid', userId);
      } else {
        // Create new inventory entry
        result = await supabase.from('want_lists').insert({
          userid: userId,
          content: contentWithPrefix,
          createdat: new Date().toISOString(),
          updatedat: new Date().toISOString(),
        })
        .select('id')
        .single();
        
        if (result.data) {
          setInventoryId(result.data.id);
        }
      }
      
      if (result.error) {
        console.error('Error saving inventory:', result.error);
        throw result.error;
      }
      
      Alert.alert('Success', 'Your inventory has been saved.');
    } catch (err) {
      console.error('Error saving inventory:', err);
      setInventoryError('Failed to save your inventory. Please try again.');
      Alert.alert('Error', 'Failed to save inventory. Please try again.');
    } finally {
      setSavingInventory(false);
    }
  };

  const loadWantList = async () => {
    if (!userId) return;
    setLoadingWantList(true);
    setWantListError(null);
    
    try {
      // Get want lists but filter out inventory items
      const { data, error } = await supabase
        .from('want_lists')
        .select('*')
        .eq('userid', userId);
        
      if (error) {
        console.error('Error loading want list:', error);
        setWantListError(error.message || 'Failed to load your want list');
        return;
      }
      
      // Find the first want list that doesn't have the inventory prefix
      const regularWantList = data?.find(item => 
        !item.content || !item.content.startsWith(INVENTORY_PREFIX)
      );
      
      if (regularWantList) {
        // Transform to match the expected format from getUserWantList
        setWantList({
          id: regularWantList.id,
          userId: regularWantList.userid,
          content: regularWantList.content || '',
          createdAt: regularWantList.createdat,
          updatedAt: regularWantList.updatedat
        });
      } else {
        setWantList(null);
      }
    } catch (err) {
      console.error('Unexpected error loading want list:', err);
      setWantListError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoadingWantList(false);
    }
  };

  const loadUpcomingShows = async () => {
    if (!userId) return;
    setLoadingShows(true);
    setShowsError(null);
    
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
        setShowsError(typeof error === 'string' ? error : 'Failed to load upcoming shows');
        setUpcomingShows([]);
      } else if (data) {
        setUpcomingShows(data as any[]); // Cast to any[]
      } else {
        setUpcomingShows([]);
      }
    } catch (error) {
      console.error('Error in loadUpcomingShows:', error);
      setShowsError(error instanceof Error ? error.message : 'An unexpected error occurred');
      setUpcomingShows([]);
    } finally {
      setLoadingShows(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      // Refresh each time screen comes into focus
      if (userId) {
        if (user?.role === UserRole.DEALER ||
            user?.role === UserRole.MVP_DEALER ||
            user?.role === UserRole.SHOW_ORGANIZER) {
          loadDealerInventory();
        }
        loadWantList();
        loadUpcomingShows();
      }
    }, [userId])
  );

  // ---------------- Render helpers ----------------
  const renderDealerInventorySection = () => (
    <View style={styles.editorContainer}>
      <Text style={styles.sectionTitle}>What I Sell</Text>
      
      {loadingInventory ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading your inventory...</Text>
        </View>
      ) : inventoryError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{inventoryError}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadDealerInventory}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder={'List the products you typically carry…'}
            value={inventoryContent}
            onChangeText={setInventoryContent}
            editable={!savingInventory}
            textAlignVertical="top"
            placeholderTextColor="#999"
          />
          <View style={{ height: 8 }} />
          <TouchableOpacity
            style={[styles.saveButtonWrapper, savingInventory && styles.saveButtonDisabled]}
            onPress={saveDealerInventory}
            disabled={savingInventory}
          >
            {savingInventory ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  // Render error message for want list
  const renderWantListError = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{wantListError}</Text>
      <TouchableOpacity 
        style={styles.retryButton}
        onPress={loadWantList}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  // Render error message for shows
  const renderShowsError = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{showsError}</Text>
      <TouchableOpacity 
        style={styles.retryButton}
        onPress={loadUpcomingShows}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
  
  // Render header for FlatList (all content before AttendeeWantLists)
  const renderHeader = useCallback(() => {
    const isPrivileged =
      user?.role === UserRole.MVP_DEALER ||
      user?.role === UserRole.SHOW_ORGANIZER;
      
    return (
      <View style={styles.headerContent}>
        {/* Dealer / Organizer specific UI */}
        {(user?.role === UserRole.DEALER ||
          user?.role === UserRole.MVP_DEALER ||
          user?.role === UserRole.SHOW_ORGANIZER) &&
          renderDealerInventorySection()}

        {/* Upgrade Tease for regular dealers */}
        {user?.role === UserRole.DEALER && (
          <View style={styles.teaseContainer}>
            <Text style={styles.teaseText}>
              Upgrade to an MVP Dealer account to have what you're selling
              available to all attendees.{' '}
              <Text 
                style={styles.teaseLink}
                onPress={handleNavigateToSubscription}
              >
                Tap to upgrade now
              </Text>
            </Text>
          </View>
        )}

        {/* Want List Error */}
        {wantListError && renderWantListError()}

        {/* Shows Error */}
        {showsError && !isPrivileged && renderShowsError()}

        {/* Want List Editor (sharing disabled for privileged roles) */}
        <WantListEditor
          wantList={wantList}
          userId={userId}
          upcomingShows={isPrivileged ? [] : upcomingShows}
          onSave={(list) => setWantList(list)}
          isLoading={loadingWantList || loadingShows}
        />
        
        {/* Show feature setup message if database issues exist for privileged users */}
        {isPrivileged && hasDatabaseIssues() && (
          <View style={styles.setupContainer}>
            <Text style={styles.setupTitle}>Attendee Want Lists</Text>
            <Text style={styles.setupText}>
              This feature is currently being set up. Please check back later.
            </Text>
            <Text style={styles.setupSubtext}>
              Our team is working to resolve database issues.
            </Text>
          </View>
        )}
      </View>
    );
  }, [
    user?.role, 
    wantList, 
    userId, 
    upcomingShows, 
    loadingWantList, 
    loadingShows, 
    wantListError, 
    showsError,
    inventoryContent,
    inventoryError,
    loadingInventory,
    savingInventory
  ]);
  
  // Render item for FlatList (AttendeeWantLists)
  const renderItem = useCallback(({ item }) => {
    const isPrivileged =
      user?.role === UserRole.MVP_DEALER ||
      user?.role === UserRole.SHOW_ORGANIZER;
      
    // Only render AttendeeWantLists if user is privileged and there are no database issues
    if (isPrivileged && !hasDatabaseIssues()) {
      return (
        <AttendeeWantLists
          userId={userId}
          userRole={user?.role}
          shows={upcomingShows}
        />
      );
    }
    
    // Return empty view if not privileged or there are database issues
    return null;
  }, [user?.role, userId, upcomingShows, hasDatabaseIssues]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Collection</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <FlatList
          data={flatListData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.flatListContent}
          keyboardShouldPersistTaps="handled"
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
  },
  headerContent: {
    padding: 16,
  },
  flatListContent: {
    flexGrow: 1,
  },
  /* ----- Shared / editor styles (mirrors WantListEditor) ----- */
  editorContainer: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 150,
    fontSize: 16,
    color: '#333',
  },
  saveButtonWrapper: {
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#99C9FF',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  /* ----- MVP Tease ----- */
  teaseContainer: {
    backgroundColor: '#FFF7E6',
    borderLeftWidth: 4,
    borderLeftColor: '#FFA500',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
  },
  teaseText: {
    color: '#AA6500',
    fontSize: 14,
    lineHeight: 20,
  },
  teaseLink: {
    color: '#FF6A00',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  /* ----- Loading and Error states ----- */
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    minHeight: 150,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  /* ----- Setup Message ----- */
  setupContainer: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
  },
  setupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  setupText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  setupSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default CollectionScreen;
