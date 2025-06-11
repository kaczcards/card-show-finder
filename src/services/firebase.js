// src/services/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBlEYZEDfYydaQw2FysfQIeroR_i6V5zuY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "card-show-finder",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };

// Placeholder functions until Firebase is properly set up
export const getCardShows = async () => {
  return { shows: [], error: null };
};

export const getCardShowsByLocation = async (lat, lng, radius) => {
  return { shows: [], error: null };
};

export const getCardShowDetails = async (id) => {
  return { show: null, error: null };
};