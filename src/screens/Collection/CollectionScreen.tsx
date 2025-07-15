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
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

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

const CollectionScreen: React.FC = () => {
  // ===== Auth =====
  const {
    authState: { user },
  } = useAuth();
  const userId = user?.id ?? '';

  // ===== Want List State =====
  const [wantList, setWantList] = useState<any | null>(null); // Using 'any' for now
  const [loadingWantList, setLoadingWantList] = useState<boolean>(true);

  // ===== Dealer Inventory State =====
  const [inventoryContent, setInventoryContent] = useState<string>('');
  const [loadingInventory, setLoadingInventory] = useState<boolean>(true);
  const [savingInventory, setSavingInventory] = useState<boolean>(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  // ===== Upcoming Shows State =====
  const [upcomingShows, setUpcomingShows] = useState<any[]>([]); // Using 'any' for now
  const [loadingShows, setLoadingShows] = useState<boolean>(true);

  // ---------------- Dealer Inventory helpers ----------------
  const loadDealerInventory = async () => {
    if (!userId) return;
    setLoadingInventory(true);
    setInventoryError(null);
    
    try {
      // Instead of using dealer_inventories table, query want_lists with a type filter
      const { data, error } = await supabase
        .from('want_lists')
        .select('content')
        .eq('user_id', userId)
        .eq('type', 'inventory')
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors if no record exists

      if (error) {
        console.error('Error loading dealer inventory:', error);
        setInventoryError('Failed to load your inventory. Please try again.');
        // Set empty content so UI doesn't break
        setInventoryContent('');
        return;
      }

      // If data exists, set the content, otherwise use empty string
      setInventoryContent(data?.content ?? '');
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
      
      // Use the want_lists table with a type field to distinguish inventory entries
      const { error } = await supabase.from('want_lists').upsert(
        {
          user_id: userId,
          content: inventoryContent.trim(),
          type: 'inventory', // Add type field to distinguish from regular want lists
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,type' } // Handle conflict based on both user_id and type
      );
      
      if (error) {
        console.error('Error saving inventory:', error);
        throw error;
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
    try {
      // Make sure to get only regular want lists (not inventory)
      const { data, error } = await getUserWantList(userId);
      if (error) {
        console.error('Error loading want list:', error);
      } else {
        setWantList(data);
      }
    } catch (err) {
      console.error('Unexpected error loading want list:', err);
    } finally {
      setLoadingWantList(false);
    }
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Collection</Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
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
              available to all attendees.
            </Text>
          </View>
        )}

        {/* Want List – visible to everyone */}
        <WantListEditor
          wantList={wantList}
          userId={userId}
          upcomingShows={upcomingShows}
          onSave={(list) => setWantList(list)}
          isLoading={loadingWantList || loadingShows}
        />
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
  content: {
    flex: 1,
    padding: 16,
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
});

export default CollectionScreen;
