import { createClient } from '@supabase/supabase-js';
import { AuthState, AuthCredentials, User, UserRole } from '../types';
import { getSupabaseUrl, getSupabaseAnonKey } from '../config';
import { Alert } from 'react-native';

// Initialize the Supabase client
export const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());

/**
 * Converting Supabase profile data to our User type
 */
export const mapProfileToUser = (
  authData: any,
  profileData: any,
): User => {
  if (!authData || !profileData) {
    throw new Error('Invalid profile data provided');
  }

  // First extract fields directly from auth data
  const user: User = {
    id: authData.id || profileData.id,
    email: authData.email,
    firstName: profileData.first_name || 'User',
    homeZipCode: profileData.home_zip_code || '',
    role: (profileData.role as UserRole) || UserRole.ATTENDEE,
    createdAt: authData.created_at || profileData.created_at,
    updatedAt: profileData.updated_at || new Date().toISOString(),
    isEmailVerified: authData.email_confirmed_at ? true : false,
    accountType: profileData.account_type || 'collector',
    subscriptionStatus: profileData.subscription_status || 'none',
    subscriptionExpiry: profileData.subscription_expiry,
    favoriteShowsCount: profileData.favorite_shows_count || 0,
    showAttendanceCount: profileData.show_attendance_count || 0,
    // Social media links
    facebookUrl: profileData.facebook_url,
    instagramUrl: profileData.instagram_url,
    twitterUrl: profileData.twitter_url,
    whatnotUrl: profileData.whatnot_url,
    ebayStoreUrl: profileData.ebay_store_url
  };

  // Add optional fields if they exist
  if (profileData.last_name) user.lastName = profileData.last_name;
  if (profileData.phone_number) user.phoneNumber = profileData.phone_number;
  if (profileData.profile_image_url) user.profileImageUrl = profileData.profile_image_url;
  if (profileData.favorite_shows) user.favoriteShows = profileData.favorite_shows;
  if (profileData.attended_shows) user.attendedShows = profileData.attended_shows;
  
  // Add notification broadcast limits for organizers
  if (user.role === UserRole.SHOW_ORGANIZER) {
    user.preShowBroadcastsRemaining = profileData.pre_show_broadcasts_remaining || 0;
    user.postShowBroadcastsRemaining = profileData.post_show_broadcasts_remaining || 0;
  }

  return user;
};

/**
 * Maps user fields to profile DB fields
 */
export const mapUserToProfile = (user: Partial<User>) => {
  return {
    first_name: user.firstName,
    last_name: user.lastName,
    home_zip_code: user.homeZipCode,
    phone_number: user.phoneNumber,
    profile_image_url: user.profileImageUrl,
    role: user.role,
    account_type: user.accountType,
    facebook_url: user.facebookUrl,
    instagram_url: user.instagramUrl,
    twitter_url: user.twitterUrl,
    whatnot_url: user.whatnotUrl,
    ebay_store_url: user.ebayStoreUrl,
    updated_at: new Date().toISOString(),
  };
};

/**
 * Sign up with email and password
 * @param credentials 
 * @param homeZipCode 
 * @param firstName 
 * @param lastName 
 * @returns Promise containing the User object
 */
export const signUp = async (
  credentials: AuthCredentials,
  homeZipCode: string,
  firstName: string,
  lastName?: string,
): Promise<User> => {
  try {
    // Check if required fields are present
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required');
    }

    if (!homeZipCode) {
      throw new Error('ZIP code is required');
    }

    if (!firstName) {
      throw new Error('First name is required');
    }

    // First, create the auth user
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw error;
    }

    if (!data?.user) {
      throw new Error('Failed to create user');
    }

    const userId = data.user.id;

    // Then add their profile information to the profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        first_name: firstName,
        last_name: lastName || null,
        home_zip_code: homeZipCode,
        role: UserRole.ATTENDEE, // Default role
        account_type: 'collector', // Default account type
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      // If profile creation fails, we should still be OK since the auth
      // trigger should create a minimal profile
      console.warn('Error creating profile:', profileError);
    }

    // Construct user object
    const user: User = {
      id: userId,
      email: credentials.email,
      firstName,
      lastName: lastName,
      homeZipCode,
      role: UserRole.ATTENDEE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEmailVerified: false,
      accountType: 'collector',
      subscriptionStatus: 'none',
      subscriptionExpiry: null,
    };

    return user;
  } catch (error: any) {
    console.error('Error in signup:', error.message);
    throw error;
  }
};

/**
 * Sign in with email and password
 * @param credentials 
 * @returns Promise containing the User object
 */
export const signIn = async (credentials: AuthCredentials): Promise<User> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw error;
    }

    if (!data?.user) {
      throw new Error('No user returned from sign in');
    }

    // Fetch the user's profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      throw new Error(`Error fetching user profile: ${profileError.message}`);
    }

    if (!profileData) {
      throw new Error('No profile data found for user');
    }

    // Map to our User type
    const user = mapProfileToUser(data.user, profileData);
    return user;
  } catch (error: any) {
    console.error('Error in signin:', error.message);
    throw error;
  }
};

/**
 * Sign out the current user
 */
export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
};

/**
 * Get the current session and user
 * @returns Promise containing the User object if session exists
 */
export const getSession = async (): Promise<User | null> => {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      throw sessionError;
    }
    
    if (!sessionData?.session?.user) {
      return null;
    }
    
    const authUser = sessionData.session.user;
    
    // Fetch profile from the profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 means no rows returned
      console.error('Error getting profile:', profileError);
      throw profileError;
    }
    
    if (!profileData) {
      console.warn('No profile found for user:', authUser.id);
      return null;
    }
    
    // Map to our User type
    const user = mapProfileToUser(authUser, profileData);
    
    return user;
  } catch (error) {
    console.error('Error getting current session:', error);
    return null;
  }
};

/**
 * Refresh the current user role
 * Used when a user upgrades their account
 */
export const refreshUser = async (): Promise<User | null> => {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      throw sessionError;
    }
    
    if (!sessionData?.session?.user) {
      return null;
    }
    
    const authUser = sessionData.session.user;
    
    // Refresh the auth session token to ensure we have the latest claims
    const { error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      throw refreshError;
    }
    
    // Fetch updated profile from the profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    if (profileError) {
      throw profileError;
    }
    
    if (!profileData) {
      throw new Error('No profile found for user');
    }
    
    // Map to our User type
    const user = mapProfileToUser(authUser, profileData);
    
    return user;
  } catch (error) {
    console.error('Error refreshing user:', error);
    return null;
  }
};

/**
 * Reset password
 * @param email 
 */
export const resetPassword = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'cardshowhunter://reset-password',
    });
    
    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.error('Error sending password reset:', error.message);
    throw error;
  }
};

/**
 * Complete the password reset process
 * @param newPassword 
 */
export const updatePassword = async (newPassword: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    
    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.error('Error updating password:', error.message);
    throw error;
  }
};

/**
 * Update user profile 
 * @param userData Partial User data to update
 * @returns Promise<User> Updated user
 */
export const updateUserProfile = async (userData: Partial<User>): Promise<User> => {
  try {
    if (!userData || !userData.id) {
      throw new Error('User ID is required for update');
    }
    
    const userId = userData.id;
    
    // Convert our User fields to DB fields
    const profileData = mapUserToProfile(userData);
    
    // Remove any undefined values to avoid setting NULL
    Object.keys(profileData).forEach(key => {
      if (profileData[key] === undefined) {
        delete profileData[key];
      }
    });
    
    // Update the profile
    const { error } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', userId);
    
    if (error) {
      throw error;
    }
    
    // Get updated user data
    const updatedUser = await getSession();
    if (!updatedUser) {
      throw new Error('Failed to retrieve updated user data');
    }
    
    return updatedUser;
  } catch (error: any) {
    console.error('Error updating profile:', error.message);
    throw error;
  }
};

/**
 * Subscribe to auth state changes
 */
export const subscribeToAuthChanges = (
  callback: (authState: AuthState) => void
) => {
  let initialized = false;

  const subscription = supabase.auth.onAuthStateChange(
    async (event, session) => {
      console.log('Auth state change event:', event);
      
      // Initial state is loading
      if (!initialized) {
        callback({
          user: null,
          isLoading: true,
          error: null,
          isAuthenticated: false,
        });
        initialized = true;
      }
      
      // Check for signups, errors, invalid tokens, etc.
      if (event === 'SIGNED_IN') {
        try {
          if (!session || !session.user) {
            throw new Error('No session or user found after sign in');
          }
          
          const userId = session.user.id;
          
          // Fetch user profile
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          
          if (profileError) {
            throw profileError;
          }
          
          if (!profileData) {
            throw new Error('No profile found for user');
          }
          
          // Map profile to our User type
          const user = mapProfileToUser(session.user, profileData);
          
          callback({
            user,
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
