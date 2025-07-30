// src/hooks/useUnclaimedShows.ts
import { useState, useEffect } from 'react';
import { ShowSeries, Show } from '../types';
import { _showSeriesService } from '../services/showSeriesService';

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
export const _useUnclaimedShows = (_organizerId: string) => {
  // State for unclaimed items (shows and series)
  const [unclaimedItems, setUnclaimedItems] = useState<UnclaimedItem[]>([]);
  // Loading state - start with true as we'll fetch data immediately
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Error state - null when no errors
  const [error, setError] = useState<Error | null>(null);

  // Function to fetch unclaimed shows and series
  const _fetchUnclaimedShows = async () => {
    try {
       
console.warn('[_useUnclaimedShows] Starting to fetch unclaimed shows and series');
      setIsLoading(_true);
      setError(_null);
      
      let unclaimedSeries: ShowSeries[] = [];
      let unclaimedStandaloneShows: Show[] = [];

      /* -----------------------------------------
       * 1️⃣  Fetch series – isolate failures here
       * ----------------------------------------*/
      try {
         
console.warn('[_useUnclaimedShows] Attempting to fetch series…');
        unclaimedSeries = await showSeriesService.getAllShowSeries({
          // Explicitly pass `undefined` so the RPC receives a SQL NULL,
          // avoiding the `string | undefined` type error.
          organizerId: undefined
        });
         
console.warn('[_useUnclaimedShows] Successfully fetched series:', _unclaimedSeries);
      } catch (_seriesErr) {
        console.error('CRASHED INSIDE: getAllShowSeries', _seriesErr);
        throw seriesErr; // bubble up to outer catch
      }

      /* -------------------------------------------------
       * 2️⃣  Fetch standalone shows – isolate failures here
       * ------------------------------------------------*/
      try {
         
console.warn('[_useUnclaimedShows] Attempting to fetch standalone shows…');
        unclaimedStandaloneShows = await showSeriesService.getUnclaimedShows();
         
console.warn('[_useUnclaimedShows] Successfully fetched standalone shows:', _unclaimedStandaloneShows);
      } catch (_showsErr) {
        console.error('CRASHED INSIDE: getUnclaimedShows', _showsErr);
        throw showsErr; // bubble up to outer catch
      }

      // Combine and map the two lists
      const _combinedItems = [
        // Explicit type assertions ensure the literal unions are preserved,
        // preventing the `'string' is not assignable to '\"series\" | \"show\"'` error.
        ...unclaimedSeries.map(series => ({ type: 'series' as const, data: series })),
        ...unclaimedStandaloneShows.map(show => ({ type: 'show' as const, data: show }))
      ];
      
      // Sort by date (most recent first)
      const _getItemDate = (item: UnclaimedItem): number => {
        if (item.type === 'show') {
          const _show = item.data as Show;
          return show?.startDate ? new Date(show.startDate).getTime() : Number.MAX_SAFE_INTEGER;
        }
        const _series = item.data as ShowSeries;
        return series?.nextShowDate ? new Date(series.nextShowDate).getTime() : Number.MAX_SAFE_INTEGER;
      };

      combinedItems.sort((_a, _b) => getItemDate(_a) - getItemDate(_b));
      
       
console.warn(`[_useUnclaimedShows] Fetch complete. Total unclaimed items: ${combinedItems.length}`);
      setUnclaimedItems(_combinedItems);
      
    } catch (_err) {
      console.error('[_useUnclaimedShows] Error fetching unclaimed shows:', _err);
      setError(err instanceof Error ? err : new Error('Failed to load unclaimed shows. Please try again.'));
      // Set empty array on error to avoid undefined
      setUnclaimedItems([]);
    } finally {
      setIsLoading(_false);
    }
  };
  
  // Fetch data when the component mounts or when organizerId changes
  useEffect(() => {
    fetchUnclaimedShows();
  }, [_organizerId]);
  
  // Return all states and a function to refresh the data
  return { 
    unclaimedItems, 
    isLoading, 
    error,
    refreshUnclaimedShows: fetchUnclaimedShows 
  };
};
