// src/services/firebaseApi.js
import axios from 'axios';

// =========================================================================
// IMPORTANT: Replace these values with your actual Firebase project details
// =========================================================================
const PROJECT_ID = 'card-show-finder'; // From Firebase console
const API_KEY = 'AIzaSyBlEYZEDfYydaQw2FysfQIeroR_i6V5zuY';       // Web API key from Firebase console
const COLLECTION_NAME = 'cardShows';  // Your Firestore collection name

// Base URL for Cloud Firestore REST API
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Mock data as fallback if API fails
const MOCK_CARD_SHOWS = [
  {
    id: '1',
    title: 'National Sports Collectors Convention',
    location: 'Chicago Convention Center',
    address: '123 Convention Way, Chicago, IL 60601',
    date: new Date(2025, 6, 15),
    image: 'https://via.placeholder.com/150',
    entryFee: '$10.00',
    coordinate: {
      latitude: 41.8781,
      longitude: -87.6298
    }
  },
  {
    id: '2',
    title: 'Regional Trading Card Expo',
    location: 'Community Center',
    address: '456 Main St, Evanston, IL 60201',
    date: new Date(2025, 6, 22),
    image: 'https://via.placeholder.com/150',
    entryFee: '$5.00',
    coordinate: {
      latitude: 42.0451,
      longitude: -87.6877
    }
  },
  {
    id: '3',
    title: 'Vintage Baseball Card Show',
    location: 'Sports Memorabilia Hall',
    address: '789 Collector Ave, Oak Park, IL 60302',
    date: new Date(2025, 7, 5),
    image: 'https://via.placeholder.com/150',
    entryFee: '$7.50',
    coordinate: {
      latitude: 41.8850,
      longitude: -87.7845
    }
  }
];

// Helper to parse Firestore document
const parseFirestoreDoc = (doc) => {
  const id = doc.name.split('/').pop();
  const data = {};
  
  // Convert Firestore fields to regular JS object
  Object.keys(doc.fields || {}).forEach(key => {
    if (doc.fields[key].stringValue !== undefined) {
      data[key] = doc.fields[key].stringValue;
    } else if (doc.fields[key].doubleValue !== undefined) {
      data[key] = doc.fields[key].doubleValue;
    } else if (doc.fields[key].integerValue !== undefined) {
      data[key] = parseInt(doc.fields[key].integerValue);
    } else if (doc.fields[key].booleanValue !== undefined) {
      data[key] = doc.fields[key].booleanValue;
    } else if (doc.fields[key].timestampValue !== undefined) {
      data[key] = new Date(doc.fields[key].timestampValue);
    } else if (doc.fields[key].mapValue !== undefined) {
      // Handle nested objects like coordinates
      const mapData = {};
      const fields = doc.fields[key].mapValue.fields || {};
      Object.keys(fields).forEach(fieldKey => {
        if (fields[fieldKey].doubleValue !== undefined) {
          mapData[fieldKey] = fields[fieldKey].doubleValue;
        } else if (fields[fieldKey].stringValue !== undefined) {
          mapData[fieldKey] = fields[fieldKey].stringValue;
        }
      });
      data[key] = mapData;
    }
  });
  
  // Handle date specially
  if (data.date && typeof data.date === 'string') {
    data.date = new Date(data.date);
  }
  
  return { id, ...data };
};

export const getCardShows = async () => {
  try {
    const response = await axios.get(
      `${BASE_URL}/${COLLECTION_NAME}?key=${API_KEY}`
    );
    
    // Transform Firestore document format to a simpler format
    const shows = response.data.documents 
      ? response.data.documents.map(parseFirestoreDoc) 
      : [];
    
    return { shows, error: null };
  } catch (error) {
    console.error('Error fetching card shows:', error);
    console.log('Falling back to mock data');
    return { shows: MOCK_CARD_SHOWS, error: null };
  }
};

export const getCardShowsByLocation = async (latitude, longitude, radiusInMiles = 50) => {
  try {
    const { shows, error } = await getCardShows();
    
    if (error) {
      return { shows: [], error };
    }
    
    // Filter shows by distance
    const filteredShows = shows.filter(show => {
      if (!show.coordinate || !show.coordinate.latitude || !show.coordinate.longitude) {
        return false;
      }
      
      // Calculate distance using Haversine formula
      const R = 3958.8; // Earth's radius in miles
      const dLat = (show.coordinate.latitude - latitude) * Math.PI / 180;
      const dLon = (show.coordinate.longitude - longitude) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(latitude * Math.PI / 180) * Math.cos(show.coordinate.latitude * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      // Add distance to show object
      show.distance = `${distance.toFixed(1)} miles away`;
      
      return distance <= radiusInMiles;
    });
    
    return { shows: filteredShows, error: null };
  } catch (error) {
    console.error("Error filtering shows by location:", error);
    
    // Return mock data filtered by location
    const filteredMockShows = MOCK_CARD_SHOWS.map(show => {
      // Calculate mock distance
      const distance = Math.random() * 30; // Random distance up to 30 miles
      return {
        ...show,
        distance: `${distance.toFixed(1)} miles away`
      };
    });
    
    return { shows: filteredMockShows, error: null };
  }
};

export const getCardShowDetails = async (showId) => {
  try {
    const response = await axios.get(
      `${BASE_URL}/${COLLECTION_NAME}/${showId}?key=${API_KEY}`
    );
    
    const show = parseFirestoreDoc(response.data);
    return { show, error: null };
  } catch (error) {
    console.error("Error getting show details:", error);
    
    // Find show in mock data
    const mockShow = MOCK_CARD_SHOWS.find(show => show.id === showId);
    if (mockShow) {
      return { show: mockShow, error: null };
    }
    
    return { show: null, error: "Show not found" };
  }
};