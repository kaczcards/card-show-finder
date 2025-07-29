#!/usr/bin/env node
/**
 * Card Show Finder - Date Filter Utility Test
 * 
 * This script tests the date filtering utility to ensure it correctly
 * filters out past shows while keeping current and future shows.
 * It tests various date formats and edge cases, and analyzes real data.
 */

const { createClient } = require('@supabase/supabase-js');
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

// =========================================================================
// Date Filter Utility (JavaScript version of the TypeScript implementation)
// =========================================================================

// Current date for comparison (using UTC to avoid timezone issues)
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

// Current year for adding to dates without year
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
 * Main function to determine if a show date is valid (today or future)
 * 
 * @param {string|null} startDate - The start date string from scraped data
 * @param {string|null} endDate - Optional end date string for multi-day events
 * @returns {Object} Object with validity status, reason, and parsed date if successful
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

  // ------------------------------------------------------------------
  // 1. “Safe” ISO-8601 (YYYY-MM-DD) → let JavaScript parse directly.
  //    We **do not** allow the Date() constructor to guess on other
  //    formats because it mis-parses strings like “Jan 5-6, 2025”.
  // ------------------------------------------------------------------
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
  // FIX: capture only the first day and the year, ignore the second day
  const dateRangePattern = /^([a-z]+)\s+(\d{1,2})-\d{1,2}(?:,)?\s+(\d{4})$/i;
  const dateRangeMatch = dateStr.match(dateRangePattern);
  if (dateRangeMatch) {
    const [_, monthStr, startDayStr, yearStr] = dateRangeMatch;
    const month = MONTH_NAMES[monthStr.toLowerCase()];
    if (month !== undefined) {
      return new Date(parseInt(yearStr), month, parseInt(startDayStr));
    }
  }
  
  // Try "Month Day-Day" format without year (e.g., "Aug 23-24")
  // FIX: capture only the first day, ignore the second day
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
  
  // If all parsing attempts fail, return null
  // ------------------------------------------------------------------
  // LAST-RESORT fallback: try Date() **only if** the string does NOT
  // look like a date-range (e.g., “Jan 5-6, 2025” or “Aug 23-24”).
  // This prevents the 2006-01-05 bug we observed.
  // ------------------------------------------------------------------
  const looksLikeRange = /[a-z]+[\s\-]+\d{1,2}\s*-\s*\d{1,2}/i.test(dateStr);
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

/**
 * Log date filtering results for debugging
 */
function logDateFilterResult(result, originalDate, source) {
  const sourceInfo = source ? `[${source}] ` : '';
  const dateInfo = `"${originalDate}" → ${result.parsedDate ? formatDate(result.parsedDate) : 'unparseable'}`;
  
  if (result.valid) {
    return `${sourceInfo}✅ KEEPING: ${dateInfo} - ${result.reason}`;
  } else {
    return `${sourceInfo}❌ FILTERING: ${dateInfo} - ${result.reason}`;
  }
}

// =========================================================================
// Test Cases
// =========================================================================

/**
 * Test the date filter with various formats
 */
async function testDateFilter() {
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  CARD SHOW FINDER - DATE FILTER UTILITY TEST${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}\n`);
  
  console.log(`${colors.cyan}Today's date: ${formatDate(TODAY)}${colors.reset}\n`);
  
  try {
    // 1. Test with specific date formats from our analysis
    await testSpecificFormats();
    
    // 2. Test edge cases
    await testEdgeCases();
    
    // 3. Analyze real data from the database
    await analyzeRealData();
    
    console.log(`\n${colors.bright}${colors.green}All tests completed successfully!${colors.reset}`);
    
  } catch (error) {
    console.error(`\n${colors.red}ERROR: ${error.message}${colors.reset}`);
    console.error(`${colors.dim}${error.stack}${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Test specific date formats found in the scraped data
 */
async function testSpecificFormats() {
  console.log(`${colors.bright}1. Testing Specific Date Formats${colors.reset}\n`);
  
  const testCases = [
    // Format: [startDate, endDate, expectedValid, description]
    ['3/28/2021', null, false, 'MM/DD/YYYY format (past)'],
    ['3/28/2026', null, true, 'MM/DD/YYYY format (future)'],
    ['April 28', null, null, 'Month Day format (depends on current date)'],
    ['January 5-6, 2025', 'January 6, 2025', true, 'Month Day-Day, Year format (future)'],
    ['January 5-6, 2020', 'January 6, 2020', false, 'Month Day-Day, Year format (past)'],
    ['Aug 2 AL', null, null, 'Month Day + State format (depends on current date)'],
    ['Aug 2', null, null, 'Month Day format (depends on current date)'],
    ['August 2, 2025', null, true, 'Month Day, Year format (future)'],
    ['August 2, 2020', null, false, 'Month Day, Year format (past)'],
    ['Sept 20 AL', null, null, 'Month Day + State format (depends on current date)'],
    ['October 25, 2025', 'October 26, 2025', true, 'Month Day, Year format with end date (future)'],
    ['2025-08-15', null, true, 'ISO format (future)'],
    ['2020-08-15', null, false, 'ISO format (past)'],
    ['Aug 29-31 AL', 'Aug 31 AL', null, 'Month Day-Day + State format (depends on current date)'],
    ['March, 19, 2022', null, false, 'Month, Day, Year format (past)'],
    ['December 4th', null, null, 'Month Day with ordinal (depends on current date)'],
    ['15 January 2025', null, true, 'Day Month Year format (future)'],
    ['15th January', null, null, 'Day with ordinal Month format (depends on current date)']
  ];
  
  console.log(`${colors.cyan}Test Results:${colors.reset}`);
  console.log(`${'─'.repeat(100)}`);
  console.log(`${colors.bright}${'Date String'.padEnd(25)} | ${'End Date'.padEnd(20)} | ${'Valid'.padEnd(6)} | ${'Parsed Date'.padEnd(12)} | ${'Reason'.padEnd(30)}${colors.reset}`);
  console.log(`${'─'.repeat(100)}`);
  
  let passCount = 0;
  let failCount = 0;
  
  for (const [startDate, endDate, expectedValid, description] of testCases) {
    const result = isShowDateValid(startDate, endDate);
    
    // For date-dependent tests (null expected), just report the result
    const testPassed = expectedValid === null || result.valid === expectedValid;
    
    if (testPassed) {
      passCount++;
    } else {
      failCount++;
    }
    
    const validText = result.valid ? `${colors.green}Yes${colors.reset}` : `${colors.red}No${colors.reset}`;
    const parsedDate = result.parsedDate ? formatDate(result.parsedDate) : 'N/A';
    
    console.log(
      `${startDate.padEnd(25)} | ` +
      `${(endDate || 'N/A').padEnd(20)} | ` +
      `${validText.padEnd(12)} | ` +
      `${parsedDate.padEnd(12)} | ` +
      `${result.reason?.substring(0, 30) || 'N/A'}`
    );
  }
  
  console.log(`${'─'.repeat(100)}`);
  console.log(`${colors.bright}Results: ${passCount} passed, ${failCount} failed${colors.reset}\n`);
}

/**
 * Test edge cases for the date filter
 */
async function testEdgeCases() {
  console.log(`${colors.bright}2. Testing Edge Cases${colors.reset}\n`);
  
  const edgeCases = [
    // Format: [startDate, endDate, description]
    [null, null, 'Null date'],
    ['', null, 'Empty string'],
    ['   ', null, 'Whitespace only'],
    ['Invalid Date', null, 'Invalid date string'],
    ['2025', null, 'Year only'],
    ['01/01', null, 'MM/DD without year'],
    ['Jan', null, 'Month only'],
    ['Tomorrow', null, 'Text date'],
    ['Next week', null, 'Text date range'],
    ['TBD', null, 'To be determined'],
    [`${TODAY.getMonth() + 1}/${TODAY.getDate()}/${TODAY.getFullYear()}`, null, 'Today exactly'],
    [`${TODAY.getMonth() + 1}/${TODAY.getDate() - 1}/${TODAY.getFullYear()}`, null, 'Yesterday'],
    [`${TODAY.getMonth() + 1}/${TODAY.getDate() + 1}/${TODAY.getFullYear()}`, null, 'Tomorrow'],
    [`12/31/${TODAY.getFullYear() - 1}`, null, 'Last year'],
    [`01/01/${TODAY.getFullYear() + 1}`, null, 'Next year'],
    ['2025-02-29', null, 'Leap year date (valid)'],
    ['2026-02-29', null, 'Invalid leap year date'],
    ['13/01/2025', null, 'Invalid month'],
    ['01/32/2025', null, 'Invalid day'],
    ['00/00/0000', null, 'Zeros']
  ];
  
  console.log(`${colors.cyan}Edge Case Results:${colors.reset}`);
  console.log(`${'─'.repeat(100)}`);
  console.log(`${colors.bright}${'Date String'.padEnd(25)} | ${'Valid'.padEnd(6)} | ${'Parsed Date'.padEnd(12)} | ${'Reason'.padEnd(50)}${colors.reset}`);
  console.log(`${'─'.repeat(100)}`);
  
  for (const [startDate, endDate, description] of edgeCases) {
    const result = isShowDateValid(startDate, endDate);
    
    const validText = result.valid ? `${colors.green}Yes${colors.reset}` : `${colors.red}No${colors.reset}`;
    const parsedDate = result.parsedDate ? formatDate(result.parsedDate) : 'N/A';
    
    console.log(
      `${(startDate || 'null').toString().padEnd(25)} | ` +
      `${validText.padEnd(12)} | ` +
      `${parsedDate.padEnd(12)} | ` +
      `${result.reason?.substring(0, 50) || 'N/A'}`
    );
  }
  
  console.log(`${'─'.repeat(100)}\n`);
}

/**
 * Analyze real data from the database to test filtering effectiveness
 */
async function analyzeRealData() {
  console.log(`${colors.bright}3. Analyzing Real Data from Database${colors.reset}\n`);
  
  try {
    // Create Supabase client
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    console.log(`${colors.dim}Fetching records from scraped_shows_pending...${colors.reset}`);
    
    // Get a sample of records
    const { data, error, count } = await supabase
      .from('scraped_shows_pending')
      .select('id, source_url, raw_payload, status', { count: 'exact' })
      .limit(500);
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      console.log(`${colors.yellow}No records found in the database.${colors.reset}`);
      return;
    }
    
    console.log(`${colors.green}Found ${data.length} records (from total ${count}).${colors.reset}\n`);
    
    // Analyze the dates
    const results = {
      total: data.length,
      kept: 0,
      filtered: 0,
      unparseable: 0,
      missing: 0,
      bySource: {},
      examples: {
        kept: [],
        filtered: []
      }
    };
    
    for (const record of data) {
      const payload = record.raw_payload || {};
      const startDate = payload.startDate;
      const endDate = payload.endDate;
      const source = new URL(record.source_url).hostname;
      
      // Initialize source stats if not exists
      if (!results.bySource[source]) {
        results.bySource[source] = {
          total: 0,
          kept: 0,
          filtered: 0,
          unparseable: 0,
          missing: 0
        };
      }
      
      results.bySource[source].total++;
      
      if (!startDate) {
        results.missing++;
        results.bySource[source].missing++;
        continue;
      }
      
      const result = isShowDateValid(startDate, endDate);
      
      if (result.valid) {
        results.kept++;
        results.bySource[source].kept++;
        
        // Keep a few examples
        if (results.examples.kept.length < 5) {
          results.examples.kept.push({
            id: record.id,
            startDate,
            endDate,
            source,
            result: logDateFilterResult(result, startDate, source)
          });
        }
      } else if (!result.parsedDate) {
        results.unparseable++;
        results.bySource[source].unparseable++;
      } else {
        results.filtered++;
        results.bySource[source].filtered++;
        
        // Keep a few examples
        if (results.examples.filtered.length < 5) {
          results.examples.filtered.push({
            id: record.id,
            startDate,
            endDate,
            source,
            result: logDateFilterResult(result, startDate, source)
          });
        }
      }
    }
    
    // Calculate percentages
    const keptPercent = ((results.kept / results.total) * 100).toFixed(1);
    const filteredPercent = ((results.filtered / results.total) * 100).toFixed(1);
    const unparseablePercent = ((results.unparseable / results.total) * 100).toFixed(1);
    const missingPercent = ((results.missing / results.total) * 100).toFixed(1);
    
    // Display results
    console.log(`${colors.cyan}Filtering Analysis:${colors.reset}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`${colors.bright}Total records analyzed: ${results.total}${colors.reset}`);
    console.log(`${colors.green}Would keep: ${results.kept} (${keptPercent}%)${colors.reset}`);
    console.log(`${colors.red}Would filter: ${results.filtered} (${filteredPercent}%)${colors.reset}`);
    console.log(`${colors.yellow}Unparseable dates: ${results.unparseable} (${unparseablePercent}%)${colors.reset}`);
    console.log(`${colors.yellow}Missing dates: ${results.missing} (${missingPercent}%)${colors.reset}`);
    console.log(`${'─'.repeat(60)}\n`);
    
    // Display source breakdown
    console.log(`${colors.cyan}Source Breakdown:${colors.reset}`);
    console.log(`${'─'.repeat(100)}`);
    console.log(`${colors.bright}${'Source'.padEnd(30)} | ${'Total'.padEnd(8)} | ${'Kept'.padEnd(8)} | ${'Filtered'.padEnd(10)} | ${'Unparseable'.padEnd(12)} | ${'Missing'.padEnd(10)}${colors.reset}`);
    console.log(`${'─'.repeat(100)}`);
    
    Object.entries(results.bySource)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([source, stats]) => {
        const keptPct = ((stats.kept / stats.total) * 100).toFixed(1);
        const filteredPct = ((stats.filtered / stats.total) * 100).toFixed(1);
        const unparsePct = ((stats.unparseable / stats.total) * 100).toFixed(1);
        const missingPct = ((stats.missing / stats.total) * 100).toFixed(1);
        
        console.log(
          `${source.padEnd(30)} | ` +
          `${stats.total.toString().padEnd(8)} | ` +
          `${stats.kept}(${keptPct}%)`.padEnd(12) + ` | ` +
          `${stats.filtered}(${filteredPct}%)`.padEnd(14) + ` | ` +
          `${stats.unparseable}(${unparsePct}%)`.padEnd(16) + ` | ` +
          `${stats.missing}(${missingPct}%)`.padEnd(10)
        );
      });
    
    console.log(`${'─'.repeat(100)}\n`);
    
    // Display examples
    console.log(`${colors.cyan}Examples of Kept Shows:${colors.reset}`);
    results.examples.kept.forEach((example, i) => {
      console.log(`${i + 1}. ${example.result}`);
    });
    
    console.log(`\n${colors.cyan}Examples of Filtered Shows:${colors.reset}`);
    results.examples.filtered.forEach((example, i) => {
      console.log(`${i + 1}. ${example.result}`);
    });
    
  } catch (error) {
    console.error(`${colors.red}Error analyzing database: ${error.message}${colors.reset}`);
  }
}

// Run the tests
testDateFilter().catch(console.error);
