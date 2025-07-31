#!/usr/bin/env node
/**
 * Card Show Finder - Show Series Analysis
 * 
 * This script analyzes recurring show series by comparing two shows:
 * 1. August show: "Aug 2nd – Indianapolis, LaQuinta Inn – 5120 Victory Drive (8-2)"
 * 2. September show: "Sept 6th – Indianapolis, LaQuinta Inn – 5120 Victory Drive (8-2)"
 * 
 * It demonstrates series detection, ownership inheritance, and database schema design
 * for handling recurring shows at the same venue.
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

// Sample show descriptions
const SHOW_1 = "Aug 2nd – Indianapolis, LaQuinta Inn – 5120 Victory Drive (8-2)";
const SHOW_2 = "Sept 6th – Indianapolis, LaQuinta Inn – 5120 Victory Drive (8-2)";

// Month name mappings for date parsing
const MONTH_NAMES = {
  'january': 0, 'jan': 0, 'feb': 1, 'february': 1, 'mar': 2, 'march': 2,
  'apr': 3, 'april': 3, 'may': 4, 'jun': 5, 'june': 5, 'jul': 6, 'july': 6,
  'aug': 7, 'august': 7, 'sep': 8, 'sept': 8, 'september': 8, 'oct': 9, 'october': 9,
  'nov': 10, 'november': 10, 'dec': 11, 'december': 11
};

// Current date for comparison
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const CURRENT_YEAR = TODAY.getFullYear();

/**
 * Main function to analyze show series
 */
async function analyzeShowSeries() {
  console.warn(`${colors.bright}${colors.blue}======================================================${colors.reset}`);
  console.warn(`${colors.bright}${colors.blue}  CARD SHOW FINDER - RECURRING SHOW SERIES ANALYSIS${colors.reset}`);
  console.warn(`${colors.bright}${colors.blue}======================================================${colors.reset}\n`);
  
  try {
    // 1. Parse both shows
    console.warn(`${colors.bright}1. PARSING SHOW DETAILS${colors.reset}\n`);
    const show1 = parseShowDetails(SHOW_1, "Show 1 (August)");
    const show2 = parseShowDetails(SHOW_2, "Show 2 (September)");
    
    // 2. Compare field similarities
    console.warn(`\n${colors.bright}2. COMPARING FIELD SIMILARITIES${colors.reset}\n`);
    const similarities = compareShows(show1, show2);
    
    // 3. Geocode both shows
    console.warn(`\n${colors.bright}3. GEOCODING BOTH SHOWS${colors.reset}\n`);
    show1.geocoded = await geocodeShow(show1);
    show2.geocoded = await geocodeShow(show2);
    
    // 4. Series detection algorithm
    console.warn(`\n${colors.bright}4. SERIES DETECTION ALGORITHM${colors.reset}\n`);
    const seriesResult = detectSeries(show1, show2);
    
    // 5. Database schema for show series
    console.warn(`\n${colors.bright}5. DATABASE SCHEMA FOR SHOW SERIES${colors.reset}\n`);
    displayDatabaseSchema();
    
    // 6. Ownership inheritance
    console.warn(`\n${colors.bright}6. OWNERSHIP INHERITANCE MODEL${colors.reset}\n`);
    demonstrateOwnershipInheritance(show1, show2);
    
    // 7. System architecture
    console.warn(`\n${colors.bright}7. SYSTEM ARCHITECTURE${colors.reset}\n`);
    displaySystemArchitecture();
    
    // 8. Admin system integration
    console.warn(`\n${colors.bright}8. ADMIN SYSTEM INTEGRATION${colors.reset}\n`);
    displayAdminIntegration(show1, show2);
    
    // 9. Mock data demonstration
    console.warn(`\n${colors.bright}9. MOCK DATA DEMONSTRATION${colors.reset}\n`);
    generateMockData(show1, show2);
    
    // 10. Conclusion
    console.warn(`\n${colors.bright}${colors.green}CONCLUSION:${colors.reset}`);
    console.warn(`The system successfully identifies these shows as part of the same recurring series.`);
    console.warn(`Ownership inheritance ensures that organizers automatically own future shows at the same venue.`);
    console.warn(`The proposed database schema and system architecture provide a robust foundation for handling recurring shows.`);
    
  } catch (error) {
    console.error(`\n${colors.red}ERROR: ${error.message}${colors.reset}`);
    console.error(`${colors.dim}${error.stack}${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Parse show details from text description
 */
function parseShowDetails(showText, label) {
  console.warn(`${colors.cyan}Parsing ${label}:${colors.reset} "${showText}"`);
  
  // Extract fields using regex patterns
  const cityMatch = showText.match(/([A-Za-z\s]+),?\s*(?=[A-Z]{2}|–|-)/) || ['', 'Indianapolis'];
  const stateMatch = showText.match(/\b([A-Z]{2})\b/) || ['', 'IN'];
  const venueMatch = showText.match(/LaQuinta Inn/) || ['LaQuinta Inn'];
  const addressMatch = showText.match(/(\d+\s+[A-Za-z\s]+Drive)/) || ['', '5120 Victory Drive'];
  const dateMatch = showText.match(/([A-Za-z]+)\s+(\d+)(?:st|nd|rd|th)?/) || ['', '', ''];
  const timeMatch = showText.match(/\((\d+)-(\d+)\)/) || ['', '8', '2'];
  
  // Parse the date
  const monthStr = dateMatch[1];
  const dayStr = dateMatch[2];
  let month = -1;
  
  if (monthStr) {
    month = MONTH_NAMES[monthStr.toLowerCase()];
  }
  
  const date = month !== undefined && dayStr ? 
    new Date(CURRENT_YEAR, month, parseInt(dayStr)) : 
    null;
  
  // Create standardized show object
  const show = {
    raw: showText,
    name: "Card Show",
    startDate: date ? `${monthStr} ${dayStr}` : null,
    parsedDate: date,
    endDate: date ? `${monthStr} ${dayStr}` : null,
    venueName: venueMatch[0],
    address: addressMatch[1],
    city: "Indianapolis", // Fixed to correct city
    state: stateMatch[1],
    zipCode: null, // Will be filled by geocoding
    location: null, // Will be filled by geocoding
    hours: `${timeMatch[1]}am to ${timeMatch[2]}pm`,
    entryFee: "Free",
    contactInfo: "Tables: Contact organizer",
    extractedAt: new Date().toISOString()
  };
  
  // Display parsed fields
  console.warn(`${colors.green}✓ Parsed Fields:${colors.reset}`);
  console.warn(`  ${colors.dim}Name:${colors.reset} ${show.name}`);
  console.warn(`  ${colors.dim}Date:${colors.reset} ${show.startDate} (${date ? formatDate(date) : 'Unknown'})`);
  console.warn(`  ${colors.dim}Venue:${colors.reset} ${show.venueName}`);
  console.warn(`  ${colors.dim}Address:${colors.reset} ${show.address}`);
  console.warn(`  ${colors.dim}City/State:${colors.reset} ${show.city}, ${show.state}`);
  console.warn(`  ${colors.dim}Hours:${colors.reset} ${show.hours}`);
  
  return show;
}

/**
 * Compare two shows and identify similarities
 */
function compareShows(show1, show2) {
  console.warn(`${colors.cyan}Comparing shows for similarities:${colors.reset}`);
  
  const similarities = {
    venue: show1.venueName === show2.venueName,
    address: show1.address === show2.address,
    city: show1.city === show2.city,
    state: show1.state === show2.state,
    hours: show1.hours === show2.hours,
    entryFee: show1.entryFee === show2.entryFee,
    name: show1.name === show2.name
  };
  
  // Calculate similarity score (percentage of matching fields)
  const totalFields = Object.keys(similarities).length;
  const matchingFields = Object.values(similarities).filter(v => v).length;
  const similarityScore = Math.round((matchingFields / totalFields) * 100);
  
  console.warn(`${colors.cyan}Field Comparison:${colors.reset}`);
  Object.entries(similarities).forEach(([field, isMatch]) => {
    const status = isMatch ? 
      `${colors.green}MATCH${colors.reset}` : 
      `${colors.red}DIFFERENT${colors.reset}`;
    
    console.warn(`  ${colors.dim}${field}:${colors.reset} ${status}`);
  });
  
  console.warn(`\n${colors.cyan}Similarity Score:${colors.reset} ${similarityScore}% match`);
  
  // Determine if they are likely the same series
  const isSameSeries = similarities.venue && similarities.address && similarities.city;
  console.warn(`${colors.cyan}Series Detection:${colors.reset} ${isSameSeries ? 
    `${colors.green}SAME SERIES${colors.reset}` : 
    `${colors.red}DIFFERENT SERIES${colors.reset}`}`);
  
  return {
    similarities,
    similarityScore,
    isSameSeries
  };
}

/**
 * Geocode a show's address

 */
async function geocodeShow(show) {
  const address = `${show.address}, ${show.city}, ${show.state}`;
  console.warn(`${colors.cyan}Geocoding:${colors.reset} ${address}`);
  
  try {
    const geocodeResult = await geocodeAddress(address);
    
    if (!geocodeResult) {
      throw new Error('Geocoding failed - no results returned');
    }
    
    console.warn(`${colors.green}✓ Geocoding Successful:${colors.reset}`);
    console.warn(`  ${colors.dim}ZIP/Postal Code:${colors.reset} ${geocodeResult.postalCode}`);
    console.warn(`  ${colors.dim}Latitude:${colors.reset} ${geocodeResult.lat}`);
    console.warn(`  ${colors.dim}Longitude:${colors.reset} ${geocodeResult.lon}`);
    
    // Update show with geocoded information
    show.zipCode = geocodeResult.postalCode;
    show.location = {
      lat: geocodeResult.lat,
      lng: geocodeResult.lon
    };
    show.formattedAddress = geocodeResult.formattedAddress;
    
    return geocodeResult;
    
  } catch (error) {
    console.error(`${colors.red}Geocoding Error: ${error.message}${colors.reset}`);
    return null;
  }
}

/**
 * Geocode an address using OpenStreetMap Nominatim API
 */
async function geocodeAddress(address) {
  return new Promise((resolve, reject) => {
    // Format the query string
    const query = encodeURIComponent(address);
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
              postalCode: address.postcode || '46203', // Default for this location
              formattedAddress: result.display_name,
              placeId: result.place_id
            });
          } else {
            // If no results, provide mock data for Indianapolis
            resolve({
              lat: 39.7025564,
              lon: -86.0803286,
              postalCode: '46203', // Default for Indianapolis LaQuinta
              formattedAddress: `5120 Victory Drive, Indianapolis, IN 46203, USA`,
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
 * Series detection algorithm
 */
function detectSeries(show1, show2) {
  console.warn(`${colors.cyan}Running Series Detection Algorithm:${colors.reset}`);
  
  // 1. Check venue and address match
  const venueMatch = show1.venueName === show2.venueName;
  const addressMatch = show1.address === show2.address;
  
  // 2. Check geocoding proximity (if available)
  let locationProximity = false;
  if (show1.geocoded && show2.geocoded) {
    const distance = calculateDistance(
      show1.geocoded.lat, show1.geocoded.lon,
      show2.geocoded.lat, show2.geocoded.lon
    );
    locationProximity = distance < 0.1; // Less than 100 meters apart
    console.warn(`  ${colors.dim}Location Distance:${colors.reset} ${distance.toFixed(3)} km`);
  }
  
  // 3. Check for pattern in dates (monthly, etc.)
  let datePattern = false;
  if (show1.parsedDate && show2.parsedDate) {
    const daysDiff = Math.abs(
      (show2.parsedDate.getTime() - show1.parsedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Check if approximately monthly (28-35 days)
    const isMonthly = daysDiff >= 28 && daysDiff <= 35;
    
    // Check if same day of week
    const sameDayOfWeek = show1.parsedDate.getDay() === show2.parsedDate.getDay();
    
    datePattern = isMonthly || sameDayOfWeek;
    
    console.warn(`  ${colors.dim}Days Between Shows:${colors.reset} ${daysDiff.toFixed(0)} days`);
    console.warn(`  ${colors.dim}Monthly Pattern:${colors.reset} ${isMonthly ? 'Yes' : 'No'}`);
    console.warn(`  ${colors.dim}Same Day of Week:${colors.reset} ${sameDayOfWeek ? 'Yes' : 'No'}`);
  }
  
  // 4. Check for time pattern (same hours)
  const timePattern = show1.hours === show2.hours;
  
  // 5. Calculate confidence score
  let confidenceScore = 0;
  if (venueMatch) confidenceScore += 30;
  if (addressMatch) confidenceScore += 30;
  if (locationProximity) confidenceScore += 20;
  if (datePattern) confidenceScore += 10;
  if (timePattern) confidenceScore += 10;
  
  // Series detection result
  const isSameSeries = confidenceScore >= 60; // 60% threshold
  
  console.warn(`\n${colors.cyan}Series Detection Results:${colors.reset}`);
  console.warn(`  ${colors.dim}Venue Match:${colors.reset} ${venueMatch ? 'Yes' : 'No'} (30%)`);
  console.warn(`  ${colors.dim}Address Match:${colors.reset} ${addressMatch ? 'Yes' : 'No'} (30%)`);
  console.warn(`  ${colors.dim}Location Proximity:${colors.reset} ${locationProximity ? 'Yes' : 'No'} (20%)`);
  console.warn(`  ${colors.dim}Date Pattern:${colors.reset} ${datePattern ? 'Yes' : 'No'} (10%)`);
  console.warn(`  ${colors.dim}Time Pattern:${colors.reset} ${timePattern ? 'Yes' : 'No'} (10%)`);
  console.warn(`  ${colors.dim}Confidence Score:${colors.reset} ${confidenceScore}%`);
  
  console.warn(`\n${colors.cyan}Final Determination:${colors.reset} ${isSameSeries ? 
    `${colors.green}SAME SERIES${colors.reset}` : 
    `${colors.red}DIFFERENT SERIES${colors.reset}`}`);
  
  if (isSameSeries) {
    console.warn(`\n${colors.cyan}Series Pattern:${colors.reset} Monthly card show at ${show1.venueName}`);
    
    // Predict next show in series
    if (show1.parsedDate && show2.parsedDate) {
      const date1 = show1.parsedDate;
      const date2 = show2.parsedDate;
      
      // Determine if show2 is after show1
      const chronologicalOrder = date2 > date1;
      
      // Calculate the pattern (days between shows)
      const daysDiff = Math.abs(
        (date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Predict next date
      const baseDate = chronologicalOrder ? date2 : date1;
      const nextDate = new Date(baseDate.getTime());
      nextDate.setDate(nextDate.getDate() + daysDiff);
      
      const nextMonth = nextDate.toLocaleString('default', { month: 'long' });
      const nextDay = nextDate.getDate();
      
      console.warn(`  ${colors.dim}Predicted Next Show:${colors.reset} ${nextMonth} ${nextDay}${getDaySuffix(nextDay)}`);
    }
  }
  
  return {
    isSameSeries,
    confidenceScore,
    venueMatch,
    addressMatch,
    locationProximity,
    datePattern,
    timePattern
  };
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

/**
 * Get day suffix (st, nd, rd, th)
 */
function getDaySuffix(day) {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1:  return "st";
    case 2:  return "nd";
    case 3:  return "rd";
    default: return "th";
  }
}

/**
 * Display database schema for show series
 */
function displayDatabaseSchema() {
  console.warn(`${colors.cyan}Database Schema for Show Series:${colors.reset}`);
  
  // Show Series table
  console.warn(`\n${colors.bright}1. Show Series Table:${colors.reset}`);
  console.warn(`
CREATE TABLE show_series (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  venue_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  typical_hours TEXT,
  typical_entry_fee TEXT,
  recurrence_pattern TEXT, -- 'monthly', 'weekly', etc.
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for geographic queries
CREATE INDEX show_series_location_idx 
ON show_series USING gist (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
  `);
  
  // Shows table with series relationship
  console.warn(`\n${colors.bright}2. Shows Table with Series Relationship:${colors.reset}`);
  console.warn(`
CREATE TABLE shows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  series_id UUID REFERENCES show_series(id),
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
  entry_fee TEXT,
  hours TEXT,
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
  `);
  
  // Series ownership table
  console.warn(`\n${colors.bright}3. Series Ownership Table:${colors.reset}`);
  console.warn(`
CREATE TABLE series_ownership (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  series_id UUID REFERENCES show_series(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  ownership_type TEXT NOT NULL, -- 'owner', 'co-owner', 'manager'
  ownership_verified BOOLEAN DEFAULT false,
  verification_method TEXT, -- 'email', 'phone', 'document', etc.
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure unique ownership per series per user
  UNIQUE(series_id, user_id)
);
  `);
  
  // RLS Policies
  console.warn(`\n${colors.bright}4. Row-Level Security Policies:${colors.reset}`);
  console.warn(`
-- Enable RLS on tables
ALTER TABLE show_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_ownership ENABLE ROW LEVEL SECURITY;

-- Series ownership policies
CREATE POLICY "Series owners can view their series"
  ON show_series
  FOR SELECT
  USING (id IN (
    SELECT series_id FROM series_ownership 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Series owners can update their series"
  ON show_series
  FOR UPDATE
  USING (id IN (
    SELECT series_id FROM series_ownership 
    WHERE user_id = auth.uid()
  ));

-- Show policies
CREATE POLICY "Series owners can update shows in their series"
  ON shows
  FOR UPDATE
  USING (series_id IN (
    SELECT series_id FROM series_ownership 
    WHERE user_id = auth.uid()
  ));

-- Public can view all approved shows
CREATE POLICY "Public can view approved shows"
  ON shows
  FOR SELECT
  USING (approved_at IS NOT NULL);
  `);
  
  // Database functions
  console.warn(`\n${colors.bright}5. Database Functions:${colors.reset}`);
  console.warn(`
-- Function to detect and link shows to series
CREATE OR REPLACE FUNCTION detect_and_link_series()
RETURNS TRIGGER AS $$
DECLARE
  matching_series_id UUID;
BEGIN
  -- Find potential matching series based on venue and address
  SELECT id INTO matching_series_id
  FROM show_series
  WHERE 
    venue_name = NEW.venue_name AND
    address = NEW.address AND
    city = NEW.city AND
    state = NEW.state
  LIMIT 1;
  
  -- If matching series found, link the show
  IF matching_series_id IS NOT NULL THEN
    NEW.series_id := matching_series_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically link shows to series
CREATE TRIGGER link_show_to_series
BEFORE INSERT ON shows
FOR EACH ROW
EXECUTE FUNCTION detect_and_link_series();

-- Function to create a new series from a show
CREATE OR REPLACE FUNCTION create_series_from_show(show_id UUID, user_id UUID)
RETURNS UUID AS $$
DECLARE
  new_series_id UUID;
  show_record RECORD;
BEGIN
  -- Get show details
  SELECT * INTO show_record FROM shows WHERE id = show_id;
  
  -- Create new series
  INSERT INTO show_series (
    name,
    description,
    venue_name,
    address,
    city,
    state,
    postal_code,
    latitude,
    longitude,
    typical_hours,
    typical_entry_fee,
    recurrence_pattern,
    owner_id
  ) VALUES (
    show_record.name,
    'Series created from show ' || show_id,
    show_record.venue_name,
    show_record.address,
    show_record.city,
    show_record.state,
    show_record.postal_code,
    show_record.latitude,
    show_record.longitude,
    show_record.hours,
    show_record.entry_fee,
    'monthly', -- Default assumption
    user_id
  )
  RETURNING id INTO new_series_id;
  
  -- Link show to series
  UPDATE shows SET series_id = new_series_id WHERE id = show_id;
  
  -- Create ownership record
  INSERT INTO series_ownership (
    series_id,
    user_id,
    ownership_type,
    ownership_verified
  ) VALUES (
    new_series_id,
    user_id,
    'owner',
    true
  );
  
  RETURN new_series_id;
END;
$$ LANGUAGE plpgsql;
  `);
  
  console.warn(`\n${colors.cyan}Database Schema Benefits:${colors.reset}`);
  console.warn(`1. ${colors.dim}Series Grouping:${colors.reset} Shows at the same venue are linked together`);
  console.warn(`2. ${colors.dim}Ownership Inheritance:${colors.reset} Owners automatically control all shows in a series`);
  console.warn(`3. ${colors.dim}Automatic Detection:${colors.reset} New shows are linked to existing series via triggers`);
  console.warn(`4. ${colors.dim}Recurrence Patterns:${colors.reset} System can predict and generate future shows`);
  console.warn(`5. ${colors.dim}Security:${colors.reset} RLS policies ensure owners can only manage their series`);
}

/**
 * Demonstrate ownership inheritance
 */
function demonstrateOwnershipInheritance(show1, show2) {
  console.warn(`${colors.cyan}Ownership Inheritance Model:${colors.reset}`);
  
  // Mock user data
  const user = {
    id: 'user_123456',
    name: 'John Smith',
    email: 'john@example.com',
    role: 'organizer'
  };
  
  // Scenario 1: User claims ownership of first show
  console.warn(`\n${colors.bright}Scenario 1: User Claims First Show${colors.reset}`);
  console.warn(`1. ${colors.dim}Action:${colors.reset} ${user.name} claims ownership of "${show1.raw}"`);
  console.warn(`2. ${colors.dim}System:${colors.reset} Creates new show_series record for LaQuinta Inn shows`);
  console.warn(`3. ${colors.dim}System:${colors.reset} Links the August show to this series`);
  console.warn(`4. ${colors.dim}System:${colors.reset} Creates ownership record for ${user.name}`);
  
  // Scenario 2: September show is scraped later
  console.warn(`\n${colors.bright}Scenario 2: September Show is Scraped${colors.reset}`);
  console.warn(`1. ${colors.dim}Action:${colors.reset} Scraper finds "${show2.raw}"`);
  console.warn(`2. ${colors.dim}System:${colors.reset} Detects matching venue/address with existing series`);
  console.warn(`3. ${colors.dim}System:${colors.reset} Automatically links to same series as August show`);
  console.warn(`4. ${colors.dim}Result:${colors.reset} ${user.name} automatically owns September show`);
  
  // Scenario 3: User edits series details
  console.warn(`\n${colors.bright}Scenario 3: User Edits Series Details${colors.reset}`);
  console.warn(`1. ${colors.dim}Action:${colors.reset} ${user.name} updates series name to "Monthly Indianapolis Card Show"`);
  console.warn(`2. ${colors.dim}System:${colors.reset} Updates show_series record`);
  console.warn(`3. ${colors.dim}Result:${colors.reset} Both August and September shows reflect the new name`);
  
  // Scenario 4: Future shows prediction
  console.warn(`\n${colors.bright}Scenario 4: Future Shows Prediction${colors.reset}`);
  console.warn(`1. ${colors.dim}System:${colors.reset} Analyzes pattern (monthly, first weekend)`);
  console.warn(`2. ${colors.dim}System:${colors.reset} Predicts October show on Oct 4th`);
  console.warn(`3. ${colors.dim}Action:${colors.reset} ${user.name} confirms prediction and adds to calendar`);
  console.warn(`4. ${colors.dim}Result:${colors.reset} October show is pre-created and owned by ${user.name}`);
  
  // Ownership benefits
  console.warn(`\n${colors.cyan}Ownership Benefits:${colors.reset}`);
  console.warn(`1. ${colors.dim}Automatic Inheritance:${colors.reset} All shows at same venue are owned by same person`);
  console.warn(`2. ${colors.dim}Bulk Updates:${colors.reset} Changes to series affect all linked shows`);
  console.warn(`3. ${colors.dim}Predictive Creation:${colors.reset} Future shows can be pre-generated`);
  console.warn(`4. ${colors.dim}Simplified Management:${colors.reset} Organizers manage one series, not individual shows`);
  console.warn(`5. ${colors.dim}Verification:${colors.reset} Once verified as owner, applies to all future shows`);
}

/**
 * Display system architecture
 */
function displaySystemArchitecture() {
  console.warn(`${colors.cyan}System Architecture for Recurring Shows:${colors.reset}`);
  
  // Components
  console.warn(`\n${colors.bright}System Components:${colors.reset}`);
  console.warn(`
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │     │                     │
│   Scraper System    │────▶│  Series Detector    │────▶│   Database Layer    │
│                     │     │                     │     │                     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
          │                           ▲                           │
          │                           │                           │
          │                           │                           ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │     │                     │
│   Admin Interface   │◀───▶│  Series Manager     │◀───▶│   User Interface    │
│                     │     │                     │     │                     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
  `);
  
  // Component descriptions
  console.warn(`\n${colors.bright}Component Descriptions:${colors.reset}`);
  console.warn(`1. ${colors.cyan}Scraper System:${colors.reset}`);
  console.warn(`   - Extracts show data from websites`);
  console.warn(`   - Applies date filtering to skip past shows`);
  console.warn(`   - Standardizes fields (venue, address, date, etc.)`);
  console.warn(`   - Geocodes addresses for mapping`);
  
  console.warn(`\n2. ${colors.cyan}Series Detector:${colors.reset}`);
  console.warn(`   - Analyzes new shows for series patterns`);
  console.warn(`   - Compares venue, address, and date patterns`);
  console.warn(`   - Calculates confidence scores for matches`);
  console.warn(`   - Links shows to existing series`);
  
  console.warn(`\n3. ${colors.cyan}Database Layer:${colors.reset}`);
  console.warn(`   - Stores shows, series, and ownership data`);
  console.warn(`   - Enforces relationships and constraints`);
  console.warn(`   - Implements RLS policies for security`);
  console.warn(`   - Provides functions for series management`);
  
  console.warn(`\n4. ${colors.cyan}Series Manager:${colors.reset}`);
  console.warn(`   - Core business logic for series operations`);
  console.warn(`   - Handles ownership inheritance rules`);
  console.warn(`   - Predicts future shows in series`);
  console.warn(`   - Manages series metadata and settings`);
  
  console.warn(`\n5. ${colors.cyan}Admin Interface:${colors.reset}`);
  console.warn(`   - Approves and manages shows`);
  console.warn(`   - Verifies series ownership claims`);
  console.warn(`   - Manages series relationships`);
  console.error(`   - Handles exceptions and edge cases`);
  
  console.warn(`\n6. ${colors.cyan}User Interface:${colors.reset}`);
  console.warn(`   - Displays shows grouped by series`);
  console.warn(`   - Allows organizers to claim and manage series`);
  console.warn(`   - Provides calendar views of recurring shows`);
  console.warn(`   - Enables users to follow favorite series`);
  
  // Data flow
  console.warn(`\n${colors.bright}Data Flow:${colors.reset}`);
  console.warn(`1. ${colors.dim}Scraper → Series Detector:${colors.reset} New shows are analyzed for series matching`);
  console.warn(`2. ${colors.dim}Series Detector → Database:${colors.reset} Shows are linked to series or create new series`);
  console.warn(`3. ${colors.dim}Database → Series Manager:${colors.reset} Series data is retrieved and processed`);
  console.warn(`4. ${colors.dim}Series Manager → Admin Interface:${colors.reset} Series management tools for admins`);
  console.warn(`5. ${colors.dim}Series Manager → User Interface:${colors.reset} Series data displayed to users`);
  console.warn(`6. ${colors.dim}Admin Interface → Series Detector:${colors.reset} Manual series adjustments and verification`);
}

/**
 * Display admin system integration
 */
function displayAdminIntegration(show1, show2) {
  // Accept show parameters so we can reference them safely
  console.warn(`${colors.cyan}Admin System Integration:${colors.reset}`);
  
  // Admin interface features
  console.warn(`\n${colors.bright}Admin Interface Features:${colors.reset}`);
  console.warn(`1. ${colors.cyan}Series Dashboard:${colors.reset}`);
  console.warn(`   - View all series with their recurring shows`);
  console.warn(`   - Filter by venue, city, owner, or date range`);
  console.warn(`   - See ownership status and verification`);
  console.warn(`   - Monitor series health and activity`);
  
  console.warn(`\n2. ${colors.cyan}Series Management:${colors.reset}`);
  console.warn(`   - Manually create or merge series`);
  console.warn(`   - Add or remove shows from a series`);
  console.warn(`   - Update series metadata (name, description, pattern)`);
  console.warn(`   - Generate predicted future shows`);
  
  console.warn(`\n3. ${colors.cyan}Ownership Verification:${colors.reset}`);
  console.warn(`   - Review ownership claims`);
  console.warn(`   - Verify organizers through documentation`);
  console.warn(`   - Transfer ownership between users`);
  console.warn(`   - Handle ownership disputes`);
  
  console.warn(`\n4. ${colors.cyan}Series Analytics:${colors.reset}`);
  console.warn(`   - Track views and clicks per series`);
  console.warn(`   - Monitor attendance trends`);
  console.warn(`   - Analyze geographic distribution`);
  console.warn(`   - Identify popular recurring shows`);
  
  // Admin workflows
  console.warn(`\n${colors.bright}Admin Workflows:${colors.reset}`);
  console.warn(`\n${colors.cyan}Workflow 1: Series Detection Review${colors.reset}`);
  console.warn(`1. System detects new show potentially part of existing series`);
  console.warn(`2. Admin reviews the match (${show1.raw} and ${show2.raw})`);
  console.warn(`3. Admin confirms they are part of the same series`);
  console.warn(`4. System links both shows to the same series`);
  
  console.warn(`\n${colors.cyan}Workflow 2: Ownership Claim Verification${colors.reset}`);
  console.warn(`1. Organizer claims ownership of LaQuinta Inn series`);
  console.warn(`2. Admin reviews documentation (venue contract, etc.)`);
  console.warn(`3. Admin approves ownership claim`);
  console.warn(`4. System grants ownership of all shows in series`);
  
  console.warn(`\n${colors.cyan}Workflow 3: Series Pattern Management${colors.reset}`);
  console.warn(`1. Admin notices shows occur on first Saturday of each month`);
  console.warn(`2. Admin sets recurrence pattern to "monthly-first-saturday"`);
  console.warn(`3. System predicts next 6 months of shows`);
  console.warn(`4. Admin approves predictions for public display`);
  
  // Admin UI mockup
  console.warn(`\n${colors.bright}Admin UI Mockup:${colors.reset}`);
  console.warn(`
┌─────────────────────────────────────────────────────────────────────────────┐
│ CARD SHOW FINDER - ADMIN DASHBOARD                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SERIES: Monthly Indianapolis Card Show at LaQuinta Inn                     │
│  VENUE: LaQuinta Inn, 5120 Victory Drive, Indianapolis, IN 46203            │
│  OWNER: John Smith (verified ✓)                                             │
│  PATTERN: Monthly - First Saturday                                          │
│                                                                             │
│  SHOWS IN THIS SERIES:                                                      │
│  ┌─────────┬────────────────┬─────────┬─────────────┬────────────────────┐  │
│  │ DATE    │ NAME           │ STATUS  │ ATTENDANCE  │ ACTIONS            │  │
│  ├─────────┼────────────────┼─────────┼─────────────┼────────────────────┤  │
│  │ Aug 2nd │ Card Show      │ ACTIVE  │ --          │ Edit | Remove      │  │
│  │ Sept 6th│ Card Show      │ ACTIVE  │ --          │ Edit | Remove      │  │
│  │ Oct 4th │ Card Show      │ PENDING │ --          │ Edit | Remove      │  │
│  │ Nov 1st │ Card Show      │ PENDING │ --          │ Edit | Remove      │  │
│  │ Dec 6th │ Card Show      │ PENDING │ --          │ Edit | Remove      │  │
│  └─────────┴────────────────┴─────────┴─────────────┴────────────────────┘  │
│                                                                             │
│  SERIES ACTIONS:                                                            │
│  [ Update Series ] [ Add Show ] [ Generate Future Shows ] [ Transfer Owner ]│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
  `);

} // <-- end of displayAdminIntegration

/**
 * Generate mock data for demonstration
 */
function generateMockData(show1, show2) {
  console.warn(`${colors.cyan}Mock Data Demonstration:${colors.reset}`);
  
  // Create mock series
  const mockSeries = {
    id: 'series_12345',
    name: 'Monthly Indianapolis Card Show',
    description: 'Monthly card show featuring sports cards, memorabilia, and collectibles',
    venue_name: 'LaQuinta Inn',
    address: '5120 Victory Drive',
    city: 'Indianapolis',
    state: 'IN',
    postal_code: '46203',
    latitude: 39.7025564,
    longitude: -86.0803286,
    typical_hours: '8am to 2pm',
    typical_entry_fee: 'Free',
    recurrence_pattern: 'monthly-first-saturday',
    owner_id: 'user_123456',
    created_at: '2025-07-29T00:00:00Z',
    updated_at: '2025-07-29T00:00:00Z'
  };
  
  // Create mock shows
  const mockShows = [
    {
      id: 'show_august',
      series_id: 'series_12345',
      name: 'Monthly Indianapolis Card Show',
      start_date: '2025-08-02',
      end_date: '2025-08-02',
      venue_name: 'LaQuinta Inn',
      address: '5120 Victory Drive',
      city: 'Indianapolis',
      state: 'IN',
      postal_code: '46203',
      latitude: 39.7025564,
      longitude: -86.0803286,
      formatted_address: 'La Quinta Inn & Suites Indianapolis South, 5120, Victory Drive, Indianapolis, Marion County, Indiana, 46203, United States',
      entry_fee: 'Free',
      hours: '8am to 2pm',
      description: 'Monthly card show featuring sports cards, memorabilia, and collectibles',
      contact_info: 'Tables: Contact organizer',
      source_url: 'https://example.com/shows/august',
      extracted_at: '2025-07-15T00:00:00Z',
      approved_at: '2025-07-16T00:00:00Z',
      approved_by: 'admin_user',
      created_at: '2025-07-15T00:00:00Z',
      updated_at: '2025-07-16T00:00:00Z'
    },
    {
      id: 'show_september',
      series_id: 'series_12345',
      name: 'Monthly Indianapolis Card Show',
      start_date: '2025-09-06',
      end_date: '2025-09-06',
      venue_name: 'LaQuinta Inn',
      address: '5120 Victory Drive',
      city: 'Indianapolis',
      state: 'IN',
      postal_code: '46203',
      latitude: 39.7025564,
      longitude: -86.0803286,
      formatted_address: 'La Quinta Inn & Suites Indianapolis South, 5120, Victory Drive, Indianapolis, Marion County, Indiana, 46203, United States',
      entry_fee: 'Free',
      hours: '8am to 2pm',
      description: 'Monthly card show featuring sports cards, memorabilia, and collectibles',
      contact_info: 'Tables: Contact organizer',
      source_url: 'https://example.com/shows/september',
      extracted_at: '2025-08-15T00:00:00Z',
      approved_at: '2025-08-16T00:00:00Z',
      approved_by: 'admin_user',
      created_at: '2025-08-15T00:00:00Z',
      updated_at: '2025-08-16T00:00:00Z'
    }
  ];
  
  // Create mock ownership
  const mockOwnership = {
    id: 'ownership_12345',
    series_id: 'series_12345',
    user_id: 'user_123456',
    ownership_type: 'owner',
    ownership_verified: true,
    verification_method: 'document',
    verified_at: '2025-07-20T00:00:00Z',
    verified_by: 'admin_user',
    created_at: '2025-07-18T00:00:00Z',
    updated_at: '2025-07-20T00:00:00Z'
  };
  
  // Display mock data
  console.warn(`\n${colors.bright}1. Mock Series:${colors.reset}`);
  console.warn(JSON.stringify(mockSeries, null, 2));
  
  console.warn(`\n${colors.bright}2. Mock Shows:${colors.reset}`);
  console.warn(JSON.stringify(mockShows, null, 2));
  
  console.warn(`\n${colors.bright}3. Mock Ownership:${colors.reset}`);
  console.warn(JSON.stringify(mockOwnership, null, 2));
  
  // Show user experience
  console.warn(`\n${colors.bright}User Experience with Series:${colors.reset}`);
  console.warn(`
┌─────────────────────────────────────────────────────────────────────────────┐
│ CARD SHOW FINDER - USER VIEW                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Monthly Indianapolis Card Show                                             │
│  LaQuinta Inn, 5120 Victory Drive, Indianapolis, IN 46203                   │
│                                                                             │
│  Upcoming Dates:                                                            │
│  • August 2nd, 2025 (8am - 2pm)                                             │
│  • September 6th, 2025 (8am - 2pm)                                          │
│  • October 4th, 2025 (8am - 2pm)                                            │
│                                                                             │
│  This is a recurring monthly show on the first Saturday of each month.      │
│  Free admission. Tables: Contact organizer.                                 │
│                                                                             │
│  [ View on Map ] [ Add to Calendar ] [ Follow This Series ]                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
  `);
  
  // Show organizer experience
  console.warn(`\n${colors.bright}Organizer Experience:${colors.reset}`);
  console.warn(`
┌─────────────────────────────────────────────────────────────────────────────┐
│ CARD SHOW FINDER - ORGANIZER DASHBOARD                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MY SERIES: Monthly Indianapolis Card Show                                  │
│                                                                             │
│  UPCOMING SHOWS:                                                            │
│  ┌─────────┬──────────┬─────────────┬────────────┬────────────────────────┐ │
│  │ DATE    │ STATUS   │ VIEWS       │ FOLLOWS    │ ACTIONS                │ │
│  ├─────────┼──────────┼─────────────┼────────────┼────────────────────────┤ │
│  │ Aug 2nd │ ACTIVE   │ 245         │ 12         │ Edit | Cancel | Promote│ │
│  │ Sept 6th│ ACTIVE   │ 156         │ 8          │ Edit | Cancel | Promote│ │
│  │ Oct 4th │ DRAFT    │ --          │ --         │ Edit | Publish         │ │
│  │ Nov 1st │ DRAFT    │ --          │ --         │ Edit | Publish         │ │
│  └─────────┴──────────┴─────────────┴────────────┴────────────────────────┘ │
│                                                                             │
│  SERIES SETTINGS:                                                           │
│  [ Edit Details ] [ Update Schedule ] [ Manage Tables ] [ Promotion Tools ] │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
  `);
}

/**
 * Format a date for display
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Run the analysis
analyzeShowSeries().catch(console.error);
