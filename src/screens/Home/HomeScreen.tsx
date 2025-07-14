import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import FilterSheet from '../../components/FilterSheet';
import FilterChips from '../../components/FilterChips';
import FilterPresetModal from '../../components/FilterPresetModal';
import { ShowFilters, Coordinates } from '../../types';
import { useInfiniteShows } from '../../hooks';

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

// Define props interface for HomeScreen
interface HomeScreenProps {
  customFilters?: ShowFilters;
  onFilterChange?: (filters: ShowFilters) => void;
  onShowPress?: (showId: string) => void;
  userLocation?: Coordinates | null;
}

const HomeScreen = ({ 
  customFilters, 
  onFilterChange, 
  onShowPress,
  userLocation: propUserLocation 
}: HomeScreenProps = {}) => {
  const navigation = useNavigation();
  const { authState } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const appState = useRef(AppState.currentState);
  const flatListRef = useRef(null);
  
  // Default filter values
  const defaultFilters: ShowFilters = {
    // Increase default radius so users see more nearby shows
    radius: 100,
    startDate: new Date(),
    endDate: new Date(new Date().setDate(new Date().getDate() + 30)),
    maxEntryFee: undefined,
    features: [],
    categories: [],
  };

  // Use customFilters if provided, otherwise use local state
  const [localFilters, setLocalFilters] = useState<ShowFilters>(defaultFilters);
  
  // Derive actual filters to use - prefer customFilters if provided
  const filters = customFilters || localFilters;
  
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [presetModalVisible, setPresetModalVisible] = useState(false);

  // Load persisted filters on mount - only if customFilters is not provided
  useEffect(() => {
    if (customFilters) return; // Skip if customFilters is provided
    
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('homeFilters');
        if (stored) {
          const parsed: ShowFilters = JSON.parse(stored);
          setLocalFilters({ ...defaultFilters, ...parsed });
        }
      } catch (e) {
        console.warn('Failed to load stored filters', e);
      }
    })();
  }, [customFilters]);

  // Persist filters whenever they change - only if customFilters is not provided
  useEffect(() => {
    if (customFilters) return; // Skip if customFilters is provided
    
    AsyncStorage.setItem('homeFilters', JSON.stringify(localFilters)).catch(() =>
      console.warn('Failed to persist filters')
    );
  }, [localFilters, customFilters]);

  // Get stock image based on show index or ID to ensure consistency
  const getStockImage = (index: number, id?: string) => {
    if (!id) return stockImages[index % stockImages.length];
    
    // Use a hash-like approach to consistently map show IDs to images
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return stockImages[hash % stockImages.length] || fallbackImage;
  };

  // Set coordinates based on propUserLocation if provided
  useEffect(() => {
    if (propUserLocation) {
      setCoordinates(propUserLocation);
    }
  }, [propUserLocation]);

  // Get user coordinates if not provided in props
  const getUserCoordinates = async () => {
    try {
      // First priority: Use coordinates from props if available
      if (propUserLocation) {
        console.log('Using coordinates from props');
        setCoordinates(propUserLocation);
        return propUserLocation;
      } 
      // Second priority: Use existing coordinates if available
      else if (coordinates && coordinates.latitude) {
        return coordinates;
      }
      // Third priority: Get coordinates from user's home zip code
      else if (authState.user && authState.user.homeZipCode) {
        console.log(`Getting coordinates for zip code: ${authState.user.homeZipCode}`);
        
        const zipData = await locationService.getZipCodeCoordinates(authState.user.homeZipCode);
        
        if (zipData && zipData.coordinates) {
          setCoordinates(zipData.coordinates);
          return zipData.coordinates;
        } else {
          throw new Error(`Could not get coordinates for zip code: ${authState.user.homeZipCode}`);
        }
      }
      
      throw new Error('No location coordinates available. Please set your home ZIP code in your profile.');
    } catch (error) {
      console.error('Error getting user coordinates:', error);
      return null;
    }
  };

  // Monitor app state changes to refresh data when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground - refreshing data');
        refresh();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Use the infinite shows hook
  const {
    shows,
    totalCount,
    hasNextPage,
    fetchNextPage,
    refresh,
    isLoading,
    isFetchingNextPage,
    isRefreshing,
    error
  } = useInfiniteShows({
    coordinates: coordinates || { latitude: 0, longitude: 0 },
    ...filters,
    enabled: true // Always enable the query, even without coordinates
  });

  // Fetch user coordinates and enable the query when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const fetchCoordinates = async () => {
        const coords = await getUserCoordinates();
        if (coords) {
          refresh();
        }
      };
      
      fetchCoordinates();
      
      return () => {
        // Cleanup if needed
      };
    }, [authState.user, filters])
  );

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Navigate to show detail screen or use provided callback
  const handleShowPress = (showId) => {
    if (onShowPress) {
      onShowPress(showId);
    } else {
      navigation.navigate('ShowDetail', { showId });
    }
  };

  // Open filter sheet
  const handleFilterPress = () => {
    setFilterSheetVisible(true);
  };

  // Apply filters callback
  const handleApplyFilters = (newFilters: ShowFilters) => {
    if (onFilterChange) {
      // If parent is managing filters, call the callback
      onFilterChange(newFilters);
    } else {
      // Otherwise, update local state
      setLocalFilters(newFilters);
    }
    setFilterSheetVisible(false);
    // Fetch data with new filters (will happen automatically via useEffect)
  };

  // Remove a single filter (chip press)
  const handleRemoveFilter = (key: string, value?: string) => {
    const updateFilters = (prev: ShowFilters) => {
      const updated: ShowFilters = { ...prev };
      switch (key) {
        case 'radius':
          updated.radius = defaultFilters.radius;
          break;
        case 'dateRange':
          updated.startDate = defaultFilters.startDate;
          updated.endDate = defaultFilters.endDate;
          break;
        case 'maxEntryFee':
          delete updated.maxEntryFee;
          break;
        case 'category':
          updated.categories = (updated.categories || []).filter((c) => c !== value);
          break;
        case 'feature':
          updated.features = (updated.features || []).filter((f) => f !== value);
          break;
        default:
          break;
      }
      return updated;
    };

    if (onFilterChange) {
      // If parent is managing filters, call the callback with updated filters
      onFilterChange(updateFilters(filters));
    } else {
      // Otherwise, update local state
      setLocalFilters(prev => updateFilters(prev));
    }
  };

  // Reset filters to defaults
  const resetFilters = () => {
    if (onFilterChange) {
      onFilterChange(defaultFilters);
    } else {
      setLocalFilters(defaultFilters);
    }
    // Fetch data with default filters (will happen automatically via useEffect)
  };

  // Get active filter count
  const activeFilterCount = () => {
    let count = 0;
    if (filters.radius !== defaultFilters.radius) count++;
    if (
      (filters.startDate &&
        new Date(filters.startDate).toDateString() !==
          new Date(defaultFilters.startDate!).toDateString()) ||
      (filters.endDate &&
        new Date(filters.endDate).toDateString() !==
          new Date(defaultFilters.endDate!).toDateString())
    )
      count++;
    if (filters.maxEntryFee !== undefined) count++;
    if (filters.categories && filters.categories.length) count += filters.categories.length;
    if (filters.features && filters.features.length) count += filters.features.length;
    return count;
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

  // Render footer loader for infinite scrolling
  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={PRIMARY_COLOR} />
        <Text style={styles.footerLoaderText}>Loading more shows...</Text>
      </View>
    );
  };

  // Handle end reached (for infinite scrolling)
  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <>
      <View style={styles.container}>
        {/* Filter Options */}
        <View style={styles.filterContainer}>
          <View style={styles.filterOptions}>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: SECONDARY_COLOR }]}
              onPress={handleFilterPress}
            >
              <Ionicons name="options" size={18} color="white" />
              <Text style={styles.filterButtonText}>Filters</Text>
              {activeFilterCount() > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount()}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Presets Button */}
            <TouchableOpacity
              style={[
                styles.filterButton,
                { backgroundColor: PRIMARY_COLOR, marginLeft: 10 },
              ]}
              onPress={() => setPresetModalVisible(true)}
            >
              <Ionicons name="star" size={18} color="white" />
              <Text style={styles.filterButtonText}>Presets</Text>
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

          {/* Active Filter Chips */}
          <FilterChips
            filters={filters}
            onRemoveFilter={handleRemoveFilter}
            style={{ marginTop: 10 }}
          />
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
              {totalCount > 0 ? `${totalCount} found` : 'No shows found'}
            </Text>
          </View>

          {isLoading && !isRefreshing ? (
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
              ref={flatListRef}
              data={shows}
              renderItem={renderShowItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.showsList}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              ListFooterComponent={renderFooter}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={10}
            />
          )}
        </View>
      </View>

      {/* Filter Sheet */}
      <FilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
      />
      
      {/* Preset Modal */}
      <FilterPresetModal
        visible={presetModalVisible}
        onClose={() => setPresetModalVisible(false)}
        currentFilters={filters}
        onApplyPreset={(presetFilters) => {
          if (onFilterChange) {
            onFilterChange(presetFilters);
          } else {
            setLocalFilters(presetFilters);
          }
          setPresetModalVisible(false);
        }}
        userId={authState.user?.id || ''}
      />
    </>
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
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
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
    flex: 1,
    backgroundColor: 'white',
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 15,
    marginTop: 15,
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
    paddingHorizontal: 15,
    paddingBottom: 20,
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
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  footerLoaderText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#636366',
  },
});

export default HomeScreen;
