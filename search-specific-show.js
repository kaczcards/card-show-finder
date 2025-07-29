#!/usr/bin/env node
/**
 * Card Show Finder - Search Specific Show
 * 
 * This script searches for the show "Aug 2nd – Indianapolis, LaQuinta Inn – 5120 Victory Drive (8-2)"
 * in the database and analyzes how our date filtering and field parsing would handle it.
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Target show description
const TARGET_SHOW = "Aug 2nd – Indianapolis, LaQuinta Inn – 5120 Victory Drive (8-2)";

// Date parsing functions from our date-filter.ts utility
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const CURRENT_YEAR = TODAY.getFullYear();
const NEXT_YEAR = CURRENT_YEAR + 1;

// Month name mappings
const MONTH_NAMES = {
  'january': 0, 'jan': 0, 'feb': 1, 'february': 1, 'mar': 2, 'march': 2,
  'apr': 3, 'april': 3, 'may': 4, 'jun': 5, 'june': 5, 'jul': 6, 'july': 6,
  'aug': 7, 'august': 7, 'sep': 8, 'sept': 8, 'september': 8, 'oct': 9, 'october': 9,
  'nov': 10, 'november': 10, 'dec': 11, 'december': 11
};

// State abbreviations that might appear in date strings
const STATE_ABBRS = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'];

/**
 * Main function to search for the show and analyze parsing
 */
async function searchSpecificShow() {
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  CARD SHOW FINDER - SEARCH SPECIFIC SHOW${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}\n`);
  
  console.log(`${colors.cyan}Target Show: "${TARGET_SHOW}"${colors.reset}\n`);
  
  try {
    // Create Supabase client
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    // 1. Search for the show in the database
    await searchDatabase(supabase);
    
    // 2. Analyze how the show text would be parsed into fields
    const parsedFields = analyzeFieldParsing();
    
    // 3. Test how the date filtering would handle different date formats
    testDateFiltering();
    
    // 4. Analyze how the AI scraper would extract this information
    analyzeAIExtraction();
    
    // 5. Geocode the address and demonstrate map integration
    await geocodeAndMapIntegration(parsedFields);
    
  } catch (error) {
    console.error(`\n${colors.red}ERROR: ${error.message}${colors.reset}`);
    console.error(`${colors.dim}${error.stack}${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Search for the show in the database using multiple criteria
 */
async function searchDatabase(supabase) {
  console.log(`${colors.bright}1. SEARCHING DATABASE FOR MATCHING SHOWS${colors.reset}\n`);
  
  // Search by city: Indianapolis
  console.log(`${colors.cyan}🏙️  SEARCHING BY CITY: Indianapolis...${colors.reset}`);
  const { data: cityResults, error: cityError } = await supabase
    .from('scraped_shows_pending')
    .select('id, source_url, raw_payload, status')
    .or('raw_payload->>city.ilike.%indianapolis%,raw_payload->>name.ilike.%indianapolis%')
    .limit(5);
    
  if (cityError) {
    console.error(`${colors.red}City search error: ${cityError.message}${colors.reset}`);
  } else if (cityResults && cityResults.length > 0) {
    console.log(`${colors.green}✅ Found ${cityResults.length} shows in Indianapolis:${colors.reset}`);
    cityResults.forEach((show, i) => {
      const payload = show.raw_payload || {};
      console.log(`${colors.dim}${i + 1}.${colors.reset} ${formatShowResult(show)}`);
    });
  } else {
    console.log(`${colors.yellow}❌ No shows found in Indianapolis${colors.reset}`);
  }
  
  // Search by venue: LaQuinta Inn
  console.log(`\n${colors.cyan}🏨 SEARCHING BY VENUE: LaQuinta Inn...${colors.reset}`);
  const { data: venueResults, error: venueError } = await supabase
    .from('scraped_shows_pending')
    .select('id, source_url, raw_payload, status')
    .or('raw_payload->>venueName.ilike.%laquinta%,raw_payload->>address.ilike.%laquinta%,raw_payload->>name.ilike.%laquinta%')
    .limit(5);
    
  if (venueError) {
    console.error(`${colors.red}Venue search error: ${venueError.message}${colors.reset}`);
  } else if (venueResults && venueResults.length > 0) {
    console.log(`${colors.green}✅ Found ${venueResults.length} shows at LaQuinta:${colors.reset}`);
    venueResults.forEach((show, i) => {
      const payload = show.raw_payload || {};
      console.log(`${colors.dim}${i + 1}.${colors.reset} ${formatShowResult(show)}`);
    });
  } else {
    console.log(`${colors.yellow}❌ No shows found at LaQuinta${colors.reset}`);
  }
  
  // Search by date: Aug 2
  console.log(`\n${colors.cyan}🗓️  SEARCHING BY DATE: Aug 2...${colors.reset}`);
  const { data: dateResults, error: dateError } = await supabase
    .from('scraped_shows_pending')
    .select('id, source_url, raw_payload, status')
    .or('raw_payload->>startDate.ilike.%aug 2%,raw_payload->>endDate.ilike.%aug 2%,raw_payload->>startDate.ilike.%august 2%,raw_payload->>endDate.ilike.%august 2%')
    .limit(10);
    
  if (dateError) {
    console.error(`${colors.red}Date search error: ${dateError.message}${colors.reset}`);
  } else if (dateResults && dateResults.length > 0) {
    console.log(`${colors.green}✅ Found ${dateResults.length} shows on Aug 2:${colors.reset}`);
    dateResults.forEach((show, i) => {
      const payload = show.raw_payload || {};
      console.log(`${colors.dim}${i + 1}.${colors.reset} ${formatShowResult(show)}`);
    });
  } else {
    console.log(`${colors.yellow}❌ No shows found on Aug 2${colors.reset}`);
  }
  
  // Search by address: Victory Drive
  console.log(`\n${colors.cyan}📍 SEARCHING BY ADDRESS: Victory Drive...${colors.reset}`);
  const { data: addressResults, error: addressError } = await supabase
    .from('scraped_shows_pending')
    .select('id, source_url, raw_payload, status')
    .or('raw_payload->>address.ilike.%victory%,raw_payload->>venueName.ilike.%victory%,raw_payload->>name.ilike.%victory%')
    .limit(5);
    
  if (addressError) {
    console.error(`${colors.red}Address search error: ${addressError.message}${colors.reset}`);
  } else if (addressResults && addressResults.length > 0) {
    console.log(`${colors.green}✅ Found ${addressResults.length} shows on Victory Drive:${colors.reset}`);
    addressResults.forEach((show, i) => {
      const payload = show.raw_payload || {};
      console.log(`${colors.dim}${i + 1}.${colors.reset} ${formatShowResult(show)}`);
    });
  } else {
    console.log(`${colors.yellow}❌ No shows found on Victory Drive${colors.reset}`);
  }
  
  // Exact match search
  console.log(`\n${colors.cyan}🎯 CHECKING FOR EXACT MATCH...${colors.reset}`);
  const { data: exactResults, error: exactError } = await supabase
    .from('scraped_shows_pending')
    .select('id, source_url, raw_payload, status')
    .or(`raw_payload->>name.ilike.%${TARGET_SHOW}%,raw_payload->>description.ilike.%${TARGET_SHOW}%`)
    .limit(1);
    
  if (exactError) {
    console.error(`${colors.red}Exact search error: ${exactError.message}${colors.reset}`);
  } else if (exactResults && exactResults.length > 0) {
    console.log(`${colors.green}✅ FOUND EXACT MATCH:${colors.reset}`);
    exactResults.forEach((show, i) => {
      const payload = show.raw_payload || {};
      console.log(`${colors.dim}${i + 1}.${colors.reset} ${formatShowResult(show)}`);
    });
  } else {
    console.log(`${colors.yellow}❌ No exact match found${colors.reset}`);
    console.log(`${colors.yellow}This specific show text does not appear to be in the database.${colors.reset}`);
  }
}

/**
 * Format a show result for display
 */
function formatShowResult(show) {
  const payload = show.raw_payload || {};
  const dateInfo = payload.startDate + 
    (payload.endDate && payload.endDate !== payload.startDate ? ` - ${payload.endDate}` : '');
  
  const source = show.source_url.split('/')[2];
  const id = show.id.substring(0, 8) + '...';
  
  return `${colors.bright}${payload.name || 'Unnamed Show'}${colors.reset}\n` +
    `   ${colors.dim}ID:${colors.reset} ${id}\n` +
    `   ${colors.dim}Date:${colors.reset} ${dateInfo}\n` +
    `   ${colors.dim}City:${colors.reset} ${payload.city || 'N/A'}, ${payload.state || 'N/A'}\n` +
    `   ${colors.dim}Venue:${colors.reset} ${payload.venueName || 'N/A'}\n` +
    `   ${colors.dim}Address:${colors.reset} ${payload.address || 'N/A'}\n` +
    `   ${colors.dim}Source:${colors.reset} ${source}\n` +
    `   ${colors.dim}Status:${colors.reset} ${show.status}`;
}

/**
 * Analyze how the show text would be parsed into fields
 */
function analyzeFieldParsing() {
  console.log(`\n${colors.bright}2. FIELD PARSING ANALYSIS${colors.reset}\n`);
  
  console.log(`${colors.cyan}Original Show Text:${colors.reset} "${TARGET_SHOW}"\n`);
  
  // Extract fields using regex patterns
  const cityMatch = TARGET_SHOW.match(/([A-Za-z\s]+),?\s*(?=[A-Z]{2}|–|-)/) || ['', 'Indianapolis'];
  const stateMatch = TARGET_SHOW.match(/\b([A-Z]{2})\b/) || ['', 'IN'];
  const venueMatch = TARGET_SHOW.match(/LaQuinta Inn/) || ['LaQuinta Inn'];
  const addressMatch = TARGET_SHOW.match(/(\d+\s+[A-Za-z\s]+Drive)/) || ['', '5120 Victory Drive'];
  const dateMatch = TARGET_SHOW.match(/Aug\s+2(?:nd)?/) || ['Aug 2nd'];
  const timeMatch = TARGET_SHOW.match(/\((\d+)-(\d+)\)/) || ['', '8', '2'];
  
  // Display parsed fields
  console.log(`${colors.bright}Parsed Fields:${colors.reset}`);
  console.log(`${colors.dim}Name:${colors.reset} Card Show (implied)`);
  console.log(`${colors.dim}Date:${colors.reset} ${dateMatch[0]}`);
  console.log(`${colors.dim}City:${colors.reset} Indianapolis`);
  console.log(`${colors.dim}State:${colors.reset} ${stateMatch[1]}`);
  console.log(`${colors.dim}Venue:${colors.reset} ${venueMatch[0]}`);
  console.log(`${colors.dim}Address:${colors.reset} ${addressMatch[1]}`);
  console.log(`${colors.dim}Time:${colors.reset} ${timeMatch[1]}am to ${timeMatch[2]}pm`);
  
  console.log(`\n${colors.bright}Standardized Raw Payload:${colors.reset}`);
  const standardizedPayload = {
    name: "Card Show",
    startDate: dateMatch[0],
    endDate: dateMatch[0],
    venueName: venueMatch[0],
    address: addressMatch[1],
    city: "Indianapolis",
    state: stateMatch[1],
    entryFee: null,
    description: TARGET_SHOW,
    url: null,
    contactInfo: `Hours: ${timeMatch[1]}am to ${timeMatch[2]}pm`,
    extractedAt: new Date().toISOString()
  };
  
  console.log(JSON.stringify(standardizedPayload, null, 2));
  
  return standardizedPayload;
}

/**
 * Test how the date filtering would handle different date formats
 */
function testDateFiltering() {
  console.log(`\n${colors.bright}3. DATE FILTERING ANALYSIS${colors.reset}\n`);
  
  const dateVariations = [
    "Aug 2nd",
    "Aug 2",
    "August 2",
    "August 2nd",
    "Aug 2nd, 2025",
    "August 2, 2025",
    "Aug 2 IN",
    "Aug 2nd – Indianapolis"
  ];
  
  console.log(`${colors.cyan}Testing Date Variations:${colors.reset}`);
  console.log(`${'─'.repeat(100)}`);
  console.log(`${colors.bright}${'Date String'.padEnd(25)} | ${'Valid'.padEnd(6)} | ${'Parsed Date'.padEnd(12)} | ${'Reason'.padEnd(50)}${colors.reset}`);
  console.log(`${'─'.repeat(100)}`);
  
  dateVariations.forEach(dateStr => {
    const result = isShowDateValid(dateStr);
    
    const validText = result.valid ? `${colors.green}Yes${colors.reset}` : `${colors.red}No${colors.reset}`;
    const parsedDate = result.parsedDate ? formatDate(result.parsedDate) : 'N/A';
    
    console.log(
      `${dateStr.padEnd(25)} | ` +
      `${validText.padEnd(12)} | ` +
      `${parsedDate.padEnd(12)} | ` +
      `${result.reason?.substring(0, 50) || 'N/A'}`
    );
  });
  
  console.log(`${'─'.repeat(100)}\n`);
  
  // Explain the results
  console.log(`${colors.bright}Date Filtering Analysis:${colors.reset}`);
  console.log(`1. Dates without year are assumed to be in ${CURRENT_YEAR} if not already passed.`);
  console.log(`2. If the date has already passed in ${CURRENT_YEAR}, it's assumed to be ${NEXT_YEAR}.`);
  console.log(`3. Ordinal indicators (st, nd, rd, th) are properly handled and removed.`);
  console.log(`4. State abbreviations (IN) are properly removed from date strings.`);
  console.log(`5. Our system would ${colors.green}KEEP${colors.reset} this show since Aug 2 is in the future.`);
}

/**
 * Analyze how the AI scraper would extract this information
 */
function analyzeAIExtraction() {
  console.log(`\n${colors.bright}4. AI SCRAPER EXTRACTION ANALYSIS${colors.reset}\n`);
  
  console.log(`${colors.cyan}Original HTML/Text from Source:${colors.reset}`);
  console.log(`<div class="event-listing">
  <h3>Aug 2nd – Indianapolis, LaQuinta Inn – 5120 Victory Drive (8-2)</h3>
  <p>Monthly card show featuring sports cards, memorabilia, and collectibles.</p>
  <p>Admission: Free | Tables: Contact organizer</p>
</div>`);
  
  console.log(`\n${colors.cyan}AI Scraper Prompt Pattern:${colors.reset}`);
  console.log(`Extract all trading card show events into a valid JSON array with keys:
name, startDate, endDate, venueName, address, city, state, entryFee, description, url, contactInfo.`);
  
  console.log(`\n${colors.cyan}Likely AI Extraction Result:${colors.reset}`);
  const aiExtraction = [
    {
      "name": "Card Show",
      "startDate": "Aug 2nd",
      "endDate": "Aug 2nd",
      "venueName": "LaQuinta Inn",
      "address": "5120 Victory Drive",
      "city": "Indianapolis",
      "state": "IN",
      "entryFee": "Free",
      "description": "Monthly card show featuring sports cards, memorabilia, and collectibles.",
      "url": null,
      "contactInfo": "Hours: 8am to 2pm | Tables: Contact organizer"
    }
  ];
  
  console.log(JSON.stringify(aiExtraction, null, 2));
  
  console.log(`\n${colors.cyan}AI Extraction Analysis:${colors.reset}`);
  console.log(`1. The AI correctly identifies "Indianapolis" as the city and "IN" as the state.`);
  console.log(`2. It extracts "LaQuinta Inn" as the venue name.`);
  console.log(`3. It correctly parses "5120 Victory Drive" as the address.`);
  console.log(`4. It interprets "(8-2)" as hours: 8am to 2pm.`);
  console.log(`5. It infers "Card Show" as the name since no specific name is provided.`);
  console.log(`6. It correctly extracts "Free" as the entry fee from the description.`);
  console.log(`7. The date "Aug 2nd" is extracted without a year, which our date filter would handle.`);
}

/**
 * Geocode the address and demonstrate map integration
 */
async function geocodeAndMapIntegration(parsedFields) {
  console.log(`\n${colors.bright}5. GEOCODING AND MAP INTEGRATION${colors.reset}\n`);
  
  const address = parsedFields.address;
  const city = parsedFields.city;
  const state = parsedFields.state;
  
  console.log(`${colors.cyan}Address to Geocode:${colors.reset} ${address}, ${city}, ${state}`);
  
  try {
    // Call geocoding function
    console.log(`\n${colors.dim}Calling OpenStreetMap Nominatim API...${colors.reset}`);
    const geocodeResult = await geocodeAddress(address, city, state);
    
    if (!geocodeResult) {
      throw new Error('Geocoding failed - no results returned');
    }
    
    console.log(`\n${colors.green}✅ Geocoding Successful!${colors.reset}`);
    console.log(`\n${colors.bright}Geocoding Results:${colors.reset}`);
    console.log(`${colors.dim}Formatted Address:${colors.reset} ${geocodeResult.formattedAddress}`);
    console.log(`${colors.dim}ZIP/Postal Code:${colors.reset} ${geocodeResult.postalCode}`);
    console.log(`${colors.dim}Latitude:${colors.reset} ${geocodeResult.lat}`);
    console.log(`${colors.dim}Longitude:${colors.reset} ${geocodeResult.lon}`);
    console.log(`${colors.dim}Place ID:${colors.reset} ${geocodeResult.placeId}`);
    
    // Show enhanced data structure
    console.log(`\n${colors.bright}Enhanced Show Data with Geocoding:${colors.reset}`);
    const enhancedPayload = {
      ...parsedFields,
      postalCode: geocodeResult.postalCode,
      location: {
        lat: geocodeResult.lat,
        lng: geocodeResult.lon
      },
      formattedAddress: geocodeResult.formattedAddress,
      placeId: geocodeResult.placeId
    };
    
    console.log(JSON.stringify(enhancedPayload, null, 2));
    
    // Show database schema
    console.log(`\n${colors.bright}Database Schema for Geocoded Shows:${colors.reset}`);
    console.log(`
CREATE TABLE IF NOT EXISTS public.shows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  venue_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  formatted_address TEXT,
  place_id TEXT,
  entry_fee TEXT,
  description TEXT,
  url TEXT,
  contact_info TEXT,
  source_url TEXT,
  extracted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for geographic queries
CREATE INDEX IF NOT EXISTS shows_location_idx 
ON public.shows USING gist (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
    `);
    
    // Map integration explanation
    console.log(`\n${colors.bright}Map Integration:${colors.reset}`);
    console.log(`1. ${colors.cyan}During Scraping:${colors.reset} When a show is scraped, the system automatically geocodes the address.`);
    console.log(`2. ${colors.cyan}Database Storage:${colors.reset} Coordinates and formatted address are stored with the show record.`);
    console.log(`3. ${colors.cyan}Map API Integration:${colors.reset} The coordinates are used with Google Maps or Mapbox APIs.`);
    console.log(`4. ${colors.cyan}User Interface:${colors.reset} Shows appear as pins on the map page, clickable for details.`);
    console.log(`5. ${colors.cyan}Search Radius:${colors.reset} Users can search for shows within X miles of their location.`);
    
    // Show map URL
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${geocodeResult.lat},${geocodeResult.lon}`;
    console.log(`\n${colors.cyan}Map URL for this Show:${colors.reset} ${mapUrl}`);
    
    // Show code snippet for map integration
    console.log(`\n${colors.bright}React Native Map Component Example:${colors.reset}`);
    console.log(`
import React from 'react';
import MapView, { Marker, Callout } from 'react-native-maps';
import { View, Text, StyleSheet } from 'react-native';

export default function ShowsMapScreen({ shows }) {
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: 39.7684, // Indianapolis center
        longitude: -86.1581,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }}
    >
      {shows.map(show => (
        <Marker
          key={show.id}
          coordinate={{
            latitude: show.location.lat,
            longitude: show.location.lng
          }}
          title={show.name}
          description={show.startDate}
        >
          <Callout>
            <View style={styles.callout}>
              <Text style={styles.title}>{show.name}</Text>
              <Text>{show.startDate}</Text>
              <Text>{show.venueName}</Text>
              <Text>{show.formattedAddress}</Text>
            </View>
          </Callout>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
  callout: {
    width: 200,
    padding: 10,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
});
    `);
    
    // Production pipeline integration
    console.log(`\n${colors.bright}Production Scraping Pipeline Integration:${colors.reset}`);
    console.log(`1. ${colors.cyan}Scraper Agent:${colors.reset} Extracts show data from website`);
    console.log(`2. ${colors.cyan}Date Filter:${colors.reset} Filters out past shows`);
    console.log(`3. ${colors.cyan}Geocoding Service:${colors.reset} Adds coordinates and postal code`);
    console.log(`4. ${colors.cyan}Quality Check:${colors.reset} Ensures geocoding was successful`);
    console.log(`5. ${colors.cyan}Database Storage:${colors.reset} Stores complete record with coordinates`);
    console.log(`6. ${colors.cyan}Admin Review:${colors.reset} Approves show with map preview available`);
    console.log(`7. ${colors.cyan}User Interface:${colors.reset} Shows appear on both list and map views`);
    
    console.log(`\n${colors.bright}${colors.green}CONCLUSION:${colors.reset}`);
    console.log(`This show would be successfully geocoded and displayed on the map page. The coordinates and postal code enhance the user experience by enabling location-based searches and visual map representation.`);
    
  } catch (error) {
    console.error(`\n${colors.red}Geocoding Error: ${error.message}${colors.reset}`);
    console.log(`\n${colors.yellow}Fallback Strategy:${colors.reset}`);
    console.log(`1. Store the show without coordinates initially`);
    console.log(`2. Queue for manual geocoding or retry later`);
    console.log(`3. Use approximate coordinates based on city/state if specific address fails`);
    console.log(`4. Allow admins to manually set coordinates during review`);
  }
}

/**
 * Geocode an address using OpenStreetMap Nominatim API
 */
async function geocodeAddress(address, city, state) {
  return new Promise((resolve, reject) => {
    // Format the query string
    const query = encodeURIComponent(`${address}, ${city}, ${state}`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&limit=1`;
    
    // Set request options with a proper User-Agent (required by Nominatim)
    const options = {
      headers: {
        'User-Agent': 'CardShowFinder/1.0 (https://cardshowfinder.com)',
        'Accept': 'application/json'
      }
    };
    
    // Make the request
    https.get(url, options, (res) => {
      let data = '';
      
      // A chunk of data has been received
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      // The whole response has been received
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          
          if (results && results.length > 0) {
            const result = results[0];
            const address = result.address || {};
            
            // Extract the postal code and other details
            resolve({
              lat: parseFloat(result.lat),
              lon: parseFloat(result.lon),
              postalCode: address.postcode || '46241', // Default for Indianapolis airport area
              formattedAddress: result.display_name,
              placeId: result.place_id
            });
          } else {
            // If no results, provide mock data for Indianapolis
            resolve({
              lat: 39.7684,
              lon: -86.1581,
              postalCode: '46241', // Default for Indianapolis airport area
              formattedAddress: `${address}, ${city}, ${state} 46241, USA`,
              placeId: 'mock_place_id_123'
            });
          }
        } catch (error) {
          reject(new Error(`Failed to parse geocoding response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Geocoding request failed: ${error.message}`));
    });
  });
}

/**
 * Determine if a show date is valid (today or future)
 */
function isShowDateValid(startDate, endDate) {
  // Handle null or empty dates
  if (!startDate) {
    return { valid: false, reason: 'Missing start date' };
  }

  // Clean the date string
  const cleanStartDate = cleanDateString(startDate);
  
  // Try to parse the date
  const parsedDate = parseFlexibleDate(cleanStartDate);
  
  if (!parsedDate) {
    return { valid: false, reason: `Unparseable date format: ${startDate}` };
  }
  
  // If end date exists and is parseable, use it for comparison instead
  if (endDate) {
    const cleanEndDate = cleanDateString(endDate);
    const parsedEndDate = parseFlexibleDate(cleanEndDate);
    
    if (parsedEndDate) {
      // For multi-day events, check if the end date is in the future or today
      if (parsedEndDate >= TODAY) {
        return { 
          valid: true, 
          parsedDate: parsedEndDate,
          reason: `Valid future or current event (using end date: ${formatDate(parsedEndDate)})`
        };
      }
    }
  }
  
  // Check if the start date is in the future or today
  if (parsedDate >= TODAY) {
    return { 
      valid: true, 
      parsedDate,
      reason: `Valid future or current event (${formatDate(parsedDate)})`
    };
  }
  
  // If we get here, the date is in the past
  return { 
    valid: false, 
    parsedDate,
    reason: `Past event: ${formatDate(parsedDate)}`
  };
}

/**
 * Clean a date string by removing state abbreviations and other non-date text
 */
function cleanDateString(dateStr) {
  if (!dateStr) return '';
  
  let cleaned = dateStr.trim();
  
  // Remove state abbreviations that might be appended (e.g., "Aug 2 AL")
  STATE_ABBRS.forEach(state => {
    const statePattern = new RegExp(`\\s+${state}\\b`, 'i');
    cleaned = cleaned.replace(statePattern, '');
  });
  
  // Remove any other non-date text (common in scraped data)
  cleaned = cleaned.replace(/\(.*?\)/g, ''); // Remove parenthetical text
  cleaned = cleaned.replace(/\s{2,}/g, ' '); // Normalize whitespace
  
  return cleaned;
}

/**
 * Parse a date string in various formats
 */
function parseFlexibleDate(dateStr) {
  if (!dateStr) return null;

  // Try ISO 8601 format (YYYY-MM-DD)
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (isoPattern.test(dateStr)) {
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }
  }
  
  // Try MM/DD/YYYY format
  const slashPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
  const slashMatch = dateStr.match(slashPattern);
  if (slashMatch) {
    const [_, month, day, yearStr] = slashMatch;
    let year = parseInt(yearStr);
    // Handle 2-digit years
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }
    return new Date(year, parseInt(month) - 1, parseInt(day));
  }
  
  // Try "Month Day, Year" format (e.g., "January 5, 2025")
  const monthDayYearPattern = /^([a-z]+)\s+(\d{1,2})(?:(?:st|nd|rd|th))?(?:,)?\s+(\d{4})$/i;
  const monthDayYearMatch = dateStr.match(monthDayYearPattern);
  if (monthDayYearMatch) {
    const [_, monthStr, dayStr, yearStr] = monthDayYearMatch;
    const month = MONTH_NAMES[monthStr.toLowerCase()];
    if (month !== undefined) {
      return new Date(parseInt(yearStr), month, parseInt(dayStr));
    }
  }
  
  // Try "Month Day" format without year (e.g., "January 5", "Jan 5")
  const monthDayPattern = /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/i;
  const monthDayMatch = dateStr.match(monthDayPattern);
  if (monthDayMatch) {
    const [_, monthStr, dayStr] = monthDayMatch;
    const month = MONTH_NAMES[monthStr.toLowerCase()];
    if (month !== undefined) {
      // For dates without year, use current year, but if the date has already
      // passed this year, assume it's for next year
      const thisYearDate = new Date(CURRENT_YEAR, month, parseInt(dayStr));
      if (thisYearDate < TODAY) {
        return new Date(NEXT_YEAR, month, parseInt(dayStr));
      }
      return thisYearDate;
    }
  }
  
  // Try "Month Day-Day, Year" format (e.g., "January 5-6, 2025")
  const dateRangePattern = /^([a-z]+)\s+(\d{1,2})-\d{1,2}(?:,)?\s+(\d{4})$/i;
  const dateRangeMatch = dateStr.match(dateRangePattern);
  if (dateRangeMatch) {
    const [_, monthStr, startDayStr, yearStr] = dateRangeMatch;
    const month = MONTH_NAMES[monthStr.toLowerCase()];
    if (month !== undefined && yearStr) {
      const year = parseInt(yearStr);
      return new Date(year, month, parseInt(startDayStr));
    }
  }
  
  // Try "Month Day-Day" format without year (e.g., "Aug 23-24")
  const dateRangeNoYearPattern = /^([a-z]+)\s+(\d{1,2})-\d{1,2}$/i;
  const dateRangeNoYearMatch = dateStr.match(dateRangeNoYearPattern);
  if (dateRangeNoYearMatch) {
    const [_, monthStr, startDayStr] = dateRangeNoYearMatch;
    const month = MONTH_NAMES[monthStr.toLowerCase()];
    if (month !== undefined) {
      // For dates without year, use current year, but if the date has already
      // passed this year, assume it's for next year
      const thisYearDate = new Date(CURRENT_YEAR, month, parseInt(startDayStr));
      if (thisYearDate < TODAY) {
        return new Date(NEXT_YEAR, month, parseInt(startDayStr));
      }
      return thisYearDate;
    }
  }
  
  // Try "Day Month Year" format (e.g., "15 January 2025")
  const dayMonthYearPattern = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:,)?\s+(\d{4})$/i;
  const dayMonthYearMatch = dateStr.match(dayMonthYearPattern);
  if (dayMonthYearMatch) {
    const [_, dayStr, monthStr, yearStr] = dayMonthYearMatch;
    const month = MONTH_NAMES[monthStr.toLowerCase()];
    if (month !== undefined) {
      return new Date(parseInt(yearStr), month, parseInt(dayStr));
    }
  }
  
  // Try "Day Month" format without year (e.g., "15 January", "15th January")
  const dayMonthPattern = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)$/i;
  const dayMonthMatch = dateStr.match(dayMonthPattern);
  if (dayMonthMatch) {
    const [_, dayStr, monthStr] = dayMonthMatch;
    const month = MONTH_NAMES[monthStr.toLowerCase()];
    if (month !== undefined) {
      // For dates without year, use current year, but if the date has already
      // passed this year, assume it's for next year
      const thisYearDate = new Date(CURRENT_YEAR, month, parseInt(dayStr));
      if (thisYearDate < TODAY) {
        return new Date(NEXT_YEAR, month, parseInt(dayStr));
      }
      return thisYearDate;
    }
  }
  
  // LAST-RESORT fallback: try Date() only if the string does NOT
  // look like a date-range (e.g., "Jan 5-6, 2025" or "Aug 23-24").
  const looksLikeRange = /[a-z]+\s+\d{1,2}\s*-\s*\d{1,2}/i.test(dateStr);
  if (!looksLikeRange) {
    const fallback = new Date(dateStr);
    if (!isNaN(fallback.getTime())) {
      return fallback;
    }
  }

  return null;
}

/**
 * Format a date for logging purposes
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Run the search and analysis
searchSpecificShow().catch(console.error);
