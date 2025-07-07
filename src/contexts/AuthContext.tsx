import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabase';
import { User, UserRole, AuthState, AuthCredentials } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as supabaseAuthService from '../services/supabaseAuthService';
import { refreshUserSession } from '../services/userRoleService';

// Define the shape of our auth context
interface AuthContextType {
  authState: AuthState;
  /**
   * Convenience getters exposed alongside the full `authState`
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
const AuthContext = createContext<AuthContextType>({
  authState: defaultAuthState,
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
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(defaultAuthState);

  // Initialize auth state on app start
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if we have a stored session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (session) {
          // Get user profile from the database
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profileError) {
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
            subscriptionExpiry: profileData.subscription_expiry,
            favoriteShows: profileData.favorite_shows || [],
            attendedShows: profileData.attended_shows || [],
            phoneNumber: profileData.phone_number,
            profileImageUrl: profileData.profile_image_url,
          };
          
          setAuthState({
            user: userData,
            isLoading: false,
            error: null,
            isAuthenticated: true,
          });
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
        console.error('Error initializing auth:', error);
        setAuthState({
          user: null,
          isLoading: false,
          error: error.message || 'Failed to initialize authentication',
          isAuthenticated: false,
        });
      }
    };
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          try {
            // Get user profile from the database
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (profileError) {
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
              subscriptionExpiry: profileData.subscription_expiry,
              favoriteShows: profileData.favorite_shows || [],
              attendedShows: profileData.attended_shows || [],
              phoneNumber: profileData.phone_number,
              profileImageUrl: profileData.profile_image_url,
            };
            
            setAuthState({
              user: userData,
              isLoading: false,
              error: null,
              isAuthenticated: true,
            });
          } catch (error: any) {
            console.error('Error handling auth state change:', error);
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
  const login = async (credentials: AuthCredentials): Promise<User> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const userData = await supabaseAuthService.signInUser(credentials);
      
      setAuthState({
        user: userData,
        isLoading: false,
        error: null,
        isAuthenticated: true,
      });
      
      return userData;
    } catch (error: any) {
      console.error('Login error:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to sign in',
        isAuthenticated: false,
      }));
      throw error;
    }
  };
  
  // Register method
  const register = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    homeZipCode: string,
    role: UserRole
  ): Promise<User> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const userData = await supabaseAuthService.registerUser(
        email,
        password,
        firstName,
        lastName,
        homeZipCode,
        role
      );
      
      setAuthState({
        user: userData,
        isLoading: false,
        error: null,
        isAuthenticated: true,
      });
      
      return userData;
    } catch (error: any) {
      console.error('Registration error:', error);
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
  const logout = async (): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      await supabaseAuthService.signOutUser();
      
      setAuthState({
        user: null,
        isLoading: false,
        error: null,
        isAuthenticated: false,
      });
    } catch (error: any) {
      console.error('Logout error:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to sign out',
      }));
      throw error;
    }
  };
  
  // Reset password method
  const resetPassword = async (email: string): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      await supabaseAuthService.resetPassword(email);
      
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: null,
      }));
    } catch (error: any) {
      console.error('Reset password error:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to reset password',
      }));
      throw error;
    }
  };
  
  // Update profile method
  const updateProfile = async (userData: Partial<User>): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      if (!authState.user) {
        throw new Error('User not authenticated');
      }
      
      await supabaseAuthService.updateUserProfile(authState.user.id, userData);
      
      // Get updated user data
      const updatedUser = await supabaseAuthService.getCurrentUser(authState.user.id);
      
      if (!updatedUser) {
        throw new Error('Failed to get updated user data');
      }
      
      setAuthState(prev => ({
        ...prev,
        user: updatedUser,
        isLoading: false,
        error: null,
      }));
    } catch (error: any) {
      console.error('Update profile error:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to update profile',
      }));
      throw error;
    }
  };
  
  // Add favorite show method
  const addFavoriteShow = async (showId: string): Promise<void> => {
    try {
      if (!authState.user) {
        throw new Error('User not authenticated');
      }
      
      await supabaseAuthService.addShowToFavorites(authState.user.id, showId);
      
      // Update local state
      setAuthState(prev => {
        if (!prev.user) return prev;
        
        const favoriteShows = [...(prev.user.favoriteShows || [])];
        if (!favoriteShows.includes(showId)) {
          favoriteShows.push(showId);
        }
        
        return {
          ...prev,
          user: {
            ...prev.user,
            favoriteShows,
          },
        };
      });
    } catch (error: any) {
      console.error('Add favorite show error:', error);
      setAuthState(prev => ({
        ...prev,
        error: error.message || 'Failed to add show to favorites',
      }));
      throw error;
    }
  };
  
  // Remove favorite show method
  const removeFavoriteShow = async (showId: string): Promise<void> => {
    try {
      if (!authState.user) {
        throw new Error('User not authenticated');
      }
      
      await supabaseAuthService.removeShowFromFavorites(authState.user.id, showId);
      
      // Update local state
      setAuthState(prev => {
        if (!prev.user) return prev;
        
        return {
          ...prev,
          user: {
            ...prev.user,
            favoriteShows: (prev.user.favoriteShows || []).filter(id => id !== showId),
          },
        };
      });
    } catch (error: any) {
      console.error('Remove favorite show error:', error);
      setAuthState(prev => ({
        ...prev,
        error: error.message || 'Failed to remove show from favorites',
      }));
      throw error;
    }
  };
  
  // Clear error method
  const clearError = () => {
    setAuthState(prev => ({
      ...prev,
      error: null,
    }));
  };

  /**
   * Helper util that guarantees we have the *latest* profile information
   * from Supabase in three steps:
   *   1. Clear any cached JWT/session entries in AsyncStorage (defensive)
   *   2. Force‐refresh the JWT via `refreshUserSession`
   *   3. Fetch a fresh profile row from the DB and map it to the `User` shape
   *
   * If any step fails we fall back to directly hitting the `profiles` table.
   * Detailed console logs are provided to aid troubleshooting in production.
   */
  const forceRefreshAndFetchProfile = async (userId: string): Promise<User | null> => {
    try {
      // 1) Clear stale auth tokens from AsyncStorage (best-effort)
      try {
        const keys = await AsyncStorage.getAllKeys();
        const supabaseKeys = keys.filter(k => k.includes('supabase'));
        if (supabaseKeys.length) {
          await AsyncStorage.multiRemove(supabaseKeys);
          /* eslint-disable no-console */
          console.log('[AuthContext] Cleared cached Supabase tokens', supabaseKeys);
        }
      } catch (clearErr) {
        console.warn('[AuthContext] Failed to clear cached tokens', clearErr);
      }

      // 2) Force the session to refresh
      const { success, error: refreshErr } = await refreshUserSession();
      if (!success) {
        console.warn('[AuthContext] Session refresh failed – falling back to direct DB fetch', refreshErr);
      }

      // 3) Fetch the latest profile data directly
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        console.error('[AuthContext] Failed to fetch profile after refresh', error);
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
        subscriptionExpiry: profile.subscription_expiry,
        favoriteShows: profile.favorite_shows || [],
        attendedShows: profile.attended_shows || [],
        phoneNumber: profile.phone_number ?? undefined,
        profileImageUrl: profile.profile_image_url ?? undefined,
      };
      console.log('[AuthContext] Fetched fresh profile', mapped.role, mapped.accountType);

      return mapped;
    } catch (err) {
      console.error('[AuthContext] Unexpected error in forceRefreshAndFetchProfile', err);
      return null;
    }
  };

  const refreshUserRole = async (): Promise<boolean> => {
    try {
      if (!authState.user) return false;

      // Use the new robust helper
      const fresh = await forceRefreshAndFetchProfile(authState.user.id);
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
      
      return true;
    } catch (e) {
      console.error('An unexpected error occurred in refreshUserRole:', e);
      return false;
    }
  };
  
  // Context value - ensuring error, isLoading, and isAuthenticated are always defined
  const contextValue: AuthContextType = {
    authState,
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
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for using the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;
