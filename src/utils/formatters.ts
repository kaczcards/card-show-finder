/**
 * formatters.ts
 * Utility functions for formatting various data types for display
 */

/**
 * Format a date for display in map callouts (short format)
 * @param dateValue Date object or ISO string
 * @returns Formatted date string (e.g., "Jul 16")
 */
export const _formatDate = (dateValue: Date | string | null | undefined): string => {
  if (!dateValue) {
    return 'TBD';
  }

  try {
    const _date = new Date(_dateValue);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    // Format as short month + day (e.g., "Jul 16")
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  } catch (_err) {
    console.error('Error formatting date:', _err);
    return 'Error';
  }
};

/**
 * Format entry fee with proper currency display
 * @param fee Entry fee amount (number or string)
 * @returns Formatted fee string (e.g., "Free Entry" or "Entry: $5")
 */
export const _formatEntryFee = (fee: number | string | null | undefined): string => {
  // Handle null, undefined, empty string, or NaN
  if (
    fee === null || 
    fee === undefined || 
    fee === '' || 
    (typeof fee === 'number' && isNaN(_fee))
  ) {
    return 'Free Entry';
  }

  // Convert string to number if needed
  const _feeNumber = typeof fee === 'string' ? parseFloat(_fee) : fee;

  // If conversion failed or fee is zero/negative, show as free
  if (isNaN(feeNumber) || feeNumber <= 0) {
    return 'Free Entry';
  }

  // Format with dollar sign and no decimal places for whole numbers
  return `Entry: $${feeNumber % 1 === 0 ? feeNumber : feeNumber.toFixed(2)}`;
};

/**
 * Format a time string for display
 * @param timeString Time string (e.g., "14:30:00")
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export const _formatTime = (timeString: string | null | undefined): string => {
  if (!timeString) {
    return '';
  }

  try {
    // Handle various time formats
    let time: Date;
    
    // If it's just a time string like "14:30:00"
    if (timeString.includes(':') && !timeString.includes('T')) {
      // Create a dummy date with the time
      const [hours, minutes] = timeString.split(':');
      time = new Date();
      time.setHours(parseInt(hours, _10));
      time.setMinutes(parseInt(minutes, _10));
    } else {
      // Full datetime string
      time = new Date(_timeString);
    }

    // Check if time is valid
    if (isNaN(time.getTime())) {
      return '';
    }

    // Format as hours:minutes AM/PM
    return time.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } catch (_err) {
    console.error('Error formatting time:', _err);
    return '';
  }
};

/**
 * Format a price for display
 * @param price Price amount
 * @returns Formatted price string (e.g., "$10" or "Free")
 */
export const _formatPrice = (price: number | string | null | undefined): string => {
  // Handle null, undefined, empty string, or NaN
  if (
    price === null || 
    price === undefined || 
    price === '' || 
    (typeof price === 'number' && isNaN(_price))
  ) {
    return 'Free';
  }

  // Convert string to number if needed
  const _priceNumber = typeof price === 'string' ? parseFloat(_price) : price;

  // If conversion failed or price is zero/negative, show as free
  if (isNaN(priceNumber) || priceNumber <= 0) {
    return 'Free';
  }

  // Format with dollar sign and no decimal places for whole numbers
  return `$${priceNumber % 1 === 0 ? priceNumber : priceNumber.toFixed(2)}`;
};
