// src/hooks/useUnclaimedShows.ts
import { useState, useEffect } from 'react';
import { ShowSeries, Show } from '../types';
import { showSeriesService } from '../services/showSeriesService';

// Interface for combined unclaimed items (shows or series)
export interface UnclaimedItem {
  type: 'series' | 'show';
  series?: ShowSeries;
  show?: Show;
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
      console.log('[useUnclaimedShows] Fetching unclaimed series');
      const unclaimedSeries = await showSeriesService.getAllShowSeries({ 
        organizerId: null // Passing null to get unclaimed series
      });
      console.log(`[useUnclaimedShows] Found ${unclaimedSeries.length} unclaimed series`);
      
      // Get unclaimed standalone shows (not part of any series)
      console.log('[useUnclaimedShows] Fetching unclaimed standalone shows');
      const unclaimedStandaloneShows = await showSeriesService.getUnclaimedShows();
      console.log(`[useUnclaimedShows] Found ${unclaimedStandaloneShows.length} unclaimed standalone shows`);
      
      // Combine into a single list
      const combinedItems: UnclaimedItem[] = [
        ...unclaimedSeries.map(series => ({ type: 'series', series } as UnclaimedItem)),
        ...unclaimedStandaloneShows.map(show => ({ type: 'show', show } as UnclaimedItem))
      ];
      
      // Sort by date (most recent first)
      combinedItems.sort((a, b) => {
        const dateA = a.type === 'show' ? new Date(a.show!.startDate) : 
          (a.series!.nextShowDate ? new Date(a.series!.nextShowDate) : new Date(0));
        const dateB = b.type === 'show' ? new Date(b.show!.startDate) : 
          (b.series!.nextShowDate ? new Date(b.series!.nextShowDate) : new Date(0));
        return dateA.getTime() - dateB.getTime();
      });
      
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
