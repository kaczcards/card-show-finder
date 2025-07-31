/**
 * Date and time formatting utilities for show details
 */

/**
 * Formats a show's date range into a human-readable string
 * 
 * @param show The show object containing start_date and optionally end_date
 * @returns Formatted date string like "Mon, Jan 1" or "Mon, Jan 1 - Wed, Jan 3"
 */
export const formatShowDate = (show: any): string => {
  if (!show?.start_date) return '';
  try {
    const startIso = (show.start_date as string).split('T')[0];
    const endIso = show.end_date ? (show.end_date as string).split('T')[0] : null;
    const startDate = new Date(`${startIso}T12:00:00`);
    const endDate = endIso ? new Date(`${endIso}T12:00:00`) : null;
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

    if (endDate && startDate.toDateString() !== endDate.toDateString()) {
      return `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
    }
    return startDate.toLocaleDateString(undefined, options);
  } catch (e) {
    return show.start_date || 'Date unavailable';
  }
};

/**
 * Formats a time string into a human-readable format
 * 
 * @param timeString The time string to format
 * @returns Formatted time string (e.g., "7:00 PM")
 */
export const formatTime = (timeString?: string | null): string => {
  if (!timeString) return '';
  try {
    return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return timeString ?? '';
  }
};

/**
 * Extracts time information from a description string
 * 
 * @param description The description text that might contain time information
 * @returns Extracted time string or null if none found
 */
export const extractTimeFromDescription = (description: string): string | null => {
  if (!description) return null;
  
  // Pattern for "10:00am - 4:00pm" or "10am - 4pm"
  const timePattern1 = /(\d{1,2})(:\d{2})?\s*(am|pm)\s*[-–—to]\s*(\d{1,2})(:\d{2})?\s*(am|pm)/i;
  const match1 = description.match(timePattern1);
  if (match1) {
    return `${match1[1]}${match1[2] || ''}${match1[3].toLowerCase()} - ${match1[4]}${match1[5] || ''}${match1[6].toLowerCase()}`;
  }

  // Pattern for "10-4pm" or "10 - 4 pm"
  const timePattern2 = /\b(\d{1,2})\s*[-–—to]\s*(\d{1,2})(\s*[ap]m)?\b/i;
  const match2 = description.match(timePattern2);
  if (match2) {
    if (match2[3]) {
      return `${match2[1]}${match2[3].toLowerCase()} - ${match2[2]}${match2[3].toLowerCase()}`;
    }
    return `${match2[1]}am - ${match2[2]}pm`;
  }
  
  return null;
};

/**
 * Gets formatted show hours from various possible time fields
 * 
 * @param show The show object with possible time fields
 * @returns Formatted show hours string
 */
export const getFormattedShowHours = (show: any): string => {
  if (!show) return 'Time not specified';
  
  // Try different possible field names for start and end times
  const start = show.start_time ?? show.startTime ?? show.time ?? null;
  const end = show.end_time ?? show.endTime ?? null;

  // Format based on available data
  if (start && end && start !== end) return `${formatTime(start)} - ${formatTime(end)}`;
  if (start) return formatTime(start);
  if (end) return formatTime(end);

  // Try to extract time from description as a fallback
  if (show.description) {
    return extractTimeFromDescription(show.description) || 'Time not specified';
  }
  
  return 'Time not specified';
};
