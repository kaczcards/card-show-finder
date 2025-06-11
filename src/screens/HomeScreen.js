import React, { useState, useEffect } from 'react';
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
import { getCardShows } from '../services/firebaseApi';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { userProfile } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [cardShows, setCardShows] = useState([]);
  const [filteredShows, setFilteredShows] = useState([]);
  const [sortOption, setSortOption] = useState('date');
  const [error, setError] = useState(null);

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
      
      {/* Your actual UI components here */}
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
          </TouchableOpacity>
        )}
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
  },  // Added comma here
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 16,
    paddingHorizontal: 16,
    color: '#212529',
  },
});

export default HomeScreen;