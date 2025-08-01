#!/usr/bin/env node
/**
 * scraper/test-enhanced-parsing.js
 * 
 * Test script to demonstrate the enhanced parsing capabilities of the new scraper system.
 * This script takes problematic raw data and shows how the new parsing functions clean it up.
 * 
 * Usage:
 *   node scraper/test-enhanced-parsing.js [--geocode] [--sample-id UUID]
 * 
 * Options:
 *   --geocode         Test geocoding functionality (requires GOOGLE_MAPS_API_KEY)
 *   --sample-id UUID  Test with a specific record from the database
 *   --help            Show help text
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const minimist = require('minimist');

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ['sample-id'],
  boolean: ['help', 'geocode'],
  alias: {
    h: 'help',
    g: 'geocode',
    s: 'sample-id'
  },
  default: {
    geocode: false
  }
});

// Show help if requested
if (argv.help) {
  console.log(`
Test Enhanced Parsing
====================

Demonstrates the enhanced parsing capabilities of the new scraper system.

Usage:
  node scraper/test-enhanced-parsing.js [--geocode] [--sample-id UUID]

Options:
  --geocode         Test geocoding functionality (requires GOOGLE_MAPS_API_KEY)
  --sample-id UUID  Test with a specific record from the database
  --help            Show this help text

Environment Variables:
  SUPABASE_URL                 Required for database access
  SUPABASE_SERVICE_ROLE_KEY    Required for database access
  GOOGLE_MAPS_API_KEY          Required for geocoding tests
  `);
  process.exit(0);
}

// ================================================================
// SECTION: UTILITY FUNCTIONS
// ================================================================

function log(title, data = null) {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
  if (data !== null) {
    if (typeof data === 'object') {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(data);
    }
  }
}

function logComparison(title, before, after) {
  console.log('\n' + '='.repeat(80));
  console.log(`${title} - BEFORE vs AFTER`);
  console.log('='.repeat(80));
  
  console.log('BEFORE:');
  console.log('-'.repeat(40));
  if (typeof before === 'object') {
    console.log(JSON.stringify(before, null, 2));
  } else {
    console.log(before);
  }
  
  console.log('\nAFTER:');
  console.log('-'.repeat(40));
  if (typeof after === 'object') {
    console.log(JSON.stringify(after, null, 2));
  } else {
    console.log(after);
  }
}

// ================================================================
// SECTION: NORMALIZATION FUNCTIONS
// ================================================================

// Constants
const TODAY = new Date();
const STATE_CODES = {
  'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
  'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
  'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
  'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
  'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
  'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH',
  'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT',
  'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY',
  'DISTRICT OF COLUMBIA': 'DC'
};

// Clean and normalize dates (remove state codes, standardize format)
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  log(`Normalizing date: "${dateStr}"`);
  
  // Remove state codes that might be appended to dates
  const stateCodeRegex = new RegExp(`\\s+(${Object.values(STATE_CODES).join('|')})\\b`, 'i');
  dateStr = dateStr.replace(stateCodeRegex, '');
  log(`After state code removal: "${dateStr}"`);
  
  // Handle common date formats
  dateStr = dateStr.trim()
    .replace(/(\d+)(st|nd|rd|th)/gi, '$1') // Remove ordinals
    .replace(/\s+/g, ' ');                // Normalize spaces
  log(`After ordinal removal: "${dateStr}"`);
  
  // Try to parse the date
  let parsedDate = null;
  
  // Try different date formats
  const dateFormats = [
    // Standard formats
    new Date(dateStr),
    // Month abbreviation formats: "Aug 2"
    new Date(`${dateStr}, ${TODAY.getFullYear()}`),
    // Handle "Month Day" format
    new Date(`${dateStr} ${TODAY.getFullYear()}`),
  ];
  
  for (const date of dateFormats) {
    if (!isNaN(date.getTime())) {
      parsedDate = date;
      log(`Successfully parsed with format: ${date.toISOString()}`);
      break;
    }
  }
  
  if (!parsedDate) {
    log(`Failed to parse date: "${dateStr}"`);
    return {
      original: dateStr,
      normalized: null,
      iso: null,
      valid: false
    };
  }
  
  // If date is in the past, assume it's next year
  if (parsedDate < TODAY && parsedDate.getMonth() < TODAY.getMonth()) {
    parsedDate.setFullYear(TODAY.getFullYear() + 1);
    log(`Date was in the past, adjusted to next year: ${parsedDate.toISOString()}`);
  }
  
  const result = {
    original: dateStr,
    normalized: parsedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    iso: parsedDate.toISOString(),
    valid: true
  };
  
  log(`Final normalized date:`, result);
  return result;
}

// Parse location into components
function parseLocation(locationStr, city = null, state = null) {
  if (!locationStr) return null;
  
  log(`Parsing location: "${locationStr}"`);
  
  // Initialize result
  const result = {
    venueName: null,
    address: null,
    city: city || null,
    state: state || null,
    zipCode: null,
    full: locationStr.trim()
  };
  
  // Extract zip code if present
  const zipMatch = locationStr.match(/\b\d{5}(-\d{4})?\b/);
  if (zipMatch) {
    result.zipCode = zipMatch[0];
    // Remove zip from location string for further processing
    locationStr = locationStr.replace(zipMatch[0], '').trim();
    log(`Extracted zip code: ${result.zipCode}`);
    log(`Remaining location: "${locationStr}"`);
  }
  
  // Extract state if not provided
  if (!result.state) {
    for (const [stateName, stateCode] of Object.entries(STATE_CODES)) {
      const stateRegex = new RegExp(`\\b${stateCode}\\b|\\b${stateName}\\b`, 'i');
      if (stateRegex.test(locationStr)) {
        result.state = stateCode;
        // Remove state from location string for further processing
        locationStr = locationStr.replace(stateRegex, '').trim();
        log(`Extracted state: ${result.state}`);
        log(`Remaining location: "${locationStr}"`);
        break;
      }
    }
  }
  
  // Extract city if not provided
  if (!result.city && result.state) {
    // Common format: "Venue Name, Address, City, State"
    const parts = locationStr.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      // Last part before state is likely city
      const cityIndex = parts.length - 1;
      result.city = parts[cityIndex];
      // Remove city from parts for further processing
      parts.splice(cityIndex, 1);
      locationStr = parts.join(', ');
      log(`Extracted city: ${result.city}`);
      log(`Remaining location: "${locationStr}"`);
    }
  }
  
  // If we have at least 2 parts left, assume first is venue and rest is address
  const remainingParts = locationStr.split(',').map(p => p.trim());
  if (remainingParts.length >= 2) {
    result.venueName = remainingParts[0];
    result.address = remainingParts.slice(1).join(', ');
    log(`Extracted venue name: "${result.venueName}"`);
    log(`Extracted address: "${result.address}"`);
  } else if (remainingParts.length === 1) {
    // If only one part left, it's likely the venue name
    result.venueName = remainingParts[0];
    log(`Extracted venue name: "${result.venueName}"`);
  }
  
  // If we couldn't parse properly, set venue name to the full location
  if (!result.venueName) {
    result.venueName = result.full;
    log(`Using full location as venue name: "${result.venueName}"`);
  }
  
  log(`Final parsed location:`, result);
  return result;
}

// Extract contact information (phone, email)
function extractContactInfo(contactStr) {
  if (!contactStr) return null;
  
  log(`Extracting contact info: "${contactStr}"`);
  
  const result = {
    full: contactStr.trim(),
    name: null,
    phone: null,
    email: null
  };
  
  // Extract email
  const emailMatch = contactStr.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  if (emailMatch) {
    result.email = emailMatch[0];
    log(`Extracted email: ${result.email}`);
  }
  
  // Extract phone (various formats)
  const phoneMatch = contactStr.match(/(\+?1[-\s.]?)?(\(?\d{3}\)?[-\s.]?)?\d{3}[-\s.]\d{4}/);
  if (phoneMatch) {
    result.phone = phoneMatch[0];
    log(`Extracted phone: ${result.phone}`);
  }
  
  // Extract name (assume it's the text before @ or phone)
  let nameStr = contactStr;
  if (result.email) {
    nameStr = contactStr.split(result.email)[0].trim();
  } else if (result.phone) {
    nameStr = contactStr.split(result.phone)[0].trim();
  }
  
  // Clean up name
  nameStr = nameStr.replace(/^\s*at\s+|\s*@\s*/, '').trim();
  if (nameStr && nameStr !== '@' && nameStr.length > 1) {
    result.name = nameStr;
    log(`Extracted name: "${result.name}"`);
  }
  
  log(`Final parsed contact info:`, result);
  return result;
}

// Parse entry fee
function parseEntryFee(feeStr) {
  if (!feeStr) return null;
  
  log(`Parsing entry fee: "${feeStr}"`);
  
  // Convert to lowercase and trim
  const normalizedFee = feeStr.toLowerCase().trim();
  
  // Check for free
  if (normalizedFee === 'free' || normalizedFee === 'none' || normalizedFee === 'n/a') {
    log(`Detected free entry`);
    return { 
      amount: 0,
      currency: 'USD',
      description: 'Free admission',
      original: feeStr
    };
  }
  
  // Extract numeric amount
  const amountMatch = normalizedFee.match(/\$?\s*(\d+(\.\d+)?)/);
  if (amountMatch) {
    const amount = parseFloat(amountMatch[1]);
    log(`Extracted amount: $${amount}`);
    return {
      amount,
      currency: 'USD',
      description: feeStr,
      original: feeStr
    };
  }
  
  // Return original if we can't parse
  log(`Could not extract numeric amount, using original`);
  return {
    amount: null,
    currency: 'USD',
    description: feeStr,
    original: feeStr
  };
}

// Extract show hours
function parseShowHours(description) {
  if (!description) return { startTime: null, endTime: null };
  
  log(`Parsing show hours from: "${description}"`);
  
  // Common time formats
  const timeRegex = /(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:-|to|–|until)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i;
  const match = description.match(timeRegex);
  
  if (match) {
    const result = {
      startTime: match[1].trim(),
      endTime: match[2].trim()
    };
    log(`Extracted show hours:`, result);
    return result;
  }
  
  log(`Could not extract show hours`);
  return { startTime: null, endTime: null };
}

// Normalize and enhance extracted show data
function normalizeShowData(rawShow, sourceUrl) {
  log(`Normalizing show data:`, rawShow);
  
  // Initialize normalized show object
  const normalizedShow = {
    // Basic info
    name: rawShow.name || null,
    description: rawShow.description || null,
    url: rawShow.url || sourceUrl,
    
    // Dates
    startDate: null,
    endDate: null,
    startDateNormalized: null,
    endDateNormalized: null,
    
    // Location
    venueName: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
    coordinates: null,
    
    // Contact
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    
    // Details
    entryFee: null,
    entryFeeAmount: null,
    showHours: null,
    startTime: null,
    endTime: null,
    
    // Metadata
    extractedAt: new Date().toISOString(),
    normalizedAt: new Date().toISOString(),
    sourceUrl: sourceUrl,
    
    // Original data
    original: { ...rawShow }
  };
  
  // Normalize dates
  if (rawShow.startDate) {
    const startDateInfo = normalizeDate(rawShow.startDate);
    if (startDateInfo.valid) {
      normalizedShow.startDate = startDateInfo.iso;
      normalizedShow.startDateNormalized = startDateInfo.normalized;
    }
  }
  
  if (rawShow.endDate) {
    const endDateInfo = normalizeDate(rawShow.endDate);
    if (endDateInfo.valid) {
      normalizedShow.endDate = endDateInfo.iso;
      normalizedShow.endDateNormalized = endDateInfo.normalized;
    }
  }
  
  // If only start date is provided, use it for end date too
  if (normalizedShow.startDate && !normalizedShow.endDate) {
    normalizedShow.endDate = normalizedShow.startDate;
    normalizedShow.endDateNormalized = normalizedShow.startDateNormalized;
  }
  
  // Parse location
  let locationInfo = null;
  
  // Try to use separated fields first
  if (rawShow.venueName || rawShow.address || rawShow.city || rawShow.state) {
    normalizedShow.venueName = rawShow.venueName || null;
    normalizedShow.address = rawShow.address || null;
    normalizedShow.city = rawShow.city || null;
    normalizedShow.state = rawShow.state || null;
    normalizedShow.zipCode = rawShow.zipCode || null;
  } 
  // Fall back to parsing combined location
  else if (rawShow.location) {
    locationInfo = parseLocation(rawShow.location);
    if (locationInfo) {
      normalizedShow.venueName = locationInfo.venueName;
      normalizedShow.address = locationInfo.address;
      normalizedShow.city = locationInfo.city;
      normalizedShow.state = locationInfo.state;
      normalizedShow.zipCode = locationInfo.zipCode;
    }
  }
  
  // Parse contact info
  if (rawShow.contactName || rawShow.contactPhone || rawShow.contactEmail) {
    normalizedShow.contactName = rawShow.contactName || null;
    normalizedShow.contactPhone = rawShow.contactPhone || null;
    normalizedShow.contactEmail = rawShow.contactEmail || null;
  } else if (rawShow.contactInfo) {
    const contactInfo = extractContactInfo(rawShow.contactInfo);
    if (contactInfo) {
      normalizedShow.contactName = contactInfo.name;
      normalizedShow.contactPhone = contactInfo.phone;
      normalizedShow.contactEmail = contactInfo.email;
    }
  }
  
  // Parse entry fee
  if (rawShow.entryFee) {
    const feeInfo = parseEntryFee(rawShow.entryFee);
    normalizedShow.entryFee = feeInfo.description;
    normalizedShow.entryFeeAmount = feeInfo.amount;
  }
  
  // Parse show hours
  if (rawShow.showHours) {
    normalizedShow.showHours = rawShow.showHours;
    // Try to extract start/end times
    const { startTime, endTime } = parseShowHours(rawShow.showHours);
    normalizedShow.startTime = startTime;
    normalizedShow.endTime = endTime;
  } else if (rawShow.description) {
    // Try to extract hours from description
    const { startTime, endTime } = parseShowHours(rawShow.description);
    normalizedShow.startTime = startTime;
    normalizedShow.endTime = endTime;
    normalizedShow.showHours = startTime && endTime ? `${startTime} - ${endTime}` : null;
  }
  
  log(`Final normalized show data:`, normalizedShow);
  return normalizedShow;
}

// Geocode an address to get coordinates
async function geocodeAddress(address, city, state) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.log('Geocoding skipped: No Google Maps API key provided');
    return null;
  }
  
  try {
    // Build address string
    const addressComponents = [];
    if (address) addressComponents.push(address);
    if (city) addressComponents.push(city);
    if (state) addressComponents.push(state);
    
    const addressStr = addressComponents.join(', ');
    if (!addressStr) {
      console.log('Geocoding skipped: Insufficient address information');
      return null;
    }
    
    console.log(`Geocoding address: "${addressStr}"`);
    
    // Call Google Maps Geocoding API
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressStr)}&key=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`Geocoding error: HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.log(`Geocoding error: ${data.status || 'No results'}`);
      return null;
    }
    
    const result = data.results[0];
    const { lat, lng } = result.geometry.location;
    
    const geoResult = {
      latitude: lat,
      longitude: lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id
    };
    
    console.log(`Geocoding result:`, geoResult);
    return geoResult;
  } catch (error) {
    console.log(`Geocoding error: ${error.message}`);
    return null;
  }
}

// ================================================================
// SECTION: TEST DATA
// ================================================================

// Sample problematic data
const sampleData = [
  {
    id: "sample1",
    name: "Huntsville Sports Cards & Collectibles Show",
    startDate: "Aug 2 AL",
    location: "Jaycees Community Building, John Hunt Park, Huntsville, AL",
    description: "9am to 3pm Tables $35/1 or 2/$60 (8ft tables)",
    contactInfo: "Scott Johnson @ 931-278-9044 sjohnson20_2000@yahoo.com",
    entryFee: "Free"
  },
  {
    id: "sample2",
    name: "The Flip Sports Card & Collectibles Trade Show",
    startDate: "Aug 9 AL",
    location: "Gardendale Civic Center, Gardendale, AL",
    description: "9am-3pm",
    contactInfo: "John Smith 555-123-4567",
    entryFee: "$5"
  },
  {
    id: "sample3",
    name: "Salem Sports Card Show",
    startDate: "August 14, 2021",
    location: "Washington County Fairgrounds 4 H building, 118 Fair Street, Salem, IN",
    description: "9 am- 2 pm 25 Tables",
    contactInfo: "Brad 812-572-1500",
    entryFee: "$15"
  }
];

// ================================================================
// SECTION: MAIN FUNCTION
// ================================================================

async function main() {
  log("ENHANCED PARSING TEST", null);
  
  // Test with sample data
  log("TESTING WITH SAMPLE DATA", null);
  
  for (const sample of sampleData) {
    log(`PROCESSING SAMPLE: ${sample.id}`, sample);
    
    // Test date normalization
    if (sample.startDate) {
      const normalizedDate = normalizeDate(sample.startDate);
      logComparison("DATE NORMALIZATION", sample.startDate, normalizedDate);
    }
    
    // Test location parsing
    if (sample.location) {
      const parsedLocation = parseLocation(sample.location);
      logComparison("LOCATION PARSING", sample.location, parsedLocation);
    }
    
    // Test contact info extraction
    if (sample.contactInfo) {
      const parsedContact = extractContactInfo(sample.contactInfo);
      logComparison("CONTACT INFO EXTRACTION", sample.contactInfo, parsedContact);
    }
    
    // Test entry fee parsing
    if (sample.entryFee) {
      const parsedFee = parseEntryFee(sample.entryFee);
      logComparison("ENTRY FEE PARSING", sample.entryFee, parsedFee);
    }
    
    // Test show hours parsing
    if (sample.description) {
      const parsedHours = parseShowHours(sample.description);
      logComparison("SHOW HOURS PARSING", sample.description, parsedHours);
    }
    
    // Test full normalization
    const normalizedShow = normalizeShowData(sample, "https://example.com/test");
    logComparison("FULL NORMALIZATION", sample, normalizedShow);
    
    // Test geocoding if enabled
    if (argv.geocode) {
      log("GEOCODING TEST", null);
      
      const locationInfo = sample.location ? parseLocation(sample.location) : {};
      const geoResult = await geocodeAddress(
        locationInfo.address,
        locationInfo.city,
        locationInfo.state
      );
      
      if (geoResult) {
        log("GEOCODING RESULT", geoResult);
      } else {
        log("GEOCODING FAILED OR SKIPPED", null);
      }
    }
    
    console.log("\n" + "-".repeat(100) + "\n");
  }
  
  // Test with database record if sample-id provided
  if (argv['sample-id']) {
    log(`TESTING WITH DATABASE RECORD: ${argv['sample-id']}`, null);
    
    // Check environment variables
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      log("ERROR: Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.");
      process.exit(1);
    }
    
    try {
      // Initialize Supabase client
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      
      // Fetch the record
      const { data: record, error } = await supabase
        .from('scraped_shows_pending')
        .select('*')
        .eq('id', argv['sample-id'])
        .single();
      
      if (error) {
        log(`ERROR: ${error.message}`);
        process.exit(1);
      }
      
      if (!record) {
        log(`ERROR: Record not found with ID: ${argv['sample-id']}`);
        process.exit(1);
      }
      
      log("DATABASE RECORD", record);
      
      if (record.raw_payload) {
        // Test full normalization
        const normalizedShow = normalizeShowData(record.raw_payload, record.source_url);
        logComparison("DATABASE RECORD NORMALIZATION", record.raw_payload, normalizedShow);
        
        // Test geocoding if enabled
        if (argv.geocode) {
          log("GEOCODING TEST FOR DATABASE RECORD", null);
          
          const geoResult = await geocodeAddress(
            normalizedShow.address,
            normalizedShow.city,
            normalizedShow.state
          );
          
          if (geoResult) {
            log("GEOCODING RESULT", geoResult);
          } else {
            log("GEOCODING FAILED OR SKIPPED", null);
          }
        }
      } else {
        log("ERROR: Record has no raw_payload");
      }
    } catch (error) {
      log(`ERROR: ${error.message}`);
      process.exit(1);
    }
  }
  
  log("TEST COMPLETE", null);
}

// Run the main function
main().catch(error => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
