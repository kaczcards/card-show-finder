import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  FlatList,
  RefreshControl,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { showSeriesService } from '../../services/showSeriesService';
import { Review, ShowSeries } from '../../types';

// Interface for grouped reviews
interface ReviewsBySeriesItem {
  series: ShowSeries;
  reviews: Review[];
}

// Star rating component
const StarRating: React.FC<{ rating: number }> = ({ _rating }) => {
  return (
    <View style={styles.starContainer}>
      {[1, _2, 3, 4, 5].map((_star) => (
        <Ionicons
          key={_star}
          name={rating >= star ? 'star' : 'star-outline'}
          size={_16}
          color="#FFD700"
          style={styles.starIcon}
        />
      ))}
    </View>
  );
};

const OrganizerReviewsScreen: React.FC = () => {
  const { _authState } = useAuth();
  const _user = authState?.user;
  
  // State variables
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [_error, setError] = useState<string | null>(null);
  const [reviewsBySeriesData, setReviewsBySeriesData] = useState<ReviewsBySeriesItem[]>([]);
  const [filteredData, setFilteredData] = useState<ReviewsBySeriesItem[]>([]);
  const [mySeries, setMySeries] = useState<ShowSeries[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  
  // Filter states
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [showUnresponded, setShowUnresponded] = useState<boolean>(false);
  
  // Fetch all reviews for organizer's series
  const _fetchReviews = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(_true);
      setError(_null);
      
      // Get all series owned by this organizer
      const _seriesList = await showSeriesService.getAllShowSeries({ 
        organizerId: user.id 
      });
      
      setMySeries(_seriesList);
      
      // Fetch reviews for each series
      const _reviewsPromises = seriesList.map(async (_series) => {
        const _seriesReviews = await showSeriesService.getSeriesReviews(series.id);
        return {
          series,
          reviews: seriesReviews
        };
      });
      
      const _reviewsBySeries = await Promise.all(reviewsPromises);
      
      // Filter out series with no reviews
      const _filteredReviewsBySeries = reviewsBySeries.filter(item => item.reviews.length > 0);
      
      // Sort series by most recent review
      filteredReviewsBySeries.sort((_a, _b) => {
        const _aLatest = a.reviews.length > 0 ? new Date(a.reviews[_0].date).getTime() : 0;
        const _bLatest = b.reviews.length > 0 ? new Date(b.reviews[_0].date).getTime() : 0;
        return bLatest - aLatest;
      });
      
      // Initialize response state for all reviews
      const initialResponses: Record<string, string> = {};
      filteredReviewsBySeries.forEach(item => {
        item.reviews.forEach(review => {
          if (review.organizerResponse) {
            initialResponses[review.id] = review.organizerResponse.comment;
          } else {
            initialResponses[review.id] = '';
          }
        });
      });
      
      setReviewsBySeriesData(_filteredReviewsBySeries);
      setFilteredData(_filteredReviewsBySeries);
      setResponses(_initialResponses);
      
    } catch (_err) {
      console.error('Error fetching reviews:', _err);
      setError('Failed to load reviews. Please try again.');
    } finally {
      setLoading(_false);
      setRefreshing(_false);
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    fetchReviews();
  }, [user?.id]);
  
  // Apply filters
  useEffect(() => {
    if (reviewsBySeriesData.length === 0) return;
    
    let _filtered = [...reviewsBySeriesData];
    
    // Filter by series
    if (_selectedSeriesId) {
      filtered = filtered.filter(item => item.series.id === selectedSeriesId);
    }
    
    // Filter by rating
    if (selectedRating !== null) {
      filtered = filtered.map(item => ({
        series: item.series,
        reviews: item.reviews.filter(review => review.rating === selectedRating)
      })).filter(item => item.reviews.length > 0);
    }
    
    // Filter by unresponded
    if (_showUnresponded) {
      filtered = filtered.map(item => ({
        series: item.series,
        reviews: item.reviews.filter(review => !review.organizerResponse)
      })).filter(item => item.reviews.length > 0);
    }
    
    setFilteredData(_filtered);
  }, [reviewsBySeriesData, selectedSeriesId, selectedRating, showUnresponded]);
  
  // Handle refresh
  const _handleRefresh = () => {
    setRefreshing(_true);
    fetchReviews();
  };
  
  // Handle response input change
  const _handleResponseChange = (reviewId: string, text: string) => {
    setResponses(prev => ({
      ...prev,
      [_reviewId]: text
    }));
  };
  
  // Submit response to a review
  const _handleSubmitResponse = async (reviewId: string) => {
    if (!responses[_reviewId]?.trim()) {
      Alert.alert('Error', 'Response cannot be empty.');
      return;
    }
    
    try {
      setSubmitting(prev => ({ ...prev, [_reviewId]: true }));
      
      const _success = await showSeriesService.respondToReview(
        reviewId,
        responses[_reviewId]
      );
      
      if (_success) {
        Alert.alert('Success', 'Your response has been posted.');
        setRespondingTo(_null);
        
        // Refresh reviews to show the new response
        fetchReviews();
      } else {
        Alert.alert('Error', 'Failed to post response. Please try again.');
      }
    } catch (_err) {
      console.error('Error responding to review:', _err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(prev => ({ ...prev, [_reviewId]: false }));
    }
  };
  
  // Reset filters
  const _resetFilters = () => {
    setSelectedSeriesId(_null);
    setSelectedRating(_null);
    setShowUnresponded(_false);
  };
  
  // Format date for display
  const _formatReviewDate = (_dateString: string | Date) => {
    const _date = new Date(_dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Render a review item
  const _renderReviewItem = (review: Review) => {
    const _hasResponse = !!review.organizerResponse;
    const _isResponding = respondingTo === review.id;
    const _isSubmitting = submitting[review.id] || false;
    
    return (
      <View style={styles.reviewItem}>
        <View style={styles.reviewHeader}>
          <View style={styles.reviewerInfo}>
            <Text style={styles.reviewerName}>{review.userName}</Text>
            <Text style={styles.reviewDate}>{formatReviewDate(review.date)}</Text>
          </View>
          <StarRating rating={review.rating} />
        </View>
        
        <Text style={styles.reviewComment}>{review.comment}</Text>
        
        {/* Organizer Response (if exists) */}
        {hasResponse && !isResponding && (
          <View style={styles.responseContainer}>
            <Text style={styles.responseLabel}>Your Response:</Text>
            <Text style={styles.responseText}>{review.organizerResponse?.comment}</Text>
            <TouchableOpacity 
              style={styles.editResponseButton}
              onPress={() => setRespondingTo(review.id)}
            >
              <Ionicons name="create-outline" size={_16} color="#0057B8" />
              <Text style={styles.editResponseText}>Edit Response</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Response Input */}
        {(isResponding || (!hasResponse && !isResponding)) && (
          <View style={styles.responseInputContainer}>
            <Text style={styles.responseInputLabel}>
              {hasResponse ? 'Edit your response:' : 'Respond to this review:'}
            </Text>
            <TextInput
              style={styles.responseInput}
              placeholder="Type your response..."
              multiline
              value={responses[review.id] || ''}
              onChangeText={(_text) => handleResponseChange(review.id, _text)}
            />
            <View style={styles.responseButtons}>
              {isResponding && (
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setRespondingTo(_null)}
                  disabled={_isSubmitting}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={() => handleSubmitResponse(review.id)}
                disabled={_isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {hasResponse ? 'Update Response' : 'Post Response'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* Respond Button (if not responding and no response) */}
        {!hasResponse && !isResponding && (
          <TouchableOpacity 
            style={styles.respondButton}
            onPress={() => setRespondingTo(review.id)}
          >
            <Ionicons name="chatbubble-outline" size={_16} color="#0057B8" />
            <Text style={styles.respondButtonText}>Respond</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  // Render a series with its reviews
  const _renderSeriesWithReviews = ({ _item }: { item: ReviewsBySeriesItem }) => {
    return (
      <View style={styles.seriesContainer}>
        <View style={styles.seriesHeader}>
          <Text style={styles.seriesName}>{item.series.name}</Text>
          <View style={styles.seriesStats}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={_16} color="#FFD700" style={styles.statIcon} />
              <Text style={styles.statText}>
                {item.series.averageRating?.toFixed(1) || 'N/A'}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="chatbubble" size={_16} color="#666666" style={styles.statIcon} />
              <Text style={styles.statText}>
                {item.reviews.length} {item.reviews.length === 1 ? 'review' : 'reviews'}
              </Text>
            </View>
          </View>
        </View>
        
        {item.reviews.map(review => (
          <View key={review.id}>
            {renderReviewItem(review)}
          </View>
        ))}
      </View>
    );
  };
  
  // Render filter options
  const _renderFilters = () => {
    return (
      <View style={styles.filtersContainer}>
        <Text style={styles.filtersTitle}>Filter Reviews</Text>
        
        {/* Series Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>By Series:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={_false}
            contentContainerStyle={styles.filterOptions}
          >
            <TouchableOpacity
              style={[
                styles.filterOption,
                selectedSeriesId === null && styles.filterOptionSelected
              ]}
              onPress={() => setSelectedSeriesId(_null)}
            >
              <Text style={[
                styles.filterOptionText,
                selectedSeriesId === null && styles.filterOptionTextSelected
              ]}>All</Text>
            </TouchableOpacity>
            
            {mySeries.map(series => (
              <TouchableOpacity
                key={series.id}
                style={[
                  styles.filterOption,
                  selectedSeriesId === series.id && styles.filterOptionSelected
                ]}
                onPress={() => setSelectedSeriesId(series.id)}
              >
                <Text style={[
                  styles.filterOptionText,
                  selectedSeriesId === series.id && styles.filterOptionTextSelected
                ]}>{series.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        {/* Rating Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>By Rating:</Text>
          <View style={styles.ratingFilterOptions}>
            <TouchableOpacity
              style={[
                styles.ratingOption,
                selectedRating === null && styles.ratingOptionSelected
              ]}
              onPress={() => setSelectedRating(_null)}
            >
              <Text style={[
                styles.ratingOptionText,
                selectedRating === null && styles.ratingOptionTextSelected
              ]}>All</Text>
            </TouchableOpacity>
            
            {[5, 4, 3, 2, 1].map(rating => (
              <TouchableOpacity
                key={_rating}
                style={[
                  styles.ratingOption,
                  selectedRating === rating && styles.ratingOptionSelected
                ]}
                onPress={() => setSelectedRating(_rating)}
              >
                <Text style={[
                  styles.ratingOptionText,
                  selectedRating === rating && styles.ratingOptionTextSelected
                ]}>{_rating}★</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Unresponded Filter */}
        <View style={styles.filterSection}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setShowUnresponded(!showUnresponded)}
          >
            <View style={[
              styles.checkbox,
              showUnresponded && styles.checkboxSelected
            ]}>
              {showUnresponded && (
                <Ionicons name="checkmark" size={_16} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.checkboxLabel}>Show only unresponded reviews</Text>
          </TouchableOpacity>
        </View>
        
        {/* Reset Filters */}
        {(selectedSeriesId !== null || selectedRating !== null || showUnresponded) && (
          <TouchableOpacity
            style={styles.resetFiltersButton}
            onPress={_resetFilters}
          >
            <Ionicons name="refresh" size={_16} color="#0057B8" />
            <Text style={styles.resetFiltersText}>Reset Filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  // Loading state
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6A00" />
        <Text style={styles.loadingText}>Loading reviews...</Text>
      </View>
    );
  }
  
  // Error state
  if (_error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={_40} color="#FF6A00" />
        <Text style={styles.errorText}>{_error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={_fetchReviews}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Empty state
  if (reviewsBySeriesData.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={
          <RefreshControl refreshing={_refreshing} onRefresh={_handleRefresh} />
        }
      >
        <Ionicons name="chatbubble-outline" size={_60} color="#CCCCCC" />
        <Text style={styles.emptyTitle}>No Reviews Yet</Text>
        <Text style={styles.emptyText}>
          You haven't received any reviews for your shows yet.
          Reviews will appear here once attendees start rating your shows.
        </Text>
      </ScrollView>
    );
  }
  
  // No results after filtering
  if (filteredData.length === 0 && reviewsBySeriesData.length > 0) {
    return (
      <View style={styles.container}>
        {renderFilters()}
        <View style={styles.noResultsContainer}>
          <Ionicons name="search" size={_40} color="#CCCCCC" />
          <Text style={styles.noResultsTitle}>No Matching Reviews</Text>
          <Text style={styles.noResultsText}>
            No reviews match your current filter settings.
          </Text>
          <TouchableOpacity
            style={styles.resetFiltersButton}
            onPress={_resetFilters}
          >
            <Ionicons name="refresh" size={_16} color="#0057B8" />
            <Text style={styles.resetFiltersText}>Reset Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  // Main content
  return (
    <View style={styles.container}>
      <FlatList
        data={_filteredData}
        renderItem={_renderSeriesWithReviews}
        keyExtractor={item => item.series.id}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={renderFilters()}
        refreshControl={
          <RefreshControl refreshing={_refreshing} onRefresh={_handleRefresh} />
        }
      />
    </View>
  );
};

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  emptyTitle: {
    fontSize: 20,
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
  listContainer: {
    paddingBottom: 20,
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  filtersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333333',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#666666',
  },
  filterOptions: {
    paddingRight: 16,
  },
  filterOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  filterOptionSelected: {
    backgroundColor: '#0057B8',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#666666',
  },
  filterOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  ratingFilterOptions: {
    flexDirection: 'row',
  },
  ratingOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  ratingOptionSelected: {
    backgroundColor: '#0057B8',
  },
  ratingOptionText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  ratingOptionTextSelected: {
    color: '#FFFFFF',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#0057B8',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#0057B8',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333333',
  },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F0F7FF',
    marginTop: 8,
  },
  resetFiltersText: {
    fontSize: 14,
    color: '#0057B8',
    marginLeft: 4,
  },
  seriesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  seriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#F9FAFC',
  },
  seriesName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
  },
  seriesStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  statIcon: {
    marginRight: 4,
  },
  statText: {
    fontSize: 14,
    color: '#666666',
  },
  reviewItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  reviewDate: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  starContainer: {
    flexDirection: 'row',
  },
  starIcon: {
    marginLeft: 2,
  },
  reviewComment: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
    marginBottom: 12,
  },
  responseContainer: {
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#0057B8',
    marginBottom: 4,
  },
  responseText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
  },
  editResponseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  editResponseText: {
    fontSize: 12,
    color: '#0057B8',
    marginLeft: 4,
  },
  responseInputContainer: {
    marginTop: 12,
  },
  responseInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  responseInput: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    padding: 12,
    fontSize: 14,
    color: '#333333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  responseButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  submitButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#0057B8',
    minWidth: 100,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  respondButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F0F7FF',
    marginTop: 8,
  },
  respondButtonText: {
    fontSize: 14,
    color: '#0057B8',
    marginLeft: 4,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 16,
  },
});

export default OrganizerReviewsScreen;
