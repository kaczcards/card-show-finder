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
      // eslint-disable-next-line no-console
console.warn('[useUnclaimedShows] Starting to fetch unclaimed shows and series');
      setIsLoading(true);
      setError(null);
      
      let unclaimedSeries: ShowSeries[] = [];
      let unclaimedStandaloneShows: Show[] = [];

      /* -----------------------------------------
       * 1️⃣  Fetch series – isolate failures here
       * ----------------------------------------*/
      try {
        // eslint-disable-next-line no-console
console.warn('[useUnclaimedShows] Attempting to fetch series…');
        unclaimedSeries = await showSeriesService.getAllShowSeries({
          // Explicitly pass `undefined` so the RPC receives a SQL NULL,
          // avoiding the `string | undefined` type error.
          organizerId: undefined
        });
        // eslint-disable-next-line no-console
console.warn('[useUnclaimedShows] Successfully fetched series:', unclaimedSeries);
      } catch (seriesErr) {
        console.error('CRASHED INSIDE: getAllShowSeries', seriesErr);
        throw seriesErr; // bubble up to outer catch
      }

      /* -------------------------------------------------
       * 2️⃣  Fetch standalone shows – isolate failures here
       * ------------------------------------------------*/
      try {
        // eslint-disable-next-line no-console
console.warn('[useUnclaimedShows] Attempting to fetch standalone shows…');
        unclaimedStandaloneShows = await showSeriesService.getUnclaimedShows();
        // eslint-disable-next-line no-console
console.warn('[useUnclaimedShows] Successfully fetched standalone shows:', unclaimedStandaloneShows);
      } catch (showsErr) {
        console.error('CRASHED INSIDE: getUnclaimedShows', showsErr);
        throw showsErr; // bubble up to outer catch
      }

      // Combine and map the two lists
      const combinedItems = [
        // Explicit type assertions ensure the literal unions are preserved,
        // preventing the `'string' is not assignable to '\"series\" | \"show\"'` error.
        ...unclaimedSeries.map(series => ({ type: 'series' as const, data: series })),
        ...unclaimedStandaloneShows.map(show => ({ type: 'show' as const, data: show }))
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
      
      // eslint-disable-next-line no-console
console.warn(`[useUnclaimedShows] Fetch complete. Total unclaimed items: ${combinedItems.length}`);
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
