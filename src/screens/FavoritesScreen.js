import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Mock data - in a real app, this would come from AsyncStorage or a database
const MOCK_FAVORITE_SHOWS = [
  {
    id: '1',
    title: 'National Sports Collectors Convention',
    location: 'Chicago Convention Center',
    address: '123 Convention Way, Chicago, IL 60601',
    date: new Date(2025, 6, 15), // July 15, 2025
    image: 'https://via.placeholder.com/150',
    distance: '2.3 miles away',
    entryFee: '$10.00',
    rating: 4.8,
  },
  {
    id: '3',
    title: 'Vintage Baseball Card Show',
    location: 'Sports Memorabilia Hall',
    address: '789 Collector Ave, Oak Park, IL 60302',
    date: new Date(2025, 7, 5), // August 5, 2025
    image: 'https://via.placeholder.com/150',
    distance: '3.7 miles away',
    entryFee: '$7.50',
    rating: 4.5,
  }
];

const FavoritesScreen = () => {
  const navigation = useNavigation();
  const [favorites, setFavorites] = useState(MOCK_FAVORITE_SHOWS);

  // Format date properly
  const formatDate = (date) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const removeFromFavorites = (id) => {
    Alert.alert(
      'Remove from Favorites',
      'Are you sure you want to remove this show from your favorites?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Remove',
          onPress: () => {
            // Filter out the removed show
            setFavorites(favorites.filter(show => show.id !== id));
          },
          style: 'destructive'
        }
      ]
    );
  };

  const renderFavoriteItem = ({ item }) => (
    <View style={styles.cardContainer}>
      <TouchableOpacity
        style={styles.cardTouchable}
        onPress={() => navigation.navigate('ShowDetails', { show: item })}
      >
        <Image source={{ uri: item.image }} style={styles.cardImage} />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={16} color="#666" />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={16} color="#666" />
            <Text style={styles.detailText}>{formatDate(item.date)}</Text>
          </View>
          <View style={styles.badgeContainer}>
            <View style={styles.priceBadge}>
              <Text style={styles.badgeText}>{item.entryFee}</Text>
            </View>
            {item.rating && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#fff" />
                <Text style={styles.badgeText}>{item.rating}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeFromFavorites(item.id)}
      >
        <Ionicons name="heart-dislike" size={22} color="#ff3b30" />
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="heart-outline" size={80} color="#ccc" />
      <Text style={styles.emptyText}>No Favorites Yet</Text>
      <Text style={styles.emptySubtext}>
        Shows you favorite will appear here for quick access
      </Text>
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.browseButtonText}>Browse Shows</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Favorite Shows</Text>
        <Text style={styles.headerSubtitle}>
          {favorites.length} {favorites.length === 1 ? 'show' : 'shows'} saved
        </Text>
      </View>

      {/* Favorites List */}
      <FlatList
        data={favorites}
        renderItem={renderFavoriteItem}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.listContainer,
          favorites.length === 0 && styles.emptyListContainer
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  cardContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
  },
  cardTouchable: {
    flexDirection: 'row',
  },
  cardImage: {
    width: 100,
    height: 120,
  },
  cardContent: {
    flex: 1,
    padding: 12,
    paddingRight: 40, // Make room for the remove button
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#212529',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  badgeContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  priceBadge: {
    backgroundColor: '#28a745',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  ratingBadge: {
    backgroundColor: '#f39c12',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#495057',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default FavoritesScreen;