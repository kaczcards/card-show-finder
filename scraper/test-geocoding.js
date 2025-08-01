#!/usr/bin/env node
/**
 * scraper/test-geocoding.js
 * 
 * Test script for validating Google Maps API geocoding functionality.
 * This script helps diagnose issues with the geocoding in the enhanced scraper by:
 * - Testing a simple address to verify API key works
 * - Showing detailed error information
 * - Using the same address format as the scraper
 * 
 * Usage:
 *   node scraper/test-geocoding.js
 */

// Load environment variables from .env
require('dotenv').config();

const fetch = require('node-fetch');

// Configuration
const GEOCODE_TIMEOUT_MS = 5000; // 5s timeout for geocoding requests
const TEST_ADDRESS = "Dallas Convention Center, Dallas, TX";

// Logging function
function log(message, data = null) {
  console.log('\n' + '='.repeat(80));
  console.log(message);
  console.log('='.repeat(80));
  if (data) {
    console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
}

// Error logging function
function logError(message, error) {
  console.error('\n' + '!'.repeat(80));
  console.error(`ERROR: ${message}`);
  console.error(error?.message || error);
  console.error('!'.repeat(80));
}

// Geocode an address to get coordinates
async function geocodeAddress(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    logError('Missing Google Maps API key', 'Set GOOGLE_MAPS_API_KEY in your .env file');
    return null;
  }
  
  log(`API Key found: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
  log(`Testing geocoding for address: "${address}"`);
  
  try {
    // Build the URL
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    log(`Request URL: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);
    
    // Set up request with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
    
    const startTime = Date.now();
    log(`Sending request at ${new Date().toISOString()}`);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    log(`Response received in ${duration}ms with status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      logError(`HTTP Error: ${response.status}`, await response.text());
      return null;
    }
    
    const data = await response.json();
    log('Full API Response:', data);
    
    if (data.status !== 'OK') {
      logError(`Geocoding API Error: ${data.status}`, data.error_message || 'No detailed error message provided');
      
      // Additional diagnostics for common error codes
      if (data.status === 'REQUEST_DENIED') {
        log('REQUEST_DENIED Troubleshooting:');
        log('1. Check if the API key is correct');
        log('2. Verify the API key has Geocoding API enabled');
        log('3. Check for billing issues in Google Cloud Console');
        log('4. Verify API restrictions (IP, referrer, etc.)');
      } else if (data.status === 'OVER_QUERY_LIMIT') {
        log('OVER_QUERY_LIMIT Troubleshooting:');
        log('1. Check your daily quota in Google Cloud Console');
        log('2. Implement rate limiting in your application');
      }
      
      return null;
    }
    
    if (!data.results || data.results.length === 0) {
      logError('No results found for this address', null);
      return null;
    }
    
    const result = data.results[0];
    const { lat, lng } = result.geometry.location;
    
    log('Successfully geocoded address!', {
      latitude: lat,
      longitude: lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      locationType: result.geometry.location_type,
      addressComponents: result.address_components.map(comp => ({
        longName: comp.long_name,
        shortName: comp.short_name,
        types: comp.types
      }))
    });
    
    return {
      latitude: lat,
      longitude: lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      logError(`Geocoding request timed out after ${GEOCODE_TIMEOUT_MS}ms`, error);
    } else {
      logError(`Geocoding error: ${error.message}`, error);
    }
    return null;
  }
}

// Check API key format
function validateApiKey(key) {
  if (!key) return false;
  
  // Check if it's a valid Google API key format (typically starts with "AIza")
  if (key.startsWith('AIza') && key.length >= 30) {
    return true;
  }
  
  return false;
}

// Main function
async function main() {
  const startTime = Date.now();
  
  log('GOOGLE MAPS GEOCODING TEST', null);
  
  // Validate environment
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  log('Environment check:');
  log(`- API key present: ${apiKey ? 'Yes' : 'No'}`);
  log(`- API key format valid: ${validateApiKey(apiKey) ? 'Yes' : 'No'}`);
  
  if (!apiKey) {
    logError('Missing Google Maps API key', 'Set GOOGLE_MAPS_API_KEY in your .env file');
    process.exit(1);
  }
  
  if (!validateApiKey(apiKey)) {
    logError('Invalid API key format', 'API key should start with "AIza" and be at least 30 characters');
    process.exit(1);
  }
  
  // Test geocoding
  const result = await geocodeAddress(TEST_ADDRESS);
  
  if (result) {
    log('TEST SUCCESSFUL!', `Successfully geocoded "${TEST_ADDRESS}"`);
  } else {
    logError('TEST FAILED!', `Could not geocode "${TEST_ADDRESS}"`);
  }
  
  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
  log(`Test completed in ${elapsedSeconds}s`);
}

// Run the main function
main().catch(error => {
  logError('Unhandled error in main process', error);
  process.exit(1);
});
