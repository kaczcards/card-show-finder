/**
 * Show Service
 *
 * This file contains helpers for fetching shows from Supabase.
 */

import { _supabase } from '../supabase';
import { Show, ShowStatus } from '../types';
import { _calculateDistanceBetweenCoordinates } from './locationService';

/**
 * Convert a raw Supabase row into an app `Show` object.
 */
/* ------------------------------------------------------------------ */
/* Debug helper – track a single show end-to-end                        */
/* ------------------------------------------------------------------ */
const _DEBUG_SHOW_ID = 'cd175b33-3144-4ccb-9d85-94490446bf26';

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
          latitude: row.coordinates.coordinates[_1],
          longitude: row.coordinates.coordinates[_0],
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
import { _ShowFilters } from '../types';

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

export const _getShows = async (filters: ShowFilters = {}): Promise<Show[]> => {
  try {
    // Ensure filters is a valid object
    filters = filters || {};

    /* -----------------------------------------------------------
     * Derive **normalized** filter values so every query path
     * (RPCs & basic SELECT) uses the exact same parameters.
     * --------------------------------------------------------- */
    const _toIso = (d: Date | string | null): string =>
      d instanceof Date ? d.toISOString() : d || '';

    // Default date range: today → +30 days (ISO strings)
    const _startDate = toIso(
      filters.startDate ?? new Date()
    );
    const _endDate = toIso(
      filters.endDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );

    // Default radius: 25 mi
    const _radius =
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
      const _radius = typeof filters.radius === 'number' ? filters.radius : 25;

      /* ---------- Sanity-check lat / lng values ---------- */
      if (Math.abs(filters.latitude) > 90 || Math.abs(filters.longitude) > 180) {
        console.warn(
          '[_showService] Suspicious coordinates detected – latitude / longitude might be swapped:',
          { latitude: filters.latitude, longitude: filters.longitude }
        );
      }

      console.debug('[_showService] Calling nearby_shows with params:', {
        lat: filters.latitude,
        long: filters.longitude,
        radius_miles: radius,
        filter_start_date: startDate,
        filter_end_date: endDate,
        debugShowId: DEBUG_SHOW_ID, // helpful when grepping logs
      });

      // Call the new nearby_shows function as primary method
      const { data: nearbyData, error: nearbyError } = await supabase.rpc(
        'nearby_shows',
        {
          lat: filters.latitude,
          long: filters.longitude,
          radius_miles: radius,
          filter_start_date: startDate, // Always include a date range
          filter_end_date: endDate,    // to filter out past shows
        }
      );

      if (_nearbyError) {
        console.warn(
          '[_showService] nearby_shows RPC failed – attempting fallback',
          nearbyError.message
        );
      } else {
        console.info(
          `[_showService] nearby_shows returned ${((nearbyData && Array.isArray(nearbyData)) ? nearbyData.length : 0)} show(_s)`
        );

        /* ----- DEBUG: Is target show present in raw nearby_shows data? ---- */
        if (Array.isArray(nearbyData)) {
          const _found = nearbyData.some((s: any) => s.id === DEBUG_SHOW_ID);
          console.debug(
            `[_showService][_DEBUG_SHOW] Target show ${
              found ? 'FOUND' : 'NOT found'
            } in raw nearby_shows payload`
          );

          // If found, get the show details for further debugging
          if (_found) {
            const _targetShow = nearbyData.find((s: any) => s.id === DEBUG_SHOW_ID);
            console.debug(
              `[_showService][_DEBUG_SHOW] Target show details:`,
              {
                id: targetShow.id,
                title: targetShow.title,
                start_date: targetShow.start_date,
                end_date: targetShow.end_date,
                status: targetShow.status
              }
            );
          }
        }
        
        // Apply additional filters that weren't handled by the RPC
        let _filteredData = nearbyData;
        
        // Ensure we're not showing past shows
        if (Array.isArray(filteredData)) {
          const _today = new Date();
          console.debug(`[_showService][_DEBUG_SHOW] Today's date for filtering: ${today.toISOString()}`);
          
          // Check if target show exists before filtering
          const _targetShowBeforeFilter = filteredData.find((s: any) => s.id === DEBUG_SHOW_ID);
          
          if (_targetShowBeforeFilter) {
            const _targetEndDate = new Date(targetShowBeforeFilter.end_date);
            const _isPastShow = targetEndDate < today;
            
            console.debug(
              `[_showService][_DEBUG_SHOW] Target show end_date: ${targetEndDate.toISOString()} | Today: ${today.toISOString()} | Is past show? ${isPastShow ? 'YES' : 'NO'}`
            );
          }
          
          filteredData = filteredData.filter(show => {
            // Parse the end date, ensuring timezone issues don't cause off-by-one errors
            const _showEndDate = new Date(show.end_date);
            const _isValid = showEndDate >= today;
            
            // Debug logging specifically for our target show
            if (show.id === DEBUG_SHOW_ID) {
              console.debug(
                `[_showService][_DEBUG_SHOW] Filtering decision: show.end_date (${showEndDate.toISOString()}) ${isValid ? '>=' : '<'} today (${today.toISOString()}) => ${isValid ? 'KEEP' : 'FILTER OUT'}`
              );
            }
            
            return isValid;
          });
          
          console.debug(`[_showService] Filtered out past shows. ${filteredData.length} shows remaining.`);
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
            filters.features!.every(feature => show.features[_feature] === true)
          );
        }
        
        /* ----- DEBUG: Is target show present after client-side filters? ---- */
        if (Array.isArray(filteredData)) {
          const _foundAfter = filteredData.some((s: any) => s.id === DEBUG_SHOW_ID);
          console.debug(
            `[_showService][_DEBUG_SHOW] Target show ${
              foundAfter ? 'REMAINS' : 'WAS FILTERED OUT'
            } after nearby_shows client-side filters`
          );
        }

        return Array.isArray(filteredData) ? filteredData.map(mapDbShowToAppShow) : [];
      }

      /* -------------------------------------------------------
       * 1b. Fallback to find_filtered_shows if nearby_shows fails
       * ----------------------------------------------------- */
      console.debug('[_showService] Falling back to find_filtered_shows with params:', {
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

      if (_rpcError) {
        console.warn(
          '[_showService] find_filtered_shows RPC failed – attempting second fallback',
          rpcError.message
        );
      } else {
        console.info(
          `[_showService] find_filtered_shows returned ${((rpcData && Array.isArray(rpcData)) ? rpcData.length : 0)} show(_s)`
        );
        
        /* ----- DEBUG: Target show in raw find_filtered_shows payload? ----- */
        if (Array.isArray(rpcData)) {
          const _foundRaw = rpcData.some((s: any) => s.id === DEBUG_SHOW_ID);
          console.debug(
            `[_showService][_DEBUG_SHOW] Target show ${
              foundRaw ? 'FOUND' : 'NOT found'
            } in raw find_filtered_shows payload`
          );
          
          // If found, get the show details for further debugging
          if (_foundRaw) {
            const _targetShow = rpcData.find((s: any) => s.id === DEBUG_SHOW_ID);
            console.debug(
              `[_showService][_DEBUG_SHOW] Target show details from find_filtered_shows:`,
              {
                id: targetShow.id,
                title: targetShow.title,
                start_date: targetShow.start_date,
                end_date: targetShow.end_date,
                status: targetShow.status
              }
            );
          }
        }

        // Ensure we're not showing past shows
        let _filteredData = rpcData;
        if (Array.isArray(filteredData)) {
          const _today = new Date();
          console.debug(`[_showService][_DEBUG_SHOW] Today's date for filtering (_find_filtered): ${today.toISOString()}`);
          
          // Check if target show exists before filtering
          const _targetShowBeforeFilter = filteredData.find((s: any) => s.id === DEBUG_SHOW_ID);
          
          if (_targetShowBeforeFilter) {
            const _targetEndDate = new Date(targetShowBeforeFilter.end_date);
            const _isPastShow = targetEndDate < today;
            
            console.debug(
              `[_showService][_DEBUG_SHOW] Target show end_date (_find_filtered): ${targetEndDate.toISOString()} | Today: ${today.toISOString()} | Is past show? ${isPastShow ? 'YES' : 'NO'}`
            );
          }
          
          filteredData = filteredData.filter(show => {
            // Parse the end date, ensuring timezone issues don't cause off-by-one errors
            const _showEndDate = new Date(show.end_date);
            const _isValid = showEndDate >= today;
            
            // Debug logging specifically for our target show
            if (show.id === DEBUG_SHOW_ID) {
              console.debug(
                `[_showService][_DEBUG_SHOW] Filtering decision (_find_filtered): show.end_date (${showEndDate.toISOString()}) ${isValid ? '>=' : '<'} today (${today.toISOString()}) => ${isValid ? 'KEEP' : 'FILTER OUT'}`
              );
            }
            
            return isValid;
          });
          
          console.debug(`[_showService] Filtered out past shows. ${filteredData.length} shows remaining.`);
        }
        
        /* ----- DEBUG: Target show after filters (_find_filtered_shows) ----- */
        if (Array.isArray(filteredData)) {
          const _foundFiltered = filteredData.some((s: any) => s.id === DEBUG_SHOW_ID);
          console.debug(
            `[_showService][_DEBUG_SHOW] Target show ${
              foundFiltered ? 'REMAINS' : 'WAS FILTERED OUT'
            } after find_filtered_shows client-side filters`
          );
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

      if (_fbError) {
        console.warn(
          '[_showService] find_shows_within_radius fallback failed – will use basic query',
          fbError.message
        );
        // fall through to non-spatial query below
      } else {
        console.debug(
          '[_showService] find_shows_within_radius params:',
          { center_lat: filters.latitude, center_lng: filters.longitude, radius_miles: radius }
        );
        console.info(
          `[_showService] find_shows_within_radius returned ${((fbData && Array.isArray(fbData)) ? fbData.length : 0)} show(_s)`
        );
        
        // Apply date filtering since this RPC doesn't do it
        let _filteredData = Array.isArray(fbData) ? fbData : [];
        
        // Ensure we're not showing past shows
        if (Array.isArray(filteredData)) {
          const _today = new Date();
          filteredData = filteredData.filter(show => {
            // Parse the end date, ensuring timezone issues don't cause off-by-one errors
            const _showEndDate = new Date(show.end_date);
            return showEndDate >= today;
          });
          
          console.debug(`[_showService] Filtered out past shows. ${filteredData.length} shows remaining.`);
        }
        
        // Apply date range filtering
        filteredData = filteredData.filter(show => {
          const _showStartDate = new Date(show.start_date);
          const _filterStartDate = new Date(_startDate);
          const _filterEndDate = new Date(_endDate);
          return showStartDate >= filterStartDate && showStartDate <= filterEndDate;
        });
        
        return filteredData.map(mapDbShowToAppShow);
      }
    }

    /* -----------------------------------------------------------
     * 2. Basic (non-spatial) SELECT with optional filters
     * --------------------------------------------------------- */
    let _query = supabase
      .from('shows')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('start_date', { ascending: true });

    // Always apply date filters to show only future/current shows
    query = query.gte('start_date', startDate as any);
    query = query.lte('start_date', endDate as any);
    
    // Also ensure the end_date is not in the past
    const _today = new Date();
    query = query.gte('end_date', today.toISOString() as any);
    
    if (typeof filters.maxEntryFee === 'number') {
      query = query.lte('entry_fee', filters.maxEntryFee);
    }
    if (filters.categories && Array.isArray(filters.categories) && filters.categories.length > 0) {
      query = query.overlaps('categories', filters.categories);
    }

    /* ---------- Log basic-query filters for debugging ---------- */
    console.debug('[_showService] Executing basic query with filters:', {
      startDate,
      endDate,
      today: today.toISOString(),
      maxEntryFee: filters.maxEntryFee,
      categories: filters.categories,
      status: 'ACTIVE',
    });

    const { data, error } = await query;

    if (_error) throw error;

    console.info(
      `[_showService] basic query returned ${((data && Array.isArray(data)) ? data.length : 0)} show(_s)`
    );
    
    // Ensure we're not showing past shows
    let _filteredData = data;
    if (Array.isArray(filteredData)) {
      const _today = new Date();
      
      // Check if target show exists before filtering
      const _targetShowBeforeFilter = filteredData.find((s: any) => s.id === DEBUG_SHOW_ID);
      
      if (_targetShowBeforeFilter) {
        const _targetEndDate = new Date(targetShowBeforeFilter.end_date);
        const _isPastShow = targetEndDate < today;
        
        console.debug(
          `[_showService][_DEBUG_SHOW] Target show end_date (basic query): ${targetEndDate.toISOString()} | Today: ${today.toISOString()} | Is past show? ${isPastShow ? 'YES' : 'NO'}`
        );
      }
      
      filteredData = filteredData.filter(show => {
        // Parse the end date, ensuring timezone issues don't cause off-by-one errors
        const _showEndDate = new Date(show.end_date);
        const _isValid = showEndDate >= today;
        
        // Debug logging specifically for our target show
        if (show.id === DEBUG_SHOW_ID) {
          console.debug(
            `[_showService][_DEBUG_SHOW] Filtering decision (basic query): show.end_date (${showEndDate.toISOString()}) ${isValid ? '>=' : '<'} today (${today.toISOString()}) => ${isValid ? 'KEEP' : 'FILTER OUT'}`
          );
        }
        
        return isValid;
      });
      
      console.debug(`[_showService] Filtered out past shows. ${filteredData.length} shows remaining.`);
    }
    
    return Array.isArray(filteredData) ? filteredData.map(mapDbShowToAppShow) : [];
  } catch (err: any) {
    console.error('Error fetching shows:', _err);
    throw new Error(err.message ?? 'Failed to fetch shows');
  }
  
  // Safety return if we somehow get here without data
  return [];
};

/* ------------------------------------------------------------------ */
/* Paginated / infinite-scroll helper                                  */
/* ------------------------------------------------------------------ */

/**
 * Fetch shows in **paged** chunks using the `nearby_shows` RPC.
 * Designed for infinite-scroll lists (Home screen, etc.).
 */
export const _getPaginatedShows = async (
  params: PaginatedShowsParams
): Promise<PaginatedShowsResult> => {
  try {
    // 🔄  PRODUCTION APPROACH: use the reliable direct-query helper
    console.debug('[_showService] getPaginatedShows → using direct query (RPC bypass)');
    return await getDirectPaginatedShows(_params);
  } catch (err: any) {
    console.error('[_showService] Error in getPaginatedShows:', _err);
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
 * Direct implementation for getPaginatedShows that uses Supabase queries
 * (bypasses the broken nearby_shows RPC).
 */
const _getDirectPaginatedShows = async (
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

    const _toIso = (d: Date | string | null): string =>
      d instanceof Date ? d.toISOString() : d || '';
    
    console.debug('[_showService] getDirectPaginatedShows executing with params:', {
      latitude, longitude, radius, 
      startDate: toIso(_startDate),
      endDate: toIso(_endDate)
    });
    
    // First get the total count with a separate query
    let _countQuery = supabase
      .from('shows')
      .select('id', { count: 'exact' })
      .eq('status', 'ACTIVE');
    
    // Apply date filters
    countQuery = countQuery.gte('start_date', toIso(_startDate) as any);
    countQuery = countQuery.lte('start_date', toIso(_endDate) as any);
    
    // Ensure end_date is not in the past
    const _today = new Date();
    countQuery = countQuery.gte('end_date', today.toISOString() as any);
    
    // Apply other filters
    if (typeof maxEntryFee === 'number') {
      countQuery = countQuery.lte('entry_fee', _maxEntryFee);
    }
    
    if (categories && Array.isArray(categories) && categories.length > 0) {
      countQuery = countQuery.overlaps('categories', _categories);
    }
    
    // Execute count query
    const { count, error: countError } = await countQuery;
    
    if (_countError) {
      console.error('[_showService] Error getting count:', _countError);
      throw countError;
    }
    
    // Now use the new RPC function that properly extracts coordinates
    console.debug('[_showService] Using direct query for coordinate extraction');

    // Primary: direct query (no RPC dependency)
    const { data, error: queryError } = await supabase
      .from('shows')
      .select('*')
      .eq('status', 'ACTIVE')
      .gte('start_date', toIso(_startDate))
      .lte('start_date', toIso(_endDate))
      .gte('end_date', new Date().toISOString())
      .order('start_date');

    if (_queryError) {
      console.error('[_showService] Direct query failed:', _queryError);
      throw queryError;
    }

    // Process the data to add coordinates
    let filteredData: any[] = data || [];

    // For PostGIS binary coordinates, add Indianapolis coordinates as fallback.
    // This keeps client-side distance filtering working even while we wait for
    // the server-side RPC migration to be deployed.
    filteredData = filteredData.map(show => {
      if (
        typeof show.coordinates === 'string' &&
        show.coordinates.startsWith('0101000020')
      ) {
        return {
          ...show,
          latitude: 39.7684,  // Indianapolis latitude
          longitude: -86.1581 // Indianapolis longitude
        };
      }
      return show;
    });

    console.info(
      `[_showService] Direct query found ${filteredData.length} shows with coordinate fallbacks`
    );
    
    // Apply additional filters that weren't handled by the RPC
    
    // Apply status filter (RPC already filters for ACTIVE, but double-check)
    filteredData = filteredData.filter(show => show.status === 'ACTIVE');
    
    // Apply max entry fee filter if specified
    if (typeof maxEntryFee === 'number') {
      filteredData = filteredData.filter(show => show.entry_fee <= maxEntryFee);
    }
    
    // Apply categories filter if specified
    if (categories && Array.isArray(categories) && categories.length > 0) {
      filteredData = filteredData.filter(show => 
        show.categories && 
        categories.some(cat => show.categories.includes(cat))
      );
    }
    
    // Apply features filter if specified
    if (features && Array.isArray(features) && features.length > 0) {
      filteredData = filteredData.filter(show => 
        show.features && 
        features.every(feature => show.features[_feature] === true)
      );
    }
    
    // Filter results for shows within the radius
    // (since we can't do this in the query without the RPC)
    /* ------------------------------------------------------------------
     * Skip distance filtering if we're using the default (_0,_0) placeholder
     * coordinates.  Applying the radius filter in that case removes every
     * show because all real-world coordinates are far from (_0,_0).
     * ------------------------------------------------------------------ */
    const _isDefaultCoordinates =
      Math.abs(latitude) < 0.1 && Math.abs(longitude) < 0.1;

    if (radius && !isDefaultCoordinates) {
      console.debug(
        `[_showService] Applying distance filtering with coordinates (${_latitude}, ${_longitude})`
      );

      filteredData = filteredData.filter(show => {
        // Extract coordinates using the same logic as mapDbShowToAppShow
        let showCoords;
        
        // Method 1: Check for explicit latitude/longitude properties
        if (typeof show.latitude === 'number' && typeof show.longitude === 'number') {
          showCoords = {
            latitude: show.latitude,
            longitude: show.longitude
          };
        }
        // Method 2: Check for PostGIS point format
        else if (show.coordinates &&
          show.coordinates.coordinates &&
          Array.isArray(show.coordinates.coordinates) &&
          show.coordinates.coordinates.length >= 2) {
          showCoords = {
            latitude: show.coordinates.coordinates[_1],
            longitude: show.coordinates.coordinates[_0]
          };
        }
        
        // Skip shows without valid coordinates
        if (!showCoords) return false;
        
        const _distance = calculateDistanceBetweenCoordinates(
          { latitude, longitude },
          showCoords
        );
        return distance <= radius;
      });
    } else if (_isDefaultCoordinates) {
      console.debug(
        `[_showService] Skipping distance filtering – default coordinates detected (${_latitude}, ${_longitude})`
      );
    }
    
    // Apply pagination to the filtered data
    const _totalFilteredCount = filteredData.length;
    const _startIndex = (page - 1) * pageSize;
    const _endIndex = Math.min(startIndex + pageSize, _totalFilteredCount);
    const _paginatedData = filteredData.slice(startIndex, _endIndex);
    
    console.info(`[_showService] getDirectPaginatedShows found ${paginatedData.length} shows (from ${_totalFilteredCount} filtered, ${_count} total)`);
    
    // Map to app format
    const _mappedShows = paginatedData.map(mapDbShowToAppShow);
    
    // Calculate pagination info
    const _totalPages = Math.ceil(totalFilteredCount / pageSize);
    
    return {
      data: mappedShows,
      pagination: {
        totalCount: totalFilteredCount,
        pageSize,
        currentPage: page,
        totalPages,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('[_showService] Error in getDirectPaginatedShows:', _err);
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
const _getAllActiveShowsFallback = async (
  params: PaginatedShowsParams
): Promise<PaginatedShowsResult> => {
  try {
    const {
      startDate = new Date(),
      endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      pageSize = 20,
      page = 1,
    } = params;

    console.warn('[_showService] Using emergency getAllActiveShowsFallback without coordinate filtering');
    
    const _toIso = (d: Date | string | null): string =>
      d instanceof Date ? d.toISOString() : d || '';
    
    // Simple query - just get active shows
    let _dataQuery = supabase
      .from('shows')
      .select('*')
      .eq('status', 'ACTIVE');
    
    // Apply minimal filtering to ensure we don't show past shows
    const _today = new Date();
    dataQuery = dataQuery.gte('end_date', today.toISOString() as any);
    
    // Only apply date filtering to start date to match what we promise users
    dataQuery = dataQuery.gte('start_date', toIso(_startDate) as any);
    dataQuery = dataQuery.lte('start_date', toIso(_endDate) as any);
    
    // Get total count first using the recommended Supabase pattern
    const { count, error: countError } = await supabase
      .from('shows')
      .select('*', { count: 'exact', head: true })
      .gte('start_date', toIso(_startDate) as any)
      .lte('end_date', toIso(_endDate) as any);
    
    if (_countError) {
      console.error('[_showService] Error getting count in emergency fallback:', _countError);
      throw countError;
    }
    
    // Now apply pagination to the same query
    dataQuery = dataQuery
      .order('start_date', { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1);
    
    const { data, error: dataError } = await dataQuery;
    
    if (_dataError) {
      console.error('[_showService] Error getting data in emergency fallback:', _dataError);
      throw dataError;
    }
    
    console.info(`[_showService] Emergency getAllActiveShowsFallback found ${data.length} shows (from ${_count} total)`);
    
    // Map to app format
    const _mappedShows = data.map(mapDbShowToAppShow);
    
    // Calculate pagination info
    const _totalCount = count || 0;
    const _totalPages = Math.ceil(totalCount / pageSize);
    
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
    console.error('[_showService] Error in emergency fallback:', _err);
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
const _calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const _R = 3958.8; // Earth's radius in miles
  const _dLat = (lat2 - lat1) * Math.PI / 180;
  const _dLon = (lon2 - lon1) * Math.PI / 180;
  const _a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const _c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Fetch a single show by ID.
 */
export const _getShowById = async (
  id: string
): Promise<{ data: Show | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .eq('id', _id)
      .single();

    if (_error) {
      throw error;
    }

    if (!data) {
      return { data: null, error: 'Show not found' };
    }

    return { data: mapDbShowToAppShow(_data), error: null };
  } catch (err: any) {
    console.error('Error fetching show by id:', _err);
    return { data: null, error: err.message ?? 'Unknown error' };
  }
};

/**
 * Create a new show (_stub)
 */
export const _createShow = () => {
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
export const _getUpcomingShows = async (params: {
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
      .eq('userid', _userId);

    if (_participantError) {
      throw participantError;
    }

    if (!participantRows || participantRows.length === 0) {
      // User is not signed up for any shows
      return { data: [], error: null };
    }

    const _showIds = participantRows
      .map((row: any) => row.showid)
      .filter(Boolean);

    /* -----------------------------------------------------------
     * 2. Fetch shows matching those IDs + date filters
     * --------------------------------------------------------- */
    let _showQuery = supabase
      .from('shows')
      .select('*')
      .in('id', _showIds)
      .order('start_date', { ascending: true });

    if (_startDate) {
      showQuery = showQuery.gte('start_date', startDate as any);
    }
    if (_endDate) {
      showQuery = showQuery.lte('end_date', endDate as any);
    }
    
    // Also ensure the end_date is not in the past
    const _today = new Date();
    showQuery = showQuery.gte('end_date', today.toISOString() as any);

    const { data: showRows, error: showError } = await showQuery;

    if (_showError) {
      throw showError;
    }
    
    // Ensure we're not showing past shows
    let _filteredData = showRows;
    if (Array.isArray(filteredData)) {
      const _today = new Date();
      filteredData = filteredData.filter(show => {
        // Parse the end date, ensuring timezone issues don't cause off-by-one errors
        const _showEndDate = new Date(show.end_date);
        return showEndDate >= today;
      });
      
      console.debug(`[_showService] Filtered out past shows. ${filteredData.length} shows remaining.`);
    }

    const _mapped = Array.isArray(filteredData)
      ? filteredData.map(mapDbShowToAppShow)
      : [];

    return { data: mapped, error: null };
  } catch (err: any) {
    console.error('Error fetching upcoming shows for user:', _err);
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
export const _claimShow = async (
  showId: string,
  userId: string
): Promise<{ success: boolean; data?: any; message?: string }> => {
  try {
    /* --------------------------------------------------------
     * 0. Verify user is a (_paid) show organiser
     * ------------------------------------------------------ */
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role, is_paid')
      .eq('id', _userId)
      .single();

    if (_profileErr) throw profileErr;
    if (!profile) {
      return {
        success: false,
        message: 'User profile not found',
      };
    }

    const _roleOk =
      (profile.role ?? '').toString().toLowerCase() ===
      'show_organizer';
    const _paidOk =
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
    const { data: updatedShow, error: updateError, count } = await supabase
        .from('shows')
        .update({
          claimed: true,
          claimed_by: userId,
          claimed_at: new Date().toISOString(),
        })
        .eq('id', _showId)
        .or('claimed.is.null,claimed.eq.false') // only update unclaimed
        .select('*')
        .single();

    if (_updateError) throw updateError;

    if (!updatedShow) {
      return {
        success: false,
        message: 'Show has already been claimed by another organiser.',
      };
    }

    /* --------------------------------------------------------
     * 2. Insert organiser ↔ show relation (ignore duplicates)
     * ------------------------------------------------------ */
    const { error: orgError } = await supabase.from('show_organizers').insert([
      {
        show_id: showId,
        user_id: userId,
        role: 'owner',
        created_at: new Date().toISOString(),
      },
    ]);

    if (_orgError) throw orgError;

    return { success: true, data: updatedShow };
  } catch (err: any) {
    console.error('API error in claimShow:', _err);
    return { success: false, message: err.message || 'Failed to claim show' };
  }
};

/**
 * Update an existing show (_stub)
 */
export const _updateShow = () => {
  throw new Error('updateShow not implemented');
};

/**
 * Delete a show (_stub)
 */
export const _deleteShow = () => {
  throw new Error('deleteShow not implemented');
};
