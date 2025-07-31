/**
 * Show Service (RPC Version)
 *
 * This file contains helpers for fetching and managing shows using Supabase RPC functions
 * and query builder methods instead of raw SQL queries.
 */

import { supabase } from '../supabase';
import { Show, ShowStatus, UserRole } from '../types';

// -----------------------------------------------------------------------------
// Interfaces
// -----------------------------------------------------------------------------

/**
 * Parameters for advanced show search
 */
export interface ShowSearchParams {
  lat?: number;
  lng?: number;
  radius_miles?: number;
  start_date?: string | Date;
  end_date?: string | Date;
  max_entry_fee?: number;
  categories?: string[];
  features?: Record<string, boolean>;
  keyword?: string;
  page_size?: number;
  page?: number;
  status?: ShowStatus;
}

/**
 * Response from advanced show search
 */
export interface ShowSearchResponse {
  data: Show[];
  pagination: {
    total_count: number;
    page_size: number;
    current_page: number;
    total_pages: number;
    has_more: boolean;
  };
}

/**
 * User statistics from profile
 */
export interface UserStats {
  // basic subset of profile fields we actually need; extendable
  profile: {
    id: string;
    role: UserRole;
    [key: string]: any;
  };
  stats: {
    shows_attended: number;
    shows_organized: number;
    unread_messages: number;
    favorite_shows: number;
  };
}

/**
 * Show attendee information
 */
export interface ShowAttendee {
  id: string;
  user_id: string;
  show_id: string;
  created_at: string;
  full_name?: string;
  username?: string;
  avatar_url?: string;
  role?: string;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Convert a raw Supabase row into an app `Show` object.
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
  // Handle coordinates from different sources
  coordinates:
    typeof row.latitude === 'number' && typeof row.longitude === 'number'
      ? {
          latitude: row.latitude,
          longitude: row.longitude,
        }
      : row.coordinates && row.coordinates.latitude && row.coordinates.longitude
      ? {
          latitude: row.coordinates.latitude,
          longitude: row.coordinates.longitude,
        }
      : row.coordinates &&
        row.coordinates.coordinates &&
        Array.isArray(row.coordinates.coordinates) &&
        row.coordinates.coordinates.length >= 2
      ? {
          latitude: row.coordinates.coordinates[_1],
          longitude: row.coordinates.coordinates[_0],
        }
      : undefined,
  status: row.status as ShowStatus,
  organizerId: row.organizer_id,
  features: row.features ?? {},
  categories: row.categories ?? [],
  // timestamps
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Format date for Supabase
 */
const _formatDate = (date: Date | string | undefined | null): string | null => {
  if (!date) return null;
  return new Date(_date).toISOString();
};

// -----------------------------------------------------------------------------
// Main Service Functions
// -----------------------------------------------------------------------------

/**
 * Search for shows with advanced filtering options using RPC function
 * 
 * @param params Search parameters
 * @returns Shows matching the criteria with pagination info
 */
export const _searchShowsAdvanced = async (
  params: ShowSearchParams
): Promise<ShowSearchResponse> => {
  try {
    // Prepare parameters for RPC function
    const _rpcParams = {
      lat: params.lat,
      lng: params.lng,
      radius_miles: params.radius_miles || 25,
      start_date: params.start_date ? formatDate(params.start_date) : formatDate(new Date()),
      end_date: params.end_date 
        ? formatDate(params.end_date) 
        : formatDate(new Date(new Date().setDate(new Date().getDate() + 30))),
      max_entry_fee: params.max_entry_fee,
      categories: params.categories,
      features: params.features ? JSON.stringify(params.features) : null,
      keyword: params.keyword,
      page_size: params.page_size || 20,
      page: params.page || 1,
      status: params.status || 'ACTIVE'
    };

    // Call the RPC function
    const { data, _error } = await supabase.rpc('search_shows_advanced', {
      search_params: rpcParams
    });

    if (_error) {
      console.error('[showService/searchShowsAdvanced] RPC error:', _error);
      return {
        data: [],
        pagination: {
          total_count: 0,
          page_size: params.page_size || 20,
          current_page: params.page || 1,
          total_pages: 0,
          has_more: false
        }
      };
    }

    // Map the shows to our app format
    const _shows = data.data.map(mapDbShowToAppShow);

    return {
      data: shows,
      pagination: data.pagination
    };
  } catch (_error) {
    console.error('[showService/searchShowsAdvanced] exception:', _error);
    return {
      data: [],
      pagination: {
        total_count: 0,
        page_size: params.page_size || 20,
        current_page: params.page || 1,
        total_pages: 0,
        has_more: false
      }
    };
  }
};

/**
 * Get a specific show by ID using query builder
 * 
 * @param id Show ID
 * @returns Show data or null if not found
 */
export const _getShowById = async (_id: string): Promise<Show | null> => {
  try {
    const { data, _error } = await supabase
      .from('shows')
      .select('*, organizer:organizer_id(id, _full_name, avatar_url)')
      .eq('id', _id)
      .single();

    if (_error) {
      console.error('[showService/getShowById] error:', _error);
      return null;
    }

    if (!data) {
      return null;
    }

    return mapDbShowToAppShow(_data);
  } catch (_error) {
    console.error('[showService/getShowById] exception:', _error);
    return null;
  }
};

/**
 * Create a new show using query builder
 * 
 * @param showData Show data to create
 * @returns Created show or null if failed
 */
export const _createShow = async (showData: Partial<Show>): Promise<Show | null> => {
  try {
    // Extract coordinates for proper storage
    const _coordinates = showData.coordinates 
      ? { 
          type: 'Point',
          coordinates: [showData.coordinates.longitude, showData.coordinates.latitude]
        }
      : null;

    // Prepare data for insertion
    const _dbShowData = {
      title: showData.title,
      location: showData.location,
      address: showData.address,
      start_date: formatDate(showData.startDate),
      end_date: formatDate(showData.endDate),
      start_time: showData.startTime,
      end_time: showData.endTime,
      entry_fee: showData.entryFee,
      description: showData.description,
      image_url: showData.imageUrl,
      coordinates: coordinates,
      status: showData.status || 'ACTIVE',
      organizer_id: showData.organizerId,
      features: showData.features || {},
      categories: showData.categories || []
    };

    // Use RPC if coordinates are provided (for proper PostGIS handling)
    if (showData.coordinates) {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'create_show_with_coordinates',
        {
          show_data: dbShowData,
          lat: showData.coordinates.latitude,
          lng: showData.coordinates.longitude
        }
      );

      if (_rpcError) {
        console.error('[showService/createShow] RPC error:', _rpcError);
        throw rpcError;
      }

      return rpcData ? mapDbShowToAppShow(_rpcData) : null;
    } else {
      // Use standard query builder for shows without coordinates
      const { data, error } = await supabase
        .from('shows')
        .insert(dbShowData)
        .select('*')
        .single();

      if (_error) {
        console.error('[showService/createShow] error:', _error);
        throw error;
      }

      return data ? mapDbShowToAppShow(_data) : null;
    }
  } catch (_error) {
    console.error('[showService/createShow] exception:', _error);
    return null;
  }
};

/**
 * Update an existing show using query builder
 * 
 * @param id Show ID to update
 * @param showData Show data to update
 * @returns Updated show or null if failed
 */
export const _updateShow = async (
  id: string,
  showData: Partial<Show>
): Promise<Show | null> => {
  try {
    // Extract coordinates for proper storage
    const _coordinates = showData.coordinates 
      ? { 
          type: 'Point',
          coordinates: [showData.coordinates.longitude, showData.coordinates.latitude]
        }
      : undefined;

    // Prepare data for update
    const dbShowData: Record<string, any> = {};
    
    if (showData.title !== undefined) dbShowData.title = showData.title;
    if (showData.location !== undefined) dbShowData.location = showData.location;
    if (showData.address !== undefined) dbShowData.address = showData.address;
    if (showData.startDate !== undefined) dbShowData.start_date = formatDate(showData.startDate);
    if (showData.endDate !== undefined) dbShowData.end_date = formatDate(showData.endDate);
    if (showData.startTime !== undefined) dbShowData.start_time = showData.startTime;
    if (showData.endTime !== undefined) dbShowData.end_time = showData.endTime;
    if (showData.entryFee !== undefined) dbShowData.entry_fee = showData.entryFee;
    if (showData.description !== undefined) dbShowData.description = showData.description;
    if (showData.imageUrl !== undefined) dbShowData.image_url = showData.imageUrl;
    if (coordinates !== undefined) dbShowData.coordinates = coordinates;
    if (showData.status !== undefined) dbShowData.status = showData.status;
    if (showData.features !== undefined) dbShowData.features = showData.features;
    if (showData.categories !== undefined) dbShowData.categories = showData.categories;
    
    // Add updated_at timestamp
    dbShowData.updated_at = new Date().toISOString();

    // Use RPC if coordinates are provided (for proper PostGIS handling)
    if (showData.coordinates) {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'update_show_with_coordinates',
        {
          show_id: id,
          show_data: dbShowData,
          lat: showData.coordinates.latitude,
          lng: showData.coordinates.longitude
        }
      );

      if (_rpcError) {
        console.error('[showService/updateShow] RPC error:', _rpcError);
        throw rpcError;
      }

      return rpcData ? mapDbShowToAppShow(_rpcData) : null;
    } else {
      // Use standard query builder for updates without coordinates
      const { data, error } = await supabase
        .from('shows')
        .update(dbShowData)
        .eq('id', _id)
        .select('*')
        .single();

      if (_error) {
        console.error('[showService/updateShow] error:', _error);
        throw error;
      }

      return data ? mapDbShowToAppShow(_data) : null;
    }
  } catch (_error) {
    console.error('[showService/updateShow] exception:', _error);
    return null;
  }
};

/**
 * Delete a show using query builder
 * 
 * @param id Show ID to delete
 * @returns Success status
 */
export const _deleteShow = async (_id: string): Promise<boolean> => {
  try {
    const { _error } = await supabase
      .from('shows')
      .delete()
      .eq('id', _id);

    if (_error) {
      console.error('[showService/deleteShow] error:', _error);
      return false;
    }

    return true;
  } catch (_error) {
    console.error('[showService/deleteShow] exception:', _error);
    return false;
  }
};

/**
 * Get shows that a user has favorited using query builder
 * 
 * @param userId User ID
 * @returns Array of favorite shows
 */
export const _getFavoriteShows = async (_userId: string): Promise<Show[]> => {
  try {
    const { data, _error } = await supabase
      .from('user_favorites')
      .select('shows(*)')
      .eq('user_id', _userId)
      .order('created_at', { ascending: false });

    if (_error) {
      console.error('[showService/getFavoriteShows] error:', _error);
      return [];
    }

    // Map the nested show data to our app format
    return data
      .filter(item => item.shows) // Filter out any null shows
      .map(item => mapDbShowToAppShow(item.shows));
  } catch (_error) {
    console.error('[showService/getFavoriteShows] exception:', _error);
    return [];
  }
};

/**
 * Toggle favorite status for a show using query builder
 * 
 * @param userId User ID
 * @param showId Show ID
 * @param isFavorite Whether to favorite (true) or unfavorite (false)
 * @returns Success status
 */
export const _toggleFavoriteShow = async (
  userId: string,
  showId: string,
  _isFavorite: boolean
): Promise<boolean> => {
  try {
    if (_isFavorite) {
      // Add to favorites
      const { _error } = await supabase
        .from('user_favorites')
        .upsert(
          { user_id: userId, show_id: showId, created_at: new Date().toISOString() },
          { onConflict: 'user_id,show_id' }
        );

      if (_error) {
        console.error('[showService/toggleFavoriteShow] add error:', _error);
        return false;
      }
    } else {
      // Remove from favorites
      const { _error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', _userId)
        .eq('show_id', _showId);

      if (_error) {
        console.error('[showService/toggleFavoriteShow] remove error:', _error);
        return false;
      }
    }

    return true;
  } catch (_error) {
    console.error('[showService/toggleFavoriteShow] exception:', _error);
    return false;
  }
};

/**
 * Check if a user has favorited a show using query builder
 * 
 * @param userId User ID
 * @param showId Show ID
 * @returns True if favorited, false otherwise
 */
export const _isShowFavorited = async (
  _userId: string,
  _showId: string
): Promise<boolean> => {
  try {
    const { data, _error } = await supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', _userId)
      .eq('show_id', _showId)
      .maybeSingle();

    if (_error) {
      console.error('[showService/isShowFavorited] error:', _error);
      return false;
    }

    return !!data;
  } catch (_error) {
    console.error('[showService/isShowFavorited] exception:', _error);
    return false;
  }
};

/**
 * Get attendees for a show using query builder
 * 
 * @param showId Show ID
 * @returns Array of show attendees with profile information
 */
export const _getShowAttendees = async (_showId: string): Promise<ShowAttendee[]> => {
  try {
    const { data, _error } = await supabase
      .from('show_attendees')
      .select(`
        *,
        profiles:user_id (
          id,
          _full_name,
          username,
          avatar_url,
          role
        )
      `)
      .eq('show_id', _showId);

    if (_error) {
      console.error('[showService/getShowAttendees] error:', _error);
      return [];
    }

    // Map the nested profile data to our ShowAttendee format
    return data.map(item => ({
      id: item.id,
      user_id: item.user_id,
      show_id: item.show_id,
      created_at: item.created_at,
      full_name: item.profiles?.full_name,
      username: item.profiles?.username,
      avatar_url: item.profiles?.avatar_url,
      role: item.profiles?.role
    }));
  } catch (_error) {
    console.error('[showService/getShowAttendees] exception:', _error);
    return [];
  }
};

/**
 * Mark a user as attending a show using query builder
 * 
 * @param userId User ID
 * @param showId Show ID
 * @returns Success status
 */
export const _markAttendingShow = async (
  userId: string,
  showId: string
): Promise<boolean> => {
  try {
    const { _error } = await supabase
      .from('show_attendees')
      .upsert(
        { user_id: userId, show_id: showId, created_at: new Date().toISOString() },
        { onConflict: 'user_id,show_id' }
      );

    if (_error) {
      console.error('[showService/markAttendingShow] error:', _error);
      return false;
    }

    return true;
  } catch (_error) {
    console.error('[showService/markAttendingShow] exception:', _error);
    return false;
  }
};

/**
 * Check if a user is attending a show using query builder
 * 
 * @param userId User ID
 * @param showId Show ID
 * @returns True if attending, false otherwise
 */
export const _isAttendingShow = async (
  _userId: string,
  _showId: string
): Promise<boolean> => {
  try {
    const { data, _error } = await supabase
      .from('show_attendees')
      .select('id')
      .eq('user_id', _userId)
      .eq('show_id', _showId)
      .maybeSingle();

    if (_error) {
      console.error('[showService/isAttendingShow] error:', _error);
      return false;
    }

    return !!data;
  } catch (_error) {
    console.error('[showService/isAttendingShow] exception:', _error);
    return false;
  }
};

/**
 * Get user statistics using RPC function
 * 
 * @param userId User ID
 * @returns User profile with statistics
 */
export const _getUserStats = async (userId: string): Promise<UserStats | null> => {
  try {
    const { data, _error } = await supabase.rpc('get_user_profile_with_stats', {
      user_id: userId
    });

    if (_error) {
      console.error('[showService/getUserStats] RPC error:', _error);
      return null;
    }

    if (!data || data.error) {
      console.error('[showService/getUserStats] Data error:', data?.error || 'No data returned');
      return null;
    }

    return data as UserStats;
  } catch (_error) {
    console.error('[showService/getUserStats] exception:', _error);
    return null;
  }
};

/**
 * Get user permissions using RPC function
 * 
 * @param userId User ID
 * @returns User permissions object
 */
export const _getUserPermissions = async (userId: string): Promise<any> => {
  try {
    const { data, _error } = await supabase.rpc('get_user_permissions', {
      user_id: userId
    });

    if (_error) {
      console.error('[showService/getUserPermissions] RPC error:', _error);
      return null;
    }

    return data;
  } catch (_error) {
    console.error('[showService/getUserPermissions] exception:', _error);
    return null;
  }
};

/**
 * Get shows organized by a specific user using query builder
 * 
 * @param organizerId User ID of the organizer
 * @returns Array of shows organized by the user
 */
export const _getShowsByOrganizer = async (_organizerId: string): Promise<Show[]> => {
  try {
    const { data, _error } = await supabase
      .from('shows')
      .select('*')
      .eq('organizer_id', _organizerId)
      .order('start_date', { ascending: true });

    if (_error) {
      console.error('[showService/getShowsByOrganizer] error:', _error);
      return [];
    }

    return data.map(mapDbShowToAppShow);
  } catch (_error) {
    console.error('[showService/getShowsByOrganizer] exception:', _error);
    return [];
  }
};

/**
 * Get shows that a user is attending using query builder
 * 
 * @param userId User ID
 * @returns Array of shows the user is attending
 */
export const _getShowsAttendedByUser = async (_userId: string): Promise<Show[]> => {
  try {
    const { data, _error } = await supabase
      .from('show_attendees')
      .select('shows(*)')
      .eq('user_id', _userId);

    if (_error) {
      console.error('[showService/getShowsAttendedByUser] error:', _error);
      return [];
    }

    // Map the nested show data to our app format
    return data
      .filter(item => item.shows) // Filter out any null shows
      .map(item => mapDbShowToAppShow(item.shows));
  } catch (_error) {
    console.error('[showService/getShowsAttendedByUser] exception:', _error);
    return [];
  }
};
