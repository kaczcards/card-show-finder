// src/services/supabaseAuthService.ts
import { supabase } from '../supabase';
import { User, UserRole, AuthCredentials, AuthState } from '../types';

/**
 * Register a new user with email and password
 * @param email User's email
 * @param password User's password
 * @param firstName User's first name
 * @param lastName User's last name (optional)
 * @param homeZipCode User's home ZIP code
 * @returns Promise with the created user
 */
export const registerUser = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string = '',
  homeZipCode: string
): Promise<User> => {
  try {
    // Register user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          firstName,
          lastName,
          homeZipCode,
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Registration failed');

    // Create a user profile in the profiles table
    // Note: This might be redundant if you have a database trigger that creates profiles,
    // but it's safer to include it here in case the trigger fails
    const userData: User = {
      id: authData.user.id,
      email,
      firstName,
      lastName: lastName || undefined,
      homeZipCode,
      role: UserRole.ATTENDEE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEmailVerified: false,
      favoriteShows: [],
      attendedShows: [],
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{
        id: userData.id,
        email: userData.email,
        first_name: userData.firstName,
        last_name: userData.lastName || '',
        home_zip_code: userData.homeZipCode,
        role: userData.role,
        created_at: userData.createdAt,
        updated_at: userData.updatedAt,
        favorite_shows: [],
        attended_shows: [],
      }]);

    if (profileError) throw profileError;

    return userData;
  } catch (error: any) {
    console.error('Error registering user:', error);
    throw new Error(error.message || 'Failed to register user');
  }
};

/**
 * Sign in a user with email and password
 * @param credentials User's email and password
 * @returns Promise with the user data
 */
export const signInUser = async (credentials: AuthCredentials): Promise<User> => {
  try {
    const { email, password } = credentials;

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Login failed');

    // Get user profile from the profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) throw profileError;
    if (!profileData) throw new Error('User profile not found');

    // Convert from Supabase format to our app's User format
    const userData: User = {
      id: authData.user.id,
      email: authData.user.email || '',
      firstName: profileData.first_name,
      lastName: profileData.last_name || undefined,
      homeZipCode: profileData.home_zip_code,
      role: profileData.role as UserRole,
      createdAt: profileData.created_at,
      updatedAt: profileData.updated_at,
      isEmailVerified: authData.user.email_confirmed_at !== null,
      favoriteShows: profileData.favorite_shows || [],
      attendedShows: profileData.attended_shows || [],
      phoneNumber: profileData.phone_number,
      profileImageUrl: profileData.profile_image_url,
    };

    return userData;
  } catch (error: any) {
    console.error('Error signing in:', error);
    throw new Error(error.message || 'Failed to sign in');
  }
};

/**
 * Sign out the current user
 * @returns Promise<void>
 */
export const signOutUser = async (): Promise<void> => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error: any) {
    console.error('Error signing out:', error);
    throw new Error(error.message || 'Failed to sign out');
  }
};

/**
 * Send a password reset email
 * @param email User's email
 * @returns Promise<void>
 */
export const resetPassword = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'cardshowfinder://reset-password', // Ensure this matches your deep link
    });

    if (error) throw error;
  } catch (error: any) {
    console.error('Error resetting password:', error);
    throw new Error(error.message || 'Failed to send password reset email');
  }
};

/**
 * Get the current user data from the database
 * @param uid User ID
 * @returns Promise with the user data
 */
export const getCurrentUser = async (uid: string): Promise<User | null> => {
  try {
    // Get user profile from the profiles table
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();

    if (error) throw error;
    if (!profileData) return null;

    // Get current auth session to check email verification status
    const { data: { user: authUser } } = await supabase.auth.getUser();

    // Convert from Supabase format to our app's User format
    const userData: User = {
      id: profileData.id,
      email: profileData.email || '',
      firstName: profileData.first_name,
      lastName: profileData.last_name || undefined,
      homeZipCode: profileData.home_zip_code,
      role: profileData.role as UserRole,
      createdAt: profileData.created_at,
      updatedAt: profileData.updated_at,
      isEmailVerified: authUser?.email_confirmed_at !== null, // Use authUser for verification status
      favoriteShows: profileData.favorite_shows || [],
      attendedShows: profileData.attended_shows || [],
      phoneNumber: profileData.phone_number,
      profileImageUrl: profileData.profile_image_url,
    };

    return userData;
  } catch (error: any) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Update user profile information
 * @param uid User ID
 * @param userData Partial user data to update
 * @returns Promise<void>
 */
export const updateUserProfile = async (
  uid: string,
  userData: Partial<User>
): Promise<void> => {
  try {
    // Update the user profile in the profiles table
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: userData.firstName,
        last_name: userData.lastName || '',
        home_zip_code: userData.homeZipCode,
        phone_number: userData.phoneNumber,
        profile_image_url: userData.profileImageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', uid);

    if (error) throw error;

    // Update user metadata in Supabase Auth if name is being updated
    if (userData.firstName || userData.lastName) {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          firstName: userData.firstName,
          lastName: userData.lastName,
        },
      });

      if (authError) throw authError;
    }
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    throw new Error(error.message || 'Failed to update user profile');
  }
};

/**
 * Add a show to user's favorites
 * @param uid User ID
 * @param showId Show ID
 * @returns Promise<void>
 */
export const addShowToFavorites = async (
  uid: string,
  showId: string
): Promise<void> => {
  try {
    // Get current favorite shows
    const { data, error: getError } = await supabase
      .from('profiles')
      .select('favorite_shows')
      .eq('id', uid)
      .single();

    if (getError) throw getError;

    const favoriteShows = data?.favorite_shows || [];

    // Only add if not already in favorites
    if (!favoriteShows.includes(showId)) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          favorite_shows: [...favoriteShows, showId],
          updated_at: new Date().toISOString(),
        })
        .eq('id', uid);

      if (updateError) throw updateError;
    }
  } catch (error: any) {
    console.error('Error adding show to favorites:', error);
    throw new Error(error.message || 'Failed to add show to favorites');
  }
};

/**
 * Remove a show from user's favorites
 * @param uid User ID
 * @param showId Show ID
 * @returns Promise<void>
 */
export const removeShowFromFavorites = async (
  uid: string,
  showId: string
): Promise<void> => {
  try {
    // Get current favorite shows
    const { data, error: getError } = await supabase
      .from('profiles')
      .select('favorite_shows')
      .eq('id', uid)
      .single();

    if (getError) throw getError;

    const favoriteShows = data?.favorite_shows || [];

    // Remove the show from favorites
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        favorite_shows: favoriteShows.filter(id => id !== showId),
        updated_at: new Date().toISOString(),
      })
      .eq('id', uid);

    if (updateError) throw updateError;
  } catch (error: any) {
    console.error('Error removing show from favorites:', error);
    throw new Error(error.message || 'Failed to remove show from favorites');
  }
};

/**
 * Subscribe to auth state changes
 * @param callback Function to call when auth state changes
 * @returns Unsubscribe function
 */
export const subscribeToAuthChanges = (
  callback: (authState: AuthState) => void
): (() => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (session?.user) {
        try {
          const userData = await getCurrentUser(session.user.id);
          callback({
            user: userData,
            isLoading: false,
            error: null,
            isAuthenticated: true,
          });
        } catch (error: any) {
          console.error('Error in auth state change listener:', error);
          callback({
            user: null,
            isLoading: false,
            error: error.message || 'Failed to get user data on auth change',
            isAuthenticated: false,
          });
        }
      } else {
        callback({
          user: null,
          isLoading: false,
          error: null,
          isAuthenticated: false,
        });
      }
    }
  );

  return () => {
    subscription.unsubscribe();
  };
};

/**
 * Check if a user is authenticated
 * @returns Boolean indicating if a user is authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
};

/**
 * Update user role (for upgrading to Dealer or Show Organizer)
 * @param uid User ID
 * @param newRole New user role
 * @returns Promise<void>
 */
export const updateUserRole = async (
  uid: string,
  newRole: UserRole
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', uid);

    if (error) throw error;
  } catch (error: any) {
    console.error('Error updating user role:', error);
    throw new Error(error.message || 'Failed to update user role');
  }
};
