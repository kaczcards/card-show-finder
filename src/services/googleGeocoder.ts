/**
 * Google Maps Geocoding Service
 * 
 * Server-side module for geocoding addresses using Google Maps API with caching
 * to reduce API costs. This module is intended for use in Node.js scripts only,
 * not for client-side or mobile app use.
 */

import axios from 'axios';
import crypto from 'crypto';
import { serviceSupabase, ensureEnv } from '../scripts/_supabaseService';

// Type definitions
interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  raw?: any;
}

interface GoogleGeocodingResponse {
  results: {
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      }
    }
  }[];
  status: string;
}

interface GeocodeCacheEntry {
  address_hash: string;
  address_norm: string;
  formatted_address: string;
  lat: number;
  lng: number;
  raw: any;
}

// Configuration
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_INITIAL_RETRY_DELAY_MS = 1000;
const DEFAULT_REQUEST_DELAY_MS = 200; // Basic rate limiting
const GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * Normalizes an address string for consistent cache lookups
 * @param address The address to normalize
 * @returns Normalized address string
 */
export function normalizeAddress(address: string): string {
  if (!address) return '';
  
  return address
    .toLowerCase()
    .replace(/[^\w\s,.-]/g, '') // Keep alphanumeric, spaces, commas, periods, hyphens
    .replace(/\s+/g, ' ')       // Replace multiple spaces with single space
    .trim();
}

/**
 * Creates a SHA-256 hash of an address string
 * @param address The address to hash
 * @returns SHA-256 hash as a hex string
 */
export function hashAddress(address: string): string {
  return crypto
    .createHash('sha256')
    .update(address)
    .digest('hex');
}

/**
 * Sleep/delay function for rate limiting
 * @param ms Milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safely converts a value to a number, returning a default if invalid
 * @param value The value to convert
 * @param defaultValue Default value if conversion fails
 * @returns The number or default value
 */
export function safeNumber(value: any, defaultValue: number): number {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Checks if the geocoding cache contains an entry for the given address
 * @param addressHash Hash of the address to look up
 * @returns Cache entry if found, null otherwise
 */
async function checkGeocodingCache(addressHash: string): Promise<GeocodeCacheEntry | null> {
  const { data, error } = await serviceSupabase
    .from('geocode_cache')
    .select('*')
    .eq('address_hash', addressHash)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data as GeocodeCacheEntry;
}

/**
 * Updates the geocoding cache with a new result
 * @param addressHash Hash of the original address
 * @param normalizedAddress Normalized address for fuzzy matching
 * @param result Geocoding result to cache
 */
async function updateGeocodingCache(
  addressHash: string,
  normalizedAddress: string,
  result: GeocodingResult
): Promise<void> {
  try {
    await serviceSupabase.rpc('geocode_cache_upsert', {
      p_address_hash: addressHash,
      p_address_norm: normalizedAddress,
      p_formatted_address: result.formattedAddress,
      p_lat: result.latitude,
      p_lng: result.longitude,
      p_raw: result.raw || null
    });
  } catch (error) {
    console.error('Failed to update geocoding cache:', error);
    // Continue execution even if cache update fails
  }
}

/**
 * Calls the Google Maps Geocoding API
 * @param address The address to geocode
 * @param apiKey Google Maps API key
 * @returns Geocoding result
 * @throws Error if geocoding fails
 */
async function callGoogleGeocodingApi(address: string, apiKey: string): Promise<GeocodingResult> {
  try {
    const response = await axios.get<GoogleGeocodingResponse>(GEOCODING_API_URL, {
      params: {
        address,
        key: apiKey
      },
      timeout: 10000 // 10 second timeout
    });

    if (response.data.status !== 'OK' || !response.data.results.length) {
      throw new Error(`Geocoding failed: ${response.data.status}`);
    }

    const result = response.data.results[0];
    return {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      raw: result
    };
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Google Maps API request failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Geocodes an address with retry logic
 * @param address The address to geocode
 * @param apiKey Google Maps API key
 * @param retryAttempts Maximum number of retry attempts
 * @param initialRetryDelayMs Initial delay between retries in milliseconds
 * @returns Geocoding result
 */
async function geocodeWithRetry(
  address: string,
  apiKey: string,
  retryAttempts: number = DEFAULT_RETRY_ATTEMPTS,
  initialRetryDelayMs: number = DEFAULT_INITIAL_RETRY_DELAY_MS
): Promise<GeocodingResult> {
  let lastError: Error | null = null;
  let delayMs = initialRetryDelayMs;

  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    try {
      // Add delay between requests (except for first attempt)
      if (attempt > 0) {
        await sleep(delayMs);
        // Exponential backoff
        delayMs *= 2;
      }

      return await callGoogleGeocodingApi(address, apiKey);
    } catch (error: any) {
      lastError = error;
      
      // Don't retry for certain error types
      if (error.message?.includes('ZERO_RESULTS') || 
          error.message?.includes('INVALID_REQUEST')) {
        break;
      }
      
      console.warn(`Geocoding attempt ${attempt + 1}/${retryAttempts + 1} failed: ${error.message}`);
    }
  }

  throw lastError || new Error('Geocoding failed after multiple attempts');
}

/**
 * Geocodes an address to coordinates using Google Maps API with caching
 * @param address The address to geocode
 * @returns Promise with coordinates and formatted address
 * @throws Error if geocoding fails or API key is missing
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  if (!address) {
    throw new Error('Address is required');
  }

  // Get and validate Google Maps API key
  const apiKey = ensureEnv('GOOGLE_MAPS_API_KEY');
  
  // Normalize and hash the address for cache lookup
  const normalizedAddress = normalizeAddress(address);
  const addressHash = hashAddress(address);
  
  // Check cache first
  const cachedResult = await checkGeocodingCache(addressHash);
  if (cachedResult) {
    console.log(`Geocoding cache hit for: ${address}`);
    return {
      latitude: cachedResult.lat,
      longitude: cachedResult.lng,
      formattedAddress: cachedResult.formatted_address,
      raw: cachedResult.raw
    };
  }
  
  console.log(`Geocoding cache miss for: ${address}`);
  
  // Basic rate limiting
  await sleep(DEFAULT_REQUEST_DELAY_MS);
  
  // Call Google Maps API with retry logic
  const result = await geocodeWithRetry(address, apiKey);
  
  // Update cache with new result
  await updateGeocodingCache(addressHash, normalizedAddress, result);
  
  return result;
}

// Export main function and helper utilities
export default {
  geocodeAddress,
  normalizeAddress,
  hashAddress,
  safeNumber,
  sleep
};
