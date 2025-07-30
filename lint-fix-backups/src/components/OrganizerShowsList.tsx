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
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { ShowSeries, Show } from '../types';
import { showSeriesService } from '../services/showSeriesService';
import { supabase } from '../supabase';
import type { OrganizerStackParamList } from '../navigation/OrganizerNavigator';

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
  const navigation =
    useNavigation<NavigationProp<OrganizerStackParamList>>();
  
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
      console.log('[OrganizerShowsList] ➡️  Fetching organizer shows...');

      // 1️⃣  Get all series owned by this organizer
      const mySeries = await showSeriesService.getAllShowSeries({
        organizerId,
      });

      if (!Array.isArray(mySeries) || mySeries.length === 0) {
        console.log(
          `[OrganizerShowsList] Organizer ${organizerId} has no series.`,
        );
      }

      // 2️⃣  Process each series to get its shows – wrapped in try/catch
      const seriesWithShowsPromises = mySeries.map(async (series) => {
        try {
          if (!series?.id) {
            console.warn('[OrganizerShowsList] Series without ID detected:', series);
            return undefined;
          }
          
          const showsInSeries = await showSeriesService.getShowsInSeries(
            series.id,
          );
          
          if (!Array.isArray(showsInSeries)) {
            console.warn('[OrganizerShowsList] Invalid shows array for series:', series.id);
            return {
              series,
              shows: [],
              upcomingCount: 0,
              nextShow: null
            };
          }
        
          // Count upcoming shows and find the next show
          const now = new Date();
          const upcomingShows = showsInSeries.filter(show => 
            show?.startDate && new Date(show.startDate) > now
          );
          
          // Sort upcoming shows by date
          upcomingShows.sort((a, b) => {
            if (!a?.startDate) return 1;
            if (!b?.startDate) return -1;
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          });
          
          return {
            series,
            shows: showsInSeries,
            upcomingCount: upcomingShows.length,
            nextShow: upcomingShows.length > 0 ? upcomingShows[0] : null
          };
        } catch (seriesErr) {
          console.error(
            '[OrganizerShowsList] Error while processing series:',
            series?.id,
            seriesErr,
          );
          // Return undefined so we can filter it out later
          return undefined;
        }
      });

      // 3️⃣  Await all series promises – keep successes, log failures
      const settled = await Promise.allSettled(seriesWithShowsPromises);
      const seriesWithShows: SeriesWithShows[] = [];

      settled.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          seriesWithShows.push(result.value);
        } else if (result.status === 'rejected') {
          console.error(
            '[OrganizerShowsList] Promise rejected for series index',
            idx,
            result.reason,
          );
        }
      });
      
      // Sort series by next upcoming show date with defensive checks
      try {
        seriesWithShows.sort((a, b) => {
          // Guard against undefined items
          if (!a || !b) return 0;
          
          // Guard against missing nextShow properties
          if (!a.nextShow && !b.nextShow) return 0;
          if (!a.nextShow) return 1;
          if (!b.nextShow) return -1;
          
          // Guard against missing startDate properties
          if (!a.nextShow.startDate) return 1;
          if (!b.nextShow.startDate) return -1;
          
          // Safe comparison
          return new Date(a.nextShow.startDate).getTime() - new Date(b.nextShow.startDate).getTime();
        });
      } catch (sortErr) {
        console.error('[OrganizerShowsList] Error sorting series:', sortErr);
        // Continue with unsorted list rather than crashing
      }
      
      setSeriesList(seriesWithShows);
      
      // Get standalone shows (not part of any series)
      // Query for shows where series_id is null and organizer_id matches
      const { data: standaloneData, error: standaloneError } = await supabase
        .from('shows')
        .select('*')
        .eq('organizer_id', organizerId)
        .is('series_id', null)
        .order('start_date', { ascending: true });
      
      if (standaloneError) {
        console.error('Error fetching standalone shows:', standaloneError);
        throw new Error(`Failed to fetch standalone shows: ${standaloneError.message}`);
      }
      
      // Map the data to match the Show interface with robust null checks
      const mappedStandaloneShows = standaloneData?.map(show => {
        // Extract coordinates safely
        let coordinates;
        try {
          if (show.coordinates && 
              typeof show.coordinates === 'object' && 
              Array.isArray(show.coordinates.coordinates) && 
              show.coordinates.coordinates.length >= 2) {
            coordinates = {
              latitude: Number(show.coordinates.coordinates[1]),
              longitude: Number(show.coordinates.coordinates[0])
            };
            
            // Validate coordinates are actual numbers
            if (isNaN(coordinates.latitude) || isNaN(coordinates.longitude)) {
              console.warn('[OrganizerShowsList] Invalid coordinate values:', show.coordinates);
              coordinates = undefined;
            }
          }
        } catch (coordErr) {
          console.error('[OrganizerShowsList] Error parsing coordinates:', coordErr);
          coordinates = undefined;
        }
        
        return {
          id: show.id,
          seriesId: show.series_id,
          title: show.title || 'Untitled Show',
          description: show.description || '',
          location: show.location || 'No location specified',
          address: show.address || '',
          startDate: show.start_date,
          endDate: show.end_date,
          entryFee: show.entry_fee,
          imageUrl: show.image_url,
          rating: show.rating,
          coordinates,
          status: show.status,
          organizerId: show.organizer_id,
          features: show.features || [],
          categories: show.categories || [],
          createdAt: show.created_at,
          updatedAt: show.updated_at
        };
      }) || [];
      
      console.log(`[OrganizerShowsList] Fetched ${mappedStandaloneShows.length} standalone shows for organizer ${organizerId}`);
      setStandaloneShows(mappedStandaloneShows);
      
      // Initialize expanded state for all series
      const initialExpandedState: Record<string, boolean> = {};
      seriesWithShows.forEach(item => {
        /* ------------------------------------------------------------------
         * Defensive guard – in rare cases `item.series` (or its `id`) may be
         * undefined which caused "cannot convert undefined value to object".
         * We skip those and log a warning so we can investigate upstream data.
         * ----------------------------------------------------------------*/
        if (item?.series?.id) {
          initialExpandedState[item.series.id] = false;
        } else {
          console.warn(
            '[OrganizerShowsList] Skipping series without valid id:',
            item?.series
          );
        }
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
    if (!seriesId) {
      console.warn('[OrganizerShowsList] Attempted to toggle undefined seriesId');
      return;
    }
    
    setExpandedSeries(prev => ({
      ...prev,
      [seriesId]: !prev[seriesId]
    }));
  };
  
  // Format date for display
  const formatShowDate = (dateString: string | Date) => {
    if (!dateString) return 'Date not set';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } catch (err) {
      console.warn('[OrganizerShowsList] Error formatting date:', dateString, err);
      return 'Invalid date';
    }
  };
  
  // Navigate to edit show
  const handleEditShow = (show: Show) => {
    if (!show?.id) {
      console.warn('[OrganizerShowsList] Attempted to edit show without ID');
      return;
    }
    navigation.navigate('EditShow', { showId: show.id });
  };
  
  // Navigate to send message
  const handleSendMessage = (show: Show) => {
    if (!show?.id) {
      console.warn('[OrganizerShowsList] Attempted to send message for show without ID');
      return;
    }
    navigation.navigate('SendBroadcast', { 
      showId: show.id,
      seriesId: show.seriesId
    });
  };
  
  // Handle canceling a show
  const handleCancelShow = (show: Show) => {
    if (!show?.id) {
      console.warn('[OrganizerShowsList] Attempted to cancel show without ID');
      return;
    }
    // To be implemented - show confirmation dialog and call API
    console.log('Cancel show:', show.id);
  };
  
  // Navigate to series details
  const handleViewSeries = (series: ShowSeries) => {
    if (!series?.id) {
      console.warn('[OrganizerShowsList] Attempted to view series without ID');
      return;
    }
    navigation.navigate('SeriesDetail', { seriesId: series.id });
  };
  
  // Render a show item
  const renderShowItem = (show: Show) => {
    if (!show) {
      console.warn('[OrganizerShowsList] Attempted to render undefined show');
      return null;
    }
    
    const isPastShow = show.endDate && new Date(show.endDate) < new Date();
    
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
        
        <Text style={styles.showTitle}>{show.title || 'Untitled Show'}</Text>
        <Text style={styles.showLocation}>{show.location || 'No location'}</Text>
        
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
    // Guard against undefined item or series
    if (!item || !item.series) {
      console.warn('[OrganizerShowsList] Attempted to render undefined series item');
      return null;
    }
    
    // Safely extract properties with defaults
    const series = item.series;
    const shows = Array.isArray(item.shows) ? item.shows : [];
    const upcomingCount = item.upcomingCount || 0;
    const nextShow = item.nextShow;
    
    // Safely access expanded state
    const isExpanded = series.id ? (expandedSeries[series.id] || false) : false;
    
    return (
      <View style={styles.seriesContainer}>
        {/* Series Header */}
        <TouchableOpacity 
          style={styles.seriesHeader}
          onPress={() => series.id && toggleSeriesExpansion(series.id)}
          disabled={!series.id}
        >
          <View style={styles.seriesInfo}>
            <Text style={styles.seriesName}>{series.name || 'Unnamed Series'}</Text>
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
              disabled={!series.id}
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
            
            <Text style={styles.nextShowTitle}>{nextShow.title || 'Untitled Show'}</Text>
            <Text style={styles.nextShowLocation}>{nextShow.location || 'No location'}</Text>
            
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
              shows.map(show => show?.id ? (
                <View key={show.id}>
                  {renderShowItem(show)}
                </View>
              ) : null)
            ) : (
              <Text style={styles.noShowsText}>No shows in this series yet.</Text>
            )}
            
            {series.id && (
              <TouchableOpacity 
                style={styles.addShowButton}
                onPress={() => navigation.navigate('AddShow', { seriesId: series.id })}
              >
                <Ionicons name="add-circle" size={16} color="#FFFFFF" style={styles.addShowIcon} />
                <Text style={styles.addShowText}>Add Show to Series</Text>
              </TouchableOpacity>
            )}
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
          onPress={() => navigation.navigate('AddShow', {})}
        >
          <Text style={styles.createShowText}>Create Your First Show</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Render the list of series and standalone shows
  return (
    <FlatList
      /* ------------------------------------------------------------------
       * Use only series items that have a valid ID to avoid runtime errors
       * ----------------------------------------------------------------*/
      data={seriesList.filter(item => item?.series?.id)}
      renderItem={renderSeriesItem}
      keyExtractor={(item, index) =>
        item?.series?.id ?? `invalid-series-${index}`
      }
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
            {standaloneShows.map(show => show?.id ? (
              <View key={show.id}>
                {renderShowItem(show)}
              </View>
            ) : null)}
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
