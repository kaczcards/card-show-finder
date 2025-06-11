import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getCardShowDetails } from '../services/firebaseApi';

const ShowDetailsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { show: initialShow, showId } = route.params;
  
  const [show, setShow] = useState(initialShow || null);
  const [loading, setLoading] = useState(!initialShow && !!showId);
  const [error, setError] = useState(null);

  // If we have a showId but not the full show data, fetch it
  useEffect(() => {
    const fetchShowDetails = async () => {
      if (!showId || initialShow) return;
      
      try {
        setLoading(true);
        const { show: fetchedShow, error } = await getCardShowDetails(showId);
        
        if (error) {
          setError(error);
          return;
        }
        
        setShow(fetchedShow);
      } catch (err) {
        setError('Failed to load show details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchShowDetails();
  }, [showId, initialShow]);

  // Format date properly
  const formatDate = (date) => {
    if (!date) return 'Date not available';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date instanceof Date ? date.toLocaleDateString('en-US', options) : 'Date unavailable';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading show details...</Text>
      </View>
    );
  }
  
  if (error || !show) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#dc3545" />
        <Text style={styles.errorText}>Could not load show details</Text>
        <TouchableOpacity 
          style={styles.goBackButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Added show details rendering
  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: show.image || 'https://via.placeholder.com/400x200?text=No+Image' }}
          style={styles.image}
          resizeMode="cover"
        />
      </View>

      <View style={styles.detailsContainer}>
        <Text style={styles.title}>{show.title}</Text>
        
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={20} color="#3498db" />
          <Text style={styles.detailText}>{formatDate(show.date)}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="location" size={20} color="#3498db" />
          <Text style={styles.detailText}>{show.location}</Text>
        </View>
        
        {show.address && (
          <View style={styles.detailRow}>
            <Ionicons name="map" size={20} color="#3498db" />
            <Text style={styles.detailText}>{show.address}</Text>
          </View>
        )}
        
        {show.entryFee && (
          <View style={styles.detailRow}>
            <Ionicons name="cash" size={20} color="#3498db" />
            <Text style={styles.detailText}>Entry Fee: {show.entryFee}</Text>
          </View>
        )}

        {show.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionTitle}>About This Show</Text>
            <Text style={styles.description}>{show.description}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.button}>
          <Ionicons name="heart" size={18} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Add to Favorites</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// Complete styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#e9ecef',
  },
  image: {
    width: '100%',
    height: 200,
  },
  detailsContainer: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 16,
    color: '#495057',
    marginLeft: 8,
    flex: 1,
  },
  descriptionContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#495057',
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
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
    marginBottom: 24,
  },
  goBackButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  goBackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ShowDetailsScreen;