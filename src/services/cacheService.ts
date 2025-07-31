import AsyncStorage from '@react-native-async-storage/async-storage';
import { Show, ShowFilters } from '../types';

// Define cache keys
const CACHE_KEYS = {
  SHOWS: 'cache:shows',
  SHOW_FILTERS: 'cache:show_filters',
  SHOW_TIMESTAMP: 'cache:shows_timestamp',
};

// Cache expiration time (in milliseconds)
const CACHE_EXPIRATION = 60 * 60 * 1000; // 1 hour

/**
 * Caches show data along with the timestamp
 * @param shows The shows data to cache
 * @param filters The filters used to fetch the shows
 */
export const cacheShows = async (shows: Show[], filters: ShowFilters): Promise<void> => {
  try {
    const timestamp = Date.now();
    
    // Store the shows data
    await AsyncStorage.setItem(CACHE_KEYS.SHOWS, JSON.stringify(shows));
    
    // Store the filters used
    await AsyncStorage.setItem(CACHE_KEYS.SHOW_FILTERS, JSON.stringify(filters));
    
    // Store the timestamp
    await AsyncStorage.setItem(CACHE_KEYS.SHOW_TIMESTAMP, timestamp.toString());
    
    console.warn(`Cached ${shows.length} shows at ${new Date(timestamp).toLocaleString()}`);
  } catch (error) {
    console.error('Error caching shows:', error);
  }
};

/**
 * Retrieves cached show data if available and not expired
 * @returns The cached shows and filters, or null if cache is expired or not available
 */
export const getCachedShows = async (): Promise<{ shows: Show[]; filters: ShowFilters } | null> => {
  try {
    // Get the timestamp
    const timestampStr = await AsyncStorage.getItem(CACHE_KEYS.SHOW_TIMESTAMP);
    
    if (!timestampStr) {
      return null;
    }
    
    const timestamp = parseInt(timestampStr, 10);
    const now = Date.now();
    
    // Check if cache has expired
    if (now - timestamp > CACHE_EXPIRATION) {
      console.warn('Show cache expired, fetching fresh data');
      return null;
    }
    
    // Get the cached shows
    const showsJson = await AsyncStorage.getItem(CACHE_KEYS.SHOWS);
    const filtersJson = await AsyncStorage.getItem(CACHE_KEYS.SHOW_FILTERS);
    
    if (!showsJson || !filtersJson) {
      return null;
    }
    
    const shows = JSON.parse(showsJson) as Show[];
    const filters = JSON.parse(filtersJson) as ShowFilters;
    
    console.warn(`Retrieved ${shows.length} shows from cache (${Math.round((now - timestamp) / 1000 / 60)} minutes old)`);
    
    return { shows, filters };
  } catch (error) {
    console.error('Error retrieving cached shows:', error);
    return null;
  }
};

/**
 * Clears the shows cache
 */
export const clearShowsCache = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHE_KEYS.SHOWS);
    await AsyncStorage.removeItem(CACHE_KEYS.SHOW_FILTERS);
    await AsyncStorage.removeItem(CACHE_KEYS.SHOW_TIMESTAMP);
    console.warn('Shows cache cleared');
  } catch (error) {
    console.error('Error clearing shows cache:', error);
  }
};
