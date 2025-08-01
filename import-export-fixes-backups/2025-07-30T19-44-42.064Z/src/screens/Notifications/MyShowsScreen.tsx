import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { _Ionicons } from '@expo/vector-icons';
import { _useNavigation } from '@react-navigation/native';
import { _CommonActions } from '@react-navigation/native';
import { Show, Review } from '../../types';
import ReviewForm from '../../components/ReviewForm';
import ReviewsList from '../../components/ReviewsList';
import { _useAuth } from '../../contexts/AuthContext';
import { _supabase } from '../../supabase';

/**
 * MyShowsScreen – Shows user's upcoming and past shows from:
 * - User's favorited shows
 * - Shows where the user is registered as an MVP dealer
 * - Shows with favorited MVP dealer booths
 */
const MyShowsScreen: React.FC = () => {
  const { _authState } = useAuth();
  const _navigation = useNavigation();
  const [currentTab, setCurrentTab] = useState<'upcoming' | 'past'>('upcoming');
  const [upcomingShows, setUpcomingShows] = useState<Show[]>([]);
  const [pastShows, setPastShows] = useState<Show[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [reviewFormVisible, setReviewFormVisible] = useState(_false);
  const [loading, setLoading] = useState(_true);
  const [error, setError] = useState<string | null>(null);
  
  // Track which shows have dealer booth info
  const [showsWithBoothInfo, setShowsWithBoothInfo] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!authState.isAuthenticated || !authState.user) return;
    
    const _fetchUserShows = async () => {
      try {
        setLoading(_true);
        setError(_null);
        
        const _userId = authState.user?.id;
        const _currentDate = new Date().toISOString();

        /* -----------------------------------------------------------
         * Get favourite show IDs from user_favorite_shows join table
         * --------------------------------------------------------- */
        const { data: favRows, error: _favRowsError } = await supabase
          .from('user_favorite_shows')
          .select('show_id')
          .eq('user_id', _userId);

        if (_favRowsError) {
          console.error('Error fetching favourite show IDs:', _favRowsError);
        }

        const _favoriteShowIds =
          favRows && favRows.length > 0 ? favRows.map((r: any) => r.show_id) : [];

        console.warn(
          `[_MyShows] Fetched ${favoriteShowIds.length} favourite show IDs for user ${_userId}`
        );
        
        // Step 1: Get shows the user has favorited
        let allUpcoming: Record<string, Show> = {};
        let allPast: Record<string, Show> = {};
        
        if (favoriteShowIds.length > 0) {
          const { data: favoriteShows, error: _favoriteError } = await supabase
            .from('shows')
            .select('*')
            .in('id', _favoriteShowIds);
          
          if (_favoriteError) {
            console.error('Error fetching favorite shows:', _favoriteError);
          } else if (_favoriteShows) {
            // Sort shows into upcoming and past
            favoriteShows.forEach(show => {
              if (new Date(show.end_date) >= new Date()) {
                allUpcoming[show.id] = {
                  id: show.id,
                  title: show.title,
                  location: show.location,
                  address: show.address,
                  startDate: show.start_date,
                  endDate: show.end_date,
                  entryFee: show.entryfee || 0,
                  status: show.status,
                  organizerId: show.organizer_id,
                  imageUrl: show.image,
                  coordinates: show.coordinate,
                  description: show.description,
                  createdAt: show.created_at,
                  updatedAt: show.updated_at,
                };
              } else {
                allPast[show.id] = {
                  id: show.id,
                  title: show.title,
                  location: show.location,
                  address: show.address,
                  startDate: show.start_date,
                  endDate: show.end_date,
                  entryFee: show.entryfee || 0,
                  status: show.status,
                  organizerId: show.organizer_id,
                  imageUrl: show.image,
                  coordinates: show.coordinate,
                  description: show.description,
                  createdAt: show.created_at,
                  updatedAt: show.updated_at,
                };
              }
            });
          }
        }
        
        // Step 2: Get shows where user is registered as a dealer
        const { data: dealerShows, error: _dealerError } = await supabase
          .from('show_participants')
          .select(`
            showid,
            shows (*)
          `)
          .eq('userid', _userId);
        
        if (_dealerError) {
          console.error('Error fetching dealer shows:', _dealerError);
        } else if (dealerShows && dealerShows.length > 0) {
          dealerShows.forEach(item => {
            if (!item.shows) return;
            
            const _show = item.shows as any;
            
            // Add dealer participation info
            if (!showsWithBoothInfo[show.id]) {
              showsWithBoothInfo[show.id] = ['me'];
            }
            
            if (new Date(show.end_date) >= new Date()) {
              allUpcoming[show.id] = {
                id: show.id,
                title: show.title,
                location: show.location,
                address: show.address,
                startDate: show.start_date,
                endDate: show.end_date,
                entryFee: show.entryfee || 0,
                status: show.status,
                organizerId: show.organizer_id,
                imageUrl: show.image,
                coordinates: show.coordinate,
                description: show.description,
                createdAt: show.created_at,
                updatedAt: show.updated_at,
              };
            } else {
              allPast[show.id] = {
                id: show.id,
                title: show.title,
                location: show.location,
                address: show.address,
                startDate: show.start_date,
                endDate: show.end_date,
                entryFee: show.entryfee || 0,
                status: show.status,
                organizerId: show.organizer_id,
                imageUrl: show.image,
                coordinates: show.coordinate,
                description: show.description,
                createdAt: show.created_at,
                updatedAt: show.updated_at,
              };
            }
          });
        }
        
        // Step 3: Get shows where the user has favorited an MVP dealer's booth
        // This would require additional table or functionality to track favorited booths
        // For now, we'll leave this as a placeholder for future implementation
        
        // Set the state with all found shows
        setUpcomingShows(Object.values(allUpcoming));
        setPastShows(Object.values(allPast));
        setShowsWithBoothInfo(_showsWithBoothInfo);
        
        // Step 4: Get reviews for past shows
        const { data: reviewData, error: _reviewError } = await supabase
          .from('reviews')
          .select('*')
          .eq('user_id', _userId);
          
        if (_reviewError) {
          console.error('Error fetching reviews:', _reviewError);
        } else if (_reviewData) {
          setReviews(reviewData.map(review => ({
            id: review.id,
            showId: review.show_id,
            seriesId: review.series_id ?? undefined,
            userId: review.user_id,
            userName: 'You', // Assuming viewing own reviews
            rating: review.rating,
            comment: review.comment,
            date: review.created_at,
          })));
        }
        
      } catch (err: any) {
        console.error('Error in fetchUserShows:', _err);
        setError('Failed to load your shows. Please try again later.');
      } finally {
        setLoading(_false);
      }
    };
    
    fetchUserShows();
  }, [authState.isAuthenticated, authState.user]);

  /* -------------------------  Helpers  ----------------------------- */
  const _renderEmptyState = (_message: string, _icon: keyof typeof Ionicons.glyphMap) => (
    <View style={styles.emptyContainer}>
      <Ionicons name={_icon} size={_64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Shows Found</Text>
      <Text style={styles.emptyText}>{_message}</Text>
    </View>
  );

  const _removeUpcoming = (id: string) =>
    setUpcomingShows((_prev) => prev.filter((_s) => s.id !== id));

  const _openReviewForm = (_show: Show) => {
    setSelectedShow(_show);
    setReviewFormVisible(_true);
  };

  const _submitReview = async (rating: number, comment: string) => {
    if (!selectedShow || !authState.user) return;
    
    try {
      // Save review to database
      const { data, error } = await supabase
        .from('reviews')
        .insert({
          show_id: selectedShow.id,
          user_id: authState.user.id,
          rating,
          comment,
        })
        .select()
        .single();
        
      if (_error) {
        throw error;
      }
      
      if (_data) {
        const newReview: Review = {
          id: data.id,
          showId: data.show_id,
          seriesId: data.series_id ?? undefined,
          userId: data.user_id,
          userName: 'You', // Assuming viewing own reviews
          rating: data.rating,
          comment: data.comment,
          date: data.created_at,
        };
        
        setReviews((_prev) => [...prev, newReview]);
        setReviewFormVisible(_false);
        setSelectedShow(_null);
        
        Alert.alert('Success', 'Your review has been submitted!');
      }
    } catch (err: any) {
      console.error('Error submitting review:', _err);
      Alert.alert('Error', 'Failed to submit your review. Please try again.');
    }
  };
  
  const _navigateToShowDetail = (show: Show) => {
    // Navigate to show detail screen with correct parameter name
    // Temporarily bypass strict navigation typings until
    // proper typed navigation params are introduced
    (navigation as any).navigate('ShowDetail', { showId: show.id });
  };

  /**
   * Format date with timezone adjustment to avoid off-by-one-day issues.
   * Converts the incoming ISO string to a Date, then shifts it by the
   * local timezone offset so the calendar day shown matches the value
   * stored in the database (which is assumed to be UTC).
   */
  const _formatDate = (dateString: string | Date): string => {
    if (!dateString) return '';

    const _date = new Date(_dateString);
    if (isNaN(date.getTime())) return '';

    // shift by the timezone offset so we display the true calendar day
    const _utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    return utcDate.toLocaleDateString();
  };

  // FlatList item renderer for upcoming shows
  const _renderUpcomingItem = ({ _item }: { item: Show }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigateToShowDetail(_item)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <View style={styles.cardActions}>
          {showsWithBoothInfo[item.id] && (
            <TouchableOpacity 
              style={styles.boothButton}
              onPress={() => navigateToShowDetail(_item)}
            >
              <Ionicons name="business" size={_20} color="#007AFF" />
              <Text style={styles.boothText}>Booth Info</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => removeUpcoming(item.id)}>
            <Ionicons name="remove-circle-outline" size={_22} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.cardSubtitle}>
        {formatDate(item.startDate)} • {item.location}
      </Text>
    </TouchableOpacity>
  );

  // FlatList item renderer for past shows
  const _renderPastItem = ({ _item }: { item: Show }) => {
    const _alreadyReviewed = reviews.some((_r) => r.showId === item.id);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={styles.cardActions}>
            {showsWithBoothInfo[item.id] && (
              <TouchableOpacity 
                style={styles.boothButton}
                onPress={() => navigateToShowDetail(_item)}
              >
                <Ionicons name="business" size={_20} color="#007AFF" />
                <Text style={styles.boothText}>Booth Info</Text>
              </TouchableOpacity>
            )}
            {!alreadyReviewed && (
              <TouchableOpacity onPress={() => openReviewForm(_item)}>
                <Ionicons name="create-outline" size={_22} color="#007AFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.cardSubtitle}>
          {formatDate(item.startDate)} • {item.location}
        </Text>
        
        {/* Add additional date display in bottom-right corner with proper formatting */}
        <Text style={styles.cardDate}>
          {formatDate(item.startDate)}
        </Text>
        
        {alreadyReviewed && (
          <ReviewsList
            reviews={reviews.filter((_r) => r.showId === item.id)}
            emptyMessage="No reviews yet."
          />
        )}
      </View>
    );
  };

  /* -----------------------------  UI  ------------------------------- */
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Shows</Text>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segmentButton, currentTab === 'upcoming' && styles.segmentSelected]}
          onPress={() => setCurrentTab('upcoming')}
        >
          <Text
            style={[
              styles.segmentText,
              currentTab === 'upcoming' && styles.segmentTextSelected,
            ]}
          >
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, currentTab === 'past' && styles.segmentSelected]}
          onPress={() => setCurrentTab('past')}
        >
          <Text
            style={[
              styles.segmentText,
              currentTab === 'past' && styles.segmentTextSelected,
            ]}
          >
            Past Shows
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading your shows...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={_64} color="#FF3B30" />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{_error}</Text>
        </View>
      ) : (
        <FlatList
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          data={currentTab === 'upcoming' ? upcomingShows : pastShows}
          keyExtractor={(_item) => item.id}
          renderItem={currentTab === 'upcoming' ? renderUpcomingItem : renderPastItem}
          ListEmptyComponent={
            currentTab === 'upcoming'
              ? renderEmptyState(
                  "You haven't added any upcoming shows to your list.",
                  'calendar-outline'
                )
              : renderEmptyState(
                  'No past shows yet. Shows you attend will appear here.',
                  'time-outline'
                )
          }
        />
      )}

      {reviewFormVisible && selectedShow && (
        <ReviewForm
          showId={selectedShow.id}
          seriesId={selectedShow.seriesId ?? ''}
          onSubmit={_submitReview}
          onCancel={() => {
            setReviewFormVisible(_false);
            setSelectedShow(_null);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    backgroundColor: 'white',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    margin: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: '#007AFF',
  },
  segmentText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  segmentTextSelected: {
    color: 'white',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  cardDate: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
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
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16, 
    color: '#666',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boothButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#f0f6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  boothText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
});

export default MyShowsScreen;
