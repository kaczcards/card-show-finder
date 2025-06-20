import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { getShowById } from '../../services/showService';
import { getDirectionsUrl } from '../../services/locationService';
import { Show, ShowStatus } from '../../types';

// Define the main stack param list type
type MainStackParamList = {
  MainTabs: undefined;
  ShowDetail: { showId: string };
};

type Props = NativeStackScreenProps<MainStackParamList, 'ShowDetail'>;

const ShowDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  // Safely get the show ID from route params
  const showId = route.params?.showId;

  // State
  const [show, setShow] = useState<Show | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoritingInProgress, setFavoritingInProgress] = useState(false);

  // Guard against missing showId
  useEffect(() => {
    if (!showId) {
      Alert.alert('Error', 'Show information unavailable.');
      navigation.goBack();
    }
  }, [showId, navigation]);

  // Get auth context
  const { authState, addFavoriteShow, removeFavoriteShow } = useAuth();
  const { user } = authState;

  // Fetch show details
  useEffect(() => {
    const fetchShowDetails = async () => {
      try {
        setLoading(true);
        if (!showId) return;
        
        // getShowById returns { data, error }
        const { data: showData, error: showError } = await getShowById(showId);
        
        if (showError || !showData) {
          Alert.alert('Error', showError || 'Show not found');
          navigation.goBack();
          return;
        }
        
        setShow(showData);
        
        // Check if the show is in user's favorites
        if (user?.favoriteShows) {
          setIsFavorite(user.favoriteShows.includes(showId));
        }
      } catch (error) {
        console.error('Error fetching show details:', error);
        Alert.alert('Error', 'Failed to load show details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchShowDetails();
  }, [showId, user, navigation]);

  // Handle favorite/unfavorite
  const toggleFavorite = async () => {
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to favorite shows',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => navigation.navigate('MainTabs') }
        ]
      );
      return;
    }

    try {
      setFavoritingInProgress(true);
      
      if (isFavorite) {
        await removeFavoriteShow(showId);
      } else {
        await addFavoriteShow(showId);
      }
      
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status. Please try again.');
    } finally {
      setFavoritingInProgress(false);
    }
  };

  // Open maps for directions
  const getDirections = () => {
    if (!show || !show.coordinates) {
      Alert.alert('Error', 'Location coordinates not available for directions.');
      return;
    }
    
    const url = getDirectionsUrl(show.coordinates, show.title);
    Linking.openURL(url).catch((err) => {
      console.error('Error opening maps:', err);
      Alert.alert('Error', 'Could not open maps application');
    });
  };

  // Share the show
  const shareShow = async () => {
    if (!show) return;
    
    try {
    // Ensure correct date regardless of local timezone
    const date = new Date(show.startDate);
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    const formattedDate = utcDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      
      await Share.share({
        title: show.title,
        message: `Check out this card show: ${show.title} on ${formattedDate} in ${show.location}. Entry fee: ${show.entryFee === 0 ? 'Free' : `$${show.entryFee}`}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Format date with safety check
  const formatDate = (dateValue: Date | string) => {
    try {
    // Parse and adjust for timezone to avoid off-by-one-day display
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
        return 'Date not available';
      }
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    return utcDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (err) {
      console.error('Error formatting date:', err);
      return 'Date not available';
    }
  };

  // Get status badge color
  const getStatusColor = (status: ShowStatus) => {
    switch (status) {
      case ShowStatus.UPCOMING:
      case ShowStatus.ACTIVE: // Supabase default
        return '#4CAF50'; // Green
      case ShowStatus.ONGOING:
        return '#2196F3'; // Blue
      case ShowStatus.COMPLETED:
        return '#9E9E9E'; // Gray
      case ShowStatus.CANCELLED:
        return '#F44336'; // Red
      default:
        return '#9E9E9E';
    }
  };

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading show details...</Text>
      </SafeAreaView>
    );
  }

  // Render show not found
  if (!show) {
    return (
      <SafeAreaView style={styles.notFoundContainer}>
        <Ionicons name="alert-circle-outline" size={60} color="#666" />
        <Text style={styles.notFoundText}>Show not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Format dates for display
  const startDate = new Date(show.startDate);
  const endDate = new Date(show.endDate);
  const isSameDay = startDate.toDateString() === endDate.toDateString();
  
  const dateString = isSameDay
    ? formatDate(startDate)
    : `${formatDate(startDate)} - ${formatDate(endDate)}`;

  // Convert features object to array for display
  const displayFeatures = show.features ? Object.keys(show.features).filter(key => show.features![key]) : [];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Show Image */}
        <View style={styles.imageContainer}>
          {show.imageUrl ? (
            <Image source={{ uri: show.imageUrl }} style={styles.image} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="images-outline" size={60} color="#ccc" />
            </View>
          )}
          
          {/* Status Badge */}
          <View 
            style={[
              styles.statusBadge, 
              { backgroundColor: getStatusColor(show.status) }
            ]}
          >
            <Text style={styles.statusText}>{show.status}</Text>
          </View>
        </View>

        {/* Title and Actions */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{show.title}</Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={toggleFavorite}
              disabled={favoritingInProgress}
            >
              {favoritingInProgress ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Ionicons 
                  name={isFavorite ? "heart" : "heart-outline"} 
                  size={24} 
                  color={isFavorite ? "#FF3B30" : "#007AFF"} 
                />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={shareShow}
            >
              <Ionicons name="share-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Date and Time */}
        <View style={styles.infoSection}>
          <View style={styles.infoHeader}>
            <Ionicons name="calendar-outline" size={22} color="#007AFF" />
            <Text style={styles.infoHeaderText}>Date & Time</Text>
          </View>
          
          <View style={styles.infoContent}>
            <Text style={styles.infoText}>{dateString}</Text>
            {show.startTime && show.endTime && (
              <Text style={styles.infoText}>
                {show.startTime} - {show.endTime}
              </Text>
            )}
          </View>
        </View>

        {/* Location */}
        <View style={styles.infoSection}>
          <View style={styles.infoHeader}>
            <Ionicons name="location-outline" size={22} color="#007AFF" />
            <Text style={styles.infoHeaderText}>Location</Text>
          </View>
          
          <View style={styles.infoContent}>
            {show.location ? (
              <Text style={styles.venueName}>{show.location}</Text>
            ) : (
              <Text style={styles.venueName}>Location not specified</Text>
            )}
            <Text style={styles.infoText}>
              {show.address || 'Address not available'}
            </Text>
            
            {show.coordinates && (
              <TouchableOpacity 
                style={styles.directionsButton}
                onPress={getDirections}
              >
                <Ionicons name="navigate-outline" size={18} color="white" />
                <Text style={styles.directionsButtonText}>Get Directions</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Entry Fee */}
        <View style={styles.infoSection}>
          <View style={styles.infoHeader}>
            <Ionicons name="cash-outline" size={22} color="#007AFF" />
            <Text style={styles.infoHeaderText}>Entry Fee</Text>
          </View>
          
          <View style={styles.infoContent}>
            <Text style={styles.entryFee}>
              {show.entryFee === 0 || show.entryFee == null
                ? 'FREE'
                : `$${Number(show.entryFee).toFixed(2)}`}
            </Text>
          </View>
        </View>

        {/* Features */}
        {displayFeatures.length > 0 && (
          <View style={styles.infoSection}>
            <View style={styles.infoHeader}>
              <Ionicons name="star-outline" size={22} color="#007AFF" />
              <Text style={styles.infoHeaderText}>Features</Text>
            </View>
            
            <View style={styles.tagsContainer}>
              {displayFeatures.map((feature, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Categories */}
        {show.categories && show.categories.length > 0 && (
          <View style={styles.infoSection}>
            <View style={styles.infoHeader}>
              <Ionicons name="pricetag-outline" size={22} color="#007AFF" />
              <Text style={styles.infoHeaderText}>Categories</Text>
            </View>
            
            <View style={styles.tagsContainer}>
              {show.categories.map((category, index) => (
                <View key={index} style={[styles.tag, styles.categoryTag]}>
                  <Text style={styles.tagText}>{category}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Description */}
        {show.description && (
          <View style={styles.infoSection}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle-outline" size={22} color="#007AFF" />
              <Text style={styles.infoHeaderText}>Description</Text>
            </View>
            
            <View style={styles.infoContent}>
              <Text style={styles.descriptionText}>{show.description}</Text>
            </View>
          </View>
        )}

        {/* Rating (if available) */}
        {show.rating !== null && show.rating !== undefined && (
          <View style={styles.infoSection}>
            <View style={styles.infoHeader}>
              <Ionicons name="star-half-outline" size={22} color="#007AFF" />
              <Text style={styles.infoHeaderText}>Rating</Text>
            </View>
            
            <View style={styles.ratingContainer}>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={
                      star <= Math.floor(show.rating)
                        ? 'star'
                        : star === Math.ceil(show.rating) && star > Math.floor(show.rating)
                        ? 'star-half'
                        : 'star-outline'
                    }
                    size={20}
                    color="#FFD700"
                  />
                ))}
              </View>
              <Text style={styles.ratingText}>
                {show.rating != null ? show.rating.toFixed(1) : 'N/A'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 20,
  },
  notFoundText: {
    fontSize: 18,
    color: '#666',
    marginTop: 10,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e1e1e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  titleContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  infoSection: {
    backgroundColor: 'white',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  infoContent: {
    paddingLeft: 30,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 6,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  directionsButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  entryFee: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: 30,
  },
  tag: {
    backgroundColor: '#e6f2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryTag: {
    backgroundColor: '#f0f0f0',
  },
  tagText: {
    fontSize: 14,
    color: '#007AFF',
  },
  descriptionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  organizerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
  },
  ratingContainer: {
    paddingLeft: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
});

export default ShowDetailScreen;
