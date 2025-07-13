// src/services/supabaseAuthService.ts
import { supabase } from '../supabase';
import { User, UserRole, AuthCredentials, AuthState } from '../types';
import NetInfo from '@react-native-community/netinfo';
import { isSupabaseInitialized } from '../supabase';

// ---------------------------------------------------------------------------
// Development mode – set to `false` in production builds. When `true`, the
// authentication flow will short-circuit after Supabase Auth login succeeds
// and return a mock profile so developers can access the app without needing
// a corresponding row in the `profiles` table.
// ---------------------------------------------------------------------------
const DEV_MODE = false;

/**
 * Register a new user with email and password
 * @param email User's email
 * @param password User's password
 * @param firstName User's first name
 * @param lastName User's last name (optional)
 * @param homeZipCode User's home ZIP code
 * @param role The desired role for the new user (defaults to ATTENDEE)
 * @returns Promise with the created user
 */
export const registerUser = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string = '',
  homeZipCode: string,
  role: UserRole = UserRole.ATTENDEE
): Promise<User> => {
  try {
    /* ---- Preconditions -------------------------------------------------- */
    // 1) Supabase properly initialised?
    if (!isSupabaseInitialized()) {
      throw new Error(
        'Supabase client not initialised – please check your environment variables (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).'
      );
    }

    // 2) Device has network connectivity?
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      throw new Error('No internet connection. Please connect to the internet and try again.');
    }

    // Register user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          firstName,
          lastName,
          homeZipCode,
          role, // store role in user metadata for downstream triggers / RLS rules
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Registration failed');

    const userData: User = {
      id: authData.user.id,
      email,
      firstName,
      lastName: lastName || undefined,
      homeZipCode,
      role,
      // new subscription-related defaults for freshly registered users
      accountType: 'collector',
      subscriptionStatus: 'none',
      subscriptionExpiry: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEmailVerified: false,
      favoriteShows: [],
      attendedShows: [],
    };
    
    // Give the database trigger a short moment to create the profile row
    await new Promise(resolve => setTimeout(resolve, 500));

    return userData;
  } catch (error: any) {
    /* ---- Enhanced error mapping ---------------------------------------- */
    const rawMessage = error?.message || '';

    // Duplicate user (already registered)
    if (
      rawMessage.toLowerCase().includes('user already registered') ||
      rawMessage.toLowerCase().includes('already exists') ||
      error?.status === 409 || // Supabase may respond with 409
      error?.code === '23505'   // postgres unique violation
    ) {
      console.warn('Attempted to register an already-existing user.');
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    // Network / fetch failures
    if (rawMessage.toLowerCase().includes('network request failed')) {
      throw new Error(
        'Unable to reach authentication server. Please check your internet connection and try again.'
      );
    }

    console.error('Error registering user via Supabase signUp:', error);
    throw new Error(rawMessage || 'Failed to register user');
  }
};

/**
 * Direct sign in with email and password - returns object with user and error
 * @param email User's email
 * @param password User's password
 * @returns Object with user and error properties
 */
export const signInWithEmailPassword = async (email: string, password: string) => {
  // Add debug logging
  console.log('[AUTH SERVICE] signInWithEmailPassword - attempting login', { email });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Enhanced error logging
    if (error) {
      console.error('[AUTH SERVICE] Login error:', JSON.stringify(error, null, 2));
      return { user: null, error };
    }

    console.log('[AUTH SERVICE] Login successful:', data.user?.id);
    return { user: data.user, error: null };
  } catch (err: any) {
    console.error('[AUTH SERVICE] Unexpected error during login:', err);
    return { user: null, error: err };
  }
};

/**
 * Sign in a user with email and password
 * @param credentials User's email and password
 * @returns Promise with the user data
 */
export const signInUser = async (credentials: AuthCredentials): Promise<User> => {
  // Initial debug log as requested
  console.log('[AUTH SERVICE] signInUser called with email:', credentials.email);

  try {
    const { email, password } = credentials;

    // Use the helper that returns `{ user, error }`
    const result = await signInWithEmailPassword(email, password);

    // Structured result logging
    console.log('[AUTH SERVICE] Result from signInWithEmailPassword:', {
      success: !!result.user,
      hasError: !!result.error,
      errorMessage: result.error?.message,
    });

    // Check if there was an error
    if (result.error) {
      // Check for specific "Email not confirmed" error
      if (result.error.message?.toLowerCase().includes('email not confirmed')) {
        throw new Error(
          'Your email address has not been verified. Please check your inbox for a verification email or use the "Resend verification" button.'
        );
      }
      
      // Check for invalid credentials error
      if (result.error.message?.toLowerCase().includes('invalid login credentials')) {
        throw new Error('Invalid email or password. Please check your credentials and try again.');
      }
      
      throw result.error;
    }

    if (!result.user) throw new Error('Login failed');

    /* ======= DEVELOPMENT MODE BYPASS ======= */
    if (DEV_MODE) {
      console.log('[AUTH SERVICE][DEV MODE] Bypassing profile fetch, returning mock user');
      const nowIso = new Date().toISOString();
      return {
        id: result.user.id,
        email: result.user.email || email,
        firstName: 'Dev',
        lastName: 'User',
        homeZipCode: '12345',
        role: UserRole.MVP_DEALER, // expose full feature set in dev
        createdAt: nowIso,
        updatedAt: nowIso,
        isEmailVerified: true,
        accountType: 'collector',
        subscriptionStatus: 'none',
        subscriptionExpiry: null,
        favoriteShows: [],
        attendedShows: [],
      };
    }

    /* ------------------------------------------------------------------
     * ENHANCED LOGGING – Profile fetch
     * ------------------------------------------------------------------ */
    console.log('[AUTH SERVICE] Authentication successful – fetching user profile', {
      userId: result.user.id,
      email: result.user.email,
    });

    // Get user profile from the profiles table
    let { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', result.user.id)
      .single();

    /* -------- Auto-create profile if missing -------- */
    const profileNotFound =
      profileError &&
        (profileError.code === 'PGRST116' ||
          profileError.message?.toLowerCase().includes('not found')) ||
      !profileData;

    if (profileNotFound) {
      console.log('[AUTH SERVICE] Profile not found – attempting to create default profile');

      const defaultProfile = {
        id: result.user.id,
        email: result.user.email,
        first_name: 'User',
        last_name: '',
        home_zip_code: '00000',
        role: UserRole.ATTENDEE,
        account_type: 'collector',
        subscription_status: 'none',
        subscription_expiry: null,
        favorite_shows: [],
        attended_shows: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([defaultProfile])
        .select()
        .single();

      if (insertError) {
        console.error('[AUTH SERVICE] Failed to create default profile:', insertError);
        throw insertError;
      }

      console.log('[AUTH SERVICE] Successfully created default profile');
      profileData = newProfile;
    } else if (profileError) {
      // Any other profile-related error
      console.error('[AUTH SERVICE] Error fetching profile:', {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
      });
      throw profileError;
    }

    if (!profileData) {
      console.error(
        '[AUTH SERVICE] No profile found and automatic creation failed for user:',
        result.user.id
      );
      throw new Error('User profile not found and could not be created');
    }

    console.log('[AUTH SERVICE] Profile fetched successfully:', {
      firstName: profileData.first_name,
      role: profileData.role,
    });

    // Convert from Supabase format to our app's User format
    console.log('[AUTH SERVICE] Transforming profile data to User format');

    const userData: User = {
      id: result.user.id,
      email: result.user.email || '',
      firstName: profileData.first_name,
      lastName: profileData.last_name || undefined,
      homeZipCode: profileData.home_zip_code,
      role: profileData.role as UserRole,
      accountType: profileData.account_type,
      subscriptionStatus: profileData.subscription_status,
      subscriptionExpiry: profileData.subscription_expiry,
      createdAt: profileData.created_at,
      updatedAt: profileData.updated_at,
      isEmailVerified: result.user.email_confirmed_at !== null,
      favoriteShows: profileData.favorite_shows || [],
      attendedShows: profileData.attended_shows || [],
      phoneNumber: profileData.phone_number,
      profileImageUrl: profileData.profile_image_url,
    };

    console.log('[AUTH SERVICE] User data transformation complete:', {
      id: userData.id,
      email: userData.email,
      role: userData.role,
      isEmailVerified: userData.isEmailVerified,
    });

    return userData;
  } catch (error: any) {
    console.error('[AUTH SERVICE] Error in signInUser:', error);
    if (error?.stack) {
      console.error('[AUTH SERVICE] Error stack:', error.stack);
    }
    throw error; // Pass through the error with our enhanced message
  }
};

/**
 * Resend verification email to a user who hasn't confirmed their email
 * @param email Email address to send verification to
 * @returns Promise<void>
 */
export const resendEmailVerification = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    
    if (error) throw error;
  } catch (error: any) {
    console.error('Error resending verification email:', error);
    throw new Error(error.message || 'Failed to resend verification email');
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
    // ------------------------------------------------------------------
    //  Debug – entry point
    // ------------------------------------------------------------------
    console.log('[AUTH SERVICE] getCurrentUser() – fetching profile for UID:', uid);

    // ------------------------------------------------------------------
    // 1) Fetch profile row
    // ------------------------------------------------------------------
    let { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();

    // ------------------------------------------------------------------
    // 2) Handle “profile not found” gracefully by creating a default row
    // ------------------------------------------------------------------
    const profileNotFound =
      (error &&
        (error.code === 'PGRST116' ||
          error.message?.toLowerCase().includes('not found'))) ||
      !profileData;

    if (profileNotFound) {
      console.warn(
        '[AUTH SERVICE] getCurrentUser – profile missing, creating default profile for user:',
        uid
      );

      const defaultProfile = {
        id: uid,
        email: (await supabase.auth.getUser()).data.user?.email,
        first_name: 'User',
        last_name: '',
        home_zip_code: '00000',
        role: UserRole.ATTENDEE,
        account_type: 'collector',
        subscription_status: 'none',
        subscription_expiry: null,
        favorite_shows: [],
        attended_shows: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([defaultProfile])
        .select()
        .single();

      if (insertError) {
        console.error(
          '[AUTH SERVICE] getCurrentUser – failed to create default profile:',
          insertError
        );
        throw insertError;
      }

      profileData = newProfile;
      error = null;
      console.log('[AUTH SERVICE] getCurrentUser – default profile created successfully');
    }

    // ------------------------------------------------------------------
    // 3) Any other Supabase error bubbles up
    // ------------------------------------------------------------------
    if (error) {
      console.error('[AUTH SERVICE] getCurrentUser – Supabase error while fetching profile', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    if (!profileData) {
      console.error(
        '[AUTH SERVICE] getCurrentUser – profile still missing after fallback creation'
      );
      return null;
    }

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
      accountType: profileData.account_type,
      subscriptionStatus: profileData.subscription_status,
      subscriptionExpiry: profileData.subscription_expiry,
      createdAt: profileData.created_at,
      updatedAt: profileData.updated_at,
      isEmailVerified: authUser?.email_confirmed_at !== null, // Use authUser for verification status
      favoriteShows: profileData.favorite_shows || [],
      attendedShows: profileData.attended_shows || [],
      phoneNumber: profileData.phone_number,
      profileImageUrl: profileData.profile_image_url,
    };

    // ------------------------------------------------------------------
    //  Debug – success
    // ------------------------------------------------------------------
    console.log('[AUTH SERVICE] getCurrentUser – successfully mapped user', {
      id: userData.id,
      email: userData.email,
      role: userData.role,
    });

    return userData;
  } catch (error: any) {
    console.error('[AUTH SERVICE] getCurrentUser – caught exception:', {
      message: error?.message,
      stack: error?.stack,
    });
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
    /* ------------------------------------------------------------------
     * Build single update object with all provided fields
     * ------------------------------------------------------------------ */
    const profileUpdates: Record<string, any> = {
      first_name: userData.firstName,
      last_name: userData.lastName ?? '',
      home_zip_code: userData.homeZipCode,
      phone_number: userData.phoneNumber,
      profile_image_url: userData.profileImageUrl,
      account_type: userData.accountType,
      subscription_status: userData.subscriptionStatus,
      subscription_expiry: userData.subscriptionExpiry,
      updated_at: new Date().toISOString(),
    };

    // Remove undefined values to avoid unintentionally overwriting fields
    const cleanUpdates = Object.fromEntries(
      Object.entries(profileUpdates).filter(([, value]) => value !== undefined)
    );

    console.log('[AUTH SERVICE] updateUserProfile – applying profile updates', {
      uid,
      fields: Object.keys(cleanUpdates),
    });

    const { error } = await supabase
      .from('profiles')
      .update(cleanUpdates)
      .eq('id', uid);

    if (error) {
      console.error('[AUTH SERVICE] updateUserProfile – update failed', error);
      throw error;
    }

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
    console.log('[AUTH SERVICE] Adding show to favorites:', { uid, showId });

    // Insert into the user_favorite_shows table
    // DB trigger will update favorite_shows_count automatically
    const { error: insertError } = await supabase
      .from('user_favorite_shows')
      .insert([{ user_id: uid, show_id: showId }])
      .single();

    // Ignore duplicate-key errors (already favorited)
    if (insertError && insertError.code !== '23505') {
      throw insertError;
    }

    if (!insertError) {
      console.log('[AUTH SERVICE] Show successfully added to favorites');
    } else {
      console.log('[AUTH SERVICE] Show already in favorites – no action needed');
    }
  } catch (error: any) {
    console.error('[AUTH SERVICE] Error adding show to favorites:', error);
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
    console.log('[AUTH SERVICE] Removing show from favorites:', { uid, showId });

    // Delete from the user_favorite_shows table
    // DB trigger will update favorite_shows_count automatically
    const { error: deleteError } = await supabase
      .from('user_favorite_shows')
      .delete()
      .eq('user_id', uid)
      .eq('show_id', showId);

    if (deleteError) throw deleteError;

    console.log('[AUTH SERVICE] Show successfully removed from favorites');
  } catch (error: any) {
    console.error('[AUTH SERVICE] Error removing show from favorites:', error);
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
