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

/* ------------------------------------------------------------------ */
/* Pagination helper types                                             */
/* ------------------------------------------------------------------ */

/**
 * Metadata describing pagination state returned from the
 * `get_paginated_shows` RPC.
 */
export interface PaginationMeta {
  totalCount: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
}

/**
 * Params accepted by `getPaginatedShows`.
 * Inherits all normal ShowFilters plus `pageSize` & `page`.
 * `latitude` and `longitude` are **required** because the RPC
 * is geo-aware – calling code (e.g. HomeScreen) must supply them.
 */
export interface PaginatedShowsParams extends ShowFilters {
  latitude: number;
  longitude: number;
  /** Number of rows per page (default: 20) */
  pageSize?: number;
  /** 1-based page index (default: 1)            */
  page?: number;
}

/**
 * Shape returned by `getPaginatedShows`.
 */
export interface PaginatedShowsResult {
  data: Show[];
  pagination: PaginationMeta;
  error: string | null;
}

export const getShows = async (filters: ShowFilters = {}): Promise<Show[]> => {
  try {
    // Ensure filters is a valid object
    filters = filters || {};

    /* -----------------------------------------------------------
     * Derive **normalized** filter values so every query path
     * (RPCs & basic SELECT) uses the exact same parameters.
     * --------------------------------------------------------- */
    const toIso = (d: Date | string): string =>
      d instanceof Date ? d.toISOString() : d;

    // Default date range: today → +30 days (ISO strings)
    const startDate = toIso(
      filters.startDate ?? new Date()
    );
    const endDate = toIso(
      filters.endDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );

    // Default radius: 25 mi
    const radius =
      typeof filters.radius === 'number' && !isNaN(filters.radius)
        ? filters.radius
        : 25;
    
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
        start_date: startDate,
        end_date: endDate,
      });

      // Call the new nearby_shows function as primary method
      const { data: nearbyData, error: nearbyError } = await supabase.rpc(
        'nearby_shows',
        {
          lat: filters.latitude,
          long: filters.longitude,
          radius_miles: radius,
          start_date: startDate, // Always include a date range
          end_date: endDate,    // to filter out past shows
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
        
        // Ensure we're not showing past shows
        if (Array.isArray(filteredData)) {
          const today = new Date();
          filteredData = filteredData.filter(show => {
            // Parse the end date, ensuring timezone issues don't cause off-by-one errors
            const showEndDate = new Date(show.end_date);
            return showEndDate >= today;
          });
          
          console.debug(`[showService] Filtered out past shows. ${filteredData.length} shows remaining.`);
        }
        
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
        start_date: startDate,
        end_date: endDate,
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
          start_date: startDate,
          end_date: endDate,
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
        
        // Ensure we're not showing past shows
        let filteredData = rpcData;
        if (Array.isArray(filteredData)) {
          const today = new Date();
          filteredData = filteredData.filter(show => {
            // Parse the end date, ensuring timezone issues don't cause off-by-one errors
            const showEndDate = new Date(show.end_date);
            return showEndDate >= today;
          });
          
          console.debug(`[showService] Filtered out past shows. ${filteredData.length} shows remaining.`);
        }
        
        return Array.isArray(filteredData) ? filteredData.map(mapDbShowToAppShow) : [];
      }

      /* -------------------------------------------------------
       * 1c. Fallback to simple radius-only RPC if the above fails
       * ----------------------------------------------------- */
      const { data: fbData, error: fbError } = await supabase.rpc(
        'find_shows_within_radius',
        {
          center_lat: typeof filters.latitude === 'number' ? filters.latitude : null,
          center_lng: typeof filters.longitude === 'number' ? filters.longitude : null,
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
          `[showService] find_shows_within_radius returned ${((fbData && Array.isArray(fbData)) ? fbData.length : 0)} show(s)`
        );
        
        // Apply date filtering since this RPC doesn't do it
        let filteredData = Array.isArray(fbData) ? fbData : [];
        
        // Ensure we're not showing past shows
        if (Array.isArray(filteredData)) {
          const today = new Date();
          filteredData = filteredData.filter(show => {
            // Parse the end date, ensuring timezone issues don't cause off-by-one errors
            const showEndDate = new Date(show.end_date);
            return showEndDate >= today;
          });
          
          console.debug(`[showService] Filtered out past shows. ${filteredData.length} shows remaining.`);
        }
        
        // Apply date range filtering
        filteredData = filteredData.filter(show => {
          const showStartDate = new Date(show.start_date);
          const filterStartDate = new Date(startDate);
          const filterEndDate = new Date(endDate);
          return showStartDate >= filterStartDate && showStartDate <= filterEndDate;
        });
        
        return filteredData.map(mapDbShowToAppShow);
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

    // Always apply date filters to show only future/current shows
    query = query.gte('start_date', startDate as any);
    query = query.lte('start_date', endDate as any);
    
    // Also ensure the end_date is not in the past
    const today = new Date();
    query = query.gte('end_date', today.toISOString() as any);
    
    if (typeof filters.maxEntryFee === 'number') {
      query = query.lte('entry_fee', filters.maxEntryFee);
    }
    if (filters.categories && Array.isArray(filters.categories) && filters.categories.length > 0) {
      query = query.overlaps('categories', filters.categories);
    }

    /* ---------- Log basic-query filters for debugging ---------- */
    console.debug('[showService] Executing basic query with filters:', {
      startDate,
      endDate,
      today: today.toISOString(),
      maxEntryFee: filters.maxEntryFee,
      categories: filters.categories,
      status: 'ACTIVE',
    });

    const { data, error } = await query;

    if (error) throw error;

    console.info(
      `[showService] basic query returned ${((data && Array.isArray(data)) ? data.length : 0)} show(s)`
    );
    
    // Ensure we're not showing past shows
    let filteredData = data;
    if (Array.isArray(filteredData)) {
      const today = new Date();
      filteredData = filteredData.filter(show => {
        // Parse the end date, ensuring timezone issues don't cause off-by-one errors
        const showEndDate = new Date(show.end_date);
        return showEndDate >= today;
      });
      
      console.debug(`[showService] Filtered out past shows. ${filteredData.length} shows remaining.`);
    }
    
    return Array.isArray(filteredData) ? filteredData.map(mapDbShowToAppShow) : [];
  } catch (err: any) {
    console.error('Error fetching shows:', err);
    throw new Error(err.message ?? 'Failed to fetch shows');
  }
  
  // Safety return if we somehow get here without data
  return [];
};

/* ------------------------------------------------------------------ */
/* Paginated / infinite-scroll helper                                  */
/* ------------------------------------------------------------------ */

/**
 * Fetch shows in **paged** chunks using the `get_paginated_shows` RPC.
 * Designed for infinite-scroll lists (Home screen, etc.).
 */
export const getPaginatedShows = async (
  params: PaginatedShowsParams
): Promise<PaginatedShowsResult> => {
  try {
    /* ---------------- Normalise & default params ----------------- */
    const {
      latitude,
      longitude,
      radius = 25,
      startDate = new Date(),
      endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      maxEntryFee = null,
      categories = null,
      features = null,
      pageSize = 20,
      page = 1,
    } = params;

    const toIso = (d: Date | string): string =>
      d instanceof Date ? d.toISOString() : d;
    
    console.debug('[showService] getPaginatedShows called with params:', {
      latitude, longitude, radius, startDate, endDate, maxEntryFee, 
      categories, features, pageSize, page
    });

    /* ---------------------- RPC invocation ----------------------- */
    const { data, error } = await supabase.rpc('get_paginated_shows', {
      lat: latitude,
      long: longitude,
      radius_miles: typeof radius === 'number' && !isNaN(radius) ? radius : 25,
      start_date: toIso(startDate),
      end_date: toIso(endDate),
      max_entry_fee: typeof maxEntryFee === 'number' ? maxEntryFee : null,
      categories,
      features,
      page_size: pageSize,
      page,
      status: 'ACTIVE', // Explicitly request only ACTIVE shows
    });

    if (error) {
      console.warn('[showService] get_paginated_shows RPC failed:', error.message);
      console.warn('[showService] Falling back to direct query...');
      
      // Fallback to direct query if RPC fails
      return await getFallbackPaginatedShows(params);
    }

    if (!data || data.error) {
      // In case the function returns an error payload
      const msg =
        typeof data?.error === 'string'
          ? data.error
          : 'Failed to load shows';
      console.warn('[showService] get_paginated_shows returned error payload:', msg);
      return {
        data: [],
        pagination: {
          totalCount: 0,
          pageSize,
          currentPage: page,
          totalPages: 0,
        },
        error: msg,
      };
    }

    // Extract rows & pagination metadata from JSONB payload
    const rows = (data as any).data ?? [];
    const paginationRaw = (data as any).pagination ?? {};

    const mappedShows: Show[] = Array.isArray(rows)
      ? rows.map(mapDbShowToAppShow)
      : [];
      
    console.info(`[showService] get_paginated_shows returned ${mappedShows.length} shows`);

    const pagination: PaginationMeta = {
      totalCount: Number(paginationRaw.total_count ?? 0),
      pageSize: Number(paginationRaw.page_size ?? pageSize),
      currentPage: Number(paginationRaw.current_page ?? page),
      totalPages: Number(paginationRaw.total_pages ?? 0),
    };

    return { data: mappedShows, pagination, error: null };
  } catch (err: any) {
    console.error('[showService] Error in getPaginatedShows:', err);
    
    // Try fallback if the main method fails
    try {
      console.warn('[showService] Attempting fallback after error...');
      const fallbackResult = await getFallbackPaginatedShows(params);
      
      // If the fallback found no shows, try the emergency fallback
      if (fallbackResult.data.length === 0 && fallbackResult.pagination.totalCount > 0) {
        console.warn('[showService] Fallback found 0 shows but totalCount > 0, trying emergency fallback');
        return await getAllActiveShowsFallback(params);
      }
      
      return fallbackResult;
    } catch (fallbackErr: any) {
      console.error('[showService] Fallback also failed:', fallbackErr);
      return {
        data: [],
        pagination: {
          totalCount: 0,
          pageSize: params.pageSize ?? 20,
          currentPage: params.page ?? 1,
          totalPages: 0,
        },
        error: err.message ?? 'Failed to fetch paginated shows',
      };
    }
  }
};

/**
 * Fallback implementation for getPaginatedShows that uses direct Supabase queries
 * instead of the RPC. This is used when the RPC fails for any reason.
 */
const getFallbackPaginatedShows = async (
  params: PaginatedShowsParams
): Promise<PaginatedShowsResult> => {
  try {
    const {
      latitude,
      longitude,
      radius = 25,
      startDate = new Date(),
      endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      maxEntryFee = null,
      categories = null,
      features = null,
      pageSize = 20,
      page = 1,
    } = params;

    const toIso = (d: Date | string): string =>
      d instanceof Date ? d.toISOString() : d;
    
    console.debug('[showService] getFallbackPaginatedShows executing with params:', {
      latitude, longitude, radius, 
      startDate: toIso(startDate),
      endDate: toIso(endDate)
    });
    
    // First get the total count with a separate query
    let countQuery = supabase
      .from('shows')
      .select('id', { count: 'exact' })
      .eq('status', 'ACTIVE');
    
    // Apply date filters
    countQuery = countQuery.gte('start_date', toIso(startDate) as any);
    countQuery = countQuery.lte('start_date', toIso(endDate) as any);
    
    // Ensure end_date is not in the past
    const today = new Date();
    countQuery = countQuery.gte('end_date', today.toISOString() as any);
    
    // Apply other filters
    if (typeof maxEntryFee === 'number') {
      countQuery = countQuery.lte('entry_fee', maxEntryFee);
    }
    
    if (categories && Array.isArray(categories) && categories.length > 0) {
      countQuery = countQuery.overlaps('categories', categories);
    }
    
    // Execute count query
    const { count, error: countError } = await countQuery;
    
    if (countError) {
      console.error('[showService] Error getting count:', countError);
      throw countError;
    }
    
    // Now get the actual data for this page
    let dataQuery = supabase
      .from('shows')
      .select('*')
      .eq('status', 'ACTIVE');
    
    // Apply the same filters as the count query
    dataQuery = dataQuery.gte('start_date', toIso(startDate) as any);
    dataQuery = dataQuery.lte('start_date', toIso(endDate) as any);
    dataQuery = dataQuery.gte('end_date', today.toISOString() as any);
    
    if (typeof maxEntryFee === 'number') {
      dataQuery = dataQuery.lte('entry_fee', maxEntryFee);
    }
    
    if (categories && Array.isArray(categories) && categories.length > 0) {
      dataQuery = dataQuery.overlaps('categories', categories);
    }
    
    // Apply pagination
    dataQuery = dataQuery
      .order('start_date', { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1);
    
    // Execute data query
    const { data, error: dataError } = await dataQuery;
    
    if (dataError) {
      console.error('[showService] Error getting data:', dataError);
      throw dataError;
    }
    
    // Filter results for shows within the radius
    // (since we can't do this in the query without the RPC)
    let filteredData = data || [];

    /* ------------------------------------------------------------------
     * Skip distance filtering if we're using the default (0,0) placeholder
     * coordinates.  Applying the radius filter in that case removes every
     * show because all real-world coordinates are far from (0,0).
     * ------------------------------------------------------------------ */
    const isDefaultCoordinates =
      Math.abs(latitude) < 0.1 && Math.abs(longitude) < 0.1;

    if (radius && !isDefaultCoordinates) {
      console.debug(
        `[showService] Applying distance filtering with coordinates (${latitude}, ${longitude})`
      );

      filteredData = filteredData.filter(show => {
        // Skip shows without coordinates
        if (!show.coordinates || !show.coordinates.coordinates) return false;

        const showLat = show.coordinates.coordinates[1];
        const showLng = show.coordinates.coordinates[0];
        const distance = calculateDistance(
          latitude,
          longitude,
          showLat,
          showLng
        );
        return distance <= radius;
      });
    } else if (isDefaultCoordinates) {
      console.debug(
        `[showService] Skipping distance filtering – default coordinates detected (${latitude}, ${longitude})`
      );
    }
    
    console.info(`[showService] getFallbackPaginatedShows found ${filteredData.length} shows (from ${count} total)`);
    
    // Map to app format
    const mappedShows = filteredData.map(mapDbShowToAppShow);
    
    // Calculate pagination info
    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);
    
    return {
      data: mappedShows,
      pagination: {
        totalCount,
        pageSize,
        currentPage: page,
        totalPages,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('[showService] Error in getFallbackPaginatedShows:', err);
    return {
      data: [],
      pagination: {
        totalCount: 0,
        pageSize: params.pageSize ?? 20,
        currentPage: params.page ?? 1,
        totalPages: 0,
      },
      error: err.message ?? 'Failed to fetch paginated shows',
    };
  }
};

/**
 * Completely bypass all location filtering if we're still not getting results.
 * This ensures users always see shows even if there are issues with coordinates.
 */
const getAllActiveShowsFallback = async (
  params: PaginatedShowsParams
): Promise<PaginatedShowsResult> => {
  try {
    const {
      startDate = new Date(),
      endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      pageSize = 20,
      page = 1,
    } = params;

    console.warn('[showService] Using emergency getAllActiveShowsFallback without coordinate filtering');
    
    const toIso = (d: Date | string): string =>
      d instanceof Date ? d.toISOString() : d;
    
    // Simple query - just get active shows
    let dataQuery = supabase
      .from('shows')
      .select('*')
      .eq('status', 'ACTIVE');
    
    // Apply minimal filtering to ensure we don't show past shows
    const today = new Date();
    dataQuery = dataQuery.gte('end_date', today.toISOString() as any);
    
    // Only apply date filtering to start date to match what we promise users
    dataQuery = dataQuery.gte('start_date', toIso(startDate) as any);
    dataQuery = dataQuery.lte('start_date', toIso(endDate) as any);
    
    // Get total count first
    const { count, error: countError } = await dataQuery.count();
    
    if (countError) {
      console.error('[showService] Error getting count in emergency fallback:', countError);
      throw countError;
    }
    
    // Now apply pagination to the same query
    dataQuery = dataQuery
      .order('start_date', { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1);
    
    const { data, error: dataError } = await dataQuery;
    
    if (dataError) {
      console.error('[showService] Error getting data in emergency fallback:', dataError);
      throw dataError;
    }
    
    console.info(`[showService] Emergency getAllActiveShowsFallback found ${data.length} shows (from ${count} total)`);
    
    // Map to app format
    const mappedShows = data.map(mapDbShowToAppShow);
    
    // Calculate pagination info
    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);
    
    return {
      data: mappedShows,
      pagination: {
        totalCount,
        pageSize,
        currentPage: page,
        totalPages,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('[showService] Error in emergency fallback:', err);
    return {
      data: [],
      pagination: {
        totalCount: 0,
        pageSize: params.pageSize ?? 20,
        currentPage: params.page ?? 1,
        totalPages: 0,
      },
      error: err.message ?? 'Failed to fetch shows',
    };
  }
};

/**
 * Calculate distance between two points using the Haversine formula
 * @returns Distance in miles
 */
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3958.8; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
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
    
    // Also ensure the end_date is not in the past
    const today = new Date();
    showQuery = showQuery.gte('end_date', today.toISOString() as any);

    const { data: showRows, error: showError } = await showQuery;

    if (showError) {
      throw showError;
    }
    
    // Ensure we're not showing past shows
    let filteredData = showRows;
    if (Array.isArray(filteredData)) {
      const today = new Date();
      filteredData = filteredData.filter(show => {
        // Parse the end date, ensuring timezone issues don't cause off-by-one errors
        const showEndDate = new Date(show.end_date);
        return showEndDate >= today;
      });
      
      console.debug(`[showService] Filtered out past shows. ${filteredData.length} shows remaining.`);
    }

    const mapped = Array.isArray(filteredData)
      ? filteredData.map(mapDbShowToAppShow)
      : [];

    return { data: mapped, error: null };
  } catch (err: any) {
    console.error('Error fetching upcoming shows for user:', err);
    return { data: null, error: err.message ?? 'Unknown error' };
  }
};

/**
 * Claims a show for a show organizer.
 *
 * 1. Marks the show row as claimed (`claimed`, `claimed_by`, `claimed_at`).
 * 2. Inserts a row in the `show_organizers` join table so we can
 *    easily query which organisers manage which shows.
 *
 * On success returns `{ success: true, data: <updated show row> }`
 * On failure returns `{ success: false, message: <reason> }`
 */
export const claimShow = async (
  showId: string,
  userId: string
): Promise<{ success: boolean; data?: any; message?: string }> => {
  try {
    /* --------------------------------------------------------
     * 0. Verify user is a (paid) show organiser
     * ------------------------------------------------------ */
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role, is_paid')
      .eq('id', userId)
      .single();

    if (profileErr) throw profileErr;
    if (!profile) {
      return {
        success: false,
        message: 'User profile not found',
      };
    }

    const roleOk =
      (profile.role ?? '').toString().toLowerCase() ===
      'show_organizer';
    const paidOk =
      profile.is_paid === undefined
        ? true // tolerate missing column
        : !!profile.is_paid;

    if (!roleOk || !paidOk) {
      return {
        success: false,
        message:
          'Only paid Show Organizers can claim shows. Please upgrade your plan.',
      };
    }

    /* --------------------------------------------------------
     * 1. Atomically flag the show as claimed IF not yet claimed
     *    — PostgREST will return 0 rows if the condition fails.
     * ------------------------------------------------------ */
    const { data: updatedShow, error: updateError, count } =
      await supabase
        .from('shows')
        .update({
          claimed: true,
          claimed_by: userId,
          claimed_at: new Date().toISOString(),
        })
        .eq('id', showId)
        .or('claimed.is.null,claimed.eq.false') // only update unclaimed
        .select('*', { count: 'exact' })
        .single();

    if (updateError) throw updateError;

    if (!updatedShow || count === 0) {
      return {
        success: false,
        message: 'Show has already been claimed by another organiser.',
      };
    }

    /* --------------------------------------------------------
     * 2. Insert organiser ↔ show relation (ignore duplicates)
     * ------------------------------------------------------ */
    const { error: orgError } = await supabase
      .from('show_organizers')
      .insert(
        {
          show_id: showId,
          user_id: userId,
          role: 'owner',
          created_at: new Date().toISOString(),
        },
        { ignoreDuplicates: true }
      );

    if (orgError) throw orgError;

    return { success: true, data: updatedShow };
  } catch (err: any) {
    console.error('API error in claimShow:', err);
    return { success: false, message: err.message || 'Failed to claim show' };
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
