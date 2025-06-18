/**
 * Show Service
 *
 * This file contains the minimal set of helpers the front-end currently
 * expects for fetching shows from Supabase.  The HomeScreen is calling
 * `getShows`, so that function (plus a small helper for fetching a single
 * show) is provided below.  If more advanced filtering / geo-queries are
 * needed they can be added later, but this implementation un-blocks the
 * runtime error.
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
 * @param limit  Max number of records to return (default 50)
 * @param offset Pagination offset  (default 0)
 */
export const getShows = async (
  limit: number = 50,
  offset: number = 0
): Promise<{ data: Show[] | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('start_date', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    const shows: Show[] = (data ?? []).map(mapDbShowToAppShow);
    return { data: shows, error: null };
  } catch (err: any) {
    console.error('Error fetching shows:', err);
    return { data: null, error: err.message ?? 'Unknown error fetching shows' };
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

// Additional helper stubs (can be implemented later if needed by UI)
export const createShow = () => {
  throw new Error('createShow not implemented');
};

export const updateShow = () => {
  throw new Error('updateShow not implemented');
};

export const deleteShow = () => {
  throw new Error('deleteShow not implemented');
};
