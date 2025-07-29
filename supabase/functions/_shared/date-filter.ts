/**
 * Card Show Finder - Date Filter Utility
 * 
 * This module provides functions to validate if a show date is current or future,
 * filtering out past shows during the scraping process.
 */

// Current date for comparison (using UTC to avoid timezone issues)
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

// Current year for adding to dates without year
const CURRENT_YEAR = TODAY.getFullYear();
const NEXT_YEAR = CURRENT_YEAR + 1;

// Month name mappings
const MONTH_NAMES: Record<string, number> = {
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
 * @param startDate - The start date string from scraped data
 * @param endDate - Optional end date string for multi-day events
 * @returns Object with validity status, reason, and parsed date if successful
 */
export function isShowDateValid(startDate: string | null, endDate?: string | null): {
  valid: boolean;
  reason?: string;
  parsedDate?: Date;
} {
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
function cleanDateString(dateStr: string): string {
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
function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // ------------------------------------------------------------------
  // 1. “Safe” ISO 8601 pattern (YYYY-MM-DD).  Let JS parse it directly.
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
  // FIXED: Properly handle date ranges with explicit year
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
  // FIXED: Properly handle date ranges without year
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
  // LAST-RESORT fallback: let JS attempt to parse *only* if the string does
  // NOT look like a date range (e.g., “Jan 5-6, 2025” or “Aug 23-24”).
  // ------------------------------------------------------------------
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
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Log date filtering results for debugging
 */
export function logDateFilterResult(
  result: { valid: boolean; reason?: string; parsedDate?: Date },
  originalDate: string,
  source?: string
): string {
  const sourceInfo = source ? `[${source}] ` : '';
  const dateInfo = `"${originalDate}" → ${result.parsedDate ? formatDate(result.parsedDate) : 'unparseable'}`;
  
  if (result.valid) {
    const message = `${sourceInfo}✅ KEEPING: ${dateInfo} - ${result.reason}`;
    console.log(message);
    return message;
  } else {
    const message = `${sourceInfo}❌ FILTERING: ${dateInfo} - ${result.reason}`;
    console.log(message);
    return message;
  }
}
