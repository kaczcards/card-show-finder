import { AuthState, AuthCredentials, User, UserRole } from '../types';
import { supabase } from '../supabase';
import { _Alert } from 'react-native';
// Toast utility for user-visible notifications
import { showLocationChangedToast } from '../utils/toastUtils';

// Re-export the shared Supabase client so callers that previously imported it
// from this service continue to work without changes.
export { supabase };

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
    paymentStatus: profileData.payment_status || 'unpaid',
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
      paymentStatus: 'none',
    };

    return user;
  } catch (error: any) {
    console.error('Error in signup:', error.message);
    throw error;
  }
};

/**
 * Register a new user with email, password, and profile information.
 * This mirrors the `signUp` flow but lets callers explicitly choose the
 * initial role (Dealer, MVP Dealer, Organizer, etc.).
 *
 * NOTE: `AuthContext` relies on this helper, so the return shape must be a
 * complete `User` object – NOT the `{ user, error }` shape used by `signIn`.
 */
export const registerUser = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  homeZipCode: string,
  role: UserRole,
): Promise<User> => {
  try {
    // ---- Argument validation ----------------------------------------------------
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    if (!homeZipCode) {
      throw new Error('ZIP code is required');
    }
    if (!firstName) {
      throw new Error('First name is required');
    }

    // ---- Create Auth user -------------------------------------------------------
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      throw error;
    }
    if (!data?.user) {
      throw new Error('Failed to create user');
    }

    const userId = data.user.id;

    // Determine account_type based on role
    const accountType =
      role === UserRole.SHOW_ORGANIZER
        ? 'organizer'
        : role === UserRole.DEALER || role === UserRole.MVP_DEALER
        ? 'dealer'
        : 'collector';

    // ---- Insert / update profile row -------------------------------------------
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        first_name: firstName,
        last_name: lastName || null,
        home_zip_code: homeZipCode,
        role,
        account_type: accountType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      // RLS triggers should still create a minimal row, but log just in case.
      console.warn('Error creating profile:', profileError);
    }

    // ---- Build & return User object --------------------------------------------
    const nowIso = new Date().toISOString();
    const user: User = {
      id: userId,
      email,
      firstName,
      lastName: lastName || undefined,
      homeZipCode,
      role,
      createdAt: nowIso,
      updatedAt: nowIso,
      isEmailVerified: false,
      accountType: accountType as any,
      subscriptionStatus: 'none',
      subscriptionExpiry: null,
      favoriteShows: [],
      attendedShows: [],
      paymentStatus: 'none',
    };

    return user;
  } catch (error: any) {
    console.error('Error in registerUser:', error.message);
    throw error;
  }
};

/**
 * Sign in with email and password
 * @param credentials 
 * @returns Promise containing the User object
 */
export const signIn = async (
  credentials: AuthCredentials,
): Promise<{ user?: User; error?: Error }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      return { error };
    }

    if (!data?.user) {
      return { error: new Error('No user returned from sign in') };
    }

    // Fetch the user's profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      return {
        error: new Error(`Error fetching user profile: ${profileError.message}`),
      };
    }

    if (!profileData) {
      return { error: new Error('No profile data found for user') };
    }

    // Map to our User type
    const user = mapProfileToUser(data.user, profileData);
    return { user };
  } catch (error: any) {
    console.error('Error in signin:', error.message);
    return { error };
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
 * Get current user profile by user ID
 * @param userId The user ID to fetch the profile for
 * @returns Promise containing the User object if found
 */
export const getCurrentUser = async (userId: string): Promise<User | null> => {
  try {
    if (!userId) {
      console.error('[supabaseAuthService] getCurrentUser called with empty userId');
      return null;
    }

    // eslint-disable-next-line no-console
console.warn('[supabaseAuthService] Fetching user profile for ID:', userId);

    /* -----------------------------------------------------------
     * 1) Fetch the user's profile row from `profiles`
     * --------------------------------------------------------- */
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[supabaseAuthService] Error fetching profile:', profileError);
      return null;
    }

    if (!profileData) {
      console.warn('[supabaseAuthService] No profile found for user:', userId);
      return null;
    }

    /* -----------------------------------------------------------
     * 2) Retrieve auth data for the **current** user via session.
     *    (Supabase client-side cannot fetch arbitrary users.)
     * --------------------------------------------------------- */
    const { data: authData, error: authError } = await supabase.auth.getUser();

    let authUser = authData?.user;

    if (authError) {
      console.error('[supabaseAuthService] Error fetching auth user:', authError);
    }

    // Fallback – construct minimal auth payload if IDs don’t match
    if (!authUser || authUser.id !== userId) {
      authUser = {
        id: userId,
        email: profileData.email || '',
      } as any;
    }

    /* -----------------------------------------------------------
     * 3) Map combined auth + profile data to our `User` type
     * --------------------------------------------------------- */
    return mapProfileToUser(authUser, profileData);
  } catch (error: any) {
    console.error('[supabaseAuthService] Unexpected error in getCurrentUser:', error);
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
 * Resend **email-verification** link after signup.
 * Useful when a user’s original verification email expired.
 */
export const resendEmailVerification = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.error('[supabaseAuthService] Error resending verification email:', error.message);
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

    /* ---------------------------------------------------------------
     * Capture the user’s existing home ZIP *before* the update so we
     * can detect changes afterwards and surface a toast.
     * ------------------------------------------------------------- */
    const sessionUser = await getSession();
    const previousZip = sessionUser?.homeZipCode ?? null;
    
    // Convert our User fields to DB fields
    const profileData = mapUserToProfile(userData);
    
    // Remove any undefined values to avoid setting NULL
    Object.keys(profileData).forEach(key => {
      const typedKey = key as keyof typeof profileData;
      if (profileData[typedKey] === undefined) {
        delete profileData[typedKey];
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

    /* ---------------------------------------------------------------
     * If the home ZIP has changed, notify the user so they understand
     * why the map recentred.
     * ------------------------------------------------------------- */
    if (
      updatedUser.homeZipCode &&
      updatedUser.homeZipCode !== previousZip
    ) {
      showLocationChangedToast(updatedUser.homeZipCode);
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
      // eslint-disable-next-line no-console
console.warn('Auth state change event:', event);
      
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
    // Unsubscribing is intentionally omitted per updated requirements.
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

/* ------------------------------------------------------------------
 * Favorite-shows helpers
 * ------------------------------------------------------------------ */

/**
 * Add a show to the user’s favorites.
 * Relies on a Postgres function `add_favorite_show(user_id uuid, show_id uuid)`
 * that performs the insert as well as any business-logic validations.
 */
export const addShowToFavorites = async (
  userId: string,
  showId: string
): Promise<void> => {
  try {
    const { error } = await supabase.rpc('add_favorite_show', {
      user_id: userId,
      show_id: showId,
    });
    if (error) throw error;
  } catch (error: any) {
    console.error('[supabaseAuthService] addShowToFavorites failed:', error);
    throw new Error(error.message || 'Failed to add show to favorites');
  }
};

/**
 * Remove a show from the user’s favorites.
 * Mirrors {@link addShowToFavorites} but calls
 * the `remove_favorite_show` Postgres function.
 */
export const removeShowFromFavorites = async (
  userId: string,
  showId: string
): Promise<void> => {
  try {
    const { error } = await supabase.rpc('remove_favorite_show', {
      user_id: userId,
      show_id: showId,
    });
    if (error) throw error;
  } catch (error: any) {
    console.error('[supabaseAuthService] removeShowFromFavorites failed:', error);
    throw new Error(error.message || 'Failed to remove show from favorites');
  }
}
