#!/usr/bin/env node
/**
 * scraper/enhanced-scraper.js
 * 
 * Enhanced CLI tool for scraping card show information with intelligent data extraction.
 * Features:
 * - Sophisticated AI prompts for better data extraction
 * - Data normalization for dates, locations, etc.
 * - Geocoding integration for coordinates
 * - Proper field mapping to database structure
 * - Validation and quality checks
 * - Better error handling and logging
 * 
 * Usage:
 *   node scraper/enhanced-scraper.js --state TX
 *   node scraper/enhanced-scraper.js --url https://example.com
 *   node scraper/enhanced-scraper.js --state CA --url https://specific.com
 *   node scraper/enhanced-scraper.js --inspect-id [UUID] (to inspect a specific record)
 */

// Load environment variables from .env (must be done before they are accessed)
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { promisify } = require('util');
const readline = require('readline');

// Configuration
const TIMEOUT_MS = 25000; // 25-second timeout for page fetch operations

// Gemini API tuning – aggressive optimisation for large documents:
//  - 10 s timeout keeps requests from hanging
//  - 8 KB chunks reduce payload size, improving success-rate on subsequent chunks
const AI_TIMEOUT_MS = 10000;  // 10 s per AI request
const MAX_HTML_SIZE = 8000;   // 8 KB per chunk sent to AI

// With smaller chunks we allow up to 5 total chunks to maintain coverage.
const MAX_CHUNKS = 5; // fail-safe: never send more than 5 chunks
const GEOCODE_TIMEOUT_MS = 5000; // 5s timeout for geocoding requests

// ---------------------------------------------------------------------------
// Rate-limiting constants – prevent API abuse & unexpected billing
// ---------------------------------------------------------------------------
const AI_REQUEST_DELAY_MS      = 2000;  // 2 s between AI requests  (≈30 req/min)
const GEOCODE_REQUEST_DELAY_MS = 1000;  // 1 s between geocode calls (≈60 req/min)
const MAX_GEOCODING_REQUESTS   = 20;    // Hard cap per run to control cost
const MAX_AI_REQUESTS          = 10;    // Safety cap on Gemini calls per run
const AI_MAX_RETRIES           = 3;     // Retry Gemini 503 errors up to 3 times
const AI_RETRY_DELAY_MS        = 5000;  // 5-second wait before retrying

const TODAY = new Date(); // For date validation
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

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ['state', 'url', 'inspect-id'],
  boolean: ['help', 'geocode', 'dry-run', 'verbose'],
  alias: {
    h: 'help',
    s: 'state',
    u: 'url',
    g: 'geocode',
    d: 'dry-run',
    v: 'verbose',
    i: 'inspect-id'
  },
  default: {
    geocode: true,  // Enable geocoding by default
    'dry-run': false,
    verbose: false
  }
});

// Show help text if requested or no arguments provided
if (argv.help || (process.argv.length <= 2 && !argv.state && !argv.url && !argv['inspect-id'])) {
  showHelp();
  process.exit(0);
}

// Utility functions
function showHelp() {
  console.log(`
Enhanced Card Show Scraper CLI
=============================

An improved command-line tool for scraping card show information with intelligent data extraction.

Environment Variables Required:
  SUPABASE_URL                 Your Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY    Your Supabase service role key
  GOOGLE_AI_KEY                Your Google AI API key for Gemini
  GOOGLE_MAPS_API_KEY          Your Google Maps API key for geocoding

Usage:
  node scraper/enhanced-scraper.js [options]

Options:
  -s, --state STATE     Filter URLs by state (2-letter code, e.g., TX)
  -u, --url URL         Scrape a specific URL (bypasses seed file)
  -g, --geocode         Enable geocoding (default: true)
  -d, --dry-run         Process without saving to database
  -v, --verbose         Show detailed logs
  -i, --inspect-id ID   Inspect and fix a specific record by UUID
  -h, --help            Show this help text

Examples:
  # Scrape all URLs for Texas from seed file
  node scraper/enhanced-scraper.js --state TX

  # Scrape a specific URL without geocoding
  node scraper/enhanced-scraper.js --url https://example.com --no-geocode

  # Dry run to test extraction without saving
  node scraper/enhanced-scraper.js --url https://example.com --dry-run

  # Inspect and fix a specific record
  node scraper/enhanced-scraper.js --inspect-id 52ba9458-7133-46ba-948b-7c2b8ecef48f

Notes:
  - When no URL is provided, URLs are loaded from scraper/seed_urls.json
  - State filtering is case-insensitive (TX, tx, Tx all work)
  - Results are stored in the scraped_shows_pending table in your database
  - Geocoding requires a valid Google Maps API key
  `);
}

function log(message, data = null, force = false) {
  if (!argv.verbose && !force) return;
  
  console.log('\n' + '='.repeat(80));
  console.log(message);
  console.log('='.repeat(80));
  if (data) {
    console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
}

function logError(message, error) {
  console.error('\n' + '!'.repeat(80));
  console.error(`ERROR: ${message}`);
  console.error(error?.message || error);
  console.error('!'.repeat(80));
}

// Create readline interface for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// --------------------------------------------------
// Utility: simple promise-based delay for rate-limits
// --------------------------------------------------
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Prompt for confirmation
function confirm(message) {
  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Load URLs from seed file
function loadSeedUrls() {
  try {
    const seedFilePath = path.join(__dirname, 'seed_urls.json');
    if (!fs.existsSync(seedFilePath)) {
      logError('Seed file not found', `Expected at: ${seedFilePath}`);
      process.exit(1);
    }
    
    const seedData = JSON.parse(fs.readFileSync(seedFilePath, 'utf8'));
    log(`Loaded ${seedData.length} URLs from seed file`, null, true);
    return seedData;
  } catch (error) {
    logError('Failed to load seed URLs', error);
    process.exit(1);
  }
}

// Filter URLs by state
function filterUrlsByState(seedData, stateFilter) {
  if (!stateFilter) return seedData;
  
  const normalizedState = stateFilter.trim().toUpperCase();
  const filtered = seedData.filter(item => 
    item.state && item.state.toUpperCase() === normalizedState
  );
  
  log(`Filtered to ${filtered.length} URLs for state: ${normalizedState}`, null, true);
  return filtered;
}

// ================================================================
// SECTION: DATA NORMALIZATION FUNCTIONS
// ================================================================

// Clean and normalize dates (remove state codes, standardize format)
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  // Remove state codes that might be appended to dates
  const stateCodeRegex = new RegExp(`\\s+(${Object.values(STATE_CODES).join('|')})\\b`, 'i');
  dateStr = dateStr.replace(stateCodeRegex, '');
  
  // Handle common date formats
  dateStr = dateStr.trim()
    .replace(/(\d+)(st|nd|rd|th)/gi, '$1') // Remove ordinals
    .replace(/\s+/g, ' ');                // Normalize spaces
  
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
      break;
    }
  }
  
  if (!parsedDate) {
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
  }
  
  return {
    original: dateStr,
    normalized: parsedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    iso: parsedDate.toISOString(),
    valid: true
  };
}

// Parse location into components
function parseLocation(locationStr, city = null, state = null) {
  if (!locationStr) return null;
  
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
  }
  
  // Extract state if not provided
  if (!result.state) {
    for (const [stateName, stateCode] of Object.entries(STATE_CODES)) {
      const stateRegex = new RegExp(`\\b${stateCode}\\b|\\b${stateName}\\b`, 'i');
      if (stateRegex.test(locationStr)) {
        result.state = stateCode;
        // Remove state from location string for further processing
        locationStr = locationStr.replace(stateRegex, '').trim();
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
    }
  }
  
  // If we have at least 2 parts left, assume first is venue and rest is address
  const remainingParts = locationStr.split(',').map(p => p.trim());
  if (remainingParts.length >= 2) {
    result.venueName = remainingParts[0];
    result.address = remainingParts.slice(1).join(', ');
  } else if (remainingParts.length === 1) {
    // If only one part left, it's likely the venue name
    result.venueName = remainingParts[0];
  }
  
  // If we couldn't parse properly, set venue name to the full location
  if (!result.venueName) {
    result.venueName = result.full;
  }
  
  return result;
}

// Extract contact information (phone, email)
function extractContactInfo(contactStr) {
  if (!contactStr) return null;
  
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
  }
  
  // Extract phone (various formats)
  const phoneMatch = contactStr.match(/(\+?1[-\s.]?)?(\(?\d{3}\)?[-\s.]?)?\d{3}[-\s.]\d{4}/);
  if (phoneMatch) {
    result.phone = phoneMatch[0];
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
  }
  
  return result;
}

// Parse entry fee
function parseEntryFee(feeStr) {
  if (!feeStr) return null;
  
  // Convert to lowercase and trim
  const normalizedFee = feeStr.toLowerCase().trim();
  
  // Check for free
  if (normalizedFee === 'free' || normalizedFee === 'none' || normalizedFee === 'n/a') {
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
    return {
      amount,
      currency: 'USD',
      description: feeStr,
      original: feeStr
    };
  }
  
  // Return original if we can't parse
  return {
    amount: null,
    currency: 'USD',
    description: feeStr,
    original: feeStr
  };
}

// Extract show hours
// -------------------------------------------
// Utility – recognise simple hour expressions
// -------------------------------------------
function isLikelyHours(text) {
  if (!text) return false;
  const timeRangePattern =
    /\b(1[0-2]|[1-9])(:[0-5][0-9])?\s*(am|pm)?\s*(?:-|–|—|to)\s*(1[0-2]|[1-9])(:[0-5][0-9])?\s*(am|pm)?\b/i;
  const dowTimePattern =
    /\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+\d/i;
  return timeRangePattern.test(text) || dowTimePattern.test(text);
}

// Enhanced hours parser: also handles "8-2", "9:30-2:30"
function parseShowHours(description) {
  if (!description) return { startTime: null, endTime: null };

  // Reject multi-range strings (contains comma or semicolon)
  if (/[,;]/.test(description)) {
    return { startTime: null, endTime: null };
  }

  // Normalise unicode dashes
  const norm = description.replace(/[–—]/g, '-').toLowerCase().trim();

  // Try explicit am/pm first
  const ampmRegex =
    /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:-|to|until)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/;
  const m1 = norm.match(ampmRegex);
  if (m1) {
    return { startTime: m1[1], endTime: m1[2] };
  }

  // Fallback "8-2"  or "9:30-2:30"
  const simpleRegex =
    /\b(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?)\b/;
  const m2 = norm.match(simpleRegex);
  if (!m2) return { startTime: null, endTime: null };

  const pad = (val) =>
    val.includes(':') ? val : `${val}:00`;

  const startRaw = pad(m2[1]);
  const endRaw = pad(m2[2]);

  // Assume start am, end pm if not specified
  const toAmPm = (t, isEnd) => {
    const [h, mins] = t.split(':').map(Number);
    const meridian =
      h >= 1 && h <= 6 ? (isEnd ? 'pm' : 'am')
      : h >= 7 && h <= 11 ? (isEnd ? 'pm' : 'am')
      : h === 12 ? (isEnd ? 'pm' : 'pm')
      : 'am';
    return `${h}:${mins.toString().padStart(2, '0')}${meridian}`;
  };

  return {
    startTime: toAmPm(startRaw, false),
    endTime: toAmPm(endRaw, true)
  };
}

// ------------------------------------------------------------
// Deterministic parser for dpmsportcards Indiana show listings
// ------------------------------------------------------------
function parseDpmsIndianaHtml(html, sourceUrl) {
  // Entity replacements
  let text = html
    .replace(/&ndash;|&mdash;|&#8211;|&#8212;/g, '-')
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"')
    .replace(/&lsquo;|&rsquo;|&#8216;|&#8217;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');

  text = text
    .replace(/\r/g, '')
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');

  const lines = text.split('\n');
  const monthRe = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)/i;
  const showLines = lines.filter(
    (l) => monthRe.test(l) && /[-–—]/.test(l) && /,/.test(l)
  );

  const MONTH_MAP = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11
  };

  const ASSUME_YEAR = 2025;

  const parseDateRange = (str) => {
    str = str.replace(/(\d+)(st|nd|rd|th)/gi, '$1').trim();
    const hasRange = /[-–—]| to /i.test(str);
    if (!hasRange) {
      const d = parseSingle(str);
      return d ? { start: d, end: d } : null;
    }
    const [a, b] = str.split(/[-–—]| to /i).map((s) => s.trim());
    const start = parseSingle(a);
    if (!start) return null;
    let end = parseSingle(b);
    if (!end) {
      const month = a.match(/^([a-z]+)/i)[1];
      end = parseSingle(`${month} ${b}`);
    }
    return end ? { start, end } : null;
  };

  const parseSingle = (str) => {
    const mm = str.match(/^([a-z]+)/i);
    if (!mm) return null;
    const month = MONTH_MAP[mm[1].toLowerCase()];
    const day = Number(str.match(/(\d{1,2})/)[1]);
    return new Date(ASSUME_YEAR, month, day);
  };

  const shows = [];
  const seen = new Set();

  for (const line of showLines) {
    const dateMatch = line.match(
      /^(\s*[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*(?:-|–|—|to)\s*\d{1,2}(?:st|nd|rd|th)?)?)/
    );
    if (!dateMatch) continue;

    const dateInfo = parseDateRange(dateMatch[1]);
    if (!dateInfo) continue;

    let remaining = line.slice(dateMatch[0].length).trim();

    const locEnd = remaining.indexOf('(') > -1 ? remaining.indexOf('(') : remaining.length;
    const locPart = remaining.slice(0, locEnd).replace(/^[–—-]\s*/, '').trim();
    const segs = locPart.split(/\s[–—-]\s/).map((s) => s.trim());

    let city = '', venue = '', address = '';
    if (segs.length >= 2) {
      const cv = segs[0];
      address = segs.slice(1).join(' - ');
      const comma = cv.indexOf(',');
      if (comma > -1) {
        city = cv.slice(0, comma).trim();
        venue = cv.slice(comma + 1).trim().replace(/^["']|["']$/g, '');
      } else {
        city = cv.trim();
      }
    }

    if (!city && locPart.includes(',')) {
      city = locPart.split(',')[0].trim();
    }

    // Hours
    const hoursTokens = [];
    const hrRe = /\(([^)]+)\)/g;
    let m;
    while ((m = hrRe.exec(remaining))) {
      if (isLikelyHours(m[1])) hoursTokens.push(m[1]);
    }
    const hours = hoursTokens
      .map((t) => t.replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim())
      .join(', ');

    // Contact
    let contactInfo = '';
    const phoneRe = /\(?\s*(\d{3})\s*\)?[-\s]?(\d{3})[-\s]?(\d{4})/;
    const pMatch = phoneRe.exec(remaining);
    if (pMatch) {
      const phoneFmt = `(${pMatch[1]}) ${pMatch[2]}-${pMatch[3]}`;
      const nameCtx = remaining.slice(
        Math.max(0, pMatch.index - 60),
        pMatch.index
      );
      const nameRe =
        /([A-Z][a-zA-Z.'-]{2,}(?:\s+[A-Z][a-zA-Z.'-]{2,}){0,2})\s*$/;
      const nm = nameRe.exec(nameCtx);
      const stop = new Set([
        'Street','St','St.','Drive','Dr','Dr.','Road','Rd','Rd.',
        'Avenue','Ave','Ave.','Boulevard','Blvd','Blvd.','Way','Lane','Ln','Ln.',
        'Court','Ct','Ct.','East','West','North','South','E','W','N','S',
        'Main','Division','Taylor','Carroll','Hunter','Wabash','Victory','Field',
        'Bronco','Votaw','Sample','Jefferson','Robbins'
      ]);
      let name = '';
      if (nm) {
        const parts = nm[1].split(/\s+/).filter((w) => !stop.has(w));
        if (parts.length >= 2) {
          name = `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
        } else if (parts.length === 1) {
          name = parts[0];
        }
      }
      contactInfo = name ? `${name} ${phoneFmt}` : phoneFmt;
    }

    const key = `${city}|${address}|${dateInfo.start.toISOString().slice(0,10)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    shows.push({
      name: city || null,
      startDate: dateInfo.start.toISOString().split('T')[0],
      endDate: dateInfo.end.toISOString().split('T')[0],
      venueName: venue || null,
      address: address || null,
      city: city || null,
      state: 'IN',
      zipCode: null,
      showHours: hours || null,
      contactInfo,
      entryFee: 'free',
      url: sourceUrl
    });
  }

  return shows;
}

// ================================================================
// SECTION: GEOCODING FUNCTIONS
// ================================================================

// Geocode an address to get coordinates
async function geocodeAddress(address, city, state) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    log('Geocoding skipped: No Google Maps API key provided');
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
      log('Geocoding skipped: Insufficient address information');
      return null;
    }
    
    // Call Google Maps Geocoding API
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressStr)}&key=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) {
      log(`Geocoding error: HTTP ${response.status}`, null, true);
      return null;
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      log(`Geocoding error: ${data.status || 'No results'}`, null, true);
      return null;
    }
    
    const result = data.results[0];
    const { lat, lng } = result.geometry.location;
    
    return {
      latitude: lat,
      longitude: lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id
    };
  } catch (error) {
    log(`Geocoding error: ${error.message}`, null, true);
    return null;
  }
}

// ================================================================
// SECTION: ENHANCED AI PROMPTS
// ================================================================

// Enhanced AI prompt with detailed instructions
function buildEnhancedAIPrompt(html, sourceUrl) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  return `
You are a specialized card show event extractor with expertise in data normalization. Your task is to analyze the HTML content from ${sourceUrl} and extract card show events into a valid JSON array.

TODAY = ${today}

Each event object MUST have these keys (use null if information is missing):
{
  "name": "Full event name/title",
  "startDate": "Start date in any format you find",
  "endDate": "End date if multi-day event, otherwise same as start date",
  "venueName": "Name of venue/location ONLY (not the full address)",
  "address": "Street address ONLY",
  "city": "City name ONLY",
  "state": "State abbreviation (2 letters) ONLY",
  "zipCode": "ZIP/Postal code if available",
  "entryFee": "Entry fee information",
  "description": "Event description if available",
  "url": "Direct link to event details if available, otherwise use source URL",
  "contactName": "Promoter/contact name if available",
  "contactPhone": "Contact phone number if available",
  "contactEmail": "Contact email if available",
  "showHours": "Hours of operation (e.g., '9am-3pm')"
}

CRITICAL EXTRACTION RULES:
1. DO NOT extract anything from comments, reviews, or testimonials
2. DO NOT extract events that happened BEFORE TODAY
1. ABSOLUTELY CRITICAL: **ONLY** extract shows with dates **AFTER** ${today}  
2. **REJECT** any show dated **2024 or earlier** – these are past events  
3. **ONLY** include shows from **2025 and beyond**  
4. DO NOT extract anything from comments, reviews, testimonials, or archive sections  
5. Focus exclusively on sections that reference future dates, "upcoming events", or 2025 + calendar entries  
6. If a show date is unclear or ambiguous, **exclude** the show  
7. When in doubt about whether a date is past or future, **do not include** the show  
   - For dates: Remove state codes that appear in dates (e.g., "Aug 2 AL" → "Aug 2")
   - For venues: Separate venue name from address
   - For contact: Separate name, phone, email
6. If multiple shows occur at same venue on different dates, create separate entries for each date
7. If a date range like "January 5-6, 2025" is found, create a single event with proper start/end dates
8. For fields with multiple pieces of information, separate them correctly
9. ONLY output the valid JSON array of events. No explanations or markdown

HTML CONTENT:
${html}
`;
}

// Specialized prompt for Sports Collectors Digest
function buildEnhancedSCDPrompt(html) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const currentYear = new Date().getFullYear();
  const nextYear    = currentYear + 1;
  
  return `
You are a specialized card show event extractor with expertise in data normalization. The HTML is from Sports Collectors Digest's show calendar.

TODAY = ${today}

The calendar is organized by STATE headings in UPPERCASE (e.g., ALABAMA, ARIZONA).
Extract EVERY show listing beneath those headings.

Each event object MUST have these keys (use null if information is missing):
{
  "name": "Full event name/title",
  "startDate": "Start date in any format you find",
  "endDate": "End date if multi-day event, otherwise same as start date",
  "venueName": "Name of venue/location ONLY (not the full address)",
  "address": "Street address ONLY",
  "city": "City name ONLY",
  "state": "State abbreviation (2 letters) ONLY",
  "zipCode": "ZIP/Postal code if available",
  "entryFee": "Entry fee information",
  "description": "Event description if available",
  "url": "Direct link to event details if available, otherwise use source URL",
  "contactName": "Promoter/contact name if available",
  "contactPhone": "Contact phone number if available",
  "contactEmail": "Contact email if available",
  "showHours": "Hours of operation (e.g., '9am-3pm')"
}

CRITICAL EXTRACTION RULES:
CRITICAL DATE FILTERING (MOST IMPORTANT):
Sports Collectors Digest is a TRUSTED, **current** source – treat all listed shows as upcoming.

1. TODAY is ${today} (${currentYear})  
2. **ASSUME CURRENT/FUTURE YEARS** when the year is missing:  
   • If the month has already passed this year, assume **${nextYear}**.  
   • If the month has not passed yet, assume **${currentYear}**.  
3. **NEVER** assign years like 2001, 2010, etc. – they are archival and must be ignored.  
4. Examples (if run today):  
   • "August 22"  → "August 22, ${ new Date().getMonth() < 7 ? currentYear : nextYear }"  
   • "January 15" → "January 15, ${ new Date().getMonth() >= 0 ? currentYear : nextYear }"  
5. **COMPLETELY IGNORE** any archived or historical sections.  
6. If a date is ambiguous after applying these rules, **skip that show**.  


DATA CLEAN-UP GUIDELINES:
• Remove state codes appearing in dates (e.g., "Aug 2 AL" → "Aug 2")  
• Separate venue name from address  
• Separate contact name, phone, and email  
• One bullet/paragraph = one event  

OUTPUT:
Return **only** the valid JSON array of events – no explanations or markdown.

HTML CONTENT:
${html}
`;
}

// ================================================================
// SECTION: DATA PROCESSING FUNCTIONS
// ================================================================

// Normalize and enhance extracted show data
function normalizeShowData(rawShow, sourceUrl) {
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
  
  return normalizedShow;
}

// Validate show data
function validateShowData(show) {
  const errors = [];
  const warnings = [];
  
  // Required fields
  if (!show.name) {
    errors.push('Missing show name');
  }
  
  if (!show.startDate) {
    errors.push('Missing or invalid start date');
  }
  
  if (!show.venueName) {
    warnings.push('Missing venue name');
  }
  
  if (!show.city && !show.state) {
    warnings.push('Missing location information (city/state)');
  }
  
  // Date validation
  if (show.startDate && show.endDate) {
    const start = new Date(show.startDate);
    const end = new Date(show.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (start < today) {
      errors.push(`Start date ${show.startDateNormalized} is in the past`);
    }
    
    if (end < start) {
      warnings.push(`End date ${show.endDateNormalized} is before start date ${show.startDateNormalized}`);
    }
  }
  
  return { 
    isValid: errors.length === 0,
    hasWarnings: warnings.length > 0,
    errors,
    warnings
  };
}

// Process a single URL
async function processUrl(url, supabase) {
  log(`Processing URL: ${url}`, null, true);
  
  try {
    // Fetch the page HTML
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const pageResponse = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    clearTimeout(timeout);
    
    if (!pageResponse.ok) {
      logError(`HTTP Error: ${pageResponse.status} ${pageResponse.statusText}`, url);
      return { success: false, showCount: 0 };
    }
    
    const html = await pageResponse.text();
    if (!html || html.length < 100) {
      logError(`Empty or too small HTML response`, url);
      return { success: false, showCount: 0 };
    }
    
    // Check if this is the DPMS Indiana URL - use deterministic parser
    if (url.includes('dpmsportcards.com/indiana-card-shows')) {
      log(`Detected DPMS Indiana URL. Using deterministic parser...`, null, true);
      
      // Parse with custom DPMS parser
      const rawShows = parseDpmsIndianaHtml(html, url);
      log(`Extracted ${rawShows.length} raw shows from DPMS. Normalizing...`, null, true);
      
      // Normalize and validate
      const normalizedShows = [];
      const invalidShows = [];
      const warningShows = [];
      
      for (const rawShow of rawShows) {
        const normalizedShow = normalizeShowData(rawShow, url);
        const validation = validateShowData(normalizedShow);
        
        if (validation.isValid) {
          normalizedShows.push(normalizedShow);
          if (validation.hasWarnings) {
            warningShows.push({
              show: normalizedShow.name,
              warnings: validation.warnings
            });
          }
        } else {
          invalidShows.push({
            show: normalizedShow.name || 'Unnamed show',
            errors: validation.errors
          });
        }
      }
      
      log(`Normalized ${normalizedShows.length} valid DPMS shows (${invalidShows.length} invalid, ${warningShows.length} with warnings)`, null, true);
      
      // Geocode valid shows if enabled
      if (argv.geocode && normalizedShows.length > 0) {
        // Filter shows that have enough address info and apply rate limiting
        const showsToGeocode = normalizedShows.filter(show =>
          show.address || (show.city && show.state)
        ).slice(0, MAX_GEOCODING_REQUESTS);
        
        if (normalizedShows.length > showsToGeocode.length) {
          log(`Rate limiting: geocoding capped at ${showsToGeocode.length}/${normalizedShows.length} shows to control costs`);
        }
        
        log(`Geocoding ${showsToGeocode.length} DPMS shows...`, null, true);
        
        for (let i = 0; i < showsToGeocode.length; i++) {
          const show = showsToGeocode[i];
          
          log(`Geocoding ${i+1}/${showsToGeocode.length}: "${show.name}"`);
          
          const geoResult = await geocodeAddress(
            show.address, 
            show.city, 
            show.state
          );
          
          if (geoResult) {
            show.coordinates = {
              latitude: geoResult.latitude,
              longitude: geoResult.longitude,
              formattedAddress: geoResult.formattedAddress
            };
            
            // If we got a better address from geocoding, use it
            if (geoResult.formattedAddress) {
              // Extract ZIP code if available
              const zipMatch = geoResult.formattedAddress.match(/\b\d{5}(-\d{4})?\b/);
              if (zipMatch) {
                show.zipCode = zipMatch[0];
              }
            }
          }
          
          // Delay to respect quota
          if (i < showsToGeocode.length - 1) {
            log(`Rate limiting: waiting ${GEOCODE_REQUEST_DELAY_MS}ms before next geocoding request`);
            await delay(GEOCODE_REQUEST_DELAY_MS);
          }
        }
      }
      
      // Skip database operations if dry run
      if (argv.dryRun) {
        log(`DRY RUN: Would insert ${normalizedShows.length} DPMS shows`, null, true);
        return { success: true, showCount: normalizedShows.length };
      }
      
      // Insert each show into the pending table
      log(`Inserting ${normalizedShows.length} DPMS shows into database...`, null, true);
      let insertedCount = 0;
      
      for (const show of normalizedShows) {
        try {
          const { error } = await supabase
            .from('scraped_shows_pending')
            .insert({
              source_url: url,
              raw_payload: show.original,
              normalized_json: show,
              geocoded_json: show.coordinates ? {
                coordinates: show.coordinates,
                geocoded_at: new Date().toISOString()
              } : null,
              status: 'PENDING'
            });
          
          if (error) {
            logError(`Error inserting DPMS show: ${error.message}`, show.name);
          } else {
            insertedCount++;
          }
        } catch (e) {
          logError(`Exception inserting DPMS show: ${e.message}`, show.name);
        }
      }
      
      log(`Successfully inserted ${insertedCount} of ${normalizedShows.length} DPMS shows`, null, true);
      return { success: true, showCount: insertedCount };
    }
    
    // For non-DPMS URLs, continue with AI extraction
    log(`HTML fetched (${html.length} bytes). Chunking & extracting with AI...`, null, true);

    // Check for Google AI API key
    const geminiApiKey = process.env.GOOGLE_AI_KEY;
    if (!geminiApiKey) {
      logError(`Missing Google AI API key`, 'Set GOOGLE_AI_KEY environment variable');
      return { success: false, showCount: 0 };
    }

    const AI_MODEL = 'gemini-1.5-flash';
    const aiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${geminiApiKey}`;

    // Naive chunking: start / middle / end
    const htmlChunks = [];
    htmlChunks.push({ 
      chunk: html.substring(0, MAX_HTML_SIZE),
      note: 'Document start' 
    });
    
    if (html.length > MAX_HTML_SIZE * 2) {
      const midStart = Math.floor(html.length / 2) - Math.floor(MAX_HTML_SIZE / 2);
      htmlChunks.push({ 
        chunk: html.substring(midStart, midStart + MAX_HTML_SIZE),
        note: 'Document middle' 
      });
    }
    
    if (html.length > MAX_HTML_SIZE * 3) {
      htmlChunks.push({ 
        chunk: html.substring(html.length - MAX_HTML_SIZE),
        note: 'Document end' 
      });
    }

    // Limit chunks
    let chunksToProcess = htmlChunks.slice(0, MAX_CHUNKS);

    // ------------------------------------------------------------------
    // AI RATE-LIMITING – cap number of Gemini calls & control spend
    // ------------------------------------------------------------------
    if (chunksToProcess.length > MAX_AI_REQUESTS) {
      log(
        `Rate limiting: capping AI requests at ${MAX_AI_REQUESTS}/${chunksToProcess.length} chunks to control costs`
      );
      chunksToProcess = chunksToProcess.slice(0, MAX_AI_REQUESTS);
    }
    const allShows = [];
    const isSCD = url.includes('sportscollectorsdigest');

    for (let i = 0; i < chunksToProcess.length; i++) {
      const { chunk } = chunksToProcess[i];
      const prompt = isSCD ? buildEnhancedSCDPrompt(chunk) : buildEnhancedAIPrompt(chunk, url);

      const aiController = new AbortController();
      const aiTimeoutId = setTimeout(() => aiController.abort(), AI_TIMEOUT_MS);
      

      let aiRespOk = false;
      let rawText   = '';
      let retryCnt  = 0;

      while (!aiRespOk && retryCnt < AI_MAX_RETRIES) {
        const aiCtrl  = new AbortController();
        const toId    = setTimeout(() => aiCtrl.abort(), AI_TIMEOUT_MS);
        try {
          const aiResp = await fetch(aiApiUrl, {
            method: 'POST',
            signal: aiCtrl.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, topP: 0.8, topK: 40 }
            })
          });

          clearTimeout(toId);

          // Handle overload 503 with retry
          if (aiResp.status === 503) {
            retryCnt++;
            console.warn(`AI 503 on chunk ${i+1}, retry ${retryCnt}/${AI_MAX_RETRIES}`);
            if (retryCnt < AI_MAX_RETRIES) {
              console.warn(`Waiting ${AI_RETRY_DELAY_MS}ms before retry...`);
              await delay(AI_RETRY_DELAY_MS);
              continue; // retry loop
            } else {
              break; // give up after max retries
            }
          }

          if (!aiResp.ok) {
            console.warn(`AI error on chunk ${i+1}: ${aiResp.status}`);
            break;
          }

          const aiJson = await aiResp.json();
          rawText      = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          aiRespOk     = rawText.length > 0;

        } catch (err) {
          console.warn(`AI timeout or error on chunk ${i+1}: ${err.message}`);
          break;
        }
      }

      if (!aiRespOk) continue;

      // Strip markdown fences
      if (rawText.startsWith('```')) {
        rawText = rawText.replace(/```[a-z]*\n?|```/g, '');
      }

      // Braces fix
      if (!rawText.startsWith('[')) {
        const fb = rawText.indexOf('[');
        const lb = rawText.lastIndexOf(']');
        if (fb !== -1 && lb !== -1) {
          rawText = rawText.slice(fb, lb + 1);
        }
      }
      
      let showsChunk = [];
      try {
        showsChunk = JSON.parse(rawText);
        if (Array.isArray(showsChunk)) {
          allShows.push(...showsChunk);
          log(`Chunk ${i+1} ⇒ ${showsChunk.length} shows`);
        }
      } catch (error) {
        logError(`Failed to parse AI response for chunk ${i+1}`, error);
      }

      // --------------------------------------------------------------
      // Delay before next AI request to respect quota & avoid spikes
      // --------------------------------------------------------------
      if (i < chunksToProcess.length - 1) {
        log(
          `Rate limiting: waiting ${AI_REQUEST_DELAY_MS}ms before next AI request`
        );
        await delay(AI_REQUEST_DELAY_MS);
      }
    }

    if (allShows.length === 0) {
      log(`No shows parsed from any chunk`, null, true);
      return { success: true, showCount: 0 };
    }
    
    log(`Extracted total ${allShows.length} raw shows. Normalizing...`, null, true);
    
    // Normalize and validate each show
    const normalizedShows = [];
    const invalidShows = [];
    const warningShows = [];
    
    for (const rawShow of allShows) {
      const normalizedShow = normalizeShowData(rawShow, url);
      const validation = validateShowData(normalizedShow);
      
      if (validation.isValid) {
        normalizedShows.push(normalizedShow);
        if (validation.hasWarnings) {
          warningShows.push({
            show: normalizedShow.name,
            warnings: validation.warnings
          });
        }
      } else {
        invalidShows.push({
          show: normalizedShow.name || 'Unnamed show',
          errors: validation.errors
        });
      }
    }
    
    log(`Normalized ${normalizedShows.length} valid shows (${invalidShows.length} invalid, ${warningShows.length} with warnings)`, null, true);
    
    if (invalidShows.length > 0) {
      log(`Invalid shows:`, invalidShows);
    }
    
    if (warningShows.length > 0) {
      log(`Shows with warnings:`, warningShows);
    }
    
    // Geocode valid shows if enabled
    if (argv.geocode && normalizedShows.length > 0) {
      // Filter shows that have enough address info and apply rate limiting
      const showsToGeocode = normalizedShows.filter(show =>
        show.address || (show.city && show.state)
      ).slice(0, MAX_GEOCODING_REQUESTS);

      if (normalizedShows.length > showsToGeocode.length) {
        log(`Rate limiting: geocoding capped at ${showsToGeocode.length}/${normalizedShows.length} shows to control costs`);
      }

      log(`Geocoding ${showsToGeocode.length} shows...`, null, true);
      
      for (let i = 0; i < showsToGeocode.length; i++) {
        const show = showsToGeocode[i];
        
        log(`Geocoding ${i+1}/${normalizedShows.length}: "${show.name}"`);
        
        const geoResult = await geocodeAddress(
          show.address, 
          show.city, 
          show.state
        );
        
        if (geoResult) {
          show.coordinates = {
            latitude: geoResult.latitude,
            longitude: geoResult.longitude,
            formattedAddress: geoResult.formattedAddress
          };
          
          // If we got a better address from geocoding, use it
          if (geoResult.formattedAddress) {
            // Parse the formatted address to potentially fill in missing fields
            const addressParts = geoResult.formattedAddress.split(', ');
            
            // If we're missing address and have at least 2 parts
            if (!show.address && addressParts.length >= 2) {
              show.address = addressParts[0];
            }
            
            // If we're missing city and have at least 3 parts
            if (!show.city && addressParts.length >= 3) {
              show.city = addressParts[addressParts.length - 3];
            }
            
            // If we're missing state and have at least 2 parts
            if (!show.state && addressParts.length >= 2) {
              const stateZip = addressParts[addressParts.length - 2];
              const stateMatch = stateZip.match(/^([A-Z]{2})/);
              if (stateMatch) {
                show.state = stateMatch[1];
              }
            }
            
            // If we're missing zip and have at least 2 parts
            if (!show.zipCode && addressParts.length >= 2) {
              const stateZip = addressParts[addressParts.length - 2];
              const zipMatch = stateZip.match(/\d{5}(-\d{4})?$/);
              if (zipMatch) {
                show.zipCode = zipMatch[0];
              }
            }
          }
        }
        
        // Delay to respect quota
        if (i < showsToGeocode.length - 1) {
          log(`Rate limiting: waiting ${GEOCODE_REQUEST_DELAY_MS}ms before next geocoding request`);
          await delay(GEOCODE_REQUEST_DELAY_MS);
        }
      }
    }
    
    // Skip database operations if dry run
    if (argv.dryRun) {
      log(`DRY RUN: Would insert ${normalizedShows.length} shows`, null, true);
      return { success: true, showCount: normalizedShows.length };
    }
    
    // Insert each show into the pending table
    log(`Inserting ${normalizedShows.length} shows into database...`, null, true);
    let insertedCount = 0;
    
    for (const show of normalizedShows) {
      try {
        const { error } = await supabase
          .from('scraped_shows_pending')
          .insert({
            source_url: url,
            raw_payload: show.original,
            normalized_json: show,
            geocoded_json: show.coordinates ? {
              coordinates: show.coordinates,
              geocoded_at: new Date().toISOString()
            } : null,
            status: 'PENDING'
          });
        
        if (error) {
          logError(`Error inserting show: ${error.message}`, show.name);
        } else {
          insertedCount++;
        }
      } catch (e) {
        logError(`Exception inserting show: ${e.message}`, show.name);
      }
    }

    log(`Successfully inserted ${insertedCount} of ${normalizedShows.length} shows`, null, true);
    return { success: true, showCount: insertedCount };
    
  } catch (e) {
    logError(`Processing failed: ${e.message}`, url);
    return { success: false, showCount: 0 };
  }
}

// Inspect and fix a specific record
async function inspectRecord(recordId, supabase) {
  log(`Inspecting record: ${recordId}`, null, true);
  
  try {
    // Fetch the record
    const { data: record, error } = await supabase
      .from('scraped_shows_pending')
      .select('*')
      .eq('id', recordId)
      .single();
    
    if (error) {
      logError(`Error fetching record: ${error.message}`, recordId);
      return false;
    }
    
    if (!record) {
      logError(`Record not found: ${recordId}`);
      return false;
    }
    
    // Display record details
    log(`RECORD DETAILS (ID: ${record.id})`, null, true);
    console.log(`Source URL: ${record.source_url}`);
    console.log(`Status: ${record.status}`);
    console.log(`Created: ${new Date(record.created_at).toLocaleString()}`);
    
    if (record.raw_payload) {
      console.log('\nRaw Payload:');
      console.log('-'.repeat(40));
      console.log(JSON.stringify(record.raw_payload, null, 2));
    }
    
    if (record.normalized_json) {
      console.log('\nNormalized Data:');
      console.log('-'.repeat(40));
      console.log(JSON.stringify(record.normalized_json, null, 2));
    }
    
    // Normalize and enhance the data
    console.log('\nRe-normalizing data...');
    const enhancedShow = normalizeShowData(record.raw_payload, record.source_url);
    const validation = validateShowData(enhancedShow);
    
    console.log('\nEnhanced Data:');
    console.log('-'.repeat(40));
    console.log(JSON.stringify(enhancedShow, null, 2));
    
    if (!validation.isValid) {
      console.log('\nValidation Errors:');
      console.log('-'.repeat(40));
      validation.errors.forEach(err => console.log(`- ${err}`));
    }
    
    if (validation.hasWarnings) {
      console.log('\nValidation Warnings:');
      console.log('-'.repeat(40));
      validation.warnings.forEach(warn => console.log(`- ${warn}`));
    }
    
    // Geocode if needed
    let geoResult = null;
    if (argv.geocode && (!record.geocoded_json || !record.geocoded_json.coordinates)) {
      console.log('\nGeocoding address...');
      geoResult = await geocodeAddress(
        enhancedShow.address,
        enhancedShow.city,
        enhancedShow.state
      );
      
      if (geoResult) {
        console.log('\nGeocoding Result:');
        console.log('-'.repeat(40));
        console.log(JSON.stringify(geoResult, null, 2));
        
        enhancedShow.coordinates = {
          latitude: geoResult.latitude,
          longitude: geoResult.longitude,
          formattedAddress: geoResult.formattedAddress
        };
      } else {
        console.log('\nGeocoding failed or was skipped');
      }
    }
    
    // Ask for confirmation before updating
    const confirmed = await confirm('\nDo you want to update this record with the enhanced data?');
    
    if (!confirmed) {
      console.log('Update cancelled');
      return true;
    }
    
    // Update the record
    const { error: updateError } = await supabase
      .from('scraped_shows_pending')
      .update({
        normalized_json: enhancedShow,
        geocoded_json: enhancedShow.coordinates ? {
          coordinates: enhancedShow.coordinates,
          geocoded_at: new Date().toISOString()
        } : record.geocoded_json
      })
      .eq('id', recordId);
    
    if (updateError) {
      logError(`Error updating record: ${updateError.message}`, recordId);
      return false;
    }
    
    log(`Successfully updated record: ${recordId}`, null, true);
    return true;
    
  } catch (e) {
    logError(`Inspection failed: ${e.message}`, recordId);
    return false;
  }
}

// Update scraping source stats after processing
async function updateScrapingSourceStats(url, success, showCount = 0, supabase) {
  try {
    const updates = {
      updated_at: new Date().toISOString()
    };
    
    if (success) {
      updates.last_success_at = new Date().toISOString();
      updates.error_streak = 0;

      if (showCount > 0) {
        const { data: incScore, error: incErr } = await supabase.rpc(
          'increment_priority',
          { url_param: url, increment_amount: Math.min(showCount, 5) }
        );
        
        if (incErr) {
          logError(`RPC increment_priority failed: ${incErr.message}`, url);
        } else if (typeof incScore === 'number') {
          updates.priority_score = incScore;
        }
      }
    } else {
      updates.last_error_at = new Date().toISOString();
      
      // Increment error streak
      const { data: newStreak, error: streakErr } = await supabase.rpc(
        'increment_error_streak',
        { url_param: url }
      );
      
      if (streakErr) {
        logError(`RPC increment_error_streak failed: ${streakErr.message}`, url);
      } else if (typeof newStreak === 'number') {
        updates.error_streak = newStreak;
      }

      // Decrease priority for errors
      const { data: decScore, error: decErr } = await supabase.rpc(
        'decrement_priority',
        { url_param: url, decrement_amount: 1 }
      );
      
      if (decErr) {
        logError(`RPC decrement_priority failed: ${decErr.message}`, url);
      } else if (typeof decScore === 'number') {
        updates.priority_score = decScore;
      }
    }
    
    const { error } = await supabase
      .from('scraping_sources')
      .update(updates)
      .eq('url', url);
    
    if (error) {
      logError(`Error updating scraping source stats for ${url}: ${error.message}`);
    }
  } catch (e) {
    logError(`Exception updating scraping source stats for ${url}: ${e.message}`);
  }
}

// Main function
async function main() {
  const startTime = Date.now();
  
  // Check environment variables before initializing Supabase
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!SUPABASE_URL) {
    logError('Missing Supabase URL', 'Set SUPABASE_URL environment variable');
    process.exit(1);
  }
  
  if (!SUPABASE_KEY) {
    logError('Missing Supabase service role key', 'Set SUPABASE_SERVICE_ROLE_KEY environment variable');
    process.exit(1);
  }
  
  // Initialize Supabase client only when we need it
  let supabase;
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (error) {
    logError('Failed to initialize Supabase client', error);
    process.exit(1);
  }
  
  // Check if we're inspecting a specific record
  if (argv['inspect-id']) {
    const success = await inspectRecord(argv['inspect-id'], supabase);
    rl.close();
    process.exit(success ? 0 : 1);
  }
  
  let urlsToProcess = [];
  
  // Determine which URLs to process
  if (argv.url) {
    // If specific URL provided, use that
    urlsToProcess = [{ url: argv.url }];
    log(`Using specific URL: ${argv.url}`, null, true);
  } else {
    // Otherwise load from seed file and filter by state if needed
    const seedData = loadSeedUrls();
    urlsToProcess = argv.state 
      ? filterUrlsByState(seedData, argv.state)
      : seedData;
      
    if (urlsToProcess.length === 0) {
      log(`No URLs found${argv.state ? ` for state ${argv.state.toUpperCase()}` : ''}`, null, true);
      process.exit(0);
    }
  }
  
  log(`Processing ${urlsToProcess.length} URLs`, null, true);
  
  const results = [];
  let totalShowsFound = 0;
  let successfulScrapes = 0;
  
  // Process URLs sequentially
  for (const item of urlsToProcess) {
    const url = item.url;
    const result = await processUrl(url, supabase);
    results.push({ url, ...result });
    
    if (result.success) {
      successfulScrapes++;
      totalShowsFound += result.showCount;
    }
    
    // Update stats after each URL
    if (!argv.dryRun) {
      await updateScrapingSourceStats(url, result.success, result.showCount, supabase);
    }
    
    // Small delay between requests to be nice to servers
    if (urlsToProcess.indexOf(item) < urlsToProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
  
  log(`Scraper completed in ${elapsedSeconds}s`, {
    processed: urlsToProcess.length,
    successful: successfulScrapes,
    showsFound: totalShowsFound,
    results
  }, true);
  
  rl.close();
}

// Run the main function
main().catch(error => {
  logError('Unhandled error in main process', error);
  rl.close();
  process.exit(1);
});
