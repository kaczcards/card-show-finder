// src/screens/MyShowsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import { getPromoterShows, deleteCardShow } from '../services/firebaseApi';

const MyShowsScreen = () => {
  const navigation = useNavigation();
  const { currentUser, userProfile } = useUser();
  
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Check if user is a promoter
  useEffect(() => {
    if (userProfile && userProfile.role !== 'promoter') {
      Alert.alert(
        'Promoter Access Only',
        'You need to be a promoter to manage shows. Would you like to upgrade your account?',
        [
          { text: 'Not Now', onPress: () => navigation.goBack() },
          { text: 'Upgrade', onPress: () => navigation.navigate('Profile') }
        ]
      );
    }
  }, [userProfile, navigation]);
  
  // Set up header button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('CreateShow')}
        >
          <Ionicons name="add-circle" size={24} color="#3498db" />
          <Text style={styles.headerButtonText}>New Show</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);
  
  // Fetch shows when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchShows();
    }, [currentUser])
  );
  
  // Fetch shows created by the current user
  const fetchShows = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const { shows: fetchedShows, error: fetchError } = await getPromoterShows(currentUser.uid);
      
      if (fetchError) {
        setError(fetchError);
        return;
      }
      
      // Sort shows by date (upcoming first)
      const sortedShows = fetchedShows.sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateA - dateB;
      });
      
      setShows(sortedShows);
      setError(null);
    } catch (err) {
      console.error('Error fetching shows:', err);
      setError('Failed to load your shows');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Handle pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchShows();
  };
  
  // Handle show deletion
  const handleDeleteShow = (showId) => {
    Alert.alert(
      'Delete Show',
      'Are you sure you want to delete this show? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const { success, error } = await deleteCardShow(showId);
              
              if (!success) {
                Alert.alert('Error', error || 'Failed to delete show');
                return;
              }
              
              // Remove show from state
              setShows(shows.filter(show => show.id !== showId));
              Alert.alert('Success', 'Show has been deleted');
            } catch (error) {
              console.error('Error deleting show:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };
  
  // Format date for display
  const formatDate = (date) => {
    if (!date) return 'TBD';
    
    const showDate = date instanceof Date ? date : new Date(date);
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return showDate.toLocaleDateString(undefined, options);
  };
  
  // Render analytics for a show
  const renderAnalytics = (show) => {
    // Default values if analytics aren't available
    const views = show.analytics?.views || 0;
    const favorites = show.analytics?.favorites || 0;
    
    return (
      <View style={styles.analytics}>
        <View style={styles.analyticItem}>
          <Ionicons name="eye-outline" size={16} color="#6c757d" />
          <Text style={styles.analyticValue}>{views}</Text>
          <Text style={styles.analyticLabel}>Views</Text>
        </View>
        
        <View style={styles.analyticItem}>
          <Ionicons name="heart-outline" size={16} color="#6c757d" />
          <Text style={styles.analyticValue}>{favorites}</Text>
          <Text style={styles.analyticLabel}>Favorites</Text>
        </View>
      </View>
    );
  };
  
  // Render a single show item
  const renderShowItem = ({ item }) => {
    const isUpcoming = new Date(item.date) >= new Date();
    
    return (
      <View style={styles.showCard}>
        <View style={styles.showHeader}>
          <Text style={styles.showTitle}>{item.title}</Text>
          {!isUpcoming && (
            <View style={styles.pastBadge}>
              <Text style={styles.pastBadgeText}>Past</Text>
            </View>
          )}
        </View>
        
        <View style={styles.showDetails}>
          <View style={styles.showInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color="#6c757d" style={styles.infoIcon} />
              <Text style={styles.infoText}>{formatDate(item.date)}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color="#6c757d" style={styles.infoIcon} />
              <Text style={styles.infoText}>{item.location}</Text>
            </View>
            
            {item.entryFee && (
              <View style={styles.infoRow}>
                <Ionicons name="cash-outline" size={16} color="#6c757d" style={styles.infoIcon} />
                <Text style={styles.infoText}>{item.entryFee}</Text>
              </View>
            )}
          </View>
          
          {item.imageUrl && (
            <Image source={{ uri: item.imageUrl }} style={styles.showImage} />
          )}
        </View>
        
        {renderAnalytics(item)}
        
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => navigation.navigate('CreateShow', { editMode: true, show: item })}
          >
            <Ionicons name="create-outline" size={18} color="#3498db" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={() => handleDeleteShow(item.id)}
          >
            <Ionicons name="trash-outline" size={18} color="#dc3545" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="calendar" size={80} color="#e9ecef" />
      <Text style={styles.emptyTitle}>No Shows Yet</Text>
      <Text style={styles.emptyText}>
        You haven't created any card shows yet. Tap the "New Show" button to get started.
      </Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => navigation.navigate('CreateShow')}
      >
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={styles.createButtonText}>Create First Show</Text>
      </TouchableOpacity>
    </View>
  );
  
  // Render error state
  const renderErrorState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="alert-circle" size={80} color="#dc3545" />
      <Text style={styles.errorTitle}>Something Went Wrong</Text>
      <Text style={styles.emptyText}>
        We couldn't load your shows. Please try again.
      </Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={fetchShows}
      >
        <Ionicons name="refresh" size={20} color="#fff" />
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
  
  // If not a promoter, don't render the content
  if (userProfile && userProfile.role !== 'promoter') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }
  
  // Show loading indicator while initially loading
  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }
  
  // Show error state if there's an error
  if (error) {
    return renderErrorState();
  }
  
  return (
    <View style={styles.container}>
      <FlatList
        data={shows}
        renderItem={renderShowItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3498db']}
          />
        }
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
  listContent: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  headerButtonText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  showCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  showHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  showTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    flex: 1,
  },
  pastBadge: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  pastBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  showDetails: {
    flexDirection: 'row',
    padding: 16,
  },
  showInfo: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#495057',
  },
  showImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  analytics: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f3f5',
    padding: 12,
  },
  analyticItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  analyticValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginHorizontal: 6,
  },
  analyticLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  actionButtons: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f3f5',
    padding: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 16,
  },
  editButtonText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  deleteButtonText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    marginTop: 16,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#dc3545',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default MyShowsScreen;
