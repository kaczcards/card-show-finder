import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getCardShowDetails, incrementShowMetric } from '../services/firebaseApi';
import { useUser } from '../context/UserContext';
import { updateUserProfile } from '../services/authService';

const ShowDetailsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { show: initialShow, showId } = route.params;
  const { currentUser, userProfile, refreshUserProfile } = useUser();

  const [show, setShow] = useState(initialShow || null);
  const [loading, setLoading] = useState(!initialShow && !!showId);
  const [error, setError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoritesUpdating, setFavoritesUpdating] = useState(false);

  // Check if show is in user favorites
  useEffect(() => {
    if (userProfile && userProfile.favoriteShows && show) {
      const isShowFavorited = userProfile.favoriteShows.includes(show.id);
      setIsFavorite(isShowFavorited);
    }
  }, [userProfile, show]);

  // If we have a showId but not the full show data, fetch it
  useEffect(() => {
    const fetchShowDetails = async () => {
      if (!showId && !initialShow) return;

      try {
        setLoading(true);
        // Use the showId from params or from initialShow
        const id = showId || initialShow.id;
        const { show: fetchedShow, error } = await getCardShowDetails(id);

        if (error) {
          setError(error);
          return;
        }

        setShow(fetchedShow);
      } catch (err) {
        setError('Failed to load show details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchShowDetails();
  }, [showId, initialShow]);

  // Track view count when component mounts
  useEffect(() => {
    const trackView = async () => {
      if (show?.id) {
        try {
          await incrementShowMetric(show.id, 'views');
          console.log('View tracked for show:', show.id);
        } catch (error) {
          console.error('Failed to track view:', error);
        }
      }
    };

    trackView();
  }, [show?.id]);

  // Toggle favorite status
  const toggleFavorite = async () => {
    if (!currentUser) {
      Alert.alert(
        'Sign In Required',
        'Please sign in or create an account to save favorites.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress={() => navigation.navigate('Login')} }
        ]
      );
      return;
    }

    if (!show) return;

    try {
      setFavoritesUpdating(true);

      // Get current favorites or initialize empty array
      const currentFavorites = userProfile?.favoriteShows || [];

      let updatedFavorites;
      if (isFavorite) {
        // Remove from favorites
        updatedFavorites = currentFavorites.filter(id => id !== show.id);
      } else {
        // Add to favorites and track analytics
        updatedFavorites = [...currentFavorites, show.id];
        await incrementShowMetric(show.id, 'favorites');
      }

      // Update user profile with new favorites
      await updateUserProfile(currentUser.uid, {
        favoriteShows: updatedFavorites
      });

      // Refresh user profile to get updated favorites
      await refreshUserProfile();

      // Update local state
      setIsFavorite(!isFavorite);

    } catch (error) {
      console.error('Error updating favorites:', error);
      Alert.alert('Error', 'Failed to update favorites. Please try again.');
    } finally {
      setFavoritesUpdating(false);
    }
  };

  // Format date properly
  const formatDate = (date) => {
    if (!date) return 'Date not available';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date instanceof Date ? date.toLocaleDateString('en-US', options) : 'Date unavailable';
  };

  // Format time properly
  const formatTime = (time) => {
    if (!time) return '';
    const timeObj = time instanceof Date ? time : new Date(time);
    return timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Check if current user is the promoter of this show
  const isPromoter = currentUser && show && currentUser.uid === show.promoterId;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading show details...</Text>
      </View>
    );
  }

  if (error || !show) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#dc3545" />
        <Text style={styles.errorText}>Could not load show details</Text>
        <TouchableOpacity 
          style={styles.goBackButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: show.imageUrl || show.image || 'https://via.placeholder.com/400x200?text=No+Image' }}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Edit button for promoters */}
        {isPromoter && (
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => navigation.navigate('CreateShow', { editMode: true, show })}
          >
            <Ionicons name="create" size={20} color="#fff" />
            <Text style={styles.editButtonText}>Edit Show</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.detailsContainer}>
        <Text style={styles.title}>{show.title}</Text>

        {/* Feature badges */}
        <View style={styles.featureBadges}>
          {show.hasOnsiteGrading && (
            <View style={styles.featureBadge}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#3498db" />
              <Text style={styles.featureBadgeText}>On-site Grading</Text>
            </View>
          )}

          {show.hasAutographGuests && (
            <View style={styles.featureBadge}>
              <Ionicons name="pencil-outline" size={14} color="#3498db" />
              <Text style={styles.featureBadgeText}>Autograph Guests</Text>
            </View>
          )}

          {show.hasRefreshments && (
            <View style={styles.featureBadge}>
              <Ionicons name="fast-food-outline" size={14} color="#3498db" />
              <Text style={styles.featureBadgeText}>Refreshments</Text>
            </View>
          )}

          {show.hasWifi && (
            <View style={styles.featureBadge}>
              <Ionicons name="wifi-outline" size={14} color="#3498db" />
              <Text style={styles.featureBadgeText}>Free WiFi</Text>
            </View>
          )}

          {show.hasDoorPrizes && (
            <View style={styles.featureBadge}>
              <Ionicons name="gift-outline" size={14} color="#3498db" />
              <Text style={styles.featureBadgeText}>Door Prizes</Text>
            </View>
          )}
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={20} color="#3498db" />
          <Text style={styles.detailText}>{formatDate(show.date)}</Text>
        </View>

        {(show.startTime || show.endTime) && (
          <View style={styles.detailRow}>
            <Ionicons name="time" size={20} color="#3498db" />
            <Text style={styles.detailText}>
              {show.startTime ? formatTime(show.startTime) : ''} 
              {show.startTime && show.endTime ? ' - ' : ''}
              {show.endTime ? formatTime(show.endTime) : ''}
            </Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Ionicons name="location" size={20} color="#3498db" />
          <Text style={styles.detailText}>{show.location}</Text>
        </View>

        {show.address && (
          <View style={styles.detailRow}>
            <Ionicons name="map" size={20} color="#3498db" />
            <Text style={styles.detailText}>{show.address}</Text>
          </View>
        )}

        {show.entryFee && (
          <View style={styles.detailRow}>
            <Ionicons name="cash" size={20} color="#3498db" />
            <Text style={styles.detailText}>Entry Fee: {show.entryFee}</Text>
          </View>
        )}

        {/* Categories */}
        {show.categories && show.categories.length > 0 && (
          <View style={styles.categoriesContainer}>
            <Text style={styles.categoriesTitle}>Categories</Text>
            <View style={styles.categoriesList}>
              {Array.isArray(show.categories) ? 
                show.categories.map((category, index) => (
                  <View key={index} style={styles.categoryChip}>
                    <Text style={styles.categoryText}>{category}</Text>
                  </View>
                )) : 
                <Text>No categories available</Text>
              }
            </View>
          </View>
        )}

        {show.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionTitle}>About This Show</Text>
            <Text style={styles.description}>{show.description}</Text>
          </View>
        )}

        {show.promoterName && (
          <View style={styles.promoterContainer}>
            <Text style={styles.promoterLabel}>Organized by:</Text>
            <Text style={styles.promoterName}>{show.promoterName}</Text>
          </View>
        )}

        <TouchableOpacity 
          style={[
            styles.favoriteButton,
            isFavorite && styles.favoritedButton
          ]}
          onPress={toggleFavorite}
          disabled={favoritesUpdating}
        >
          {favoritesUpdating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons 
                name={isFavorite ? "heart" : "heart-outline"} 
                size={18} 
                color="#fff" 
                style={styles.buttonIcon} 
              />
              <Text style={styles.buttonText}>
                {isFavorite ? "Saved to Favorites" : "Add to Favorites"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Get directions button */}
        <TouchableOpacity style={styles.directionsButton}>
          <Ionicons name="navigate" size={18} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Get Directions</Text>
        </TouchableOpacity>
      </View>

      {/* Vendors Section */}
      <View style={styles.vendorsSection}>
        <View style={styles.vendorsHeader}>
          <Text style={styles.vendorsTitle}>Vendors at This Show</Text>
          <Text style={styles.vendorCount}>12 vendors signed up</Text>
        </View>

        <View style={styles.vendorsList}>
          <View style={styles.vendorItem}>
            <View style={styles.vendorInfo}>
              <Text style={styles.vendorName}>Chicago Cards & Comics</Text>
              <Text style={styles.vendorCategories}>Sports Cards • Pokemon • MTG</Text>
              <View style={styles.vendorBadge}>
                <Ionicons name="star" size={12} color="#fff" />
                <Text style={styles.vendorBadgeText}>MVP DEALER</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.messageButton}>
              <Ionicons name="mail-outline" size={16} color="#3498db" />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.vendorItem}>
            <View style={styles.vendorInfo}>
              <Text style={styles.vendorName}>Vintage Treasures</Text>
              <Text style={styles.vendorCategories}>Vintage Baseball • Football</Text>
              <View style={styles.vendorBadge}>
                <Ionicons name="star" size={12} color="#fff" />
                <Text style={styles.vendorBadgeText}>MVP DEALER</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.messageButton}>
              <Ionicons name="mail-outline" size={16} color="#3498db" />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.vendorItem}>
            <View style={styles.vendorInfo}>
              <Text style={styles.vendorName}>Modern Collectibles</Text>
              <Text style={styles.vendorCategories}>Basketball • Football</Text>
            </View>
            <View style={styles.basicVendor}>
              <Text style={styles.basicVendorText}>Basic Vendor</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.viewAllVendors}>
          <Text style={styles.viewAllText}>View All Vendors</Text>
        </TouchableOpacity>
      </View>

      {/* Reviews Section */}
      <View style={styles.reviewsSection}>
        <View style={styles.reviewsHeader}>
          <Text style={styles.reviewsTitle}>Reviews & Ratings</Text>
          <TouchableOpacity 
            style={styles.writeReviewButton}
            onPress={() => {
              if (!currentUser) {
                Alert.alert('Sign In Required', 'Please sign in to write a review.');
                return;
              }
              // TODO: Navigate to write review screen
              Alert.alert('Coming Soon', 'Review functionality will be available after attending the show.');
            }}
          >
            <Text style={styles.writeReviewText}>Write Review</Text>
          </TouchableOpacity>
        </View>

        {/* Overall Rating */}
        <View style={styles.overallRating}>
          <View style={styles.ratingScore}>
            <Text style={styles.ratingNumber}>4.2</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= 4 ? "star" : "star-outline"}
                  size={16}
                  color="#ffc107"
                />
              ))}
            </View>
            <Text style={styles.reviewCount}>Based on 28 reviews</Text>
          </View>
        </View>

        {/* Recent Reviews */}
        <View style={styles.recentReviews}>
          <View style={styles.reviewItem}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewerName}>Mike C.</Text>
              <View style={styles.reviewRating}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= 5 ? "star" : "star-outline"}
                    size={12}
                    color="#ffc107"
                  />
                ))}
              </View>
            </View>
            <Text style={styles.reviewText}>
              Great show with lots of variety! Found several cards for my collection. 
              Well organized and friendly dealers throughout.
            </Text>
            <Text style={styles.reviewDate}>2 weeks ago</Text>
          </View>

          <View style={styles.reviewItem}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewerName}>Sarah L.</Text>
              <View style={styles.reviewRating}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= 4 ? "star" : "star-outline"}
                    size={12}
                    color="#ffc107"
                  />
                ))}
              </View>
            </View>
            <Text style={styles.reviewText}>
              Good selection of vintage cards. Parking was a bit challenging but overall 
              a positive experience.
            </Text>
            <Text style={styles.reviewDate}>1 month ago</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.viewAllReviews}>
          <Text style={styles.viewAllText}>View All Reviews</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// Complete styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#e9ecef',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 200,
  },
  editButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(52, 152, 219, 0.9)',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  detailsContainer: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 12,
  },
  featureBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  featureBadgeText: {
    color: '#3498db',
    fontSize: 12,
    marginLeft: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 16,
    color: '#495057',
    marginLeft: 8,
    flex: 1,
  },
  categoriesContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  categoriesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  categoriesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryChip: {
    backgroundColor: '#f1f8ff',
    borderWidth: 1,
    borderColor: '#bde0fe',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
  },
  categoryText: {
    color: '#3498db',
    fontSize: 14,
  },
  descriptionContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#495057',
    lineHeight: 24,
  },
  promoterContainer: {
    marginTop: 16,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 16,
  },
  promoterLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  promoterName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212529',
  },
  favoriteButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  favoritedButton: {
    backgroundColor: '#e74c3c',
  },
  directionsButton: {
    backgroundColor: '#28a745',
    borderRadius: 8,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
    marginTop: 16,
    marginBottom: 24,
  },
  goBackButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  goBackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ctaButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#3498db',
    marginTop: 12,
  },
  ctaButtonText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  reviewsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  writeReviewButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  writeReviewText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  overallRating: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    marginBottom: 16,
  },
  ratingScore: {
    alignItems: 'center',
  },
  ratingNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  stars: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: '#6c757d',
  },
  recentReviews: {
    marginBottom: 16,
  },
  reviewItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#212529',
  },
  reviewRating: {
    flexDirection: 'row',
  },
  reviewText: {
    fontSize: 14,
    color: '#212529',
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: '#6c757d',
  },
  viewAllReviews: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewAllText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: 'bold',
  },
  vendorsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  vendorsHeader: {
    marginBottom: 16,
  },
  vendorsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  vendorCount: {
    fontSize: 14,
    color: '#6c757d',
  },
  vendorsList: {
    marginBottom: 16,
  },
  vendorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  vendorCategories: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 6,
  },
  vendorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  vendorBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  messageButtonText: {
    color: '#3498db',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  basicVendor: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  basicVendorText: {
    color: '#6c757d',
    fontSize: 12,
  },
  viewAllVendors: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});

export default ShowDetailsScreen;