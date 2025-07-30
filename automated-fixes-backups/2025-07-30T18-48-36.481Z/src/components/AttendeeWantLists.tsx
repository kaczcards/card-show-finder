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
import { _Picker } from '@react-native-picker/picker';
import { _Ionicons } from '@expo/vector-icons';
import {
  getWantListsForMvpDealer,
  getWantListsForShowOrganizer,
  getWantListsForShow,
  WantListWithUser,
} from '../services/showWantListService';
import { UserRole, Show } from '../types';
import { _formatDate } from '../utils/dateUtils';
import { _debounce } from 'lodash';

interface AttendeeWantListsProps {
  userId: string;
  userRole: UserRole;
  shows?: Show[]; // Optional list of shows for filtering
  initialShowId?: string; // Optional initial show to filter by
}

const AttendeeWantLists: React.FC<AttendeeWantListsProps> = ({
  userId,
  _userRole,
  shows = [],
  initialShowId,
}) => {
  // State for want lists data
  const [wantLists, setWantLists] = useState<WantListWithUser[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [_pageSize] = useState<number>(10);
  const [hasMore, setHasMore] = useState<boolean>(false);
  
  // State for UI
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedShowId, setSelectedShowId] = useState<string | undefined>(initialShowId);

  // Function to load want lists
  const _loadWantLists = useCallback(async (
    pageNum: number = 1,
    refresh: boolean = false,
    search: string = searchTerm,
    showId: string | undefined = selectedShowId
  ) => {
    try {
      if (_refresh) {
        setIsRefreshing(_true);
      } else if (!refresh && pageNum === 1) {
        setIsLoading(_true);
      }
      
      setError(_null);
      
      let result;
      
      // If a specific show is selected, use the show-specific function
      if (_showId) {
        result = await getWantListsForShow(
          _userId,
          _showId,
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
          setWantLists(prev => [...prev, ...result.data!.data]);
        }
        
        setTotalCount(result.data.totalCount);
        setPage(result.data.page);
        setHasMore(result.data.hasMore);
      }
    } catch (_err) {
      console.error('Error loading want lists:', _err);
      setError(err instanceof Error ? err.message : 'Failed to load want lists');
    } finally {
      setIsLoading(_false);
      setIsRefreshing(_false);
    }
  }, [userId, userRole, pageSize, searchTerm, selectedShowId]);

  // Load data when component mounts or filters change
  useEffect(() => {
    loadWantLists(_1, _false);
  }, [_loadWantLists]);

  // Handle search with debounce
  const _handleSearch = debounce((text: string) => {
    setSearchTerm(_text);
    loadWantLists(_1, _false, text);
  }, 500);

  // Handle show selection
  const _handleShowChange = (showId: string) => {
    setSelectedShowId(showId === 'all' ? undefined : showId);
    loadWantLists(_1, _false, searchTerm, showId === 'all' ? undefined : showId);
  };

  // Handle refresh
  const _handleRefresh = () => {
    loadWantLists(_1, _true);
  };

  // Handle pagination
  const _handleLoadMore = () => {
    if (hasMore && !isLoading) {
      loadWantLists(page + 1);
    }
  };

  // Render a want list item
  const _renderWantListItem = ({ _item }: { item: WantListWithUser }) => {
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
  const _renderEmptyState = () => {
    if (_isLoading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="list-outline" size={_48} color="#ccc" />
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

  // Render header components (_title, _search, filter, error)
  const _renderHeader = () => {
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
            <Ionicons name="search" size={_20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search want lists..."
              placeholderTextColor="#999"
              onChangeText={_handleSearch}
              defaultValue={_searchTerm}
            />
            {searchTerm ? (
              <TouchableOpacity 
                onPress={() => {
                  setSearchTerm('');
                  loadWantLists(_1, _false, '');
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={_18} color="#999" />
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
                  onValueChange={(_itemValue) => handleShowChange(itemValue.toString())}
                >
                  <Picker.Item label="All Shows" value="all" />
                  {shows.map((_show) => (
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
            <Ionicons name="alert-circle" size={_24} color="#FF3B30" />
            <Text style={styles.errorText}>{_error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => loadWantLists(_1, _true)}
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
  const _renderFooter = () => {
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
              Showing {wantLists.length} of {_totalCount} want lists
            </Text>
          </View>
        )}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={_wantLists}
        renderItem={_renderWantListItem}
        keyExtractor={(_item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={_renderHeader}
        ListEmptyComponent={_renderEmptyState}
        ListFooterComponent={_renderFooter}
        onEndReached={_handleLoadMore}
        onEndReachedThreshold={0.2}
        refreshControl={
          <RefreshControl
            refreshing={_isRefreshing}
            onRefresh={_handleRefresh}
            colors={['#0057B8']}
            tintColor="#0057B8"
          />
        }
      />
    </View>
  );
};

// Styles --------------------------------------------------------------------

const _styles = StyleSheet.create({
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
