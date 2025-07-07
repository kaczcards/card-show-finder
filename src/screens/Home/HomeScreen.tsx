import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as locationService from '../../services/locationService';
import { getShows } from '../../services/showService';
import { useAuth } from '../../contexts/AuthContext';
import FilterSheet from '../../components/FilterSheet';
import { ShowFilters } from '../../types';

// Constants
const PRIMARY_COLOR = '#FF6A00'; // Orange
const SECONDARY_COLOR = '#0057B8'; // Blue

// Stock images for show items
const stockImages = [
  require('../../../assets/stock/home_show_01.jpg'),
  require('../../../assets/stock/home_show_02.jpg'),
  require('../../../assets/stock/home_show_03.jpg'),
  require('../../../assets/stock/home_show_04.jpg'),
  require('../../../assets/stock/home_show_05.jpg'),
  require('../../../assets/stock/home_show_06.jpg'),
  require('../../../assets/stock/home_show_07.jpg'),
  require('../../../assets/stock/home_show_08.jpg'),
  require('../../../assets/stock/home_show_09.jpg'),
  require('../../../assets/stock/home_show_10.jpg'),
];

// Always-safe fallback
const fallbackImage = require('../../../assets/stock/home_show_01.jpg');

const HomeScreen = () => {
  const navigation = useNavigation();
  const { authState } = useAuth();
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coordinates, setCoordinates] = useState(null);
  const [error, setError] = useState(null);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const appState = useRef(AppState.currentState);
  
  // Default filter values
  const [filters, setFilters] = useState<ShowFilters>({
    radius: 25, // Default 25 miles
    startDate: new Date(),
    endDate: new Date(new Date().setDate(new Date().getDate() + 30)), // Default 30 days
    maxEntryFee: undefined,
    features: [],
    categories: [],
  });

  // Get stock image based on show index or ID to ensure consistency
  const getStockImage = (index: number, id?: string) => {
    if (!id) return stockImages[index % stockImages.length];
    
    // Use a hash-like approach to consistently map show IDs to images
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return stockImages[hash % stockImages.length] || fallbackImage;
  };

  // Monitor app state changes to refresh data when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground - refreshing data');
        fetchData();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Refresh data when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchData();
      return () => {
        // Cleanup if needed
      };
    }, [authState.user, filters])
  );

  // Fetch shows based on user's home zip code and current filters
  const fetchData = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      }
      setError(null);
      
      // Get coordinates from user's home zip code if we don't have them yet
      let currentCoords = coordinates;
      
      if ((!currentCoords || !currentCoords.latitude) && authState.user && authState.user.homeZipCode) {
        console.log(`Getting coordinates for zip code: ${authState.user.homeZipCode}`);
        
        const zipData = await locationService.getZipCodeCoordinates(authState.user.homeZipCode);
        
        if (zipData && zipData.coordinates) {
          currentCoords = zipData.coordinates;
          setCoordinates(zipData.coordinates);
        } else {
          throw new Error(`Could not get coordinates for zip code: ${authState.user.homeZipCode}`);
        }
      }
      
      if (!currentCoords || !currentCoords.latitude) {
        throw new Error('No location coordinates available. Please set your home ZIP code in your profile.');
      }
      
      console.log(`Fetching shows within ${filters.radius} miles of coordinates`, currentCoords);
      
      // Create filter object with current coordinates and filters
      const showFilters: ShowFilters = {
        ...filters,
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
      };
      
      // Format dates as ISO strings if they're Date objects
      if (showFilters.startDate instanceof Date) {
        showFilters.startDate = showFilters.startDate.toISOString();
      }
      
      if (showFilters.endDate instanceof Date) {
        showFilters.endDate = showFilters.endDate.toISOString();
      }
      
      const nearbyShows = await getShows(showFilters);
      
      console.log(`Found ${nearbyShows.length} shows`);
      
      // Sort shows by startDate in ascending order before setting state
      const sortedShows = [...nearbyShows].sort(
        (a, b) =>
          new Date(a.startDate).getTime() -
          new Date(b.startDate).getTime()
      );
      
      setShows(sortedShows);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message || 'Failed to load shows. Please try again.');
    } finally {
      setLoading(false);
      if (isRefreshing) {
        setRefreshing(false);
      }
    }
  };

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    fetchData(true);
  };

  // Navigate to show detail screen
  const handleShowPress = (showId) => {
    navigation.navigate('ShowDetail', { showId });
  };

  // Open filter sheet
  const handleFilterPress = () => {
    setFilterSheetVisible(true);
  };

  // Apply filters from filter sheet
  const handleApplyFilters = (newFilters: ShowFilters) => {
    setFilters(newFilters);
    setFilterSheetVisible(false);
    // Fetch data with new filters
    fetchData();
  };

  // Reset filters to defaults
  const resetFilters = () => {
    const defaultFilters: ShowFilters = {
      radius: 25,
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 30)),
      maxEntryFee: undefined,
      features: [],
      categories: [],
    };
    
    setFilters(defaultFilters);
    fetchData();
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    // Parse the date string and adjust for timezone issues
    // This ensures the correct date is shown regardless of local timezone
    const date = new Date(dateString);
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);

    return utcDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Render show item
  const renderShowItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.showCard}
      onPress={() => handleShowPress(item.id)}
    >
      <Image
        source={
          item.imageUrl && typeof item.imageUrl === 'string'
            ? { uri: item.imageUrl }
            : getStockImage(index, item.id)
        }
        style={styles.showImage}
        defaultSource={fallbackImage}
      />
      <View style={styles.showInfo}>
        <Text style={styles.showTitle}>{item.title}</Text>
        <Text style={styles.showDate}>
          {formatDate(item.startDate)}
          {item.startDate !== item.endDate ? ` - ${formatDate(item.endDate)}` : ''}
        </Text>
        <View style={styles.showLocation}>
          <Ionicons name="location" size={14} color={SECONDARY_COLOR} />
          <Text style={styles.showLocationText}>{item.location}</Text>
        </View>
        {item.entryFee > 0 && (
          <View style={styles.showFeeBadge}>
            <Text style={styles.showFeeText}>${item.entryFee}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // Render active filters summary
  const renderActiveFilters = () => {
    const activeFilterCount = 
      (filters.radius !== 25 ? 1 : 0) +
      (filters.maxEntryFee !== undefined ? 1 : 0) +
      (filters.features && filters.features.length > 0 ? 1 : 0) +
      (filters.categories && filters.categories.length > 0 ? 1 : 0);
    
    if (activeFilterCount === 0) {
      return null;
    }
    
    return (
      <View style={styles.activeFiltersContainer}>
        <Text style={styles.activeFiltersText}>
          {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'} active
        </Text>
        <TouchableOpacity onPress={resetFilters}>
          <Text style={styles.resetFiltersText}>Reset</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Filter Options */}
        <View style={styles.filterContainer}>
          <View style={styles.filterOptions}>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: SECONDARY_COLOR }]}
              onPress={handleFilterPress}
            >
              <Ionicons name="options" size={18} color="white" />
              <Text style={styles.filterButtonText}>Filters</Text>
            </TouchableOpacity>
            
            {/* Display distance filter */}
            <View style={styles.activeFilterPill}>
              <Ionicons name="location" size={14} color={SECONDARY_COLOR} />
              <Text style={styles.activeFilterText}>
                {filters.radius} miles
              </Text>
            </View>
            
            {/* Display date range filter */}
            <View style={styles.activeFilterPill}>
              <Ionicons name="calendar" size={14} color={SECONDARY_COLOR} />
              <Text style={styles.activeFilterText}>
                Next {Math.round((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
              </Text>
            </View>
          </View>
          
          {renderActiveFilters()}
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#D32F2F" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Upcoming Shows Section */}
        <View style={styles.showsContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Shows</Text>
            <Text style={styles.showCountText}>
              {shows.length > 0 ? `${shows.length} found` : 'No shows found'}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={PRIMARY_COLOR} style={styles.loader} />
              <Text style={styles.loaderText}>Loading shows...</Text>
            </View>
          ) : shows.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={50} color={SECONDARY_COLOR} />
              <Text style={styles.emptyStateText}>No upcoming shows found</Text>
              <Text style={styles.emptyStateSubtext}>Try adjusting your filters or expanding your search radius</Text>
              <TouchableOpacity 
                style={styles.resetFiltersButton}
                onPress={resetFilters}
              >
                <Text style={styles.resetFiltersButtonText}>Reset Filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={shows}
              renderItem={renderShowItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.showsList}
            />
          )}
        </View>
      </ScrollView>
      
      {/* Filter Sheet */}
      <FilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  filterContainer: {
    padding: 15,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  filterOptions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 10,
    flexWrap: 'wrap',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 90,
    marginRight: 8,
    marginBottom: 8,
  },
  filterButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 4,
  },
  activeFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F0FF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  activeFilterText: {
    color: SECONDARY_COLOR,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  activeFiltersText: {
    fontSize: 12,
    color: '#636366',
  },
  resetFiltersText: {
    fontSize: 12,
    color: SECONDARY_COLOR,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#D32F2F',
    marginLeft: 8,
    flex: 1,
  },
  showsContainer: {
    padding: 15,
    backgroundColor: 'white',
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  showCountText: {
    fontSize: 14,
    color: '#636366',
  },
  viewAllText: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  showsList: {
    paddingBottom: 10,
  },
  showCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  showImage: {
    width: 100,
    height: 100,
    resizeMode: 'cover',
  },
  showInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  showTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  showDate: {
    fontSize: 14,
    color: '#636366',
    marginBottom: 4,
  },
  showLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  showLocationText: {
    fontSize: 14,
    color: '#636366',
    marginLeft: 4,
  },
  showFeeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  showFeeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loader: {
    marginBottom: 10,
  },
  loaderText: {
    color: '#636366',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 10,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#636366',
    marginTop: 5,
    textAlign: 'center',
    marginBottom: 15,
  },
  resetFiltersButton: {
    backgroundColor: SECONDARY_COLOR,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  resetFiltersButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default HomeScreen;
