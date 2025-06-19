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
    console.log('[HomeScreen] Starting fetchShows()');
    try {
      setLoading(true);
      let showsData: Show[] = [];
      let locationCoords: Coordinates | null = null;

      // If user has a home ZIP code, use that
      if (user?.homeZipCode) {
        console.log('[HomeScreen] Using home ZIP code', user.homeZipCode);
        try {
          const zipData = await getZipCodeCoordinates(user.homeZipCode);
          if (zipData) {
            locationCoords = zipData.coordinates;
            console.log('[HomeScreen] Coordinates resolved from ZIP:', locationCoords);
          } else {
            console.warn('[HomeScreen] Failed to get coordinates for ZIP code', user.homeZipCode);
          }
        } catch (zipError) {
          console.error('[HomeScreen] Error getting ZIP coordinates:', zipError);
          // Continue with null coordinates - will use basic query
        }
      } else {
        // Otherwise, try to get current location
        console.log('[HomeScreen] No home ZIP code, trying current location');
        try {
          locationCoords = await getCurrentLocation();
          console.log('[HomeScreen] Current location coordinates:', locationCoords);
        } catch (locationError) {
          console.error('[HomeScreen] Error getting current location:', locationError);
          // Continue with null coordinates - will use basic query
        }
      }

      // Create a safe copy of filters with defaults
      const currentFilters: ShowFilters = { 
        ...filters,
        radius: filters.radius || 25,
        startDate: filters.startDate || new Date(),
        endDate: filters.endDate || new Date(new Date().setDate(new Date().getDate() + 30))
      };
      
      if (locationCoords) {
        currentFilters.latitude = locationCoords.latitude;
        currentFilters.longitude = locationCoords.longitude;
      }

      console.log('[HomeScreen] Final filters sent to getShows:', currentFilters);

      try {
        showsData = await getShows(currentFilters);
        console.log(`[HomeScreen] Got ${showsData.length} shows from getShows()`);
        setShows(showsData);
      } catch (showError: any) {
        console.error('[HomeScreen] getShows() threw', showError);
        console.error('[HomeScreen] Error fetching shows:', showError);
        
        // Try one more time with basic filters
        try {
          console.log('[HomeScreen] Attempting fallback with basic filters');
          const basicFilters: ShowFilters = {
            startDate: new Date(),
            endDate: new Date(new Date().setDate(new Date().getDate() + 30)),
          };
          showsData = await getShows(basicFilters);
          console.log(`[HomeScreen] Fallback got ${showsData.length} shows`);
          setShows(showsData);
        } catch (fallbackError) {
          console.error('[HomeScreen] Fallback getShows() also failed:', fallbackError);
          // Set empty array to prevent undefined errors
          setShows([]);
          Alert.alert('Error', 'Failed to load card shows. Please try again.');
        }
      }
    } catch (error) {
      console.error('[HomeScreen] Unhandled error in fetchShows:', error);
      Alert.alert('Error', 'Failed to load card shows. Please try again.');
      // Set empty array to prevent undefined errors
      setShows([]);
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
      {user?.firstName && (
        <Text style={styles.welcomeMessage}>
          {`Welcome Back, ${user.firstName}`}
        </Text>
      )}
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
  welcomeMessage: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
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
