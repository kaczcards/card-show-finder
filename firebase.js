import { getApps, initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  query, 
  where,
  orderBy,
  GeoPoint,
  limit
} from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyBlEYZEDfYydaQw2FysfQIeroR_i6V5zuY",
  authDomain: "YOUR_DOMAIN.firebaseapp.com", 
  projectId: "card-show-finder",
  storageBucket: "YOUR_BUCKET.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID" 
};

// Initialize Firebase only if not already initialized
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

const db = getFirestore(app);

// Collection reference
const SHOWS_COLLECTION = 'cardShows';

// Get all card shows
export const getCardShows = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, SHOWS_COLLECTION));
    const shows = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      shows.push({
        id: doc.id,
        ...data,
        date: data.date ? data.date.toDate() : new Date(), // Convert Firestore timestamp to JS Date
      });
    });
    
    return { shows, error: null };
  } catch (error) {
    console.error("Error getting shows:", error);
    return { shows: [], error: error.message };
  }
};

// Get card shows by location
export const getCardShowsByLocation = async (latitude, longitude, radiusInMiles = 50) => {
  try {
    // Get all shows (for simple implementation)
    // For production, use a geospatial solution like Firestore with geohashing
    const { shows, error } = await getCardShows();
    
    if (error) {
      return { shows: [], error };
    }
    
    // Filter shows by distance
    const filteredShows = shows.filter(show => {
      if (!show.coordinate) return false;
      
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
    console.error("Error getting shows by location:", error);
    return { shows: [], error: error.message };
  }
};

// Get card show details 
export const getCardShowDetails = async (showId) => {
  try {
    const docRef = doc(db, SHOWS_COLLECTION, showId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return { 
        show: {
          id: docSnap.id,
          ...data,
          date: data.date ? data.date.toDate() : new Date(),
        },
        error: null 
      };
    } else {
      return { show: null, error: "Show not found" };
    }
  } catch (error) {
    console.error("Error getting show details:", error);
    return { show: null, error: error.message };
  }
};

// Export both auth and db
export { db, auth };