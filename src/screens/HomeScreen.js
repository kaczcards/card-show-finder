import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useUser } from '../context/UserContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import FilterModal from './FilterModal';
import { getCardShows, getCardShowsByLocation } from '../services/firebaseApi';

// ---- helpers -------------------------------------------------------------
// convert US zip to lat/lon via Zippopotam.us
const zipToCoords = async (zip) => {
  if (!zip) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return null;
    return {
      latitude: parseFloat(place.latitude),
      longitude: parseFloat(place.longitude),
    };
  } catch {
    return null;
  }
};

// Haversine distance in miles
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const HomeScreen = () => {
  const navigation = useNavigation();
  const { userProfile } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [cardShows, setCardShows] = useState([]);
  const [filteredShows, setFilteredShows] = useState([]);
  const [sortOption, setSortOption] = useState('date');
  const [error, setError] = useState(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  // ----- Default filters -----
  const defaultFilters = {
    distance: 25,
    dateRange: {
      start: new Date(),
      end: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d;
      })(),
    },
    categories: [],
    features: {
      onSiteGrading: false,
      autographGuests: false,
      freeAdmission: false
    }
  };
  const [filters, setFilters] = useState(defaultFilters);

  // Move fetchShows outside useEffect to make it accessible for retry button
  const fetchShows = async () => {
    try {
      setLoading(true);
      const { shows, error } = await getCardShows();
      
      if (error) {
        setError(error);
        return;
      }
      
      setCardShows(shows);
      setFilteredShows(shows);
    } catch (err) {
      setError('Failed to load card shows');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch card shows when component mounts
  useEffect(() => {
    fetchShows();
  }, []);

  // Add Filter button to header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={{ marginRight: 16 }}
          onPress={() => setIsFilterVisible(true)}
        >
          <Ionicons name="filter" size={24} color="#3498db" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // Apply filters coming from modal
  const handleApplyFilters = async (newFilters) => {
    setLoading(true);
    setFilters(newFilters);

    try {
      // ---- 1. Location filtering -----------------------------------------
      let showsByDistance = cardShows;
      if (newFilters.distance) {
        // determine user coords
        let coords = await zipToCoords(userProfile?.zipCode);
        // if we have coords call API else fall back to manual distance calc
        if (coords) {
          const { shows } = await getCardShowsByLocation(
            coords.latitude,
            coords.longitude,
            newFilters.distance
          );
          showsByDistance = shows;
        } else {
          // manual filter using haversine against first show with coords
          showsByDistance = cardShows.filter((s) => {
            if (!s.coordinate) return false;
            const dist = calculateDistance(
              41.8781,
              -87.6298,
              s.coordinate.latitude,
              s.coordinate.longitude
            ); // default Chicago reference
            return dist <= newFilters.distance;
          });
        }
      }

      // ---- 2. Date range --------------------------------------------------
      const { start, end } = newFilters.dateRange;
      let filtered = showsByDistance.filter((show) => {
        if (!show.date) return false;
        const date = show.date instanceof Date ? show.date : new Date(show.date);
        return date >= start && date <= end;
      });

      // ---- 3. Categories --------------------------------------------------
      if (newFilters.categories && newFilters.categories.length) {
        filtered = filtered.filter((s) =>
          newFilters.categories.some((cat) =>
            (s.categories || []).includes(cat)
          )
        );
      }

      // ---- 4. Features ----------------------------------------------------
      const activeFeatureKeys = Object.keys(newFilters.features || {}).filter(
        (k) => newFilters.features[k]
      );
      if (activeFeatureKeys.length) {
        filtered = filtered.filter((s) =>
          activeFeatureKeys.every((feat) => s.features?.[feat])
        );
      }

      setFilteredShows(filtered);
    } catch (e) {
      console.warn('filter error', e);
    } finally {
      setLoading(false);
    }
  };

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

  // Loading state
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading card shows...</Text>
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
      
      {/* Card Shows List */}
      <FlatList
        data={filteredShows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.card}
            onPress={() => navigation.navigate('ShowDetails', { show: item })}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.location}>{item.location}</Text>
            {item.date && <Text>{item.date.toDateString()}</Text>}
            {item.distance && <Text style={styles.distance}>{item.distance}</Text>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color="#6c757d" />
            <Text style={styles.emptyText}>No card shows found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters or check back later</Text>
          </View>
        }
      />

      {/* Filter Modal */}
      <FilterModal
        visible={isFilterVisible}
        onClose={() => setIsFilterVisible(false)}
        onApply={handleApplyFilters}
        initialFilters={filters}
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
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  distance: {
    fontSize: 12,
    color: '#28a745',
    marginTop: 4,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 16,
    color: '#212529',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6c757d',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default HomeScreen;
