/**
 * dateUtils.ts
 * Utility functions for date formatting and manipulation
 */

/**
 * Format a date to a human-readable string
 * @param date Date object or ISO string
 * @param options Intl.DateTimeFormatOptions to customize the format
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string | undefined | null,
  options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }
): string => {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', options);
  } catch (err) {
    console.error('Error formatting date:', err);
    return typeof date === 'string' ? date : '';
  }
};

/**
 * Check if two dates represent the same day
 * @param date1 First date
 * @param date2 Second date
 * @returns True if both dates are on the same day
 */
export const isSameDay = (
  date1: Date | string | undefined | null,
  date2: Date | string | undefined | null
): boolean => {
  if (!date1 || !date2) return false;
  
  try {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
    
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  } catch (err) {
    console.error('Error comparing dates:', err);
    return false;
  }
};

/**
 * Format a date range intelligently, handling one-day shows
 * @param startDate Start date
 * @param endDate End date
 * @param options Intl.DateTimeFormatOptions to customize the format
 * @returns Formatted date range string
 */
export const formatDateRange = (
  startDate: Date | string | undefined | null,
  endDate: Date | string | undefined | null,
  options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }
): string => {
  if (!startDate) return '';
  
  // If no end date or same as start date, just show the start date
  if (!endDate || isSameDay(startDate, endDate)) {
    return formatDate(startDate, options);
  }
  
  // Otherwise, show the range
  return `${formatDate(startDate, options)} to ${formatDate(endDate, options)}`;
};

/**
 * Format a date to a relative time string (e.g. "2 minutes ago")
 * @param date Date object or parsable date string
 * @returns Human-readable relative time
 */
export const formatRelativeTime = (
  date: Date | string | number | null | undefined
): string => {
  if (!date) return '';

  const dateObj: Date =
    typeof date === 'string' || typeof date === 'number'
      ? new Date(date)
      : date;

  const secondsDiff = Math.floor((Date.now() - dateObj.getTime()) / 1000);

  // Handle future dates – return empty string instead of negative values
  if (secondsDiff < 0) return '';

  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],            // up to 59 seconds
    [60, 'minute'],            // up to 59 minutes
    [24, 'hour'],              // up to 23 hours
    [7, 'day'],                // up to 6 days
    [4.34812, 'week'],         // approx. 4.3 weeks in a month
    [12, 'month'],             // up to 11 months
  ];

  let value = secondsDiff;
  let unit: Intl.RelativeTimeFormatUnit = 'second';

  // Iterate through unit thresholds to find the most appropriate one
  for (const [threshold, currentUnit] of units) {
    if (value < threshold) {
      unit = currentUnit;
      break;
    }
    value = Math.floor(value / threshold);
    unit = currentUnit;
  }

  // Years are a special case (anything beyond months threshold)
  if (unit === 'month' && value >= 12) {
    value = Math.floor(value / 12);
    unit = 'year';
  }

  // Use Intl.RelativeTimeFormat when available for better i18n
  if (typeof Intl !== 'undefined' && (Intl as any).RelativeTimeFormat) {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    return rtf.format(-value, unit);
  }

  // Fallback manual formatting
  const plural = Math.abs(value) === 1 ? '' : 's';
  return `${value} ${unit}${plural} ago`;
};
