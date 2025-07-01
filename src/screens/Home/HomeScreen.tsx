import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as locationService from '../../services/locationService';
import { getShows } from '../../services/showService';
import FilterSheet from '../../components/FilterSheet';
import FilterChips from '../../components/FilterChips';
import FilterPresetModal from '../../components/FilterPresetModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShowFilters, Coordinates } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

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
}: HomeScreenProps) => {
  const navigation = useNavigation();
  const { authState } = useAuth();
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  /* ------------------------------------------------------------------
   * Filter State & Persistence
   * ---------------------------------------------------------------- */
  const defaultFilters: ShowFilters = {
    radius: 25,
    startDate: new Date(),
    endDate: new Date(new Date().setDate(new Date().getDate() + 30)),
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

  // Fetch shows based on user's home zip code or provided location
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // First priority: Use coordinates from props if available
        if (propUserLocation) {
          console.log('Using coordinates from props');
          setCoordinates(propUserLocation);
        } 
        // Second priority: Get coordinates from user's home zip code
        else if (authState.user && authState.user.homeZipCode && !coordinates) {
          console.log(`Using zip code from user profile: ${authState.user.homeZipCode}`);
          
          const zipData = await locationService.getZipCodeCoordinates(authState.user.homeZipCode);
          
          if (zipData && zipData.coordinates) {
            setCoordinates(zipData.coordinates);
          } else {
            console.error(`Could not get coordinates for zip code: ${authState.user.homeZipCode}`);
          }
        }
        
        // If we have coordinates, fetch shows
        if (coordinates) {
          // Derive start & end dates from current filter state
          const formattedStartDate =
            filters.startDate instanceof Date
              ? filters.startDate.toISOString()
              : filters.startDate ?? null;
          const formattedEndDate =
            filters.endDate instanceof Date
              ? filters.endDate.toISOString()
              : filters.endDate ?? null;

          console.log(
            `Fetching shows within ${filters.radius} miles with filters`,
            filters
          );

          const nearbyShows = await getShows({
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            ...filters,
            startDate: formattedStartDate,
            endDate: formattedEndDate,
          });
          
          console.log(`Found ${nearbyShows.length} shows`);
          // Sort shows by startDate in ascending order before setting state
          const sortedShows = [...nearbyShows].sort(
            (a, b) =>
              new Date(a.startDate).getTime() -
              new Date(b.startDate).getTime()
          );
          setShows(sortedShows);
        } else {
          console.warn('No coordinates available to fetch shows');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authState.user, coordinates, filters]);

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (coordinates) {
        const nearbyShows = await getShows({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          ...filters,
          startDate:
            filters.startDate instanceof Date
              ? filters.startDate.toISOString()
              : filters.startDate ?? null,
          endDate:
            filters.endDate instanceof Date
              ? filters.endDate.toISOString()
              : filters.endDate ?? null,
        });

        // Sort shows by startDate in ascending order before updating state
        const sortedShows = [...nearbyShows].sort(
          (a, b) =>
            new Date(a.startDate).getTime() -
            new Date(b.startDate).getTime()
        );
        setShows(sortedShows);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Navigate to show detail screen or use provided callback
  const handleShowPress = (showId) => {
    if (onShowPress) {
      onShowPress(showId);
    } else {
      navigation.navigate('ShowDetail', { showId });
    }
  };

  // Navigate to filter screen
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

  return (
    <>
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
          </View>

          {/* Active Filter Chips */}
          <FilterChips
            filters={filters}
            onRemoveFilter={handleRemoveFilter}
            style={{ marginTop: 10 }}
          />
        </View>

        {/* Upcoming Shows Section */}
        <View style={styles.showsContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Shows</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={PRIMARY_COLOR} style={styles.loader} />
          ) : shows.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={50} color={SECONDARY_COLOR} />
              <Text style={styles.emptyStateText}>No upcoming shows found</Text>
              <Text style={styles.emptyStateSubtext}>Try adjusting your filters</Text>
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
    marginTop: 10,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 90,
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
  loader: {
    marginVertical: 20,
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
  },
});

export default HomeScreen;
