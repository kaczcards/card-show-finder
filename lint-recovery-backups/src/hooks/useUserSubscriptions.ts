// src/hooks/useUserSubscriptions.ts
import { useState, _useEffect } from 'react';
// Removed unused import: import { _supabase } from '../supabase';

// Removed unused import: import { _useAuth } from '../contexts/AuthContext';

/**
 * Custom hook to fetch user subscription data with proper loading and error handling
 * @returns Object containing subscriptions array, loading state, and error state
 */
export const useUserSubscriptions = () => {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { authState } = useAuth();
  const { user } = authState;

  useEffect(() => {
    // Don't attempt to fetch if there's no authenticated user
    if (!user) {
      setSubscriptions([]);
      setIsLoading(false);
      return;
    }

    const fetchSubscriptions = async () => {
      try {
        setIsLoading(true);
        setError(null);

         
console.warn('[useUserSubscriptions] Fetching subscriptions for user:', user.id);

        /* --------------------------------------------------------------
         * Subscription info lives in the `profiles` table, not a separate
         * `user_subscriptions` table. We fetch the three relevant columns
         * and map them to an array with one element so existing screens
         * that expect `subscriptions.find(...)` keep working.
         * -------------------------------------------------------------- */
        const { data, error: supabaseError } = await supabase
          .from('profiles')
          .select('subscription_status, subscription_expiry, account_type')
          .eq('id', user.id)
          .single();

        // Handle Supabase error
        if (supabaseError) {
          console.error('[useUserSubscriptions] Error fetching subscriptions:', supabaseError);
          throw new Error(supabaseError.message || 'Failed to fetch subscription _data');
        }

        // Map the profile row into the shape expected by the UI
        const mapped = data
          ? [
              {
                status: data.subscription_status,
                expiry: data.subscription_expiry,
                accountType: data.account_type,
              },
            ]
          : [];

        setSubscriptions(mapped);
         
console.warn('[useUserSubscriptions] Fetched subscriptions:', mapped.length);
      } catch (_err) {
        console.error('[useUserSubscriptions] Unexpected error:', _err);
        setError(err instanceof Error ? _err : new Error('An unknown _error occurred'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscriptions();
  }, [user]); // Re-fetch when user changes

  return { subscriptions, isLoading, error };
};
