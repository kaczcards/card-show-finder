import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ShowSeries, Show } from '../types';
import { showSeriesService } from '../services/showSeriesService';

// Default placeholder shown when a show has no custom image
const placeholderShowImage = require('../../assets/images/placeholder-show.png');

interface OrganizerShowsListProps {
  organizerId: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export interface OrganizerShowsListRef {
  refetch: () => Promise<void>;
}

interface SeriesWithShows {
  series: ShowSeries;
  shows: Show[];
  upcomingCount: number;
  nextShow?: Show | null;
}

const OrganizerShowsList = forwardRef<OrganizerShowsListRef, OrganizerShowsListProps>(({
  organizerId,
  onRefresh,
  isRefreshing = false
}, ref) => {
  const navigation = useNavigation();
  
  // State variables
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [seriesList, setSeriesList] = useState<SeriesWithShows[]>([]);
  const [standaloneShows, setStandaloneShows] = useState<Show[]>([]);
  const [expandedSeries, setExpandedSeries] = useState<Record<string, boolean>>({});
  
  // Fetch organizer's shows using useCallback
  const fetchOrganizerShows = useCallback(async () => {
    if (!organizerId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get all series owned by this organizer
      const mySeries = await showSeriesService.getAllShowSeries({ 
        organizerId 
      });
      
      // Process each series to get its shows
      const seriesWithShowsPromises = mySeries.map(async (series) => {
        const showsInSeries = await showSeriesService.getShowsInSeries(series.id);
        
        // Count upcoming shows and find the next show
        const now = new Date();
        const upcomingShows = showsInSeries.filter(show => 
          new Date(show.startDate) > now
        );
        
        // Sort upcoming shows by date
        upcomingShows.sort((a, b) => 
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );
        
        return {
          series,
          shows: showsInSeries,
          upcomingCount: upcomingShows.length,
          nextShow: upcomingShows.length > 0 ? upcomingShows[0] : null
        };
      });
      
      const seriesWithShows = await Promise.all(seriesWithShowsPromises);
      
      // Sort series by next upcoming show date
      seriesWithShows.sort((a, b) => {
        if (!a.nextShow && !b.nextShow) return 0;
        if (!a.nextShow) return 1;
        if (!b.nextShow) return -1;
        return new Date(a.nextShow.startDate).getTime() - new Date(b.nextShow.startDate).getTime();
      });
      
      setSeriesList(seriesWithShows);
      
      // Get standalone shows (not part of any series)
      // For now, we'll assume all shows are part of a series
      setStandaloneShows([]);
      
      // Initialize expanded state for all series
      const initialExpandedState: Record<string, boolean> = {};
      seriesWithShows.forEach(item => {
        initialExpandedState[item.series.id] = false;
      });
      setExpandedSeries(initialExpandedState);
      
    } catch (err) {
      console.error('Error fetching organizer shows:', err);
      setError('Failed to load your shows. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [organizerId]);
  
  // Expose the refetch function to parent components
  useImperativeHandle(ref, () => ({
    refetch: fetchOrganizerShows
  }));
  
  // Initial data fetch
  useEffect(() => {
    fetchOrganizerShows();
  }, [fetchOrganizerShows]);
  
  // Toggle series expansion
  const toggleSeriesExpansion = (seriesId: string) => {
    setExpandedSeries(prev => ({
      ...prev,
      [seriesId]: !prev[seriesId]
    }));
  };
  
  // Format date for display
  const formatShowDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Navigate to edit show
  const handleEditShow = (show: Show) => {
    navigation.navigate('EditShow', { showId: show.id });
  };
  
  // Navigate to send message
  const handleSendMessage = (show: Show) => {
    navigation.navigate('SendBroadcast', { 
      showId: show.id,
      seriesId: show.seriesId
    });
  };
  
  // Handle canceling a show
  const handleCancelShow = (show: Show) => {
    // To be implemented - show confirmation dialog and call API
    console.log('Cancel show:', show.id);
  };
  
  // Navigate to series details
  const handleViewSeries = (series: ShowSeries) => {
    navigation.navigate('SeriesDetail', { seriesId: series.id });
  };
  
  // Render a show item
  const renderShowItem = (show: Show) => {
    const isPastShow = new Date(show.endDate) < new Date();
    
    return (
      <View style={[
        styles.showItem,
        isPastShow && styles.pastShowItem
      ]}>
        <View style={styles.showHeader}>
          <Text style={styles.showDate}>{formatShowDate(show.startDate)}</Text>
          {isPastShow && (
            <View style={styles.pastBadge}>
              <Text style={styles.pastBadgeText}>Past</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.showTitle}>{show.title}</Text>
        <Text style={styles.showLocation}>{show.location}</Text>
        
        <View style={styles.showActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleEditShow(show)}
          >
            <Ionicons name="create-outline" size={16} color="#0057B8" />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleSendMessage(show)}
          >
            <Ionicons name="mail-outline" size={16} color="#0057B8" />
            <Text style={styles.actionButtonText}>Message</Text>
          </TouchableOpacity>
          
          {!isPastShow && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => handleCancelShow(show)}
            >
              <Ionicons name="close-circle-outline" size={16} color="#FF3B30" />
              <Text style={[styles.actionButtonText, styles.cancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };
  
  // Render a series item with its shows
  const renderSeriesItem = ({ item }: { item: SeriesWithShows }) => {
    const { series, shows, upcomingCount, nextShow } = item;
    const isExpanded = expandedSeries[series.id] || false;
    
    return (
      <View style={styles.seriesContainer}>
        {/* Series Header */}
        <TouchableOpacity 
          style={styles.seriesHeader}
          onPress={() => toggleSeriesExpansion(series.id)}
        >
          <View style={styles.seriesInfo}>
            <Text style={styles.seriesName}>{series.name}</Text>
            <View style={styles.seriesStats}>
              <View style={styles.statItem}>
                <Ionicons name="calendar" size={14} color="#666666" style={styles.statIcon} />
                <Text style={styles.statText}>
                  {shows.length} {shows.length === 1 ? 'show' : 'shows'}
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Ionicons name="time" size={14} color="#666666" style={styles.statIcon} />
                <Text style={styles.statText}>
                  {upcomingCount} upcoming
                </Text>
              </View>
              
              {series.averageRating && (
                <View style={styles.statItem}>
                  <Ionicons name="star" size={14} color="#FFD700" style={styles.statIcon} />
                  <Text style={styles.statText}>
                    {series.averageRating.toFixed(1)}
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.seriesActions}>
            <TouchableOpacity 
              style={styles.viewSeriesButton}
              onPress={() => handleViewSeries(series)}
            >
              <Text style={styles.viewSeriesText}>View Series</Text>
            </TouchableOpacity>
            
            <Ionicons 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={24} 
              color="#666666" 
            />
          </View>
        </TouchableOpacity>
        
        {/* Next Show Preview (if not expanded) */}
        {!isExpanded && nextShow && (
          <View style={styles.nextShowPreview}>
            <View style={styles.nextShowHeader}>
              <Ionicons name="calendar" size={16} color="#0057B8" style={styles.nextShowIcon} />
              <Text style={styles.nextShowLabel}>Next Show:</Text>
              <Text style={styles.nextShowDate}>{formatShowDate(nextShow.startDate)}</Text>
            </View>
            
            <Text style={styles.nextShowTitle}>{nextShow.title}</Text>
            <Text style={styles.nextShowLocation}>{nextShow.location}</Text>
            
            <View style={styles.showActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleEditShow(nextShow)}
              >
                <Ionicons name="create-outline" size={16} color="#0057B8" />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleSendMessage(nextShow)}
              >
                <Ionicons name="mail-outline" size={16} color="#0057B8" />
                <Text style={styles.actionButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* Expanded Shows List */}
        {isExpanded && (
          <View style={styles.expandedShowsList}>
            {shows.length > 0 ? (
              shows.map(show => (
                <View key={show.id}>
                  {renderShowItem(show)}
                </View>
              ))
            ) : (
              <Text style={styles.noShowsText}>No shows in this series yet.</Text>
            )}
            
            <TouchableOpacity 
              style={styles.addShowButton}
              onPress={() => navigation.navigate('AddShow', { seriesId: series.id })}
            >
              <Ionicons name="add-circle" size={16} color="#FFFFFF" style={styles.addShowIcon} />
              <Text style={styles.addShowText}>Add Show to Series</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };
  
  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6A00" />
        <Text style={styles.loadingText}>Loading your shows...</Text>
      </View>
    );
  }
  
  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={40} color="#FF6A00" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={fetchOrganizerShows}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Empty state
  if (seriesList.length === 0 && standaloneShows.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Image 
          source={placeholderShowImage} 
          style={styles.emptyImage}
          resizeMode="contain"
        />
        <Text style={styles.emptyTitle}>No Shows Yet</Text>
        <Text style={styles.emptyText}>
          You haven't claimed any shows or created any series yet.
        </Text>
        <TouchableOpacity 
          style={styles.createShowButton}
          onPress={() => navigation.navigate('AddShow')}
        >
          <Text style={styles.createShowText}>Create Your First Show</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Render the list of series and standalone shows
  return (
    <FlatList
      data={seriesList}
      renderItem={renderSeriesItem}
      keyExtractor={item => item.series.id}
      contentContainerStyle={styles.listContainer}
      ListHeaderComponent={
        standaloneShows.length > 0 ? (
          <View style={styles.standaloneHeader}>
            <Text style={styles.standaloneTitle}>Individual Shows</Text>
          </View>
        ) : null
      }
      ListFooterComponent={
        standaloneShows.length > 0 ? (
          <View style={styles.standaloneShows}>
            {standaloneShows.map(show => (
              <View key={show.id}>
                {renderShowItem(show)}
              </View>
            ))}
          </View>
        ) : null
      }
      refreshing={isRefreshing}
      onRefresh={onRefresh || fetchOrganizerShows}
    />
  );
});

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
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
  seriesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  seriesHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  seriesInfo: {
    flex: 1,
  },
  seriesName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  seriesStats: {
    flexDirection: 'row',
    alignItems: 'center',
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
  seriesActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewSeriesButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F0F7FF',
    borderRadius: 16,
    marginRight: 8,
  },
  viewSeriesText: {
    fontSize: 12,
    color: '#0057B8',
    fontWeight: '500',
  },
  nextShowPreview: {
    padding: 16,
    backgroundColor: '#F9FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  nextShowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  nextShowIcon: {
    marginRight: 6,
  },
  nextShowLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#0057B8',
    marginRight: 6,
  },
  nextShowDate: {
    fontSize: 12,
    color: '#666666',
  },
  nextShowTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  nextShowLocation: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  expandedShowsList: {
    padding: 16,
    backgroundColor: '#F9FAFC',
  },
  showItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  pastShowItem: {
    borderLeftColor: '#9E9E9E',
    opacity: 0.8,
  },
  showHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  showDate: {
    fontSize: 12,
    color: '#666666',
  },
  pastBadge: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  pastBadgeText: {
    fontSize: 10,
    color: '#666666',
  },
  showTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  showLocation: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  showActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F0F7FF',
    borderRadius: 16,
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#0057B8',
    fontWeight: '500',
    marginLeft: 4,
  },
  cancelButton: {
    backgroundColor: '#FFEEEE',
  },
  cancelButtonText: {
    color: '#FF3B30',
  },
  noShowsText: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 16,
  },
  addShowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0057B8',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  addShowIcon: {
    marginRight: 6,
  },
  addShowText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  standaloneHeader: {
    marginBottom: 12,
  },
  standaloneTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  standaloneShows: {
    marginTop: 8,
  },
});

export default OrganizerShowsList;
