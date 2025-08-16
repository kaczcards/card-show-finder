/**
 * Show Service
 *
 * This file contains helpers for fetching shows from Supabase.
 */

import { supabase } from '../supabase';
import { Show, ShowStatus } from '../types';
import { calculateDistanceBetweenCoordinates } from './locationService';
import { safeOverlaps } from '../utils/postgrest';

/* ------------------------------------------------------------------ */
/* WKB (hex) → Lat/Lng helpers                                         */
/* ------------------------------------------------------------------ */

// Convert hex string to byte array
const hexToBytes = (hex: string): Uint8Array => {
  // Strip optional 0x prefix (common in PostGIS EWKB output)
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const len = clean.length;

  // Guard against odd-length strings which would break parsing
  if (len % 2 !== 0) {
    throw new Error(`[showService] Invalid WKB hex string length: ${len}`);
  }

  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
  }
  return bytes;
};

// Read 32-bit uint respecting endianness
const readUint32 = (
  view: DataView,
  offset: number,
  littleEndian: boolean
): number => view.getUint32(offset, littleEndian);

// Read 64-bit float (Float64) respecting endianness
const readFloat64 = (
  view: DataView,
  offset: number,
  littleEndian: boolean
): number => view.getFloat64(offset, littleEndian);

/**
 * Parse a PostGIS WKB POINT (optionally preceded by SRID / EWKB flag).
 * Supports little/big-endian, 2-D POINT only.
 *
 * Returns { latitude, longitude } or null if parsing fails.
 */
const parseWkbPoint = (
  hex: string
): { latitude: number; longitude: number } | null => {
  try {
    if (!hex || typeof hex !== 'string') return null;

    const bytes = hexToBytes(hex);
    if (bytes.length < 21) return null; // minimal POINT length

    const view = new DataView(bytes.buffer);

    // Byte 0: 1 = little-endian, 0 = big-endian
    const littleEndian = view.getUint8(0) === 1;

    // Bytes 1-4: geometry type (uint32). 0x20000000 flag means SRID present.
    const rawType = readUint32(view, 1, littleEndian);
    const hasSrid = (rawType & 0x20000000) !== 0;
    const wkbType = rawType & 0xFFFF; // strip flags
    const WKB_POINT = 1;
    if (wkbType !== WKB_POINT) return null;

    let offset = 5;
    if (hasSrid) {
      // Skip SRID (uint32)
      offset += 4;
    }

    // Read coordinates (Float64 x, y)
    const x = readFloat64(view, offset, littleEndian);
    const y = readFloat64(view, offset + 8, littleEndian);

    // PostGIS POINT stores X = longitude, Y = latitude
    if (isFinite(x) && isFinite(y)) {
      return { latitude: y, longitude: x };
    }
    return null;
  } catch {
    // Swallow any parsing error – return null to indicate failure
    return null;
  }
};

/**
 * Normalize an address string for consistent comparison.
 * Lowercases, trims, collapses whitespace, and removes punctuation except commas.
 * Returns empty string for falsy inputs.
 */
const normalizeAddress = (str?: string): string => {
  if (!str) return '';
  
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')  // collapse multiple spaces to single space
    .replace(/[^\w\s,]/g, ''); // remove punctuation except commas
};

/**
 * Convert a raw Supabase row into an app `Show` object.
 */
/* ------------------------------------------------------------------ */
/* Debug helper – track a single show end-to-end                        */
/* ------------------------------------------------------------------ */
const DEBUG_SHOW_ID = '46437e96-79e3-443e-9ad6-f43ebf660cc3';

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
  // WKB hex string fallback (EWKB)
  ...(typeof row.coordinates === 'string'
    ? (() => {
        const pt = parseWkbPoint(row.coordinates);
        return pt
          ? {
              coordinates: {
                latitude: pt.latitude,
                longitude: pt.longitude,
              },
            }
          : {};
      })()
    : {}),
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
    const toIso = (d: Date | string | null): string =>
      d instanceof Date ? d.toISOString() : d || '';

    // Default date range: today → +30 days (ISO strings)
    const startDate = toIso(
      filters.startDate ?? new Date()
    );
    const endDate = toIso(
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
      const radius = typeof filters.radius === 'number' ? filters.radius : 25;

      /* ---------- Sanity-check lat / lng values ---------- */
      if (Math.abs(filters.latitude) > 90 || Math.abs(filters.longitude) > 180) {
        if (__DEV__)
        console.warn(
          '[showService] Suspicious coordinates detected – latitude / longitude might be swapped:',
          { latitude: filters.latitude, longitude: filters.longitude }
        );
      }

      if (__DEV__)
      console.warn('[showService] Calling nearby_shows with params:', {
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

      if (nearbyError) {
        if (__DEV__)
        console.warn(
          '[showService] nearby_shows RPC failed – attempting fallback',
          nearbyError.message
        );
      } else {
        if (__DEV__)
        console.warn(
          `[showService] nearby_shows returned ${((nearbyData && Array.isArray(nearbyData)) ? nearbyData.length : 0)} show(s)`
        );

        /* ----- DEBUG: Is target show present in raw nearby_shows data? ---- */
        if (Array.isArray(nearbyData)) {
          const found = nearbyData.some((s: any) => s.id === DEBUG_SHOW_ID);
          if (__DEV__)
          console.warn(
            `[showService][DEBUG_SHOW] Target show ${
              found ? 'FOUND' : 'NOT found'
            } in raw nearby_shows payload`
          );

          // If found, get the show details for further debugging
          if (found) {
            const targetShow = nearbyData.find((s: any) => s.id === DEBUG_SHOW_ID);
          if (__DEV__)
          console.warn(
              `[showService][DEBUG_SHOW] Target show details:`,
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
        let filteredData = nearbyData;
        
        // Ensure we're not showing past shows
        if (Array.isArray(filteredData)) {
          const today = new Date();
          if (__DEV__)
          console.warn(`[showService][DEBUG_SHOW] Today's date for filtering: ${today.toISOString()}`);
          
          // Check if target show exists before filtering
          const targetShowBeforeFilter = filteredData.find((s: any) => s.id === DEBUG_SHOW_ID);
          
          if (targetShowBeforeFilter) {
            const targetEndDate = new Date(targetShowBeforeFilter.end_date);
            const isPastShow = targetEndDate < today;
            
            console.warn(
              `[showService][DEBUG_SHOW] Target show end_date: ${targetEndDate.toISOString()} | Today: ${today.toISOString()} | Is past show? ${isPastShow ? 'YES' : 'NO'}`
            );
          }
          
          filteredData = filteredData.filter(show => {
            // Parse the end date, ensuring timezone issues don't cause off-by-one errors
            const showEndDate = new Date(show.end_date);
            const isValid = showEndDate >= today;
            
            // Debug logging specifically for our target show
            if (show.id === DEBUG_SHOW_ID) {
              if (__DEV__)
              console.warn(
                `[showService][DEBUG_SHOW] Filtering decision: show.end_date (${showEndDate.toISOString()}) ${isValid ? '>=' : '<'} today (${today.toISOString()}) => ${isValid ? 'KEEP' : 'FILTER OUT'}`
              );
            }
            
            return isValid;
          });
          
          if (__DEV__)
          console.warn(`[showService] Filtered out past shows. ${filteredData.length} shows remaining.`);
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
        
        /* ----- DEBUG: Is target show present after client-side filters? ---- */
        if (Array.isArray(filteredData)) {
          const foundAfter = filteredData.some((s: any) => s.id === DEBUG_SHOW_ID);
          if (__DEV__)
          console.warn(
            `[showService][DEBUG_SHOW] Target show ${
              foundAfter ? 'REMAINS' : 'WAS FILTERED OUT'
            } after nearby_shows client-side filters`
          );
        }

        return Array.isArray(filteredData) ? filteredData.map(mapDbShowToAppShow) : [];
      }

      /* -------------------------------------------------------
       * 1b. Fallback to find_filtered_shows if nearby_shows fails
       * ----------------------------------------------------- */
      if (__DEV__)
      console.warn('[showService] Falling back to find_filtered_shows with params:', {
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
        if (__DEV__)
        console.warn(
          '[showService] find_filtered_shows RPC failed – attempting second fallback',
          rpcError.message
        );
      } else {
        if (__DEV__)
        console.warn(
          `[showService] find_filtered_shows returned ${((rpcData && Array.isArray(rpcData)) ? rpcData.length : 0)} show(s)`
        );
        
        /* ----- DEBUG: Target show in raw find_filtered_shows payload? ----- */
        if (Array.isArray(rpcData)) {
          const foundRaw = rpcData.some((s: any) => s.id === DEBUG_SHOW_ID);
          if (__DEV__)
          console.warn(
            `[showService][DEBUG_SHOW] Target show ${
              foundRaw ? 'FOUND' : 'NOT found'
            } in raw find_filtered_shows payload`
          );
          
          // If found, get the show details for further debugging
          if (foundRaw) {
            const targetShow = rpcData.find((s: any) => s.id === DEBUG_SHOW_ID);
            console.warn(
              `[showService][DEBUG_SHOW] Target show details from find_filtered_shows:`,
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
        let filteredData = rpcData;
        if (Array.isArray(filteredData)) {
          const today = new Date();
          if (__DEV__)
          console.warn(`[showService][DEBUG_SHOW] Today's date for filtering (find_filtered): ${today.toISOString()}`);
          
          // Check if target show exists before filtering
          const targetShowBeforeFilter = filteredData.find((s: any) => s.id === DEBUG_SHOW_ID);
          
          if (targetShowBeforeFilter) {
            const targetEndDate = new Date(targetShowBeforeFilter.end_date);
            const isPastShow = targetEndDate < today;
            
            console.warn(
              `[showService][DEBUG_SHOW] Target show end_date (find_filtered): ${targetEndDate.toISOString()} | Today: ${today.toISOString()} | Is past show? ${isPastShow ? 'YES' : 'NO'}`
            );
          }
          
          filteredData = filteredData.filter(show => {
            // Parse the end date, ensuring timezone issues don't cause off-by-one errors
            const showEndDate = new Date(show.end_date);
            const isValid = showEndDate >= today;
            
            // Debug logging specifically for our target show
            if (show.id === DEBUG_SHOW_ID) {
              if (__DEV__)
              console.warn(
                `[showService][DEBUG_SHOW] Filtering decision (find_filtered): show.end_date (${showEndDate.toISOString()}) ${isValid ? '>=' : '<'} today (${today.toISOString()}) => ${isValid ? 'KEEP' : 'FILTER OUT'}`
              );
            }
            
            return isValid;
          });
          
          if (__DEV__)
          console.warn(`[showService] Filtered out past shows. ${filteredData.length} shows remaining.`);
        }
        
        /* ----- DEBUG: Target show after filters (find_filtered_shows) ----- */
        if (Array.isArray(filteredData)) {
          const foundFiltered = filteredData.some((s: any) => s.id === DEBUG_SHOW_ID);
          if (__DEV__)
          console.warn(
            `[showService][DEBUG_SHOW] Target show ${
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

      if (fbError) {
        if (__DEV__)
        console.warn(
          '[showService] find_shows_within_radius fallback failed – will use basic query',
          fbError.message
        );
        // fall through to non-spatial query below
      } else {
        if (__DEV__)
        console.warn(
          '[showService] find_shows_within_radius params:',
          { center_lat: filters.latitude, center_lng: filters.longitude, radius_miles: radius }
        );
        if (__DEV__)
        console.warn(
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
          
          if (__DEV__)
          console.warn(`[showService] Filtered out past shows. ${filteredData.length} shows remaining.`);
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

    /* -----------------------------------------------------------
     * Date-range logic: include any show that **overlaps** the
     * selected range rather than only shows that START inside it.
     *  start_date ≤ rangeEnd  AND  end_date ≥ rangeStart
     * --------------------------------------------------------- */
    const rangeStart = startDate; // already ISO string
    const rangeEnd = endDate;     // already ISO string
    query = query.lte('start_date', rangeEnd as any);
    query = query.gte('end_date', rangeStart as any);
    
    if (typeof filters.maxEntryFee === 'number') {
      query = query.lte('entry_fee', filters.maxEntryFee);
    }
    query = safeOverlaps(query, 'categories', filters.categories as any);

    /* ---------- Log basic-query filters for debugging ---------- */
    if (__DEV__)
    console.warn('[showService] Executing basic query with filters:', {
      startDate: rangeStart,
      endDate: rangeEnd,
      maxEntryFee: filters.maxEntryFee,
      categories: filters.categories,
      status: 'ACTIVE',
    });

    const { data, error } = await query;

    if (error) throw error;

    if (__DEV__)
    console.warn(
      `[showService] basic query returned ${((data && Array.isArray(data)) ? data.length : 0)} show(s)`
    );
    
    // Ensure we're not showing past shows
    let filteredData = data;
    if (Array.isArray(filteredData)) {
      const today = new Date();
      
      // Check if target show exists before filtering
      const targetShowBeforeFilter = filteredData.find((s: any) => s.id === DEBUG_SHOW_ID);
      
      if (targetShowBeforeFilter) {
        const targetEndDate = new Date(targetShowBeforeFilter.end_date);
        const isPastShow = targetEndDate < today;
        
        if (__DEV__)
        console.warn(
          `[showService][DEBUG_SHOW] Target show end_date (basic query): ${targetEndDate.toISOString()} | Today: ${today.toISOString()} | Is past show? ${isPastShow ? 'YES' : 'NO'}`
        );
      }
      
      filteredData = filteredData.filter(show => {
        // Parse the end date, ensuring timezone issues don't cause off-by-one errors
        const showEndDate = new Date(show.end_date);
        const isValid = showEndDate >= today;
        
        // Debug logging specifically for our target show
        if (show.id === DEBUG_SHOW_ID) {
          console.warn(
            `[showService][DEBUG_SHOW] Filtering decision (basic query): show.end_date (${showEndDate.toISOString()}) ${isValid ? '>=' : '<'} today (${today.toISOString()}) => ${isValid ? 'KEEP' : 'FILTER OUT'}`
          );
        }
        
        return isValid;
      });
      
      if (__DEV__)
      console.warn(`[showService] Filtered out past shows. ${filteredData.length} shows remaining.`);
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
 * Fetch shows in **paged** chunks using the `nearby_shows` RPC.
 * Designed for infinite-scroll lists (Home screen, etc.).
 */
export const getPaginatedShows = async (
  params: PaginatedShowsParams
): Promise<PaginatedShowsResult> => {
  try {
    // 🔄  PRODUCTION APPROACH: use the reliable direct-query helper
    if (__DEV__)
      console.warn(
        '[showService] getPaginatedShows → using direct query (RPC bypass)',
      );
    return await getDirectPaginatedShows(params);
  } catch (err: any) {
    console.error('[showService] Error in getPaginatedShows:', err);
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
const getDirectPaginatedShows = async (
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

    const toIso = (d: Date | string | null): string =>
      d instanceof Date ? d.toISOString() : d || '';
    
    if (__DEV__)
      console.warn(
        '[showService] getDirectPaginatedShows executing with params:',
        {
      latitude, longitude, radius, 
      startDate: toIso(startDate),
      endDate: toIso(endDate)
        },
      );
    
    if (__DEV__)
      console.warn(
        '[showService] Using direct query for coordinate extraction',
      );
    let countQuery = supabase
      .from('shows')
      .select('id', { count: 'exact' })
      .eq('status', 'ACTIVE');
    
    // Apply date filters
    // Overlap logic: show starts on/before rangeEnd AND ends on/after rangeStart
    countQuery = countQuery.lte('start_date', toIso(endDate) as any);
    countQuery = countQuery.gte('end_date', toIso(startDate) as any);
    
    
    // Apply other filters
    if (typeof maxEntryFee === 'number') {
      countQuery = countQuery.lte('entry_fee', maxEntryFee);
    }
    
    countQuery = safeOverlaps(countQuery, 'categories', categories as any);
    
    // Execute count query
    const { count, error: countError } = await countQuery;
    
    if (countError) {
      console.error('[showService] Error getting count:', countError);
      throw countError;
    }
    
    // Now use the new RPC function that properly extracts coordinates
    console.warn('[showService] Using direct query for coordinate extraction');

    // Primary: direct query (no RPC dependency)
    const { data, error: queryError } = await supabase
      .from('shows')
      .select('*')
      .eq('status', 'ACTIVE')
      // Overlap logic: include shows whose date span intersects the range
      .lte('start_date', toIso(endDate))
      .gte('end_date', toIso(startDate))
      .order('start_date');

    if (queryError) {
      console.error('[showService] Direct query failed:', queryError);
      throw queryError;
    }

    /* ------------------------------------------------------------------
     * DEBUG – inspect target show immediately after raw direct query
     * ----------------------------------------------------------------*/
    if (Array.isArray(data)) {
      const dbgRow: any | undefined = data.find((r: any) => r.id === DEBUG_SHOW_ID);
      if (dbgRow) {
        console.warn('[showService][DEBUG_SHOW] Found target show in raw direct query:', {
          id: dbgRow.id,
          title: dbgRow.title,
          start_date: dbgRow.start_date,
          end_date: dbgRow.end_date,
          latitude: dbgRow.latitude,
          longitude: dbgRow.longitude,
          hasCoordArray:
            !!dbgRow.coordinates &&
            !!dbgRow.coordinates.coordinates &&
            Array.isArray(dbgRow.coordinates.coordinates),
          coordArray: dbgRow.coordinates?.coordinates,
          coordType: typeof dbgRow.coordinates,
        });
      } else {
        console.warn('[showService][DEBUG_SHOW] Target show NOT in raw direct query result');
      }
    }

    // Process the data to add coordinates
    let filteredData: any[] = data || [];

    if (__DEV__)
      console.warn(
        `[showService] Direct query returned ${filteredData.length} raw show(s)`,
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
        features.every(feature => show.features[feature] === true)
      );
    }
    
    // Build a map of coordinates by address from shows that have coordinates
    const coordsByAddress = new Map<string, { latitude: number; longitude: number }>();
    
    filteredData.forEach(show => {
      // Only include entries that have valid coordinates
      let hasValidCoords = false;
      let coords: { latitude: number; longitude: number } | null = null;
      
      // Check for explicit latitude/longitude
      if (typeof show.latitude === 'number' && typeof show.longitude === 'number') {
        coords = { latitude: show.latitude, longitude: show.longitude };
        hasValidCoords = true;
      }
      // Check for PostGIS point
      else if (
        show.coordinates &&
        show.coordinates.coordinates &&
        Array.isArray(show.coordinates.coordinates) &&
        show.coordinates.coordinates.length >= 2
      ) {
        coords = {
          latitude: show.coordinates.coordinates[1],
          longitude: show.coordinates.coordinates[0]
        };
        hasValidCoords = true;
      }
      // Check for WKB hex string
      else if (typeof show.coordinates === 'string') {
        const pt = parseWkbPoint(show.coordinates);
        if (pt) {
          coords = pt;
          hasValidCoords = true;
        }
      }
      
      // If we found valid coordinates and have an address, add to the map
      if (hasValidCoords && coords && show.address) {
        const normalizedAddr = normalizeAddress(show.address);
        if (normalizedAddr) {
          coordsByAddress.set(normalizedAddr, coords);
        }
      }
    });
    
    if (__DEV__ && coordsByAddress.size > 0) {
      console.warn(
        `[showService] Built coordinates map from ${coordsByAddress.size} addresses with known coordinates`
      );
    }
    
    // Filter results for shows within the radius
    // (since we can't do this in the query without the RPC)
    /* ------------------------------------------------------------------
     * Skip distance filtering if we're using the default (0,0) placeholder
     * coordinates.  Applying the radius filter in that case removes every
     * show because all real-world coordinates are far from (0,0).
     * ------------------------------------------------------------------ */
    const isDefaultCoordinates =
      Math.abs(latitude) < 0.1 && Math.abs(longitude) < 0.1;

    if (radius && !isDefaultCoordinates) {
      if (__DEV__)
        console.warn(
        `[showService] Applying distance filtering with coordinates (${latitude}, ${longitude})`
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
            latitude: show.coordinates.coordinates[1],
            longitude: show.coordinates.coordinates[0]
          };
        // Method 3: WKB hex string
        } else if (typeof show.coordinates === 'string') {
          const pt = parseWkbPoint(show.coordinates);
          if (pt) {
            showCoords = {
              latitude: pt.latitude,
              longitude: pt.longitude,
            };
          }
        }
        
        // If no coordinates yet, try to find them by address
        if (!showCoords && show.address) {
          const normalizedAddr = normalizeAddress(show.address);
          const fallbackCoords = coordsByAddress.get(normalizedAddr);
          
          if (fallbackCoords) {
            showCoords = fallbackCoords;
            
            // Also assign these coordinates to the show object for mapping
            // Use a try/catch to handle readonly properties
            try {
              show.latitude = fallbackCoords.latitude;
              show.longitude = fallbackCoords.longitude;
            } catch (e) {
              // If properties are readonly, we can still use showCoords for distance calc
              if (__DEV__) {
                console.warn('[showService] Could not assign fallback coordinates to show object (readonly properties)');
              }
            }
            
            // Debug log for target show
            if (show.id === DEBUG_SHOW_ID) {
              console.warn('[showService][DEBUG_SHOW] Applied fallback coordinates from address match:', {
                address: show.address,
                normalizedAddress: normalizedAddr,
                borrowedCoords: fallbackCoords
              });
            }
          }
        }
        
        // Skip shows without valid coordinates
        if (!showCoords) return false;
        
        const distance = calculateDistanceBetweenCoordinates(
          { latitude, longitude },
          showCoords
        );

        /* ----------- DEBUG distance calc for target show ------------- */
        if (show.id === DEBUG_SHOW_ID) {
          console.warn('[showService][DEBUG_SHOW] Distance filter evaluation:', {
            coordsUser: { latitude, longitude },
            coordsShow: showCoords,
            distance,
            radius,
            passes: distance <= radius,
          });
        }

        return distance <= radius;
      });

      /* After distance filtering – did target remain? */
      if (Array.isArray(filteredData)) {
        const remains = filteredData.some((s: any) => s.id === DEBUG_SHOW_ID);
        console.warn(
          `[showService][DEBUG_SHOW] Target show ${
            remains ? 'REMAINS' : 'REMOVED'
          } after distance filtering`,
        );
      }
    } else if (isDefaultCoordinates) {
      if (__DEV__)
        console.warn(
        `[showService] Skipping distance filtering – default coordinates detected (${latitude}, ${longitude})`
      );
    }
    
    // Apply pagination to the filtered data
    const totalFilteredCount = filteredData.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalFilteredCount);
    const paginatedData = filteredData.slice(startIndex, endIndex);
    
    if (__DEV__)
      console.warn(
        `[showService] getDirectPaginatedShows found ${paginatedData.length} shows (from ${totalFilteredCount} filtered, ${count} total)`,
      );

    /* Final page check for DEBUG_SHOW */
    if (paginatedData.some((s: any) => s.id === DEBUG_SHOW_ID)) {
      console.warn('[showService][DEBUG_SHOW] Target show IS in final paginated page');
    } else {
      console.warn('[showService][DEBUG_SHOW] Target show NOT in final paginated page');
    }
    
    // Map to app format
    const mappedShows = paginatedData.map(mapDbShowToAppShow);
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalFilteredCount / pageSize);
    
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
    console.error('[showService] Error in getDirectPaginatedShows:', err);
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

    if (__DEV__)
      console.warn(
        '[showService] Using emergency getAllActiveShowsFallback without coordinate filtering',
      );
    
    const toIso = (d: Date | string | null): string =>
      d instanceof Date ? d.toISOString() : d || '';
    
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
    
    // Get total count first using the recommended Supabase pattern
    const { count, error: countError } = await supabase
      .from('shows')
      .select('*', { count: 'exact', head: true })
      .gte('start_date', toIso(startDate) as any)
      .lte('end_date', toIso(endDate) as any);
    
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
    
    if (__DEV__)
      console.warn(
        `[showService] Emergency getAllActiveShowsFallback found ${data.length} shows (from ${count} total)`,
      );
    
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
const _calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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

    // Early-exit guard: nothing to look up → return empty list
    if (showIds.length === 0) {
      return { data: [], error: null };
    }

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
      
      if (__DEV__)
        console.warn(
          `[showService] Filtered out past shows. ${filteredData.length} shows remaining.`,
        );
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
    const {
      data: updatedShow,
      error: updateError,
      count: _count,
    } = await supabase
        .from('shows')
        .update({
          claimed: true,
          claimed_by: userId,
          claimed_at: new Date().toISOString(),
        })
        .eq('id', showId)
        .or('claimed.is.null,claimed.eq.false') // only update unclaimed
        .select('*')
        .single();

    if (updateError) throw updateError;

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
