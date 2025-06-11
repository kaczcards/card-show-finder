import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform
} from 'react-native';
import { useUser } from '../context/UserContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getCardShows } from '../services/firebaseApi';
import FilterPanel from '../components/FilterPanel';
import { saveFilterPreferences, loadFilterPreferences } from '../services/filterPreferencesService';

// Skeleton loading component for better UX
const ShowSkeleton = () => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonTitle} />
    <View style={styles.skeletonLocation} />
    <View style={styles.skeletonDate} />
  </View>
);

const HomeScreen = () => {
  const navigation = useNavigation();
  const { userProfile } = useUser();
  
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [cardShows, setCardShows] = useState([]);
  const [filteredShows, setFilteredShows] = useState([]);
  const [sortOption, setSortOption] = useState('date');
  const [error, setError] = useState(null);
  
  // Filter state
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    startDate: new Date(),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    categories: [],
    features: {
      onSiteGrading: false,
      autographGuests: false
    },
    priceRange: [0, 100]
  });
  
  // Animation for filter panel
  const filterPanelHeight = new Animated.Value(0);
  
  // Set up header button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={toggleFilterPanel}
        >
          <Ionicons 
            name={showFilterPanel ? "options" : "options-outline"} 
            size={24} 
            color="#3498db" 
          />
          {hasActiveFilters() && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>
                {countActiveFilters()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, showFilterPanel, activeFilters]);
  
  // Check if any filters are active
  const hasActiveFilters = () => {
    return (
      activeFilters.categories.length > 0 ||
      activeFilters.features.onSiteGrading ||
      activeFilters.features.autographGuests ||
      activeFilters.priceRange[1] < 100
    );
  };
  
  // Count active filters for badge
  const countActiveFilters = () => {
    let count = 0;
    if (activeFilters.categories.length > 0) count++;
    if (activeFilters.features.onSiteGrading) count++;
    if (activeFilters.features.autographGuests) count++;
    if (activeFilters.priceRange[1] < 100) count++;
    return count;
  };
  
  // Toggle filter panel visibility
  const toggleFilterPanel = () => {
    const newValue = !showFilterPanel;
    setShowFilterPanel(newValue);
    
    Animated.timing(filterPanelHeight, {
      toValue: newValue ? 1 : 0,
      duration: 300,
      useNativeDriver: false
    }).start();
  };
  
  // Load saved filter preferences
  useEffect(() => {
    const loadSavedFilters = async () => {
      try {
        console.log("Loading saved filter preferences...");
        const savedFilters = await loadFilterPreferences();
        if (savedFilters) {
          console.log("Loaded filters:", JSON.stringify(savedFilters));
          setActiveFilters(savedFilters);
        }
      } catch (error) {
        console.error("Error loading filter preferences:", error);
      }
    };
    
    loadSavedFilters();
  }, []);
  
  // Handle filter changes
  const handleFiltersChange = (newFilters) => {
    try {
      console.log("Filter changed to:", JSON.stringify(newFilters));
      setActiveFilters(newFilters);
      // Save filter preferences locally
      saveFilterPreferences(newFilters);
      // Apply filters
      applyFilters(cardShows, newFilters);
    } catch (error) {
      console.error("Error handling filter changes:", error);
    }
  };
  
  // Apply filters to shows
  const applyFilters = (shows, filters = activeFilters) => {
    try {
      console.log("Applying filters to", shows?.length || 0, "shows");
      
      if (!shows || !Array.isArray(shows) || shows.length === 0) {
        console.log("No shows to filter");
        setFilteredShows([]);
        return;
      }
      
      const filtered = shows.filter(show => {
        // Filter by date range
        if (show.date) {
          // Ensure we're working with Date objects
          const showDate = show.date instanceof Date ? 
            show.date : 
            new Date(show.date);
          
          const startDate = filters.startDate instanceof Date ?
            filters.startDate :
            new Date(filters.startDate);
            
          const endDate = filters.endDate instanceof Date ?
            filters.endDate :
            new Date(filters.endDate);
          
          console.log(`Comparing dates: Show ${showDate.toISOString()}, Filter range: ${startDate.toISOString()} - ${endDate.toISOString()}`);
          
          // Check if date is valid before comparing
          if (isNaN(showDate.getTime())) {
            console.log(`Invalid show date for ${show.title}`);
            return false;
          }
          
          if (showDate < startDate || showDate > endDate) {
            console.log(`${show.title} filtered out by date range`);
            return false;
          }
        }
        
        // Filter by categories
        if (filters.categories && filters.categories.length > 0) {
          if (!show.categories || !Array.isArray(show.categories)) {
            console.log(`${show.title} has no categories`);
            return false;
          }
          
          // Check if show has at least one of the selected categories
          const hasMatchingCategory = filters.categories.some(category => 
            show.categories.includes(category)
          );
          
          if (!hasMatchingCategory) {
            console.log(`${show.title} filtered out by categories`);
            return false;
          }
        }
        
        // Filter by features
        if (filters.features.onSiteGrading && !show.hasOnsiteGrading) {
          console.log(`${show.title} filtered out by onSiteGrading`);
          return false;
        }
        
        if (filters.features.autographGuests && !show.hasAutographGuests) {
          console.log(`${show.title} filtered out by autographGuests`);
          return false;
        }
        
        // Filter by price
        if (show.entryFee) {
          // Convert price string to number (remove $ and parse)
          const priceString = typeof show.entryFee === 'string' ? show.entryFee.replace('$', '') : '0';
          const price = parseFloat(priceString);
          
          if (!isNaN(price) && price > filters.priceRange[1]) {
            console.log(`${show.title} filtered out by price: ${price} > ${filters.priceRange[1]}`);
            return false;
          }
        }
        
        return true;
      });
      
      console.log(`Filtering complete: ${filtered.length} shows match filters out of ${shows.length}`);
      setFilteredShows(filtered);
    } catch (error) {
      console.error("Error applying filters:", error);
      // If filtering fails, show all shows
      setFilteredShows(shows || []);
    }
  };
  
  // Move fetchShows outside useEffect to make it accessible for retry button
  const fetchShows = async () => {
    try {
      setLoading(true);
      console.log("Fetching card shows...");
      const { shows, error: fetchError } = await getCardShows();
      
      if (fetchError) {
        console.error("Error fetching shows:", fetchError);
        setError(fetchError);
        return;
      }
      
      if (!shows || !Array.isArray(shows)) {
        console.error("Invalid shows data returned:", shows);
        setError("Invalid data format received");
        return;
      }
      
      console.log(`Fetched ${shows.length} shows`);
      
      // Add mock categories and features if they don't exist
      const enhancedShows = shows.map(show => ({
        ...show,
        categories: show.categories || ['Sports Cards', 'Baseball Cards'],
        hasOnsiteGrading: show.hasOnsiteGrading || Math.random() > 0.5,
        hasAutographGuests: show.hasAutographGuests || Math.random() > 0.5,
      }));
      
      setCardShows(enhancedShows);
      
      // Apply any active filters
      applyFilters(enhancedShows);
    } catch (err) {
      console.error("Unexpected error fetching shows:", err);
      setError('Failed to load card shows');
    } finally {
      setLoading(false);
    }
  };

  // Fetch card shows when component mounts
  useEffect(() => {
    fetchShows();
  }, []);

  // Error handling
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={60} color="#dc3545" />
        <Text style={styles.errorText}>Failed to load card shows</Text>
        <Text style={styles.errorSubtext}>
          There was a problem loading the data. Please try again.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchShows}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render skeleton loading
  if (loading) {
    return (
      <View style={styles.container}>
        {userProfile && (
          <Text style={styles.welcomeText}>
            Hello, {userProfile.firstName}! Finding card shows...
          </Text>
        )}
        
        <View style={styles.skeletonContainer}>
          {[...Array(5)].map((_, index) => (
            <ShowSkeleton key={index} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {userProfile && (
        <Text style={styles.welcomeText}>
          Hello, {userProfile.firstName}! Here are upcoming card shows near you.
        </Text>
      )}
      
      {/* Filter panel */}
      {showFilterPanel && (
        <Animated.View 
          style={[
            styles.filterPanelContainer,
            {
              maxHeight: filterPanelHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 500]
              })
            }
          ]}
        >
          <FilterPanel 
            onFiltersChange={handleFiltersChange}
            initialFilters={activeFilters}
          />
        </Animated.View>
      )}
      
      {/* Results count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {filteredShows.length} {filteredShows.length === 1 ? 'show' : 'shows'} found
        </Text>
        {hasActiveFilters() && (
          <TouchableOpacity 
            onPress={() => handleFiltersChange({
              startDate: new Date(),
              endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
              categories: [],
              features: {
                onSiteGrading: false,
                autographGuests: false
              },
              priceRange: [0, 100]
            })}
          >
            <Text style={styles.clearFilters}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Show list */}
      <FlatList
        data={filteredShows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.card}
            onPress={() => navigation.navigate('ShowDetails', { show: item })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.title}>{item.title}</Text>
              {item.entryFee && (
                <Text style={styles.entryFee}>{item.entryFee}</Text>
              )}
            </View>
            <Text style={styles.location}>{item.location}</Text>
            {item.date && <Text style={styles.date}>{new Date(item.date).toDateString()}</Text>}
            
            {/* Feature badges */}
            <View style={styles.featureBadges}>
              {item.hasOnsiteGrading && (
                <View style={styles.featureBadge}>
                  <Ionicons name="shield-checkmark-outline" size={12} color="#3498db" />
                  <Text style={styles.featureBadgeText}>On-site Grading</Text>
                </View>
              )}
              {item.hasAutographGuests && (
                <View style={styles.featureBadge}>
                  <Ionicons name="pencil-outline" size={12} color="#3498db" />
                  <Text style={styles.featureBadgeText}>Autograph Guests</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={60} color="#adb5bd" />
            <Text style={styles.emptyText}>No shows match your filters</Text>
            <TouchableOpacity 
              style={styles.resetFiltersButton}
              onPress={() => handleFiltersChange({
                startDate: new Date(),
                endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
                categories: [],
                features: {
                  onSiteGrading: false,
                  autographGuests: false
                },
                priceRange: [0, 100]
              })}
            >
              <Text style={styles.resetFiltersText}>Reset Filters</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
  },
  filterButton: {
    padding: 8,
    marginRight: 16,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#dc3545',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  filterPanelContainer: {
    overflow: 'hidden',
    marginBottom: 10,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  resultsCount: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  clearFilters: {
    fontSize: 14,
    color: '#3498db',
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
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
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginBottom: 6,
  },
  entryFee: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#28a745',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    marginLeft: 8,
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 8,
  },
  featureBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  featureBadgeText: {
    fontSize: 12,
    color: '#3498db',
    marginLeft: 4,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#212529',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  resetFiltersButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  resetFiltersText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Skeleton styles
  skeletonContainer: {
    flex: 1,
  },
  skeletonCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  skeletonTitle: {
    height: 20,
    width: '80%',
    backgroundColor: '#f1f3f5',
    borderRadius: 4,
    marginBottom: 12,
  },
  skeletonLocation: {
    height: 16,
    width: '60%',
    backgroundColor: '#f1f3f5',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonDate: {
    height: 16,
    width: '40%',
    backgroundColor: '#f1f3f5',
    borderRadius: 4,
  },
});

export default HomeScreen;
