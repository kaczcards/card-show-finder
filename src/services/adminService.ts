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
  coordinates: row.coordinates && 
    typeof row.coordinates === 'object' ? 
    {
      // Extract coordinates from PostGIS geography type
      latitude: parseFloat(row.coordinates.coordinates?.[1]) || 0,
      longitude: parseFloat(row.coordinates.coordinates?.[0]) || 0,
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
export const checkAdminStatus = async (): Promise<{ isAdmin: boolean; error: string | null }> => {
  try {
    const { data, error } = await supabase.rpc('is_admin');
    
    if (error) {
      console.error('Error checking admin status:', error);
      return { isAdmin: false, error: error.message };
    }
    
    return { isAdmin: !!data, error: null };
  } catch (err: any) {
    console.error('Unexpected error checking admin status:', err);
    return { isAdmin: false, error: err.message || 'An unexpected error occurred' };
  }
};

/**
 * Fetches all shows from the database for admin validation.
 * This function ignores any date or distance filters and returns all shows.
 * 
 * @returns An object containing an array of shows and any error message
 */
export const getAllShowsForValidation = async (): Promise<{ shows: Show[]; error: string | null }> => {
  try {
    // First check if the user has admin privileges
    const { isAdmin, error: adminCheckError } = await checkAdminStatus();
    
    if (adminCheckError) {
      return { shows: [], error: adminCheckError };
    }
    
    if (!isAdmin) {
      return { shows: [], error: 'Unauthorized: Admin privileges required' };
    }
    
    // Query the admin_shows_view to get all shows
    const { data, error } = await supabase
      .from('admin_shows_view')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching shows for validation:', error);
      return { shows: [], error: error.message };
    }
    
    const mappedShows = Array.isArray(data) ? data.map(mapDbShowToAppShow) : [];
    return { shows: mappedShows, error: null };
  } catch (err: any) {
    console.error('Unexpected error fetching shows for validation:', err);
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
export const updateShowCoordinates = async (
  showId: string,
  coordinates: Coordinates
): Promise<{ success: boolean; error: string | null }> => {
  try {
    // First check if the user has admin privileges
    const { isAdmin, error: adminCheckError } = await checkAdminStatus();
    
    if (adminCheckError) {
      return { success: false, error: adminCheckError };
    }
    
    if (!isAdmin) {
      return { success: false, error: 'Unauthorized: Admin privileges required' };
    }
    
    // Convert coordinates to PostGIS geography point format
    const geographyPoint = `SRID=4326;POINT(${coordinates.longitude} ${coordinates.latitude})`;
    
    // Update the show's coordinates
    const { error } = await supabase
      .from('shows')
      .update({ 
        coordinates: geographyPoint,
        updated_at: new Date().toISOString()
      })
      .eq('id', showId);
    
    if (error) {
      console.error('Error updating show coordinates:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected error updating show coordinates:', err);
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
export const assignAdminRole = async (
  userId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase.rpc('assign_admin_role', { target_user_id: userId });
    
    if (error) {
      console.error('Error assigning admin role:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected error assigning admin role:', err);
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
export const revokeAdminRole = async (
  userId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase.rpc('revoke_admin_role', { target_user_id: userId });
    
    if (error) {
      console.error('Error revoking admin role:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected error revoking admin role:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
};
