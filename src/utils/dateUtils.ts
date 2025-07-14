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
 * Format a time string from a date
 * @param timeString Date string or Date object
 * @returns Formatted time string (e.g., "7:00 PM")
 */
export const formatTime = (timeString?: Date | string | null): string => {
  if (!timeString) return '';
  
  try {
    const date = typeof timeString === 'string' ? new Date(timeString) : timeString;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    console.error('Error formatting time:', e);
    return typeof timeString === 'string' ? timeString : '';
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

/**
 * Get relative time description (e.g., "2 days ago", "in 3 hours")
 * @param date Date to compare against now
 * @returns Human-readable relative time
 */
export const getRelativeTimeDescription = (date: Date | string): string => {
  const now = new Date();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const diffMs = targetDate.getTime() - now.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays < -30) {
    return formatDate(targetDate, { year: 'numeric', month: 'short', day: 'numeric' });
  } else if (diffDays < -1) {
    return `${Math.abs(diffDays)} days ago`;
  } else if (diffDays === -1) {
    return 'Yesterday';
  } else if (diffHours < 0) {
    return `${Math.abs(diffHours)} hours ago`;
  } else if (diffMinutes < 0) {
    return `${Math.abs(diffMinutes)} minutes ago`;
  } else if (diffSeconds < 0) {
    return 'Just now';
  } else if (diffSeconds < 60) {
    return 'In a few seconds';
  } else if (diffMinutes < 60) {
    return `In ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}`;
  } else if (diffHours < 24) {
    return `In ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
  } else if (diffDays < 30) {
    return `In ${diffDays} day${diffDays === 1 ? '' : 's'}`;
  } else {
    return formatDate(targetDate, { year: 'numeric', month: 'short', day: 'numeric' });
  }
};

/**
 * Check if a date is in the past
 * @param date Date to check
 * @returns True if the date is in the past
 */
export const isPastDate = (date: Date | string | undefined | null): boolean => {
  if (!date) return false;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj < new Date();
  } catch (error) {
    console.error('Error checking if date is past:', error);
    return false;
  }
};

/**
 * Extract month and day from a date
 * @param date Date to extract from
 * @returns Formatted month and day (e.g., "Jul 20")
 */
export const getMonthAndDay = (date: Date | string | undefined | null): string => {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (error) {
    console.error('Error getting month and day:', error);
    return '';
  }
};
