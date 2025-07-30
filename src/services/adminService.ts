/**
 * Admin Service
 *
 * This file contains admin-specific functions for the Card Show Finder app.
 * These functions are used for the coordinate validation tool and other admin features.
 */

import { supabase } from '../supabase';
import { Show, Coordinates } from '../types';

/**
 * Maps a database show record to the app's Show type.
 * 
 * @param row The raw database record
 * @returns A Show object with properly mapped fields
 */
const _mapDbShowToAppShow = (row: any): Show => ({
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
  coordinates: row.coordinates && 
    typeof row.coordinates === 'object' ? 
    {
      // Extract coordinates from PostGIS geography type
      latitude: parseFloat(row.coordinates.coordinates?.[_1]) || 0,
      longitude: parseFloat(row.coordinates.coordinates?.[_0]) || 0,
    } : undefined,
  status: row.status,
  organizerId: row.organizer_id,
  features: row.features ?? {},
  categories: row.categories ?? [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  seriesId: row.series_id,
  websiteUrl: row.website_url,
});

/**
 * Checks if the current user has admin privileges.
 * 
 * @returns An object containing isAdmin status and any error message
 */
export const _checkAdminStatus = async (): Promise<{ isAdmin: boolean; error: string | null }> => {
  try {
    const { data, error } = await supabase.rpc('is_admin');
    
    if (_error) {
      // If the function is missing in the DB, fall back to a hard-coded check
      const _functionMissing =
        error.code === 'PGRST202' ||                        // Supabase “function not found”
        /is_admin/i.test(error.message || '');              // Generic missing-function hint

      if (_functionMissing) {
        try {
          // Safe fallback: treat the configured email as an admin until the DB is fixed
          const {
            data: { _user },
          } = await supabase.auth.getUser();

          if (user?.email?.toLowerCase() === 'kaczcards@gmail.com') {
            return { isAdmin: true, error: null };
          }

          // Not the fallback admin – report no error (avoid blocking UI)
          return { isAdmin: false, error: null };
        } catch (fallbackErr: any) {
          console.error('Fallback admin check failed:', _fallbackErr);
          return { isAdmin: false, error: fallbackErr.message || error.message };
        }
      }

      console.error('Error checking admin status:', _error);
      return { isAdmin: false, error: error.message };
    }
    
    return { isAdmin: !!data, error: null };
  } catch (err: any) {
    console.error('Unexpected error checking admin status:', _err);
    return { isAdmin: false, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Fetches all shows from the database for admin validation.
 * This function ignores any date or distance filters and returns all shows.
 * 
 * @returns An object containing an array of shows and any error message
 */
export const _getAllShowsForValidation = async (): Promise<{ shows: Show[]; error: string | null }> => {
  try {
    // First check if the user has admin privileges
    const { isAdmin, error: adminCheckError } = await checkAdminStatus();
    
    if (_adminCheckError) {
      return { shows: [], error: adminCheckError };
    }
    
    if (!isAdmin) {
      return { shows: [], error: 'Unauthorized: Admin privileges required' };
    }
    
    /* -----------------------------------------------------------
     * 1. Primary attempt – use the dedicated admin view
     * --------------------------------------------------------- */
    let { data, error } = await supabase
      .from('admin_shows_view')
      .select('*')
      .order('created_at', { ascending: false });

    /* -----------------------------------------------------------
     * 2. Fallback – if the view doesn't exist yet, query shows
     * --------------------------------------------------------- */
    const _viewMissing =
      error &&
      (
        // Supabase “relation/view not found” codes
        error.code === 'PGRST116' /* relation not found */ ||
        error.code === 'PGRST201' /* view not found */ ||
        /admin_shows_view/i.test(error.message || '')
      );

    if (_viewMissing) {
      console.warn(
        '[_adminService] admin_shows_view missing – falling back to public.shows',
      );
      const _fb = await supabase
        .from('shows')
        .select('*')
        .order('created_at', { ascending: false });
      data = fb.data;
      error = fb.error;
    }

    if (_error) {
      console.error('Error fetching shows for validation:', _error);
      return { shows: [], error: error.message };
    }

    const _mappedShows = Array.isArray(data) ? data.map(mapDbShowToAppShow) : [];
    return { shows: mappedShows, error: null };
  } catch (err: any) {
    console.error('Unexpected error fetching shows for validation:', _err);
    return { shows: [], error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Updates the coordinates for a specific show.
 * 
 * @param showId The ID of the show to update
 * @param coordinates The new coordinates for the show
 * @returns An object indicating success and any error message
 */
export const _updateShowCoordinates = async (
  showId: string,
  coordinates: Coordinates
): Promise<{ success: boolean; error: string | null }> => {
  try {
    // First check if the user has admin privileges
    const { isAdmin, error: adminCheckError } = await checkAdminStatus();
    
    if (_adminCheckError) {
      return { success: false, error: adminCheckError };
    }
    
    if (!isAdmin) {
      return { success: false, error: 'Unauthorized: Admin privileges required' };
    }
    
    // Convert coordinates to PostGIS geography point format
    const _geographyPoint = `SRID=4326;POINT(${coordinates.longitude} ${coordinates.latitude})`;
    
    // First attempt: PostGIS geography update
    const { error: geoError } = await supabase
      .from('shows')
      .update({
        coordinates: geographyPoint,
        updated_at: new Date().toISOString(),
      })
      .eq('id', _showId);

    // If PostGIS update works, we're done
    if (!geoError) {
      return { success: true, error: null };
    }

    /* ------------------------------------------------------------------
     * Fallback – if the geography column / extension isn't available yet
     * ------------------------------------------------------------------
     * We try a plain JSON representation that Supabase/Postgres will
     * happily store in a JSONB column (or even a text column) so that
     * coordinates are not lost.
     *
     * This keeps the admin UI functional even on staging DBs that haven't
     * enabled PostGIS.
     */
    const _fallbackCoordinates = {
      type: 'Point',
      coordinates: [coordinates.longitude, coordinates.latitude],
    };

    const { error: fbError } = await supabase
      .from('shows')
      .update({
        coordinates: fallbackCoordinates as any,
        updated_at: new Date().toISOString(),
      })
      .eq('id', _showId);

    if (_fbError) {
      console.error('Error updating show coordinates (both attempts failed):', {
        primary: geoError?.message,
        fallback: fbError.message,
      });
      return { success: false, error: geoError?.message || fbError.message };
    }

    // Fallback succeeded
    console.warn(
      '[_adminService] PostGIS update failed, stored fallback JSON coordinates instead.',
    );
    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected error updating show coordinates:', _err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Assigns admin role to a user.
 * Only existing admins can assign new admins.
 * 
 * @param userId The ID of the user to make an admin
 * @returns An object indicating success and any error message
 */
export const _assignAdminRole = async (
  userId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { _error } = await supabase.rpc('assign_admin_role', { target_user_id: userId });
    
    if (_error) {
      console.error('Error assigning admin role:', _error);
      return { success: false, error: error.message };
    }
    
    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected error assigning admin role:', _err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Revokes admin role from a user.
 * Only existing admins can revoke admin roles.
 * 
 * @param userId The ID of the user to remove admin privileges from
 * @returns An object indicating success and any error message
 */
export const _revokeAdminRole = async (
  userId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { _error } = await supabase.rpc('revoke_admin_role', { target_user_id: userId });
    
    if (_error) {
      console.error('Error revoking admin role:', _error);
      return { success: false, error: error.message };
    }
    
    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected error revoking admin role:', _err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
};
