import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

// Domain / context / services
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import {
  getUserWantList as _getUserWantList,
  createWantList as _createWantList,
  updateWantList as _updateWantList,
  shareWantList as _shareWantList,
} from '../../services/collectionService';
import { getUpcomingShows } from '../../services/showService';
import { supabase } from '../../supabase';
// UI
import WantListEditor from '../../components/WantListEditor';
import AttendeeWantLists from '../../components/AttendeeWantLists';

/**
 * DealerInventoryEditor
 * ---------------------
 * Memoized component that renders the dealer / organizer "What I Sell" editor.
 * Extracted from the previous inline renderDealerInventorySection function to
 * keep a stable component identity and avoid unnecessary re-renders that could
 * steal TextInput focus.
 */
const DealerInventoryEditor = React.memo(
  ({
    value,
    onChange,
    loading,
    saving,
    error,
    onRetry,
    onSave,
  }: {
    value: string;
    onChange: (text: string) => void;
    loading: boolean;
    saving: boolean;
    error: string | null;
    onRetry: () => void;
    onSave: () => void;
  }) => {
    return (
      <View style={styles.editorContainer}>
        <Text style={styles.sectionTitle}>What I Sell</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading your inventory...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TextInput
              key="dealer-inventory-input"
              style={styles.textInput}
              multiline
              placeholder="List the products you typically carry…"
              value={value}
              onChangeText={onChange}
              editable={!saving && !loading}
              blurOnSubmit={false}
              autoCorrect={false}
              autoCapitalize="none"
              underlineColorAndroid="transparent"
              textAlignVertical="top"
              placeholderTextColor="#999"
            />
            <View style={{ height: 8 }} />
            <TouchableOpacity
              style={[
                styles.saveButtonWrapper,
                saving && styles.saveButtonDisabled,
              ]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }
);

/**
 * CollectionHeader
 * ----------------
 * Top-level memoized header component that renders the dealer inventory editor,
 * want-list editor, teaser, and any error/setup states. Extracted out of the
 * CollectionScreen render tree so its identity is stable across renders and
 * will not cause the TextInput to remount.
 */
interface CollectionHeaderProps {
  userRole: UserRole | undefined;
  isPrivileged: boolean;
  wantList: any | null;
  userId: string;
  upcomingShows: any[];
  loadingWantList: boolean;
  loadingShows: boolean;
  wantListError: string | null;
  showsError: string | null;
  inventoryValue: string;
  onInventoryChange: (text: string) => void;
  loadingInventory: boolean;
  savingInventory: boolean;
  inventoryError: string | null;
  onRetryInventory: () => void;
  onSaveInventory: () => void;
  onNavigateToSubscription: () => void;
  hasDatabaseIssues: () => boolean;
}

const CollectionHeader: React.FC<CollectionHeaderProps> = React.memo(
  ({
    userRole,
    isPrivileged,
    wantList,
    userId,
    upcomingShows,
    loadingWantList,
    loadingShows,
    wantListError,
    showsError,
    inventoryValue,
    onInventoryChange,
    loadingInventory,
    savingInventory,
    inventoryError,
    onRetryInventory,
    onSaveInventory,
    onNavigateToSubscription,
    hasDatabaseIssues,
  }) => {
    return (
      <View style={styles.headerContent}>
        {/* Dealer / Organizer Inventory Editor */}
        {(userRole === UserRole.DEALER ||
          userRole === UserRole.MVP_DEALER ||
          userRole === UserRole.SHOW_ORGANIZER) && (
          <DealerInventoryEditor
            value={inventoryValue}
            onChange={onInventoryChange}
            loading={loadingInventory}
            saving={savingInventory}
            error={inventoryError}
            onRetry={onRetryInventory}
            onSave={onSaveInventory}
          />
        )}

        {/* Upgrade Tease for regular dealers */}
        {userRole === UserRole.DEALER && (
          <View style={styles.teaseContainer}>
            <Text style={styles.teaseText}>
              Upgrade to an MVP Dealer account to have what you're selling
              available to all attendees.{' '}
              <Text
                style={styles.teaseLink}
                onPress={onNavigateToSubscription}
              >
                Tap to upgrade now
              </Text>
            </Text>
          </View>
        )}

        {/* Want List Error */}
        {wantListError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{wantListError}</Text>
          </View>
        )}

        {/* Shows Error */}
        {showsError && !isPrivileged && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{showsError}</Text>
          </View>
        )}

        {/* Want List Editor */}
        <WantListEditor
          wantList={wantList}
          userId={userId}
          upcomingShows={isPrivileged ? [] : upcomingShows}
          onSave={() => {}}
          isLoading={loadingWantList || loadingShows}
        />

        {/* Setup message if DB issues for privileged */}
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
  }
);

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
  const [inventoryContent, setInventoryContent] = useState<string>(''); // Server copy
  const [inventoryInput, setInventoryInput] = useState<string>(''); // Local input buffer
  const [inventoryLoaded, setInventoryLoaded] = useState<boolean>(false);
  const inventoryDirtyRef = useRef<boolean>(false);
  const [loadingInventory, setLoadingInventory] = useState<boolean>(true);
  const [savingInventory, setSavingInventory] = useState<boolean>(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventoryId, setInventoryId] = useState<string | null>(null);

  // ===== Upcoming Shows State =====
  const [upcomingShows, setUpcomingShows] = useState<any[]>([]); // Using 'any' for now
  const [loadingShows, setLoadingShows] = useState<boolean>(true);
  const [showsError, setShowsError] = useState<string | null>(null);
  
  // ===== Role helpers =====
  const isPrivileged =
    user?.role === UserRole.MVP_DEALER ||
    user?.role === UserRole.SHOW_ORGANIZER;

  // ===== Navigation Handlers =====
  const handleNavigateToSubscription = () => {
    // Navigate directly to the subscription screen; nested params not required
    navigation.navigate('My Profile' as never);
  };

  // Helper to check if there are database issues
  const hasDatabaseIssues = () => {
    // Check if any of the database-related functions encountered errors
    return !!(wantListError || showsError || inventoryError);
  };

  // Stable callback for inventory change
  const handleInventoryChange = useCallback((text: string) => {
    setInventoryInput(text);
    inventoryDirtyRef.current = true;
  }, []);

  // ---------------- Dealer Inventory helpers ----------------
  const loadDealerInventory = async () => {
    if (!userId) return;
    setLoadingInventory(true);
    setInventoryError(null);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('dealer_specialties')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error loading dealer inventory:', error);
        setInventoryError('Failed to load your inventory. Please try again.');
        // Set empty content so UI doesn't break
        setInventoryContent('');
        return;
      }
      
      // Compute fetched string from dealer_specialties array
      const fetched = (data?.dealer_specialties || []).join(', ');
      
      // Always update server copy
      setInventoryContent(fetched);
      
      // Only update input if user hasn't made changes
      if (!inventoryDirtyRef.current) {
        setInventoryInput(fetched);
      }
      
      setInventoryLoaded(true);
      setInventoryId(null);
    } catch (err) {
      console.error('Error loading dealer inventory:', err);
      setInventoryError('An unexpected error occurred. Please try again.');
      setInventoryContent('');
      if (!inventoryDirtyRef.current) {
        setInventoryInput('');
      }
    } finally {
      setLoadingInventory(false);
    }
  };

  const saveDealerInventory = async () => {
    if (!userId) return;
    setInventoryError(null);
    
    try {
      setSavingInventory(true);
      
      // Parse content into specialties array - use inventoryInput instead of inventoryContent
      const specialtiesArray = inventoryInput
        .split(/[\n,]+/)
        .map(item => item.trim())
        .filter(Boolean);
      
      // Dedupe while preserving casing/order of first occurrence
      const seen = new Set<string>();
      const uniqueSpecialties = specialtiesArray.filter(item => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      const { data, error } = await supabase
        .from('profiles')
        .update({
          dealer_specialties: uniqueSpecialties,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('dealer_specialties')
        .single();
      
      if (error) {
        console.error('Error saving inventory:', error);
        throw error;
      }
      
      // Update both copies with normalized data
      const savedJoined = (data?.dealer_specialties || []).join(', ');
      setInventoryContent(savedJoined);
      setInventoryInput(savedJoined);
      inventoryDirtyRef.current = false;
      
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
      // Fetch the user's single (regular) want-list row, if any
      const { data, error } = await supabase
        .from('want_lists')
        .select('*')
        .eq('userid', userId)
        .maybeSingle();

      if (error) {
        console.error('Error loading want list:', error);
        setWantListError(error.message || 'Failed to load your want list');
        return;
      }

      if (data) {
        // Transform to the shape expected by <WantListEditor>
        setWantList({
          id: data.id,
          userId: data.userid,
          content: data.content || '',
          createdAt: data.createdat,
          updatedAt: data.updatedat,
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
  // -------------------- render --------------------

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Collection</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={{ flex: 1 }}>
          <CollectionHeader
            userRole={user?.role}
            isPrivileged={isPrivileged}
            wantList={wantList}
            userId={userId}
            upcomingShows={upcomingShows}
            loadingWantList={loadingWantList}
            loadingShows={loadingShows}
            wantListError={wantListError}
            showsError={showsError}
            inventoryValue={inventoryInput}
            onInventoryChange={handleInventoryChange}
            loadingInventory={loadingInventory}
            savingInventory={savingInventory}
            inventoryError={inventoryError}
            onRetryInventory={loadDealerInventory}
            onSaveInventory={saveDealerInventory}
            onNavigateToSubscription={handleNavigateToSubscription}
            hasDatabaseIssues={hasDatabaseIssues}
          />

          {isPrivileged && !hasDatabaseIssues() && (
            <View style={{ flex: 1 }}>
              <AttendeeWantLists
                userId={userId}
                userRole={user?.role}
                shows={upcomingShows}
              />
            </View>
          )}
        </View>
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
