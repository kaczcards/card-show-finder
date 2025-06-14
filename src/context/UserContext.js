import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getUserProfile } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithEmailAndPassword } from 'firebase/auth';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();

    // Attempt automatic login with stored credentials (if any)
    // This runs only once on mount. If credentials exist and succeed,
    // onAuthStateChanged below will fire with the authenticated user.
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('csf_credentials');
        if (stored && !auth.currentUser) {
          const { email, password } = JSON.parse(stored);
          if (email && password) {
            await signInWithEmailAndPassword(auth, email, password);
          }
        }
      } catch (e) {
        // Fail silently – user will just have to log in manually
        console.log('Auto-login failed or not available:', e?.message || e);
      }
    })();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        const { profile } = await getUserProfile(user.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUserProfile = async () => {
    if (currentUser) {
      const { profile } = await getUserProfile(currentUser.uid);
      setUserProfile(profile);
    }
  };

  return (
    <UserContext.Provider value={{ 
      currentUser, 
      userProfile, 
      loading,
      refreshUserProfile
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);

/**
 * Utility to be called elsewhere in the app if an explicit
 * re-attempt of stored-credential login is needed.
 */
export const signInWithStoredCredentials = async () => {
  try {
    const stored = await AsyncStorage.getItem('csf_credentials');
    if (!stored) return { success: false, error: 'No stored credentials' };

    const { email, password } = JSON.parse(stored);
    if (!email || !password) {
      return { success: false, error: 'Invalid stored credentials' };
    }

    const auth = getAuth();
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
