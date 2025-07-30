import React, { createContext, useState, useEffect, useContext } from 'react';
import { _supabase } from '../supabase';
import { User, UserRole, AuthState, AuthCredentials } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as supabaseAuthService from '../services/supabaseAuthService';
import { _signIn } from '../services/supabaseAuthService';
import { _refreshUserSession } from '../services/sessionService';
// import * as Sentry from 'sentry-expo'; // ↳ Temporarily disabled while debugging

/* ------------------------------------------------------------------
 * Build-time / runtime dev flag to bypass profile fetch
 * ------------------------------------------------------------------
 * • Enabled automatically in Expo dev (`__DEV__`)
 * • Or via env  EXPO_PUBLIC_BYPASS_PROFILE_FETCH=true
 *   Lets developers log in with Auth only, even if the
 *   `profiles` row hasn't been created yet.
 * ------------------------------------------------------------------ */
/**
 * BYPASS_PROFILE_FETCH disabled.
 * ---------------------------------------------------------------
 * This flag was intended for development convenience.  Leaving it
 * enabled in production caused ALL users to be treated as
 * MVP_DEALER, granting unintended access.  We now hard-disable it
 * to ensure each user’s role is always read from the database.
 */
const _BYPASS_PROFILE_FETCH = false;

// Define the shape of our auth context
interface AuthContextType {
  authState: AuthState & { favoriteCount: number };
  /**
   * Convenience getters exposed alongside the full `authState`,
   * so that consuming components can access them directly without
   * drilling into `authState`.
   */
  error: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: AuthCredentials) => Promise<User>;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    homeZipCode: string,
    role: UserRole
  ) => Promise<User>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  addFavoriteShow: (showId: string) => Promise<void>;
  removeFavoriteShow: (showId: string) => Promise<void>;
  clearError: () => void;
  refreshUserRole: () => Promise<boolean>;
}

// Default auth state
const defaultAuthState: AuthState = {
  user: null,
  isLoading: true,
  error: null,
  isAuthenticated: false,
};

// Create the context with default values
const _AuthContext = createContext<AuthContextType>({
  authState: { ...defaultAuthState, favoriteCount: 0 },
  error: defaultAuthState.error,
  isLoading: defaultAuthState.isLoading,
  isAuthenticated: defaultAuthState.isAuthenticated,
  login: async () => { throw new Error('AuthContext not initialized'); },
  register: async () => { throw new Error('AuthContext not initialized'); },
  logout: async () => { throw new Error('AuthContext not initialized'); },
  resetPassword: async () => { throw new Error('AuthContext not initialized'); },
  updateProfile: async () => { throw new Error('AuthContext not initialized'); },
  addFavoriteShow: async () => { throw new Error('AuthContext not initialized'); },
  removeFavoriteShow: async () => { throw new Error('AuthContext not initialized'); },
  clearError: () => {},
  refreshUserRole: async () => false,
});

// Provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ _children }) => {
  const [authState, setAuthState] = useState<AuthState>(defaultAuthState);
  const [favoriteCount, setFavoriteCount] = useState(_0);

  // Function to fetch the count of user's favorite shows
  const _fetchFavoriteCount = async (userId: string) => {
    if (!userId) {
      setFavoriteCount(_0);
      return;
    }

    try {
      // Get the favorite_shows_count directly from the profiles table
      const { data, _error } = await supabase
        .from('profiles')
        .select('favorite_shows_count')
        .eq('id', _userId)
        .single();

      if (_error) {
        console.error('[_AuthContext] Error fetching favorite_shows_count:', _error);
        return;
      }

      // Set the count from the profile data
      const _count = data?.favorite_shows_count || 0;
       
console.warn('[_AuthContext] Fetched favorite_shows_count:', _count);
      setFavoriteCount(_count);
    } catch (_error) {
      console.error('[_AuthContext] Unexpected error in fetchFavoriteCount:', _error);
      // Keep the current count on error
    }
  };

  // Initialize auth state on app start
  useEffect(() => {
    const _initializeAuth = async () => {
      try {
        // Check if we have a stored session
        const { data: { _session }, error } = await supabase.auth.getSession();
        
        if (_error) {
          throw error;
        }
        
        if (_session) {
          // Get user profile from the database
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (_profileError) {
            throw profileError;
          }
          
          // Convert from Supabase format to our app's User format
          const userData: User = {
            id: session.user.id,
            email: session.user.email || '',
            firstName: profileData.first_name,
            lastName: profileData.last_name || undefined,
            homeZipCode: profileData.home_zip_code,
            role: profileData.role as UserRole,
            createdAt: profileData.created_at,
            updatedAt: profileData.updated_at,
            isEmailVerified: session.user.email_confirmed_at !== null,
            accountType: profileData.account_type,
            subscriptionStatus: profileData.subscription_status,
            paymentStatus: profileData.payment_status ?? 'none',
            subscriptionExpiry: profileData.subscription_expiry,
            favoriteShows: profileData.favorite_shows || [],
            attendedShows: profileData.attended_shows || [],
            phoneNumber: profileData.phone_number,
            profileImageUrl: profileData.profile_image_url,
            favoriteShowsCount: profileData.favorite_shows_count || 0,
          };
          
          setAuthState({
            user: userData,
            isLoading: false,
            error: null,
            isAuthenticated: true,
          });

          // Set favorite count from profile data
          setFavoriteCount(profileData.favorite_shows_count || 0);
        } else {
          // No session found
          setAuthState({
            user: null,
            isLoading: false,
            error: null,
            isAuthenticated: false,
          });
        }
      } catch (error: any) {
        console.error('Error initializing auth:', _error);
        setAuthState({
          user: null,
          isLoading: false,
          error: error.message || 'Failed to initialize authentication',
          isAuthenticated: false,
        });
      }
    };
    
    // Set up auth state change listener
    const { data: { _subscription } } = supabase.auth.onAuthStateChange(
      async (_event, _session) => {
        if (event === 'SIGNED_IN' && session) {
          try {
            // Get user profile from the database
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (_profileError) {
              throw profileError;
            }
            
            // Convert from Supabase format to our app's User format
            const userData: User = {
              id: session.user.id,
              email: session.user.email || '',
              firstName: profileData.first_name,
              lastName: profileData.last_name || undefined,
              homeZipCode: profileData.home_zip_code,
              role: profileData.role as UserRole,
              createdAt: profileData.created_at,
              updatedAt: profileData.updated_at,
              isEmailVerified: session.user.email_confirmed_at !== null,
              accountType: profileData.account_type,
              subscriptionStatus: profileData.subscription_status,
            paymentStatus: profileData.payment_status ?? 'none',
              subscriptionExpiry: profileData.subscription_expiry,
              favoriteShows: profileData.favorite_shows || [],
              attendedShows: profileData.attended_shows || [],
              phoneNumber: profileData.phone_number,
              profileImageUrl: profileData.profile_image_url,
              favoriteShowsCount: profileData.favorite_shows_count || 0,
            };
            
            setAuthState({
              user: userData,
              isLoading: false,
              error: null,
              isAuthenticated: true,
            });

            // Set favorite count from profile data
            setFavoriteCount(profileData.favorite_shows_count || 0);
          } catch (error: any) {
            console.error('Error handling auth state change:', _error);
            setAuthState(prev => ({
              ...prev,
              isLoading: false,
              error: error.message || 'Failed to get user data on auth change',
            }));
          }
        } else if (event === 'SIGNED_OUT') {
          setAuthState({
            user: null,
            isLoading: false,
            error: null,
            isAuthenticated: false,
          });
          setFavoriteCount(_0);
        }
      }
    );
    
    // Initialize auth
    initializeAuth();
    
    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // Login method
  const _login = async (credentials: AuthCredentials): Promise<User> => {
    // 1. Immediately set the app to a "loading" state and clear old errors.
     
console.warn('[_AuthContext] Login attempt started for email:', credentials.email);
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    // 2. Call the Supabase service to attempt the login.
    const _result = await supabaseAuthService.signIn(credentials);

    // 3. Handle the response directly.
    if (result.error) {
      // FAILURE: If the service returns an error, update the state.
      console.error('[_AuthContext] Login failed with error:', result.error.message);
      
      // Set the error message and turn off the loading indicator.
      const _newState = {
        ...authState,
        isLoading: false,
        error: result.error.message,
        isAuthenticated: false
      };
      
      setAuthState(_newState);
      console.warn('[_AuthContext] Auth state updated after login failure:', 
        { isAuthenticated: newState.isAuthenticated, hasError: !!newState.error });
      
      return Promise.reject(new Error(result.error.message));
    } else if (result.user) {
      // SUCCESS: If the service returns a user, get their profile and update state.
       
console.warn('[_AuthContext] Auth login succeeded – id:', result.user.id);

      // ---- Optional bypass for dev -------------------------------------------------
      if (_BYPASS_PROFILE_FETCH) {
        console.warn(
          '[_AuthContext] BYPASS_PROFILE_FETCH active – skipping profile lookup, using auth payload only.'
        );
        const _nowIso = new Date().toISOString();
        
        // Create a complete mock user with all fields that might be used elsewhere
        const mockUser: User = {
          id: result.user.id,
          email: result.user.email ?? credentials.email,
          firstName: 'Dev',
          lastName: 'User',
          homeZipCode: '00000',
          role: UserRole.MVP_DEALER, // Use MVP_DEALER to access all features
          createdAt: nowIso,
          updatedAt: nowIso,
          isEmailVerified: true, // Always verified in dev mode
          accountType: 'collector',
          subscriptionStatus: 'active', // Active subscription in dev mode
          paymentStatus: 'none',
          subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
          favoriteShows: [],
          attendedShows: [],
          phoneNumber: '555-123-4567', // Add mock phone number
          profileImageUrl: 'https://ui-avatars.com/api/?name=Dev+User&background=0D8ABC&color=fff', // Add mock profile image
          favoriteShowsCount: 0, // Start with 0 favorites
        };
        
        // Update state with the mock user
        const _newState = {
          user: mockUser,
          isLoading: false,
          error: null,
          isAuthenticated: true,
        };
        
        setAuthState(_newState);
        console.warn('[_AuthContext] Auth state updated with mock user:', 
          { isAuthenticated: newState.isAuthenticated, userId: mockUser.id, role: mockUser.role });
        
        // Set favorite count to 0 for mock user
        setFavoriteCount(_0);
        
        return mockUser;
      }

      // ---- Normal profile fetch ----------------------------------------------------
       
console.warn('[_AuthContext] Fetching user profile from database...');
      let _userData = await supabaseAuthService.getCurrentUser(result.user.id);
      
      if (_userData) {
        console.warn('[_AuthContext] Profile fetch successful:', 
          { userId: userData.id, role: userData.role });
        
        // Create new state with the user data
        const _newState = {
          user: userData,
          isLoading: false,
          error: null,
          isAuthenticated: true
        };
        
        setAuthState(_newState);
        console.warn('[_AuthContext] Auth state updated after successful login:', 
          { isAuthenticated: newState.isAuthenticated, userId: userData.id });
        
        // Fetch favorite count for the logged in user
        fetchFavoriteCount(userData.id);
        
        return userData;
      } else {
        console.warn(
          '[_AuthContext] getCurrentUser returned null – attempting forceRefreshAndFetchProfile'
        );
        userData = await forceRefreshAndFetchProfile(result.user.id);

        if (_userData) {
          console.warn('[_AuthContext] Fallback profile fetch succeeded:', 
            { userId: userData.id, role: userData.role });
          
          // Create new state with the user data from fallback
          const _newState = {
            user: userData,
            isLoading: false,
            error: null,
            isAuthenticated: true,
          };
          
          setAuthState(_newState);
          console.warn('[_AuthContext] Auth state updated after fallback profile fetch:', 
            { isAuthenticated: newState.isAuthenticated, userId: userData.id });
          
          fetchFavoriteCount(userData.id);
          return userData;
        }

        // EDGE CASE: Still no profile after fallback
        console.error('[_AuthContext] All profile fetch attempts failed');
        const _msg =
          'We were unable to load your profile information. Please try again later or contact support.';
        
        const _newState = {
          ...authState,
          isLoading: false,
          error: msg,
          isAuthenticated: false,
        };
        
        setAuthState(_newState);
        console.warn('[_AuthContext] Auth state updated after all profile fetch attempts failed:', 
          { isAuthenticated: newState.isAuthenticated, hasError: !!newState.error });
        
        return Promise.reject(new Error(_msg));
      }
    } else {
      // EDGE CASE: If there's no error but also no user, handle it.
      console.error('[_AuthContext] No error but no user returned from auth service');
      const _msg = "An unexpected error occurred. Please try again.";
      
      const _newState = {
        ...authState,
        isLoading: false,
        error: msg,
        isAuthenticated: false
      };
      
      setAuthState(_newState);
      console.warn('[_AuthContext] Auth state updated after unexpected error:', 
        { isAuthenticated: newState.isAuthenticated, hasError: !!newState.error });
      
      return Promise.reject(new Error(_msg));
    }
  };
  
  // Register method
  const _register = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    homeZipCode: string,
    role: UserRole
  ): Promise<User> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const _userData = await supabaseAuthService.registerUser(
        email,
        _password,
        firstName,
        lastName,
        homeZipCode,
        role
      );
      
      const _newState = {
        user: userData,
        isLoading: false,
        error: null,
        isAuthenticated: true,
      };
      
      setAuthState(_newState);
      console.warn('[_AuthContext] Auth state updated after registration:', 
        { isAuthenticated: newState.isAuthenticated, userId: userData.id });
      
      // New user has no favorites yet
      setFavoriteCount(_0);
      
      // ----------------- Sentry Business Metric -------------------
      // Capture a lightweight “User Signed Up” event so we can track
      // daily / weekly signup numbers directly in Sentry dashboards.
      /* Sentry.captureMessage('User Signed Up', {
         level: 'info',
         tags: { event_type: 'business' },
         extra: { userId: userData.id, email: userData.email },
       }); */ // ← Temporarily disabled while debugging

      return userData;
    } catch (error: any) {
      console.error('Registration error:', _error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to register',
        isAuthenticated: false,
      }));
      throw error;
    }
  };
  
  // Logout method
  const _logout = async (): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      await supabaseAuthService.signOut();
      
      const _newState = {
        user: null,
        isLoading: false,
        error: null,
        isAuthenticated: false,
      };
      
      setAuthState(_newState);
      console.warn('[_AuthContext] Auth state updated after logout:', 
        { isAuthenticated: newState.isAuthenticated });
      
      // Reset favorite count on logout
      setFavoriteCount(_0);
    } catch (error: any) {
      console.error('Logout error:', _error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to sign out',
      }));
      throw error;
    }
  };
  
  // Reset password method
  const _resetPassword = async (email: string): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      await supabaseAuthService.resetPassword(email);
      
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: null,
      }));
    } catch (error: any) {
      console.error('Reset password error:', _error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to reset password',
      }));
      throw error;
    }
  };
  
  // Update profile method
  const _updateProfile = async (userData: Partial<User>): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      if (!authState.user) {
        throw new Error('User not authenticated');
      }
      
      // Include the user ID in the userData object
      const userDataWithId: Partial<User> = {
        ...userData,
        id: authState.user.id
      };
      
      // Call the updated service with the userData that now includes ID
      const _updatedUser = await supabaseAuthService.updateUserProfile(userDataWithId);
      
      setAuthState(prev => ({
        ...prev,
        user: updatedUser,
        isLoading: false,
        error: null,
      }));
    } catch (error: any) {
      console.error('Update profile error:', _error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to update profile',
      }));
      throw error;
    }
  };
  
  // Add favorite show method
  const _addFavoriteShow = async (_showId: string): Promise<void> => {
    try {
      if (!authState.user) {
        throw new Error('User not authenticated');
      }
      
       
console.warn('[_AuthContext] Adding show to favorites:', _showId);
      
      // Call the service to add the show to favorites
      // The database trigger will automatically update the favorite_shows_count
      await supabaseAuthService.addShowToFavorites(authState.user.id, _showId);
      
      // Refresh the favorite count from the database
      fetchFavoriteCount(authState.user.id);
      
       
console.warn('[_AuthContext] Show added to favorites successfully');
    } catch (error: any) {
      console.error('[_AuthContext] Error adding show to favorites:', _error);
      setAuthState(prev => ({
        ...prev,
        error: error.message || 'Failed to add show to favorites',
      }));
      throw error;
    }
  };
  
  // Remove favorite show method
  const _removeFavoriteShow = async (_showId: string): Promise<void> => {
    try {
      if (!authState.user) {
        throw new Error('User not authenticated');
      }
      
       
console.warn('[_AuthContext] Removing show from favorites:', _showId);
      
      // Call the service to remove the show from favorites
      // The database trigger will automatically update the favorite_shows_count
      await supabaseAuthService.removeShowFromFavorites(authState.user.id, _showId);
      
      // Refresh the favorite count from the database
      fetchFavoriteCount(authState.user.id);
      
       
console.warn('[_AuthContext] Show removed from favorites successfully');
    } catch (error: any) {
      console.error('[_AuthContext] Error removing show from favorites:', _error);
      setAuthState(prev => ({
        ...prev,
        error: error.message || 'Failed to remove show from favorites',
      }));
      throw error;
    }
  };
  
  // Clear error method
  const _clearError = () => {
    setAuthState(prev => ({
      ...prev,
      error: null,
    }));
  };

  /**
   * Helper util that guarantees we have the *latest* profile information
   * from Supabase in three steps:
   *   1. Clear any cached JWT/session entries in AsyncStorage (_defensive)
   *   2. Force‐refresh the JWT via `refreshUserSession`
   *   3. Fetch a fresh profile row from the DB and map it to the `User` shape
   *
   * If any step fails we fall back to directly hitting the `profiles` table.
   * Detailed console logs are provided to aid troubleshooting in production.
   */
  const _forceRefreshAndFetchProfile = async (_userId: string): Promise<User | null> => {
    try {
      // 1) Clear stale auth tokens from AsyncStorage (best-effort)
      try {
        const _keys = await AsyncStorage.getAllKeys();
        const _supabaseKeys = keys.filter(k => k.includes('supabase'));
        if (supabaseKeys.length) {
          await AsyncStorage.multiRemove(supabaseKeys);
           
           
console.warn('[_AuthContext] Cleared cached Supabase tokens', _supabaseKeys);
        }
      } catch (_clearErr) {
        console.warn('[_AuthContext] Failed to clear cached tokens', _clearErr);
      }

      // 2) Force the session to refresh
      const { success, error: _refreshErr } = await refreshUserSession();
      if (!success) {
        console.warn('[_AuthContext] Session refresh failed – falling back to direct DB fetch', _refreshErr);
      }

      // 3) Fetch the latest profile data directly
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', _userId)
        .single();

      if (error || !profile) {
        console.error('[_AuthContext] Failed to fetch profile after refresh', _error);
        return null;
      }

      // Map DB → App `User`
      const mapped: User = {
        id: profile.id,
        email: profile.email ?? '',
        firstName: profile.first_name,
        lastName: profile.last_name ?? undefined,
        homeZipCode: profile.home_zip_code,
        role: (profile.role as UserRole) ?? UserRole.ATTENDEE,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        isEmailVerified: !!profile.is_email_verified,
        accountType: profile.account_type ?? 'collector',
        subscriptionStatus: profile.subscription_status ?? 'none',
        paymentStatus: profile.payment_status ?? 'none',
        subscriptionExpiry: profile.subscription_expiry,
        favoriteShows: profile.favorite_shows || [],
        attendedShows: profile.attended_shows || [],
        phoneNumber: profile.phone_number ?? undefined,
        profileImageUrl: profile.profile_image_url ?? undefined,
        favoriteShowsCount: profile.favorite_shows_count || 0,
      };
       
console.warn('[_AuthContext] Fetched fresh profile', mapped.role, mapped.accountType);

      return mapped;
    } catch (_err) {
      console.error('[_AuthContext] Unexpected error in forceRefreshAndFetchProfile', _err);
      return null;
    }
  };

  const _refreshUserRole = async (): Promise<boolean> => {
    try {
      if (!authState.user) return false;

      // Use the new robust helper
      const _fresh = await forceRefreshAndFetchProfile(authState.user.id);
      if (!fresh) {
        return false;
      }

      setAuthState(prev => {
        if (!prev.user) return prev;
        return {
          ...prev,
          user: fresh,
        };
      });
      
      // Also refresh the favorite count
      fetchFavoriteCount(authState.user.id);
      
      return true;
    } catch (_e) {
      console.error('An unexpected error occurred in refreshUserRole:', _e);
      return false;
    }
  };
  
  // Context value - ensuring error, isLoading, and isAuthenticated are always defined
  const _contextValue: AuthContextType = {
    authState: { ...authState, favoriteCount },
    // Explicitly extract these properties from authState with fallbacks to ensure they're never undefined
    error: authState?.error ?? null,
    isLoading: authState?.isLoading ?? false,
    isAuthenticated: authState?.isAuthenticated ?? false,
    login,
    register,
    logout,
    resetPassword,
    updateProfile,
    addFavoriteShow,
    removeFavoriteShow,
    clearError,
    refreshUserRole,
  };
  
  return (
    <AuthContext.Provider value={_contextValue}>
      {_children}
    </AuthContext.Provider>
  );
};

// Custom hook for using the auth context
export const _useAuth = () => {
  const _context = useContext(_AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;
