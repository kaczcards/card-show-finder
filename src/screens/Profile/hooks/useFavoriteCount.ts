import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../supabase';

export const useFavoriteCount = () => {
  const { authState } = useAuth();
  const { user } = authState;
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setCount(0);
      return;
    }

    try {
      // Try to read the counter column directly
      const { data, error } = await supabase
        .from('profiles')
        .select('favorite_shows_count')
        .eq('id', user.id)
        .single();

      if (error) {
        if (__DEV__) {
          console.warn(
            '[useFavoriteCount] Error fetching favorite_shows_count:',
            error.message
          );
        }

        // 42703 = column does not exist -> migration not applied yet
        if (error.code === '42703') {
          if (__DEV__) {
            console.warn(
              '[useFavoriteCount] Falling back to counting records in user_favorite_shows'
            );
          }

          // Fallback – count rows in join table
          const {
            count: rowCount,
            error: countError,
          } = await supabase
            .from('user_favorite_shows')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

          if (countError) {
            console.error(
              '[useFavoriteCount] Error counting favorites:',
              countError
            );
            return;
          }

          setCount(rowCount || 0);
          return;
        }

        console.error(
          '[useFavoriteCount] Unexpected error fetching favorite_shows_count:',
          error
        );
        return;
      }

      // Success path – column exists
      const favoriteCount = data?.favorite_shows_count ?? 0;
      if (__DEV__) {
        console.warn('[useFavoriteCount] Fetched favorite_shows_count:', favoriteCount);
      }
      setCount(favoriteCount);
    } catch (err) {
      console.error('[useFavoriteCount] Unexpected error:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh, user?.id]);

  return { count, refresh };
};

export default useFavoriteCount;
