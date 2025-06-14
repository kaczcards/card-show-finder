import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

// Initialize Firebase (use your actual Firebase config)
const firebaseConfig = {
  apiKey: "AIzaSyBlEYZEDfYydaQw2FysfQIeroR_i6V5zuY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "card-show-finder",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase app if not already initialized
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  // App already initialized
  console.log("Firebase already initialized");
}

const auth = getAuth(app);
const db = getFirestore(app);

// Register new user
export const registerUser = async (email, password, userData, role = 'attendee') => {
  try {
    // Create authentication record
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Store additional user data in Firestore
    await setDoc(doc(db, "users", user.uid), {
      email: email,
      firstName: userData.firstName || '',
      zipCode: userData.zipCode || '',
      cardInterests: userData.cardInterests || [],
      notificationPreferences: {
        showAlerts: userData.notificationPreferences?.showAlerts || true,
        upcomingShows: userData.notificationPreferences?.upcomingShows || true,
        newShowsInArea: userData.notificationPreferences?.newShowsInArea || true
      },
      role: role, // Add user role (attendee or dealer)
      isPremium: role === 'dealer', // Dealers are premium by default
      createdAt: new Date(),
      favoriteShows: []
    });
    
    return { user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
};

// Login existing user
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
};

// Logout user
export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
};

// Get user profile data
export const getUserProfile = async (userId) => {
  try {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { profile: docSnap.data(), error: null };
    } else {
      return { profile: null, error: "User profile not found" };
    }
  } catch (error) {
    return { profile: null, error: error.message };
  }
};

// Update user profile
export const updateUserProfile = async (userId, profileData) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, profileData);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Upgrade user to dealer (placeholder for Stripe integration)
export const upgradeToDealer = async (userId) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      role: 'dealer',
      isPremium: true,
      upgradedAt: new Date()
    });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Upgrade dealer to Show Organizer
// Verification (matching name/phone) should be handled at the UI/server level;
// this function only updates the Firestore document once verification is complete.
export const upgradeToShowOrganizer = async (userId) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      role: 'showOrganizer',
      isPremium: true,
      upgradedAt: new Date()
    });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
