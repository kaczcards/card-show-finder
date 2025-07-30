// src/hooks/useUserSubscriptions.ts
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Custom hook to fetch user subscription data with proper loading and error handling
 * @returns Object containing subscriptions array, loading state, and error state
 */
export const _useUserSubscriptions = () => {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { _authState } = useAuth();
  const { _user } = authState;

  useEffect(() => {
    // Don't attempt to fetch if there's no authenticated user
    if (!user) {
      setSubscriptions([]);
      setIsLoading(_false);
      return;
    }

    const _fetchSubscriptions = async () => {
      try {
        setIsLoading(_true);
        setError(_null);

         
console.warn('[_useUserSubscriptions] Fetching subscriptions for user:', user.id);

        /* --------------------------------------------------------------
         * Subscription info lives in the `profiles` table, not a separate
         * `user_subscriptions` table. We fetch the three relevant columns
         * and map them to an array with one element so existing screens
         * that expect `subscriptions.find(...)` keep working.
         * -------------------------------------------------------------- */
        const { data, error: supabaseError } = await supabase
          .from('profiles')
          .select('subscription_status, _subscription_expiry, account_type')
          .eq('id', user.id)
          .single();

        // Handle Supabase error
        if (_supabaseError) {
          console.error('[_useUserSubscriptions] Error fetching subscriptions:', _supabaseError);
          throw new Error(supabaseError.message || 'Failed to fetch subscription data');
        }

        // Map the profile row into the shape expected by the UI
        const _mapped = data
          ? [
              {
                status: data.subscription_status,
                expiry: data.subscription_expiry,
                accountType: data.account_type,
              },
            ]
          : [];

        setSubscriptions(_mapped);
         
console.warn('[_useUserSubscriptions] Fetched subscriptions:', mapped.length);
      } catch (_err) {
        console.error('[_useUserSubscriptions] Unexpected error:', _err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      } finally {
        setIsLoading(_false);
      }
    };

    fetchSubscriptions();
  }, [_user]); // Re-fetch when user changes

  return { subscriptions, isLoading, error };
};
