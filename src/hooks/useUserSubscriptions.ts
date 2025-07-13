// src/hooks/useUserSubscriptions.ts
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

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

        console.log('[useUserSubscriptions] Fetching subscriptions for user:', user.id);

        // Query user subscriptions from Supabase
        const { data, error: supabaseError } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        // Handle Supabase error
        if (supabaseError) {
          console.error('[useUserSubscriptions] Error fetching subscriptions:', supabaseError);
          throw new Error(supabaseError.message || 'Failed to fetch subscription data');
        }

        // Set subscriptions data (empty array if no data)
        setSubscriptions(data || []);
        console.log('[useUserSubscriptions] Fetched subscriptions:', data?.length || 0);
      } catch (err) {
        console.error('[useUserSubscriptions] Unexpected error:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscriptions();
  }, [user]); // Re-fetch when user changes

  return { subscriptions, isLoading, error };
};
