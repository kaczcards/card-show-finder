// src/hooks/useUnclaimedShows.ts
import { useState, useEffect } from 'react';
import { ShowSeries, Show } from '../types';
import { showSeriesService } from '../services/showSeriesService';
import { supabase } from '../supabase';

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
      console.warn('[_useUnclaimedShows] Fetching unclaimed series & shows…');
      setIsLoading(true);
      setError(null);

      /* ------------------------------------ *
       * 1. Unclaimed SERIES (organizer_id IS NULL)
       * ------------------------------------ */
      const { data: rawSeries, error: seriesErr } = await supabase
        .from('show_series')
        .select('*')
        .is('organizer_id', null);

      if (seriesErr) throw seriesErr;

      // Map raw series to ShowSeries objects with camelCase properties
      const mappedSeries = (rawSeries ?? []).map(series => ({
        id: series.id,
        name: series.name,
        organizerId: series.organizer_id,
        description: series.description,
        averageRating: series.average_rating,
        reviewCount: series.review_count,
        createdAt: series.created_at,
        updatedAt: series.updated_at
      }));

      const seriesIds = mappedSeries.map(s => s.id);

      /* ------------------------------------ *
       * 2. Upcoming shows that belong to ANY of
       *    those unclaimed series
       * ------------------------------------ */
      let upcomingSeriesShows: Show[] = [];
      if (seriesIds.length > 0) {
        const { data: rawSeriesShows, error: showsErr } = await supabase
          .from('shows')
          .select('*')
          .in('series_id', seriesIds)
          .gte('end_date', new Date().toISOString());

        if (showsErr) throw showsErr;
        
        // Map raw shows to Show objects using the service helper
        upcomingSeriesShows = (rawSeriesShows ?? []).map(show => 
          showSeriesService.mapShowRow(show)
        );
      }

      // Build per-series aggregates (nextShowDate & upcomingCount)
      const seriesMeta = new Map<
        string,
        { nextShowDate: string; upcomingCount: number }
      >();

      for (const show of upcomingSeriesShows) {
        const meta = seriesMeta.get(show.seriesId!) || {
          nextShowDate: show.startDate,
          upcomingCount: 0,
        };
        meta.upcomingCount += 1;
        if (new Date(show.startDate) < new Date(meta.nextShowDate)) {
          meta.nextShowDate = show.startDate;
        }
        seriesMeta.set(show.seriesId!, meta);
      }

      // Merge meta into mapped series & filter out series with 0 upcoming
      const unclaimedSeries: ShowSeries[] = mappedSeries
        .filter(s => seriesMeta.has(s.id))
        .map(s => ({
          ...s,
          nextShowDate: seriesMeta.get(s.id)!.nextShowDate,
          upcomingCount: seriesMeta.get(s.id)!.upcomingCount,
        }));

      /* ------------------------------------ *
       * 3. Stand-alone unclaimed upcoming shows
       * ------------------------------------ */
      const { data: rawStandalone, error: standaloneErr } = await supabase
        .from('shows')
        .select('*')
        .is('organizer_id', null)
        .is('series_id', null)
        .gte('end_date', new Date().toISOString())
        .order('start_date', { ascending: true });

      if (standaloneErr) throw standaloneErr;

      // Map raw standalone shows to Show objects using the service helper
      const unclaimedStandaloneShows: Show[] = (rawStandalone ?? []).map(show => 
        showSeriesService.mapShowRow(show)
      );

      /* ------------------------------------ *
       * 4. Combine & sort by upcoming date ASC
       * ------------------------------------ */
      const combinedItems: UnclaimedItem[] = [
        ...unclaimedSeries.map(s => ({ type: 'series' as const, data: s })),
        ...unclaimedStandaloneShows.map(show => ({ type: 'show' as const, data: show })),
      ];

      // Sort by date using properly typed objects with camelCase properties
      const dateValue = (item: UnclaimedItem) =>
        item.type === 'series'
          ? new Date((item.data as ShowSeries).nextShowDate!).getTime()
          : new Date((item.data as Show).startDate).getTime();

      combinedItems.sort((a, b) => dateValue(a) - dateValue(b));

      setUnclaimedItems(combinedItems);
      console.warn(`[_useUnclaimedShows] Done. Items: ${combinedItems.length}`);
    } catch (err) {
      console.error('[_useUnclaimedShows] Error:', err);
      setError(
        err instanceof Error
          ? err
          : new Error('Failed to load unclaimed shows. Please try again.'),
      );
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
