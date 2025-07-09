import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Show, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getUpcomingShows } from '../services/showService';
import { getSharedWantListsForDealer } from '../services/collectionService';

interface AttendeeWantList {
  id: string;
  sharedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName?: string;
  };
  wantList: {
    id: string;
    content: string;
    updatedAt: string;
  } | null;
}

const AttendeeWantLists: React.FC = () => {
  const { authState } = useAuth();
  const user = authState?.user;
  
  // State variables
  const [shows, setShows] = useState<Show[]>([]);
  const [selectedShowId, setSelectedShowId] = useState<string>('');
  const [wantLists, setWantLists] = useState<AttendeeWantList[]>([]);
  const [filteredWantLists, setFilteredWantLists] = useState<AttendeeWantList[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  
  // Loading states
  const [loadingShows, setLoadingShows] = useState<boolean>(true);
  const [loadingWantLists, setLoadingWantLists] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Check if user is authorized (MVP Dealer or Show Organizer)
  const isAuthorized = user?.role === UserRole.MVP_DEALER || user?.role === UserRole.SHOW_ORGANIZER;
  
  // Fetch shows the dealer/organizer is registered for
  const fetchShows = async () => {
    if (!user?.id) return;
    
    try {
      setLoadingShows(true);
      setError(null);
      
      const { data, error } = await getUpcomingShows({
        userId: user.id,
        // Include current and upcoming shows
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Include shows from yesterday
      });
      
      if (error) {
        throw new Error(error);
      }
      
      if (data) {
        setShows(data);
        // Select the first show by default if available
        if (data.length > 0 && !selectedShowId) {
          setSelectedShowId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching shows:', err);
      setError('Failed to load shows. Please try again.');
    } finally {
      setLoadingShows(false);
    }
  };
  
  // Fetch attendee want lists for the selected show
  const fetchWantLists = async () => {
    if (!user?.id || !selectedShowId) return;
    
    try {
      setLoadingWantLists(true);
      setError(null);
      
      const { data, error } = await getSharedWantListsForDealer(user.id, selectedShowId);
      
      if (error) {
        throw new Error(error);
      }
      
      if (data) {
        setWantLists(data);
        setFilteredWantLists(data);
      }
    } catch (err) {
      console.error('Error fetching want lists:', err);
      setError('Failed to load attendee want lists. Please try again.');
    } finally {
      setLoadingWantLists(false);
      setRefreshing(false);
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    if (isAuthorized) {
      fetchShows();
    }
  }, [user?.id, isAuthorized]);
  
  // Fetch want lists when selected show changes
  useEffect(() => {
    if (selectedShowId) {
      fetchWantLists();
    }
  }, [selectedShowId]);
  
  // Filter want lists based on search text
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredWantLists(wantLists);
      return;
    }
    
    const searchTermLower = searchText.toLowerCase();
    const filtered = wantLists.filter(item => {
      // Search in user name
      const userName = `${item.user.firstName} ${item.user.lastName || ''}`.toLowerCase();
      if (userName.includes(searchTermLower)) return true;
      
      // Search in want list content
      if (item.wantList?.content.toLowerCase().includes(searchTermLower)) return true;
      
      return false;
    });
    
    setFilteredWantLists(filtered);
  }, [searchText, wantLists]);
  
  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchShows().then(() => fetchWantLists());
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  
  // Render a want list item
  const renderWantListItem = ({ item }: { item: AttendeeWantList }) => {
    const userName = `${item.user.firstName} ${item.user.lastName || ''}`;
    const hasWantList = !!item.wantList;
    
    return (
      <View style={styles.wantListItem}>
        <View style={styles.wantListHeader}>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.sharedDate}>Shared: {formatDate(item.sharedAt)}</Text>
        </View>
        
        {hasWantList ? (
          <>
            <Text style={styles.wantListContent} numberOfLines={3}>
              {item.wantList.content}
            </Text>
            
            <TouchableOpacity 
              style={styles.viewDetailsButton}
              onPress={() => {
                // Show full want list in an alert for now
                // In a real app, you might want to navigate to a detail screen
                Alert.alert(
                  `${userName}'s Want List`,
                  item.wantList.content,
                  [{ text: 'Close' }]
                );
              }}
            >
              <Text style={styles.viewDetailsText}>View Full List</Text>
              <Ionicons name="chevron-forward" size={16} color="#0057B8" />
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.noWantListText}>
            This attendee has shared their profile but hasn't created a want list yet.
          </Text>
        )}
      </View>
    );
  };
  
  // If user is not authorized, show access denied message
  if (!isAuthorized) {
    return (
      <View style={styles.unauthorizedContainer}>
        <Ionicons name="lock-closed" size={48} color="#FF6A00" />
        <Text style={styles.unauthorizedTitle}>Access Restricted</Text>
        <Text style={styles.unauthorizedText}>
          Attendee want lists are only available to MVP Dealers and Show Organizers.
          Upgrade your account to access this feature.
        </Text>
      </View>
    );
  }
  
  // Loading state for initial shows fetch
  if (loadingShows && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6A00" />
        <Text style={styles.loadingText}>Loading your shows...</Text>
      </View>
    );
  }
  
  // Error state
  if (error && !refreshing) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={40} color="#FF6A00" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={handleRefresh}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // No shows available
  if (shows.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={48} color="#CCCCCC" />
        <Text style={styles.emptyTitle}>No Shows Found</Text>
        <Text style={styles.emptyText}>
          You need to be registered for upcoming shows to access attendee want lists.
          Register for shows to connect with attendees and grow your business.
        </Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Show Selection Dropdown */}
      <View style={styles.dropdownContainer}>
        <Text style={styles.dropdownLabel}>Select a Show:</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedShowId}
            onValueChange={(itemValue) => setSelectedShowId(itemValue)}
            style={styles.picker}
          >
            {shows.map(show => (
              <Picker.Item 
                key={show.id} 
                label={`${show.title} (${formatDate(show.startDate)})`} 
                value={show.id} 
              />
            ))}
          </Picker>
        </View>
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or card..."
          value={searchText}
          onChangeText={setSearchText}
          clearButtonMode="while-editing"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Ionicons name="close-circle" size={20} color="#666666" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Want Lists */}
      {loadingWantLists && !refreshing ? (
        <View style={styles.loadingListContainer}>
          <ActivityIndicator size="large" color="#FF6A00" />
          <Text style={styles.loadingText}>Loading attendee want lists...</Text>
        </View>
      ) : filteredWantLists.length > 0 ? (
        <FlatList
          data={filteredWantLists}
          renderItem={renderWantListItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh} 
              colors={["#FF6A00"]}
            />
          }
          ListHeaderComponent={
            <Text style={styles.resultsCount}>
              {filteredWantLists.length} {filteredWantLists.length === 1 ? 'attendee' : 'attendees'} found
            </Text>
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.emptyListContainer}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh} 
              colors={["#FF6A00"]}
            />
          }
        >
          <Ionicons name="list-outline" size={48} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>No Want Lists Found</Text>
          <Text style={styles.emptyText}>
            {searchText.length > 0 
              ? "No want lists match your search criteria. Try different keywords."
              : "No attendees have shared their want lists for this show yet."}
          </Text>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    backgroundColor: '#F9F9F9',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  resultsCount: {
    fontSize: 14,
    color: '#666666',
    padding: 16,
    paddingBottom: 8,
  },
  listContainer: {
    paddingBottom: 20,
  },
  wantListItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    margin: 16,
    marginTop: 0,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  wantListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  sharedDate: {
    fontSize: 12,
    color: '#999999',
  },
  wantListContent: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
    marginBottom: 12,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F0F7FF',
    borderRadius: 16,
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#0057B8',
    marginRight: 4,
  },
  noWantListText: {
    fontSize: 14,
    color: '#999999',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingListContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666666',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 12,
    marginBottom: 16,
    color: '#FF6A00',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#0057B8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 300,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  unauthorizedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  unauthorizedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 16,
    marginBottom: 8,
  },
  unauthorizedText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
});

export default AttendeeWantLists;
