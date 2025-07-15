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
  } catch (error) {
    console.error('Error formatting date:', error);
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
  } catch (error) {
    console.error('Error comparing dates:', error);
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
