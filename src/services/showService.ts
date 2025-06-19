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
  entryFee: row.entry_fee,
  description: row.description ?? undefined,
  imageUrl: row.image_url ?? undefined,
  rating: row.rating ?? undefined,
  coordinates: row.coordinates
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
    /* -----------------------------------------------------------
     * 1. Geo-aware query via RPC when lat/lng present
     * --------------------------------------------------------- */
    if (
      typeof filters.latitude === 'number' &&
      typeof filters.longitude === 'number'
    ) {
      const radius = filters.radius ?? 25;

      /* ---------- Sanity-check lat / lng values ---------- */
      if (Math.abs(filters.latitude) > 90 || Math.abs(filters.longitude) > 180) {
        console.warn(
          '[showService] Suspicious coordinates detected – latitude / longitude might be swapped:',
          { latitude: filters.latitude, longitude: filters.longitude }
        );
      }

      console.debug('[showService] Calling find_filtered_shows with params:', {
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
          center_lat: filters.latitude,
          center_lng: filters.longitude,
          radius_miles: radius,
          start_date: filters.startDate ?? null,
          end_date: filters.endDate ?? null,
          max_entry_fee: filters.maxEntryFee ?? null,
          show_categories: filters.categories ?? null,
          show_features: filters.features ?? null,
        }
      );

      if (rpcError) {
        console.warn(
          '[showService] find_filtered_shows RPC failed – attempting fallback',
          rpcError.message
        );
      } else {
        console.info(
          `[showService] find_filtered_shows returned ${(rpcData ?? []).length} show(s)`
        );
        return (rpcData ?? []).map(mapDbShowToAppShow);
      }

      /* -------------------------------------------------------
       * 1b. Fallback to simple radius-only RPC if the above fails
       * ----------------------------------------------------- */
      const { data: fbData, error: fbError } = await supabase.rpc(
        'find_shows_within_radius',
        {
          center_lat: filters.latitude,
          center_lng: filters.longitude,
          radius_miles: radius,
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
          `[showService] find_shows_within_radius returned ${(fbData ?? []).length} show(s)`
        );
        return (fbData ?? []).map(mapDbShowToAppShow);
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
    if (filters.categories && filters.categories.length > 0) {
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
      `[showService] basic query returned ${(data ?? []).length} show(s)`
    );
    return (data ?? []).map(mapDbShowToAppShow);
  } catch (err: any) {
    console.error('Error fetching shows:', err);
    throw new Error(err.message ?? 'Failed to fetch shows');
  }
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
