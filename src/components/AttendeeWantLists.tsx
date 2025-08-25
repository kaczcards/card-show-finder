import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import {
  getWantListsForMvpDealer,
  getWantListsForShowOrganizer,
  getWantListsForShow,
  WantListWithUser,
} from '../services/showWantListService';
import { UserRole, Show } from '../types';
import { formatDate } from '../utils/dateUtils';
import { debounce } from 'lodash';

interface AttendeeWantListsProps {
  userId: string;
  userRole: UserRole;
  shows?: Show[]; // Optional list of shows for filtering
  initialShowId?: string; // Optional initial show to filter by
}

const AttendeeWantLists: React.FC<AttendeeWantListsProps> = ({
  userId,
  userRole,
  shows = [],
  initialShowId,
}) => {
  // State for want lists data
  const [wantLists, setWantLists] = useState<WantListWithUser[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [hasMore, setHasMore] = useState<boolean>(false);
  
  // State for UI
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedShowId, setSelectedShowId] = useState<string | undefined>(initialShowId);

  // Function to load want lists
  const loadWantLists = useCallback(async (
    pageNum: number = 1,
    refresh: boolean = false,
    search: string = searchTerm,
    showId: string | undefined = selectedShowId
  ) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else if (!refresh && pageNum === 1) {
        setIsLoading(true);
      }
      
      setError(null);
      
      let result;
      
      // If a specific show is selected, use the show-specific function
      if (showId) {
        result = await getWantListsForShow(
          userId,
          showId,
          pageNum,
          pageSize,
          search
        );
      } else if (userRole === UserRole.MVP_DEALER) {
        // Get want lists for MVP Dealer
        result = await getWantListsForMvpDealer({
          userId,
          page: pageNum,
          pageSize,
          searchTerm: search
        });
      } else if (userRole === UserRole.SHOW_ORGANIZER) {
        // Get want lists for Show Organizer
        result = await getWantListsForShowOrganizer({
          userId,
          page: pageNum,
          pageSize,
          searchTerm: search
        });
      } else {
        throw new Error('Unauthorized: Only MVP Dealers and Show Organizers can view want lists');
      }
      
      if (result.error) {
        throw result.error;
      }
      
      if (result.data) {
        if (pageNum === 1 || refresh) {
          // Replace data for first page or refresh
          setWantLists(result.data.data);
        } else {
          // Append data for pagination
          setWantLists(prev => {
            const existingKeys = new Set(
              prev.map((wl) => `${wl.id}:${wl.showId}`),
            );
            const merged = [...prev];
            result.data!.data.forEach((wl) => {
              const key = `${wl.id}:${wl.showId}`;
              if (!existingKeys.has(key)) {
                merged.push(wl);
                existingKeys.add(key);
              }
            });
            return merged;
          });
        }
        
        setTotalCount(result.data.totalCount);
        setPage(result.data.page);
        setHasMore(result.data.hasMore);
      }
    } catch (err) {
      console.error('Error loading want lists:', err);
      setError(err instanceof Error ? err.message : 'Failed to load want lists');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId, userRole, pageSize, searchTerm, selectedShowId]);

  // Load data when component mounts or filters change
  useEffect(() => {
    loadWantLists(1, false);
  }, [loadWantLists]);

  // Handle search with debounce
  const handleSearch = debounce((text: string) => {
    setSearchTerm(text);
    loadWantLists(1, false, text);
  }, 500);

  // Handle show selection
  const handleShowChange = (showId: string) => {
    setSelectedShowId(showId === 'all' ? undefined : showId);
    loadWantLists(1, false, searchTerm, showId === 'all' ? undefined : showId);
  };

  // Handle refresh
  const handleRefresh = () => {
    loadWantLists(1, true);
  };

  // Handle pagination
  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      loadWantLists(page + 1);
    }
  };

  // Render a want list item
  const renderWantListItem = ({ item }: { item: WantListWithUser }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.userName}</Text>
            <Text style={styles.userRole}>
              {item.userRole === UserRole.DEALER ? 'Dealer' : 
               item.userRole === UserRole.MVP_DEALER ? 'MVP Dealer' : 'Attendee'}
            </Text>
          </View>
          <View style={styles.showInfo}>
            <Text style={styles.showTitle}>{item.showTitle}</Text>
            <Text style={styles.showDate}>{formatDate(item.showStartDate)}</Text>
            <Text style={styles.showLocation}>{item.showLocation}</Text>
          </View>
        </View>
        
        <View style={styles.cardContent}>
          <Text style={styles.contentTitle}>Want List:</Text>
          <Text style={styles.content}>{item.content}</Text>
        </View>
        
        <View style={styles.cardFooter}>
          <Text style={styles.updatedText}>
            {/* Use proper DateTimeFormatOptions instead of boolean */}
            Updated: {formatDate(item.updatedAt, { dateStyle: 'short' })}
          </Text>
        </View>
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => {
    if (isLoading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="list-outline" size={48} color="#ccc" />
        <Text style={styles.emptyText}>No want lists found</Text>
        <Text style={styles.emptySubtext}>
          {searchTerm 
            ? 'Try a different search term'
            : selectedShowId
              ? 'No want lists for this show yet'
              : 'No want lists available for your shows'}
        </Text>
      </View>
    );
  };

  // Render header components (title, search, filter, error)
  const renderHeader = () => {
    return (
      <>
        {/* Header with title */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {userRole === UserRole.MVP_DEALER 
              ? 'Attendee Want Lists' 
              : 'Show Attendee Want Lists'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {userRole === UserRole.MVP_DEALER 
              ? 'See what attendees are looking for at your shows' 
              : 'See what attendees are looking for at your events'}
          </Text>
        </View>
        
        {/* Search and filter section */}
        <View style={styles.filterContainer}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search want lists..."
              placeholderTextColor="#999"
              onChangeText={handleSearch}
              defaultValue={searchTerm}
            />
            {searchTerm ? (
              <TouchableOpacity 
                onPress={() => {
                  setSearchTerm('');
                  loadWantLists(1, false, '');
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            ) : null}
          </View>
          
          {/* Show filter dropdown (only if multiple shows available) */}
          {shows.length > 1 && (
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Filter by Show:</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedShowId || 'all'}
                  style={styles.picker}
                  onValueChange={(itemValue) => handleShowChange(itemValue.toString())}
                >
                  <Picker.Item label="All Shows" value="all" />
                  {shows.map((show) => (
                    <Picker.Item 
                      key={show.id} 
                      label={show.title} 
                      value={show.id} 
                    />
                  ))}
                </Picker>
              </View>
            </View>
          )}
        </View>
        
        {/* Error message */}
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={24} color="#FF3B30" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => loadWantLists(1, true)}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        
        {/* Loading indicator for initial load */}
        {isLoading && page === 1 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0057B8" />
            <Text style={styles.loadingText}>Loading want lists...</Text>
          </View>
        ) : null}
      </>
    );
  };

  // Render footer (loading indicator for pagination and pagination info)
  const renderFooter = () => {
    return (
      <>
        {/* Loading indicator for pagination */}
        {hasMore && (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color="#0057B8" />
            <Text style={styles.footerText}>Loading more...</Text>
          </View>
        )}
        
        {/* Pagination info */}
        {wantLists.length > 0 && (
          <View style={styles.paginationInfo}>
            <Text style={styles.paginationText}>
              Showing {wantLists.length} of {totalCount} want lists
            </Text>
          </View>
        )}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={wantLists}
        renderItem={renderWantListItem}
        keyExtractor={(item) => `${item.id}:${item.showId}`}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.2}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#0057B8']}
            tintColor="#0057B8"
          />
        }
      />
    </View>
  );
};

// Styles --------------------------------------------------------------------

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
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  filterContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  pickerContainer: {
    marginTop: 8,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  picker: {
    height: 40,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#f9f9f9',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#eee',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  showInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  showTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0057B8',
    marginBottom: 2,
  },
  showDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  showLocation: {
    fontSize: 12,
    color: '#888',
  },
  cardContent: {
    padding: 16,
  },
  contentTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  content: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  cardFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#f9f9f9',
  },
  updatedText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 200,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  footerText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    minHeight: 200,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#666',
    marginTop: 12,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  errorContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFEEEE',
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginVertical: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  retryText: {
    color: 'white',
    fontWeight: '500',
  },
  paginationInfo: {
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: 'white',
  },
  paginationText: {
    fontSize: 12,
    color: '#666',
  },
});

export default AttendeeWantLists;
