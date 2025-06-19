import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { getShows } from '../../services/showService';
import { getCurrentLocation, getZipCodeCoordinates } from '../../services/locationService';
import { Show, ShowFilters, Coordinates } from '../../types';

// Import components (to be created later)
// import FilterSheet from '../../components/FilterSheet';
// import ShowCard from '../../components/ShowCard';

// Define the main stack param list type
type MainStackParamList = {
  MainTabs: undefined;
  ShowDetail: { showId: string };
};

type Props = NativeStackScreenProps<MainStackParamList>;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  // State
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  /**
   * When true it means we already attempted a second fetch with a larger
   * radius (100 mi). This prevents an infinite retry loop.
   */
  const [hasExpandedRadius, setHasExpandedRadius] = useState(false);
  const [filters, setFilters] = useState<ShowFilters>({
    radius: 25, // Default radius: 25 miles
    startDate: new Date(), // Default start date: today
    endDate: new Date(new Date().setDate(new Date().getDate() + 30)), // Default end date: 30 days from now
  });

  // Get auth context
  const { authState } = useAuth();
  const { user } = authState;

  // Fetch shows based on location or ZIP code
  const fetchShows = useCallback(async () => {
    try {
      setLoading(true);
      // Reset expansion flag for a brand-new fetch cycle
      setHasExpandedRadius(false);
      let showsData: Show[] = [];
      let locationCoords: Coordinates | null = null;

      console.log('[HomeScreen] Starting fetchShows()');

      // If user has a home ZIP code, use that
      if (user?.homeZipCode) {
        console.log('[HomeScreen] Using home ZIP code', user.homeZipCode);
        const zipData = await getZipCodeCoordinates(user.homeZipCode);
        if (zipData) {
          locationCoords = zipData.coordinates;
          console.log(
            '[HomeScreen] Coordinates resolved from ZIP:',
            locationCoords
          );
        }
      } else {
        // Otherwise, try to get current location
        console.log('[HomeScreen] No home ZIP – requesting device location');
        locationCoords = await getCurrentLocation();
        if (locationCoords) {
          console.log(
            '[HomeScreen] Device location acquired:',
            locationCoords
          );
        }
      }

      const currentFilters: ShowFilters = { ...filters };
      if (locationCoords) {
        currentFilters.latitude = locationCoords.latitude;
        currentFilters.longitude = locationCoords.longitude;
      }

      if (!locationCoords) {
        console.warn(
          '[HomeScreen] Location coordinates could not be determined – falling back to non-spatial query'
        );
      }

      console.log('[HomeScreen] Final filters sent to getShows:', currentFilters);

      try {
        showsData = await getShows(currentFilters);
        console.log(
          `[HomeScreen] getShows() returned ${showsData.length} show(s)`,
          showsData
        );

        /* ------------------------------------------------------------
         * If we found nothing on the first pass and we have NOT yet
         * expanded the radius, try again with 100 mi.
         * ---------------------------------------------------------- */
        if (
          showsData.length === 0 &&
          !hasExpandedRadius &&
          (currentFilters.radius ?? 25) < 100
        ) {
          console.log(
            '[HomeScreen] No shows with default radius – retrying with 100 miles'
          );
          const expandedFilters: ShowFilters = {
            ...currentFilters,
            radius: 100,
          };
          const expandedResults = await getShows(expandedFilters);
          setHasExpandedRadius(true);
          console.log(
            `[HomeScreen] Expanded radius fetch returned ${expandedResults.length} show(s)`
          );
          showsData = expandedResults;
        }
      } catch (svcErr: any) {
        console.error('[HomeScreen] getShows() threw', svcErr);
        throw svcErr; // re-throw so outer catch handles alert / state reset
      }

      setShows(showsData);

      // If still nothing after expansion, inform the user
      if (showsData.length === 0 && hasExpandedRadius) {
        Alert.alert(
          'No Nearby Shows',
          'We couldn’t find any card shows within 100 miles over the next 30 days. ' +
            'Know of a show that’s missing? Help the community by adding it!'
        );
      }
    } catch (error) {
      console.error('[HomeScreen] Error fetching shows:', error);
      Alert.alert(
        'Error',
        `Failed to load card shows. ${
          error?.message ? `\n\nDetails: ${error.message}` : ''
        }`
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.log('[HomeScreen] fetchShows() complete');
    }
  }, [user, filters]);

  // Load shows when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchShows();
    }, [fetchShows])
  );

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchShows();
  };

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<ShowFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setFilterVisible(false);
  };

  // Navigate to show detail
  const handleShowPress = (showId: string) => {
    navigation.navigate('ShowDetail', { showId });
  };

  // Render a show item
  const renderShowItem = ({ item }: { item: Show }) => {
    // Format date
    const startDate = new Date(item.startDate);
    const endDate = new Date(item.endDate);
    const isSameDay = startDate.toDateString() === endDate.toDateString();
    
    const dateString = isSameDay
      ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    // Convert features object to array for display
    const displayFeatures = item.features ? Object.keys(item.features).filter(key => item.features![key]) : [];

    return (
      <TouchableOpacity
        style={styles.showCard}
        onPress={() => handleShowPress(item.id)}
      >
        <View style={styles.showImageContainer}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.showImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="images-outline" size={40} color="#ccc" />
            </View>
          )}
        </View>
        <View style={styles.showInfo}>
          <Text style={styles.showTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.showDetail}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.showDetailText}>{dateString}</Text>
          </View>
          <View style={styles.showDetail}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.showDetailText} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
          <View style={styles.showDetail}>
            <Ionicons name="cash-outline" size={16} color="#666" />
            <Text style={styles.showDetailText}>
              {item.entryFee === 0 ? 'Free' : `$${item.entryFee.toFixed(2)}`}
            </Text>
          </View>
          {displayFeatures && displayFeatures.length > 0 && (
            <View style={styles.featuresContainer}>
              {displayFeatures.slice(0, 2).map((feature, index) => (
                <View key={index} style={styles.featureTag}>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
              {displayFeatures.length > 2 && (
                <View style={styles.featureTag}>
                  <Text style={styles.featureText}>+{displayFeatures.length - 2}</Text>
                </View>
              )}
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={24} color="#ccc" style={styles.chevron} />
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={60} color="#ccc" />
      <Text style={styles.emptyStateTitle}>No Shows Found</Text>
      <Text style={styles.emptyStateText}>
        There are no card shows matching your filters. Try adjusting your filters or checking back later.
      </Text>
      <TouchableOpacity style={styles.emptyStateButton} onPress={fetchShows}>
        <Text style={styles.emptyStateButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  // Render header with filter info
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>
        {shows.length === 0
          ? 'No shows found'
          : shows.length === 1
          ? '1 show found'
          : `${shows.length} shows found`}
      </Text>
      <Text style={styles.headerSubtitle}>
        Within {filters.radius} miles
        {filters.startDate && filters.endDate
          ? ` • ${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`
          : ''}
      </Text>
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setFilterVisible(true)}
      >
        <Ionicons name="options-outline" size={20} color="#007AFF" />
        <Text style={styles.filterButtonText}>Filter</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading card shows...</Text>
        </View>
      ) : (
        <FlatList
          data={shows}
          renderItem={renderShowItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#007AFF']}
              tintColor="#007AFF"
            />
          }
        />
      )}

      {/* Filter Sheet - To be implemented later */}
      {/* <FilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filters={filters}
        onApplyFilters={handleFilterChange}
      /> */}
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Extra padding at bottom for better UX
  },
  headerContainer: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f2ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  filterButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  showCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  showImageContainer: {
    width: 100,
    height: 120,
  },
  showImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  showInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  showTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  showDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  showDetailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  featureTag: {
    backgroundColor: '#e6f2ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 12,
    color: '#007AFF',
  },
  chevron: {
    alignSelf: 'center',
    marginRight: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginTop: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyStateButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyStateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default HomeScreen;
