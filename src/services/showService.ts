// src/services/showService.ts
// Supabase client lives one directory up (src/supabase.ts)
import { supabase } from '../supabase';
import { Show, ShowFilters } from '../types';

/**
 * Safely convert a PostGIS point (as returned by Supabase) into
 * an app-level `{ latitude, longitude }` object.
 * Returns `undefined` when the structure is missing or invalid.
 */
const dbPointToCoordinates = (
  point: any
): { latitude: number; longitude: number } | undefined => {
  if (
    !point ||
    !Array.isArray(point.coordinates) ||
    point.coordinates.length < 2
  ) {
    return undefined;
  }

  const [lng, lat] = point.coordinates;

  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    Number.isNaN(lat) ||
    Number.isNaN(lng)
  ) {
    return undefined;
  }

  return { latitude: lat, longitude: lng };
};

/**
 * Get all shows with optional filtering
 * @param filters Optional filters to apply
 * @returns Promise with array of shows
 */
export const getShows = async (filters: ShowFilters = {}): Promise<Show[]> => {
  try {
    let query = supabase
      .from('shows')
      .select('*');
    
    // Apply radius filter if location (coordinates) is provided
    if (filters.latitude && filters.longitude && filters.radius) {
      // Ensure all numeric parts are valid numbers
      if (
        isFinite(filters.latitude) &&
        isFinite(filters.longitude) &&
        isFinite(filters.radius)
      ) {
        // Convert radius from miles to meters
        const radiusInMeters = filters.radius * 1609.34;

        // Use PostGIS ST_DWithin for distance filtering
        query = query.filter(
          // Supabase PostGIS helper signature:
          // (columnOrOperator, operatorOrColumn, geometry, distance)
          // Putting the operator first avoids the “failed to parse filter” error.
          'st_dwithin',
          'coordinates',
          `POINT(${filters.longitude} ${filters.latitude})`,
          radiusInMeters
        );
      } else {
        console.warn(
          '[showService] Invalid coordinates provided for radius filter – skipping filter.'
        );
        // If the caller *expected* filtering (radius present) but coords invalid,
        // it is safer to return an empty list than all shows.
        return [];
      }
    }
    
    // Apply date filters
    if (filters.startDate) {
      query = query.gte('start_date', filters.startDate.toISOString());
    }
    
    if (filters.endDate) {
      query = query.lte('end_date', filters.endDate.toISOString());
    }
    
    // Apply category filters
    if (filters.categories && filters.categories.length > 0) {
      // Overlap operator checks if any categories match
      query = query.contains('categories', filters.categories);
    }
    
    // Apply features filters
    if (filters.features && filters.features.length > 0) {
      filters.features.forEach(feature => {
        // Check if feature exists in JSONB features column
        query = query.contains('features', { [feature]: true });
      });
    }
    
    // Apply entry fee filter
    if (filters.maxEntryFee !== undefined) {
      query = query.lte('entry_fee', filters.maxEntryFee);
    }
    
    // Apply status filter (default to ACTIVE)
    query = query.eq('status', filters.status || 'ACTIVE');
    
    // Apply ordering (default to start date ascending)
    query = query.order('start_date', { ascending: true });
    
    // Execute query
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Convert from database format to app format (with defensive coord parsing)
    return (data || []).map(item => ({
      id: item.id,
      title: item.title,
      location: item.location,
      address: item.address,
      startDate: new Date(item.start_date),
      endDate: new Date(item.end_date),
      entryFee: item.entry_fee,
      description: item.description,
      imageUrl: item.image_url,
      rating: item.rating,
      coordinates: dbPointToCoordinates(item.coordinates),
      status: item.status,
      organizerId: item.organizer_id,
      features: item.features || {},
      categories: item.categories || [],
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
  } catch (error) {
    console.error('Error getting shows:', error);
    throw error;
  }
};

/**
 * Get a single show by ID
 * @param showId Show ID
 * @returns Promise with show data
 */
export const getShowById = async (showId: string): Promise<Show | null> => {
  try {
    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .eq('id', showId)
      .single();
    
    if (error) throw error;
    if (!data) return null;
    
    return {
      id: data.id,
      title: data.title,
      location: data.location,
      address: data.address,
      startDate: new Date(data.start_date),
      endDate: new Date(data.end_date),
      entryFee: data.entry_fee,
      description: data.description,
      imageUrl: data.image_url,
      rating: data.rating,
      coordinates: dbPointToCoordinates(data.coordinates),
      status: data.status,
      organizerId: data.organizer_id,
      features: data.features || {},
      categories: data.categories || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (error) {
    console.error('Error getting show by ID:', error);
    throw error;
  }
};

/**
 * Create a new show
 * @param showData Show data
 * @returns Promise with created show
 */
export const createShow = async (showData: Omit<Show, 'id' | 'createdAt' | 'updatedAt'>): Promise<Show> => {
  try {
    // Format data for database
    const dbData = {
      title: showData.title,
      location: showData.location,
      address: showData.address,
      start_date: showData.startDate.toISOString(),
      end_date: showData.endDate.toISOString(),
      entry_fee: showData.entryFee,
      description: showData.description,
      image_url: showData.imageUrl,
      rating: showData.rating,
      coordinates: showData.coordinates 
        ? `POINT(${showData.coordinates.longitude} ${showData.coordinates.latitude})`
        : null,
      status: showData.status || 'ACTIVE',
      organizer_id: showData.organizerId,
      features: showData.features || {},
      categories: showData.categories || []
    };
    
    // Insert into database
    const { data, error } = await supabase
      .from('shows')
      .insert([dbData])
      .select('*')
      .single();
    
    if (error) throw error;
    if (!data) throw new Error('Failed to create show');
    
    return {
      id: data.id,
      title: data.title,
      location: data.location,
      address: data.address,
      startDate: new Date(data.start_date),
      endDate: new Date(data.end_date),
      entryFee: data.entry_fee,
      description: data.description,
      imageUrl: data.image_url,
      rating: data.rating,
      coordinates: dbPointToCoordinates(data.coordinates),
      status: data.status,
      organizerId: data.organizer_id,
      features: data.features || {},
      categories: data.categories || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (error) {
    console.error('Error creating show:', error);
    throw error;
  }
};

/**
 * Update a show
 * @param showId Show ID
 * @param showData Show data to update
 * @returns Promise with updated show
 */
export const updateShow = async (showId: string, showData: Partial<Show>): Promise<Show> => {
  try {
    // Format data for database
    const dbData: any = {};
    
    if (showData.title !== undefined) dbData.title = showData.title;
    if (showData.location !== undefined) dbData.location = showData.location;
    if (showData.address !== undefined) dbData.address = showData.address;
    if (showData.startDate !== undefined) dbData.start_date = showData.startDate.toISOString();
    if (showData.endDate !== undefined) dbData.end_date = showData.endDate.toISOString();
    if (showData.entryFee !== undefined) dbData.entry_fee = showData.entryFee;
    if (showData.description !== undefined) dbData.description = showData.description;
    if (showData.imageUrl !== undefined) dbData.image_url = showData.imageUrl;
    if (showData.rating !== undefined) dbData.rating = showData.rating;
    if (showData.coordinates !== undefined) {
      dbData.coordinates = showData.coordinates 
        ? `POINT(${showData.coordinates.longitude} ${showData.coordinates.latitude})`
        : null;
    }
    if (showData.status !== undefined) dbData.status = showData.status;
    if (showData.features !== undefined) dbData.features = showData.features;
    if (showData.categories !== undefined) dbData.categories = showData.categories;
    
    // Set updated_at
    dbData.updated_at = new Date().toISOString();
    
    // Update in database
    const { data, error } = await supabase
      .from('shows')
      .update(dbData)
      .eq('id', showId)
      .select('*')
      .single();
    
    if (error) throw error;
    if (!data) throw new Error('Failed to update show');
    
    return {
      id: data.id,
      title: data.title,
      location: data.location,
      address: data.address,
      startDate: new Date(data.start_date),
      endDate: new Date(data.end_date),
      entryFee: data.entry_fee,
      description: data.description,
      imageUrl: data.image_url,
      rating: data.rating,
      coordinates: dbPointToCoordinates(data.coordinates),
      status: data.status,
      organizerId: data.organizer_id,
      features: data.features || {},
      categories: data.categories || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (error) {
    console.error('Error updating show:', error);
    throw error;
  }
};

/**
 * Delete a show
 * @param showId Show ID
 * @returns Promise<void>
 */
export const deleteShow = async (showId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('shows')
      .delete()
      .eq('id', showId);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting show:', error);
    throw error;
  }
};

/**
 * Get shows favorited by a user
 * @param userId User ID
 * @returns Promise with array of favorited shows
 */
export const getFavoriteShows = async (userId: string): Promise<Show[]> => {
  try {
    // Get user's favorite show IDs
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('favorite_shows')
      .eq('id', userId)
      .single();
    
    if (userError) throw userError;
    if (!userData?.favorite_shows?.length) return [];
    
    const favoriteIds = userData.favorite_shows;
    
    // Get the shows matching those IDs
    const { data: shows, error: showsError } = await supabase
      .from('shows')
      .select('*')
      .in('id', favoriteIds);
    
    if (showsError) throw showsError;
    
    // Convert to app format
    return (shows || []).map(item => ({
      id: item.id,
      title: item.title,
      location: item.location,
      address: item.address,
      startDate: new Date(item.start_date),
      endDate: new Date(item.end_date),
      entryFee: item.entry_fee,
      description: item.description,
      imageUrl: item.image_url,
      rating: item.rating,
      coordinates: dbPointToCoordinates(item.coordinates),
      status: item.status,
      organizerId: item.organizer_id,
      features: item.features || {},
      categories: item.categories || [],
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
  } catch (error) {
    console.error('Error getting favorite shows:', error);
    throw error;
  }
};
