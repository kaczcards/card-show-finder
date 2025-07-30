import React, { useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  Alert,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShowSeries, Show } from '../types';
import { showSeriesService } from '../services/showSeriesService';
import { claimShow } from '../services/organizerService';
import { useUnclaimedShows, UnclaimedItem } from '../hooks/useUnclaimedShows';

// Define the extended ShowSeries type with additional properties
interface ShowSeriesExtended extends ShowSeries {
  nextShowDate?: string | Date;
  showCount?: number;
  upcomingCount: number;
}

// Default placeholder image
const placeholderShowImage = require('../../assets/images/placeholder-show.png');

interface UnclaimedShowsListProps {
  organizerId: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onClaimSuccess?: () => void; // Callback when a show is successfully claimed
}

// Ref interface so parent components (e.g., Dashboard) can manually trigger a refetch
export interface UnclaimedShowsListRef {
  refetch: () => Promise<void>;
}

const UnclaimedShowsList = forwardRef<UnclaimedShowsListRef, UnclaimedShowsListProps>((props, ref) => {
  const { organizerId, onRefresh, isRefreshing = false, onClaimSuccess } = props;
  
  // Use the custom hook to fetch and manage unclaimed shows data
  const { 
    unclaimedItems, 
    isLoading, 
    error, 
    refreshUnclaimedShows 
  } = useUnclaimedShows(organizerId);
  
  // State for tracking which items are being claimed
  const [claimingInProgress, setClaimingInProgress] = useState<Record<string, boolean>>({});

  /**
   * Expose an imperative refetch method so parent components can force a data
   * refresh immediately after external actions (e.g. claiming a show).
   * We memoise it with useCallback to avoid re-creating the function on every
   * render which would break the ref identity.
   */
  const refetch = useCallback(async () => {
    await refreshUnclaimedShows();
  }, [refreshUnclaimedShows]);

  useImperativeHandle(ref, () => ({ refetch }), [refetch]);
  
  // Handle claiming a show or series
  const handleClaim = async (item: UnclaimedItem) => {
    // Basic validation – bail early if the payload is malformed
    if (!item || !item.type || !item.data) {
      console.warn('[UnclaimedShows] handleClaim called with invalid item', item);
      return;
    }

    const itemId = item.data.id;

    if (!itemId) {
      console.warn('[UnclaimedShows] Missing ID while claiming', item);
      return;
    }

    try {
      // Set claiming in progress for this item
      setClaimingInProgress(prev => ({ ...prev, [itemId]: true }));
      
      let result;
      if (item.type === 'series') {
        // Claim series
        result = await showSeriesService.claimShowSeries(itemId);
      } else {
        // Claim individual show
        result = await claimShow(itemId, organizerId);
      }
      
      // Type guard to check if the result has an error property
      if ('error' in result && result.error !== null) {
        // Error
        Alert.alert(
          'Claim Failed',
          result.error || `Failed to claim this ${item.type === 'series' ? 'series' : 'show'}.`,
          [{ text: 'OK' }]
        );
      } else {
        // Success - refresh the list to remove the claimed item
        refreshUnclaimedShows();
        
        // Show success message
        Alert.alert(
          'Success!',
          `You have successfully claimed this ${item.type === 'series' ? 'series' : 'show'}.`,
          [{ text: 'OK' }]
        );
        
        // Call success callback if provided
        if (onClaimSuccess) {
          onClaimSuccess();
        }
      }
    } catch (err: any) {
      console.error('Error claiming item:', err);
      Alert.alert(
        'Error',
        err.message || 'An unexpected error occurred. Please try again.'
      );
    } finally {
      // Guard – itemId may be undefined if earlier validation failed
      if (itemId) {
        setClaimingInProgress(prev => ({ ...prev, [itemId]: false }));
      }
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Render a series item
  const renderSeriesItem = (series: ShowSeriesExtended) => {
    if (!series) return null; // Safety-net: avoid rendering invalid data
    const isClaimingInProgress = claimingInProgress[series.id] || false;
    
    return (
      <View style={styles.itemContainer}>
        <View style={styles.itemHeader}>
          <View style={styles.seriesBadge}>
            <Text style={styles.seriesBadgeText}>Series</Text>
          </View>
          <Text style={styles.itemName}>{series.name}</Text>
        </View>
        
        <View style={styles.itemDetails}>
          {series.reviewCount ? (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingText}>
                {series.averageRating?.toFixed(1)} ({series.reviewCount})
              </Text>
            </View>
          ) : (
            <Text style={styles.noRatingsText}>No ratings yet</Text>
          )}
          
          {series.nextShowDate && (
            <View style={styles.nextShowContainer}>
              <Ionicons name="calendar-outline" size={16} color="#666666" style={styles.iconSpacing} />
              <Text style={styles.nextShowText}>
                Next: {formatDate(series.nextShowDate)}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.itemStats}>
          <View style={styles.statItem}>
            <Ionicons name="calendar" size={14} color="#666666" style={styles.statIcon} />
            <Text style={styles.statText}>
              {series.showCount || 0} {(series.showCount || 0) === 1 ? 'show' : 'shows'}
            </Text>
          </View>
          
          {series.upcomingCount > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="time" size={14} color="#666666" style={styles.statIcon} />
              <Text style={styles.statText}>
                {series.upcomingCount} upcoming
              </Text>
            </View>
          )}
        </View>
        
        <TouchableOpacity 
          style={[styles.claimButton, isClaimingInProgress && styles.claimButtonDisabled]}
          onPress={() => handleClaim({ type: 'series', data: series })}
          disabled={isClaimingInProgress}
        >
          {isClaimingInProgress ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="flag" size={16} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.claimButtonText}>Claim Series</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };
  
  // Render a show item
  const renderShowItem = (show: Show) => {
    if (!show) return null;
    const isClaimingInProgress = claimingInProgress[show.id] || false;
    
    return (
      <View style={styles.itemContainer}>
        <View style={styles.itemHeader}>
          <View style={styles.showBadge}>
            <Text style={styles.showBadgeText}>Show</Text>
          </View>
          <Text style={styles.itemName}>{show.title}</Text>
        </View>
        
        <Text style={styles.locationText}>{show.location}</Text>
        
        <View style={styles.itemDetails}>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={16} color="#666666" style={styles.iconSpacing} />
            <Text style={styles.dateText}>{formatDate(show.startDate)}</Text>
          </View>
          
          {show.rating ? (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingText}>{show.rating.toFixed(1)}</Text>
            </View>
          ) : (
            <Text style={styles.noRatingsText}>No ratings yet</Text>
          )}
        </View>
        
        <TouchableOpacity 
          style={[styles.claimButton, isClaimingInProgress && styles.claimButtonDisabled]}
          onPress={() => handleClaim({ type: 'show', data: show })}
          disabled={isClaimingInProgress}
        >
          {isClaimingInProgress ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="flag" size={16} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.claimButtonText}>Claim Show</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };
  
  // Render an item (either series or show)
  const renderItem = ({ item }: { item: UnclaimedItem }) => {
    if (!item || !item.data) return null;
    
    if (item.type === 'series') {
      return renderSeriesItem(item.data as ShowSeriesExtended);
    }
    
    if (item.type === 'show') {
      return renderShowItem(item.data as Show);
    }
    
    console.warn('[UnclaimedShows] Skipped rendering invalid item', item);
    return null;
  };
  
  // Loading state
  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6A00" />
        <Text style={styles.loadingText}>Finding unclaimed shows...</Text>
      </View>
    );
  }
  
  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={40} color="#FF6A00" />
        <Text style={styles.errorText}>{error.message || 'Failed to load unclaimed shows. Please try again.'}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={refreshUnclaimedShows}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Empty state
  if (unclaimedItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Image 
          source={placeholderShowImage} 
          style={styles.emptyImage}
          resizeMode="contain"
        />
        <Text style={styles.emptyTitle}>No Unclaimed Shows</Text>
        <Text style={styles.emptyText}>
          There are currently no unclaimed shows or series available for you to claim.
          Check back later or create your own show.
        </Text>
        <TouchableOpacity 
          style={styles.createShowButton}
          onPress={() => Alert.alert('Coming Soon', 'This feature is under development.')}
        >
          <Text style={styles.createShowText}>Create New Show</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Main content - list of unclaimed items
  return (
    <FlatList
      data={unclaimedItems}
      renderItem={renderItem}
      keyExtractor={(item, index) =>
        item.type === 'series'
          ? `series-${item.data.id ?? index}`
          : `show-${item.data.id ?? index}`
      }
      contentContainerStyle={styles.listContainer}
      refreshControl={
        <RefreshControl 
          refreshing={isRefreshing} 
          onRefresh={onRefresh || refreshUnclaimedShows} 
        />
      }
      ListHeaderComponent={
        <Text style={styles.listHeader}>
          Found {unclaimedItems.length} unclaimed {unclaimedItems.length === 1 ? 'item' : 'items'}
        </Text>
      }
    />
  );
});

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  listHeader: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  emptyImage: {
    width: 120,
    height: 120,
    opacity: 0.6,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  createShowButton: {
    backgroundColor: '#FF6A00',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  createShowText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  itemContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  seriesBadge: {
    backgroundColor: '#0057B8',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  seriesBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  showBadge: {
    backgroundColor: '#4CAF50',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  showBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
  },
  locationText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    color: '#666666',
  },
  nextShowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextShowText: {
    fontSize: 14,
    color: '#666666',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
    marginLeft: 4,
  },
  noRatingsText: {
    fontSize: 14,
    color: '#999999',
    fontStyle: 'italic',
  },
  itemStats: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statIcon: {
    marginRight: 4,
  },
  statText: {
    fontSize: 12,
    color: '#666666',
  },
  claimButton: {
    backgroundColor: '#0057B8',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  claimButtonDisabled: {
    backgroundColor: '#A0C4FF',
  },
  claimButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
  },
  buttonIcon: {
    marginRight: 8,
  },
  iconSpacing: {
    marginRight: 4,
  },
});

export default UnclaimedShowsList;
