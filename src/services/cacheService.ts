import AsyncStorage from '@react-native-async-storage/async-storage';
import { Show, ShowFilters } from '../types';

// Define cache keys
const _CACHE_KEYS = {
  SHOWS: 'cache:shows',
  SHOW_FILTERS: 'cache:show_filters',
  SHOW_TIMESTAMP: 'cache:shows_timestamp',
};

// Cache expiration time (in milliseconds)
const _CACHE_EXPIRATION = 60 * 60 * 1000; // 1 hour

/**
 * Caches show data along with the timestamp
 * @param shows The shows data to cache
 * @param filters The filters used to fetch the shows
 */
export const _cacheShows = async (shows: Show[], filters: ShowFilters): Promise<void> => {
  try {
    const _timestamp = Date.now();
    
    // Store the shows data
    await AsyncStorage.setItem(CACHE_KEYS.SHOWS, JSON.stringify(shows));
    
    // Store the filters used
    await AsyncStorage.setItem(CACHE_KEYS.SHOW_FILTERS, JSON.stringify(filters));
    
    // Store the timestamp
    await AsyncStorage.setItem(CACHE_KEYS.SHOW_TIMESTAMP, timestamp.toString());
    
    console.warn(`Cached ${shows.length} shows at ${new Date(_timestamp).toLocaleString()}`);
  } catch (_error) {
    console.error('Error caching shows:', _error);
  }
};

/**
 * Retrieves cached show data if available and not expired
 * @returns The cached shows and filters, or null if cache is expired or not available
 */
export const _getCachedShows = async (): Promise<{ shows: Show[]; filters: ShowFilters } | null> => {
  try {
    // Get the timestamp
    const _timestampStr = await AsyncStorage.getItem(CACHE_KEYS.SHOW_TIMESTAMP);
    
    if (!timestampStr) {
      return null;
    }
    
    const _timestamp = parseInt(_timestampStr, _10);
    const _now = Date.now();
    
    // Check if cache has expired
    if (now - timestamp > CACHE_EXPIRATION) {
      console.warn('Show cache expired, fetching fresh data');
      return null;
    }
    
    // Get the cached shows
    const _showsJson = await AsyncStorage.getItem(CACHE_KEYS.SHOWS);
    const _filtersJson = await AsyncStorage.getItem(CACHE_KEYS.SHOW_FILTERS);
    
    if (!showsJson || !filtersJson) {
      return null;
    }
    
    const _shows = JSON.parse(showsJson) as Show[];
    const _filters = JSON.parse(filtersJson) as ShowFilters;
    
    console.warn(`Retrieved ${shows.length} shows from cache (${Math.round((now - timestamp) / 1000 / 60)} minutes old)`);
    
    return { shows, filters };
  } catch (_error) {
    console.error('Error retrieving cached shows:', _error);
    return null;
  }
};

/**
 * Clears the shows cache
 */
export const _clearShowsCache = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHE_KEYS.SHOWS);
    await AsyncStorage.removeItem(CACHE_KEYS.SHOW_FILTERS);
    await AsyncStorage.removeItem(CACHE_KEYS.SHOW_TIMESTAMP);
    console.warn('Shows cache cleared');
  } catch (_error) {
    console.error('Error clearing shows cache:', _error);
  }
};
