/**
 * Show Service
 *
 * This file contains helpers for fetching shows from Supabase.
 */

import { supabase } from '../supabase';
import { Show, ShowStatus } from '../types';

/**
 * Convert a raw Supabase row into an app `Show` object.
 */
const mapDbShowToAppShow = (row: any): Show => ({
  id: row.id,
  title: row.title,
  location: row.location,
  address: row.address,
  startDate: row.start_date,
  endDate: row.end_date,
  startTime: row.start_time,
  endTime: row.end_time,
  entryFee: row.entry_fee,
  description: row.description ?? undefined,
  imageUrl: row.image_url ?? undefined,
  rating: row.rating ?? undefined,
  // Prefer explicit latitude / longitude columns (added in updated Supabase functions);
  // fall back to legacy PostGIS object when they are not present.
  coordinates:
    typeof row.latitude === 'number' && typeof row.longitude === 'number'
      ? {
          latitude: row.latitude,
          longitude: row.longitude,
        }
      : row.coordinates &&
        row.coordinates.coordinates &&
        Array.isArray(row.coordinates.coordinates) &&
        row.coordinates.coordinates.length >= 2
      ? {
          latitude: row.coordinates.coordinates[1],
          longitude: row.coordinates.coordinates[0],
        }
      : undefined,
  status: row.status as ShowStatus,
  organizerId: row.organizer_id,
  features: row.features ?? {},
  categories: row.categories ?? [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  seriesId: row.series_id,
  websiteUrl: row.website_url,
});

/**
 * Fetch a list of active shows.
 *
 * The caller supplies a `ShowFilters` object that may contain:
 *   • latitude / longitude / radius → geo-filtered RPC
 *   • startDate / endDate / maxEntryFee / categories / features, etc.
 *
 * The function always returns an **array of Show objects** (may be empty) and
 * throws on error – this aligns with `HomeScreen.tsx`, which expects a plain
 * array.
 */
import { ShowFilters } from '../types';

export const getShows = async (filters: ShowFilters = {}): Promise<Show[]> => {
  try {
    // Ensure filters is a valid object
    filters = filters || {};
    
    /* -----------------------------------------------------------
     * 1. Geo-aware query via nearby_shows RPC when lat/lng present
     * --------------------------------------------------------- */
    if (
      typeof filters.latitude === 'number' &&
      typeof filters.longitude === 'number' &&
      !isNaN(filters.latitude) &&
      !isNaN(filters.longitude)
    ) {
      const radius = typeof filters.radius === 'number' ? filters.radius : 25;

      /* ---------- Sanity-check lat / lng values ---------- */
      if (Math.abs(filters.latitude) > 90 || Math.abs(filters.longitude) > 180) {
        console.warn(
          '[showService] Suspicious coordinates detected – latitude / longitude might be swapped:',
          { latitude: filters.latitude, longitude: filters.longitude }
        );
      }

      console.debug('[showService] Calling nearby_shows with params:', {
        lat: filters.latitude,
        long: filters.longitude,
        radius_miles: radius,
        start_date: filters.startDate ?? null,
        end_date: filters.endDate ?? null,
      });

      // Call the new nearby_shows function as primary method
      const { data: nearbyData, error: nearbyError } = await supabase.rpc(
        'nearby_shows',
        {
          lat: filters.latitude,
          long: filters.longitude,
          radius_miles: radius,
          start_date: filters.startDate || null,
          end_date: filters.endDate || null,
        }
      );

      if (nearbyError) {
        console.warn(
          '[showService] nearby_shows RPC failed – attempting fallback',
          nearbyError.message
        );
      } else {
        console.info(
          `[showService] nearby_shows returned ${((nearbyData && Array.isArray(nearbyData)) ? nearbyData.length : 0)} show(s)`
        );
        
        // Apply additional filters that weren't handled by the RPC
        let filteredData = nearbyData;
        
        // Filter by max entry fee if specified
        if (typeof filters.maxEntryFee === 'number' && Array.isArray(filteredData)) {
          filteredData = filteredData.filter(show => 
            show.entry_fee <= filters.maxEntryFee!
          );
        }
        
        // Filter by categories if specified
        if (filters.categories && Array.isArray(filters.categories) && 
            filters.categories.length > 0 && Array.isArray(filteredData)) {
          filteredData = filteredData.filter(show => 
            show.categories && 
            filters.categories!.some(cat => show.categories.includes(cat))
          );
        }
        
        // Filter by features if specified
        if (filters.features && Array.isArray(filters.features) && 
            filters.features.length > 0 && Array.isArray(filteredData)) {
          filteredData = filteredData.filter(show => 
            show.features && 
            filters.features!.every(feature => show.features[feature] === true)
          );
        }
        
        return Array.isArray(filteredData) ? filteredData.map(mapDbShowToAppShow) : [];
      }

      /* -------------------------------------------------------
       * 1b. Fallback to find_filtered_shows if nearby_shows fails
       * ----------------------------------------------------- */
      console.debug('[showService] Falling back to find_filtered_shows with params:', {
        center_lat: filters.latitude,
        center_lng: filters.longitude,
        radius_miles: radius,
        start_date: filters.startDate ?? null,
        end_date: filters.endDate ?? null,
        max_entry_fee: filters.maxEntryFee ?? null,
        show_categories: filters.categories ?? null,
        show_features: filters.features ?? null,
      });

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'find_filtered_shows',
        {
          // Primary/filter-aware RPC parameters
          center_lat: typeof filters.latitude === 'number' ? filters.latitude : null,
          center_lng: typeof filters.longitude === 'number' ? filters.longitude : null,
          radius_miles: typeof filters.radius === 'number' ? filters.radius : 25,
          start_date: filters.startDate || null,
          end_date: filters.endDate || null,
          max_entry_fee: typeof filters.maxEntryFee === 'number' ? filters.maxEntryFee : null,
          show_categories: Array.isArray(filters.categories) ? filters.categories : null,
          show_features: filters.features || null,
        }
      );

      if (rpcError) {
        console.warn(
          '[showService] find_filtered_shows RPC failed – attempting second fallback',
          rpcError.message
        );
      } else {
        console.info(
          `[showService] find_filtered_shows returned ${((rpcData && Array.isArray(rpcData)) ? rpcData.length : 0)} show(s)`
        );
        return Array.isArray(rpcData) ? rpcData.map(mapDbShowToAppShow) : [];
      }

      /* -------------------------------------------------------
       * 1c. Fallback to simple radius-only RPC if the above fails
       * ----------------------------------------------------- */
      const { data: fbData, error: fbError } = await supabase.rpc(
        'find_shows_within_radius',
        {
          center_lat: typeof filters.latitude === 'number' ? filters.latitude : null,
          center_lng: typeof filters.longitude === 'number' ? filters.longitude : null,
          radius_miles: typeof filters.radius === 'number' ? filters.radius : 25,
        }
      );

      if (fbError) {
        console.warn(
          '[showService] find_shows_within_radius fallback failed – will use basic query',
          fbError.message
        );
        // fall through to non-spatial query below
      } else {
        console.debug(
          '[showService] find_shows_within_radius params:',
          { center_lat: filters.latitude, center_lng: filters.longitude, radius_miles: radius }
        );
        console.info(
          `[showService] find_shows_within_radius returned ${((fbData && Array.isArray(fbData)) ? fbData.length : 0)} show(s)`
        );
        return Array.isArray(fbData) ? fbData.map(mapDbShowToAppShow) : [];
      }
    }

    /* -----------------------------------------------------------
     * 2. Basic (non-spatial) SELECT with optional filters
     * --------------------------------------------------------- */
    let query = supabase
      .from('shows')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('start_date', { ascending: true });

    if (filters.startDate) {
      query = query.gte('start_date', filters.startDate as any);
    }
    if (filters.endDate) {
      query = query.lte('end_date', filters.endDate as any);
    }
    if (typeof filters.maxEntryFee === 'number') {
      query = query.lte('entry_fee', filters.maxEntryFee);
    }
    if (filters.categories && Array.isArray(filters.categories) && filters.categories.length > 0) {
      query = query.overlaps('categories', filters.categories);
    }

    /* ---------- Log basic-query filters for debugging ---------- */
    console.debug('[showService] Executing basic query with filters:', {
      startDate: filters.startDate,
      endDate: filters.endDate,
      maxEntryFee: filters.maxEntryFee,
      categories: filters.categories,
      status: 'ACTIVE',
    });

    const { data, error } = await query;

    if (error) throw error;

    console.info(
      `[showService] basic query returned ${((data && Array.isArray(data)) ? data.length : 0)} show(s)`
    );
    return Array.isArray(data) ? data.map(mapDbShowToAppShow) : [];
  } catch (err: any) {
    console.error('Error fetching shows:', err);
    throw new Error(err.message ?? 'Failed to fetch shows');
  }
  
  // Safety return if we somehow get here without data
  return [];
};

/**
 * Fetch a single show by ID.
 */
export const getShowById = async (
  id: string
): Promise<{ data: Show | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return { data: null, error: 'Show not found' };
    }

    return { data: mapDbShowToAppShow(data), error: null };
  } catch (err: any) {
    console.error('Error fetching show by id:', err);
    return { data: null, error: err.message ?? 'Unknown error' };
  }
};

/**
 * Create a new show (stub)
 */
export const createShow = () => {
  throw new Error('createShow not implemented');
};

/**
 * Fetch upcoming (or otherwise date-filtered) shows a user is planning to attend.
 *
 * Looks up the `show_participants` table for the supplied `userId` and then
 * fetches matching shows from `shows`, with optional date-range constraints.
 *
 * @param params - { userId, startDate, endDate? }
 * @returns { data, error } shape – `data` will be an array of `Show`s.
 */
export const getUpcomingShows = async (params: {
  userId: string;
  startDate: Date | string;
  endDate?: Date | string;
}): Promise<{ data: Show[] | null; error: string | null }> => {
  try {
    const { userId, startDate, endDate } = params;

    if (!userId) {
      return { data: null, error: 'Invalid userId' };
    }

    /* -----------------------------------------------------------
     * 1. Fetch show IDs the user plans to attend
     * --------------------------------------------------------- */
    const { data: participantRows, error: participantError } = await supabase
      .from('show_participants')
      // use lowercase column names in db
      .select('showid')
      .eq('userid', userId);

    if (participantError) {
      throw participantError;
    }

    if (!participantRows || participantRows.length === 0) {
      // User is not signed up for any shows
      return { data: [], error: null };
    }

    const showIds = participantRows
      .map((row: any) => row.showid)
      .filter(Boolean);

    /* -----------------------------------------------------------
     * 2. Fetch shows matching those IDs + date filters
     * --------------------------------------------------------- */
    let showQuery = supabase
      .from('shows')
      .select('*')
      .in('id', showIds)
      .order('start_date', { ascending: true });

    if (startDate) {
      showQuery = showQuery.gte('start_date', startDate as any);
    }
    if (endDate) {
      showQuery = showQuery.lte('end_date', endDate as any);
    }

    const { data: showRows, error: showError } = await showQuery;

    if (showError) {
      throw showError;
    }

    const mapped = Array.isArray(showRows)
      ? showRows.map(mapDbShowToAppShow)
      : [];

    return { data: mapped, error: null };
  } catch (err: any) {
    console.error('Error fetching upcoming shows for user:', err);
    return { data: null, error: err.message ?? 'Unknown error' };
  }
};

/**
 * Update an existing show (stub)
 */
export const updateShow = () => {
  throw new Error('updateShow not implemented');
};

/**
 * Delete a show (stub)
 */
export const deleteShow = () => {
  throw new Error('deleteShow not implemented');
};
