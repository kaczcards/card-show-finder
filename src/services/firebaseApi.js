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
    },
    categories: ['Sports Cards', 'Baseball Cards', 'Basketball Cards', 'Football Cards', 'Hockey Cards', 'Memorabilia'],
    hasOnsiteGrading: true,
    hasAutographGuests: true,
    description: 'The largest sports collectibles show in the nation featuring hundreds of dealers, authentication services, and special athlete appearances.'
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
    },
    categories: ['Sports Cards', 'Pokemon Cards', 'Yu-Gi-Oh!', 'Magic: The Gathering'],
    hasOnsiteGrading: false,
    hasAutographGuests: false,
    description: 'A family-friendly card trading event focusing on both sports and gaming cards.'
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
    },
    categories: ['Sports Cards', 'Baseball Cards', 'Vintage Cards'],
    hasOnsiteGrading: true,
    hasAutographGuests: false,
    description: 'Specializing in pre-1980 baseball cards with expert dealers and appraisers on site.'
  },
  {
    id: '4',
    title: 'Modern Basketball Showcase',
    location: 'United Center Annex',
    address: '1901 W Madison St, Chicago, IL 60612',
    date: new Date(2025, 7, 18),
    image: 'https://via.placeholder.com/150',
    entryFee: '$15.00',
    coordinate: {
      latitude: 41.8807,
      longitude: -87.6742
    },
    categories: ['Sports Cards', 'Basketball Cards', 'Modern Cards'],
    hasOnsiteGrading: true,
    hasAutographGuests: true,
    description: 'Featuring the latest basketball card releases, autograph sessions with current NBA players, and on-site grading.'
  },
  {
    id: '5',
    title: 'Pokemon & TCG Festival',
    location: 'Gaming Paradise',
    address: '555 Gamer Blvd, Schaumburg, IL 60173',
    date: new Date(2025, 8, 10),
    image: 'https://via.placeholder.com/150',
    entryFee: 'Free',
    coordinate: {
      latitude: 42.0334,
      longitude: -88.0834
    },
    categories: ['Pokemon Cards', 'Magic: The Gathering', 'Yu-Gi-Oh!', 'Other TCGs'],
    hasOnsiteGrading: false,
    hasAutographGuests: false,
    description: 'A trading card game festival with tournaments, trading areas, and new release showcases.'
  },
  {
    id: '6',
    title: 'Autograph Collectors Expo',
    location: 'Signature Hall',
    address: '222 Celebrity Way, Rosemont, IL 60018',
    date: new Date(2025, 8, 25),
    image: 'https://via.placeholder.com/150',
    entryFee: '$25.00',
    coordinate: {
      latitude: 41.9865,
      longitude: -87.8612
    },
    categories: ['Autographs', 'Memorabilia', 'Sports Cards'],
    hasOnsiteGrading: false,
    hasAutographGuests: true,
    description: 'Premium show featuring dozens of athletes and celebrities signing autographs throughout the weekend.'
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
  
  // Parse boolean that may have come in as string
  if (typeof data.isPremium === 'string') {
    data.isPremium = data.isPremium === 'true';
  }

  // Convert categories back from JSON string (if saved that way)
  if (typeof data.categories === 'string') {
    try {
      data.categories = JSON.parse(data.categories);
    } catch {
      /* ignore – leave as-is */
    }
  }

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

    // Show must be approved to be visible to attendees
    const approvedShows = shows.filter((s) => s.status === 'approved');

    // Premium listings first, then by date asc
    approvedShows.sort((a, b) => {
      if (a.isPremium === b.isPremium) {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateA - dateB;
      }
      return a.isPremium ? -1 : 1;
    });

    return { shows: approvedShows, error: null };
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

    // preserve premium-first order coming from getCardShows()
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

// ----------------------------- CRUD HELPERS ----------------------------- //

// Helper: convert plain JS object to Firestore REST "fields" representation
const toFirestoreFields = (data) => {
  const fields = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    switch (typeof value) {
      case 'string':
        fields[key] = { stringValue: value };
        break;
      case 'number':
        // Firestore distinguishes int vs double, but doubleValue works for both
        fields[key] = { doubleValue: value };
        break;
      case 'boolean':
        fields[key] = { booleanValue: value };
        break;
      case 'object':
        if (value instanceof Date) {
          fields[key] = { timestampValue: value.toISOString() };
        } else if (Array.isArray(value)) {
          // Store arrays as comma-separated strings for simplicity
          fields[key] = { stringValue: JSON.stringify(value) };
        } else {
          // Map (e.g., coordinate)
          const mapFields = {};
          Object.entries(value).forEach(([k, v]) => {
            mapFields[k] =
              typeof v === 'number'
                ? { doubleValue: v }
                : { stringValue: String(v) };
          });
          fields[key] = { mapValue: { fields: mapFields } };
        }
        break;
    }
  });
  return { fields };
};

// Create a new card show
export const createCardShow = async (showData) => {
  try {
    // Ensure required default fields exist
    const payloadData = {
      isPremium: false,
      status: 'pending',      // pending review
      paymentStatus: 'unpaid',
      ...showData
    };

    const payload = toFirestoreFields(payloadData);
    const res = await axios.post(
      `${BASE_URL}/${COLLECTION_NAME}?key=${API_KEY}`,
      payload
    );
    const show = parseFirestoreDoc(res.data);
    return { success: true, showId: show.id, error: null };
  } catch (error) {
    console.error('Error creating card show:', error);
    return { success: false, error: error.message };
  }
};

// Update existing card show
export const updateCardShow = async (showId, updateData) => {
  try {
    const payload = toFirestoreFields(updateData);
    await axios.patch(
      `${BASE_URL}/${COLLECTION_NAME}/${showId}?key=${API_KEY}&updateMask.fieldPaths=*`,
      payload
    );
    return { success: true, error: null };
  } catch (error) {
    console.error('Error updating card show:', error);
    return { success: false, error: error.message };
  }
};

// Update premium status & payment state for a show
export const updateShowPremiumStatus = async (
  showId,
  isPremium = true,
  paymentStatus = 'paid'
) => {
  try {
    const partial = {
      isPremium,
      paymentStatus,
      status: 'approved' // once paid we mark approved automatically
    };
    const payload = toFirestoreFields(partial);
    await axios.patch(
      `${BASE_URL}/${COLLECTION_NAME}/${showId}?key=${API_KEY}&updateMask.fieldPaths=isPremium&updateMask.fieldPaths=paymentStatus&updateMask.fieldPaths=status`,
      payload
    );
    return { success: true, error: null };
  } catch (error) {
    console.error('Error updating premium status:', error);
    return { success: false, error: error.message };
  }
};

// Delete a card show
export const deleteCardShow = async (showId) => {
  try {
    await axios.delete(
      `${BASE_URL}/${COLLECTION_NAME}/${showId}?key=${API_KEY}`
    );
    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting card show:', error);
    return { success: false, error: error.message };
  }
};

// Fetch shows created by a specific promoter
export const getPromoterShows = async (promoterId) => {
  try {
    const res = await axios.get(
      `${BASE_URL}/${COLLECTION_NAME}?key=${API_KEY}&pageSize=1000`
    );
    const all = res.data.documents
      ? res.data.documents.map(parseFirestoreDoc)
      : [];
    const shows = all.filter((s) => s.promoterId === promoterId);
    return { shows, error: null };
  } catch (error) {
    console.error('Error fetching promoter shows:', error);
    return { shows: [], error: error.message };
  }
};

// Increment analytics metric (e.g., views, favorites)
export const incrementShowMetric = async (showId, metricField = 'views', amount = 1) => {
  try {
    const payload = {
      fields: {},
      updateMask: { fieldPaths: [ `analytics.${metricField}` ] },
      currentDocument: { exists: true },
      /* Use fieldTransforms for increment */
      fieldTransforms: [
        {
          fieldPath: `analytics.${metricField}`,
          increment: { integerValue: amount }
        }
      ]
    };

    await axios.patch(
      `${BASE_URL}/${COLLECTION_NAME}/${showId}:commit?key=${API_KEY}`,
      { writes: [payload] }
    );
    return { success: true, error: null };
  } catch (error) {
    console.error('Error incrementing metric:', error);
    return { success: false, error: error.message };
  }
};
