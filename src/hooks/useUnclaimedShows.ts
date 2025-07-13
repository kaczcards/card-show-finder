// src/hooks/useUnclaimedShows.ts
import { useState, useEffect } from 'react';
import { ShowSeries, Show } from '../types';
import { showSeriesService } from '../services/showSeriesService';

// Interface for combined unclaimed items (shows or series)
export interface UnclaimedItem {
  type: 'series' | 'show';
  data: ShowSeries | Show;
}

/**
 * Custom hook to fetch and manage unclaimed shows data
 * @param organizerId The organizer ID (used for claiming shows later)
 * @returns Object containing unclaimed items, loading state, and error state
 */
export const useUnclaimedShows = (organizerId: string) => {
  // State for unclaimed items (shows and series)
  const [unclaimedItems, setUnclaimedItems] = useState<UnclaimedItem[]>([]);
  // Loading state - start with true as we'll fetch data immediately
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Error state - null when no errors
  const [error, setError] = useState<Error | null>(null);

  // Function to fetch unclaimed shows and series
  const fetchUnclaimedShows = async () => {
    try {
      console.log('[useUnclaimedShows] Starting to fetch unclaimed shows and series');
      setIsLoading(true);
      setError(null);
      
      // Get unclaimed series
      const unclaimedSeries = await showSeriesService.getAllShowSeries({
        organizerId: null // Passing null to get unclaimed series
      });
      
      // CRITICAL DEBUG LOG - This log will show exactly what is coming back from the service
      console.log('[DEBUG] Value of unclaimedSeries:', unclaimedSeries);
      
      // Get unclaimed standalone shows (not part of any series)
      const unclaimedStandaloneShows = await showSeriesService.getUnclaimedShows();
      
      // CRITICAL DEBUG LOG - This log will show exactly what is coming back from the service
      console.log('[DEBUG] Value of unclaimedStandaloneShows:', unclaimedStandaloneShows);

      // --- THIS IS THE PRODUCTION-QUALITY FIX ---
      // Default to an empty array if the service returns a falsy value (null, undefined, etc.)
      const safeSeries = unclaimedSeries || [];
      const safeShows = unclaimedStandaloneShows || [];
      // ------------------------------------------
      
      console.log('[DEBUG] Using safeSeries:', safeSeries);
      console.log('[DEBUG] Using safeShows:', safeShows);
      
      // Now, it is 100% safe to combine and map these arrays
      const combinedItems = [
        ...safeSeries.map(series => ({ type: 'series', data: series })),
        ...safeShows.map(show => ({ type: 'show', data: show }))
      ];
      
      // Sort by date (most recent first)
      const getItemDate = (item: UnclaimedItem): number => {
        if (item.type === 'show') {
          const show = item.data as Show;
          return show?.startDate ? new Date(show.startDate).getTime() : Number.MAX_SAFE_INTEGER;
        }
        const series = item.data as ShowSeries;
        return series?.nextShowDate ? new Date(series.nextShowDate).getTime() : Number.MAX_SAFE_INTEGER;
      };

      combinedItems.sort((a, b) => getItemDate(a) - getItemDate(b));
      
      console.log(`[useUnclaimedShows] Fetch complete. Total unclaimed items: ${combinedItems.length}`);
      setUnclaimedItems(combinedItems);
      
    } catch (err) {
      console.error('[useUnclaimedShows] Error fetching unclaimed shows:', err);
      setError(err instanceof Error ? err : new Error('Failed to load unclaimed shows. Please try again.'));
      // Set empty array on error to avoid undefined
      setUnclaimedItems([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch data when the component mounts or when organizerId changes
  useEffect(() => {
    fetchUnclaimedShows();
  }, [organizerId]);
  
  // Return all states and a function to refresh the data
  return { 
    unclaimedItems, 
    isLoading, 
    error,
    refreshUnclaimedShows: fetchUnclaimedShows 
  };
};
