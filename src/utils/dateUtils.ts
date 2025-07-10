/**
 * Date utility functions for formatting and manipulating dates
 */

/**
 * Formats a date as a relative time string (e.g., "just now", "5 minutes ago", "yesterday")
 * @param date The date to format
 * @param now Optional reference date (defaults to current time)
 * @returns Human-readable relative time string
 */
export const formatRelativeTime = (date: Date, now: Date = new Date()): string => {
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  // Handle future dates
  if (seconds < 0) {
    // For small future differences (within a minute), treat as "just now"
    if (seconds > -60) {
      return 'just now';
    }
    return formatFutureTime(date, now);
  }
  
  // Handle past dates
  if (seconds < 30) {
    return 'just now';
  }
  
  if (seconds < 60) {
    return 'less than a minute ago';
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? 'a minute ago' : `${minutes} minutes ago`;
  }
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  }
  
  const days = Math.floor(hours / 24);
  if (days === 1) {
    return 'yesterday';
  }
  
  if (days < 7) {
    return `${days} days ago`;
  }
  
  const weeks = Math.floor(days / 7);
  if (weeks === 1) {
    return 'last week';
  }
  
  if (weeks < 5) {
    return `${weeks} weeks ago`;
  }
  
  const months = Math.floor(days / 30);
  if (months === 1) {
    return 'last month';
  }
  
  if (months < 12) {
    return `${months} months ago`;
  }
  
  const years = Math.floor(days / 365);
  return years === 1 ? 'last year' : `${years} years ago`;
};

/**
 * Helper function to format future dates
 * @param date Future date
 * @param now Reference date
 * @returns Human-readable future time string
 */
const formatFutureTime = (date: Date, now: Date): string => {
  const seconds = Math.floor((date.getTime() - now.getTime()) / 1000);
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? 'in a minute' : `in ${minutes} minutes`;
  }
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? 'in an hour' : `in ${hours} hours`;
  }
  
  const days = Math.floor(hours / 24);
  if (days === 1) {
    return 'tomorrow';
  }
  
  if (days < 7) {
    return `in ${days} days`;
  }
  
  const weeks = Math.floor(days / 7);
  if (weeks === 1) {
    return 'next week';
  }
  
  if (weeks < 5) {
    return `in ${weeks} weeks`;
  }
  
  const months = Math.floor(days / 30);
  if (months === 1) {
    return 'next month';
  }
  
  if (months < 12) {
    return `in ${months} months`;
  }
  
  const years = Math.floor(days / 365);
  return years === 1 ? 'next year' : `in ${years} years`;
};

/**
 * Format a date as a short date string (e.g., "Jan 1, 2023")
 * @param date The date to format
 * @returns Formatted date string
 */
export const formatShortDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format a date as a time string (e.g., "3:45 PM")
 * @param date The date to format
 * @returns Formatted time string
 */
export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Format a date for display in a message timestamp (e.g., "Jan 1 at 3:45 PM")
 * @param date The date to format
 * @returns Formatted date and time string
 */
export const formatMessageTimestamp = (date: Date): string => {
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && 
                  date.getMonth() === now.getMonth() && 
                  date.getFullYear() === now.getFullYear();
  
  if (isToday) {
    return formatTime(date);
  }
  
  const isThisYear = date.getFullYear() === now.getFullYear();
  
  if (isThisYear) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }) + ' at ' + formatTime(date);
  }
  
  return formatShortDate(date);
};
