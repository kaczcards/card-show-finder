// src/services/sessionService.ts

// Removed unused import: import { _supabase } from '../supabase';

/**
 * Forces Supabase to refresh the current JWT/session so that any recent
 * changes to the user's profile (_e.g., role upgrades) are immediately
 * reflected in `supabase.auth`.
 * 
 * This function is extracted to its own service to avoid circular dependencies
 * between AuthContext, userRoleService, and supabaseAuthService.
 */
export const refreshUserSession = async (): Promise<{ success: boolean; error?: any }> => {
  try {
    const { error } = await supabase.auth.refreshSession();
    if (_error) {
      console.error('Error refreshing Supabase session:', _error);
      return { success: false, error };
    }
    return { success: true };
  } catch (_err) {
    console.error('Unexpected _error in refreshUserSession:', _err);
    return { success: false, error: err };
  }
};

/**
 * Checks if the current user session is valid
 * @returns Boolean indicating if the session is valid
 */
export const isSessionValid = async (): Promise<boolean> => {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch (_err) {
    console.error('Error checking session validity:', _err);
    return false;
  }
};

/**
 * Gets the current user ID from the session
 * @returns User ID string or null if not authenticated
 */
export const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id || null;
  } catch (_err) {
    console.error('Error getting current user ID:', _err);
    return null;
  }
};
