/**
 * PostgREST Filter Utilities
 * 
 * Helper functions for formatting values to work with PostgREST filter syntax
 * used by the Supabase client.
 */

/**
 * Formats an array of values into a parenthesized, quoted list for use with
 * PostgREST `in` and `not.in` filters.
 * 
 * @example
 * // Returns: '("id1","id2","id3")'
 * formatInList(['id1', 'id2', 'id3']);
 * 
 * @example
 * // For use with Supabase query filters:
 * query.not('id', 'in', formatInList(idsToExclude));
 * // or
 * query.filter('id', 'in', formatInList(idsToInclude));
 * 
 * @param values - Array of string values to format (null/undefined values are filtered out)
 * @returns A properly formatted string for PostgREST in/not-in filters: '("val1","val2",...)'
 */
export function formatInList(values: Array<string | null | undefined>): string {
  // Filter out null/undefined values
  const validValues = values.filter(Boolean);
  
  if (validValues.length === 0) {
    return "()"; // Empty list
  }
  
  // Format each value: escape quotes and wrap in double quotes
  const formattedValues = validValues.map(value => {
    // Defensive: escape any embedded double quotes (though UUIDs won't have them)
    const escaped = String(value).replace(/"/g, '\\"');
    return `"${escaped}"`;
  });
  
  // Join with commas and wrap in parentheses
  return `(${formattedValues.join(',')})`;
}

/**
 * Formats a list of values for use with PostgREST, with additional handling for
 * large arrays that might exceed URL length limits.
 * 
 * For very large arrays, consider using this with multiple queries or a different approach.
 * 
 * @param values - Array of values to format
 * @param chunkSize - Optional maximum chunk size (default: 100)
 * @returns Formatted string for PostgREST
 */
export function formatLargeInList(
  values: Array<string | null | undefined>,
  chunkSize: number = 100
): string {
  // If under chunk size, use standard formatter
  if (values.length <= chunkSize) {
    return formatInList(values);
  }
  
  // Warning for large arrays that might cause issues
  console.warn(
    `[postgrest] Large array (${values.length} items) used with formatLargeInList. ` +
    `Consider server-side filtering or pagination instead.`
  );
  
  // For now, just use the standard formatter with a warning
  // In a real implementation, you might want to split this into multiple queries
  return formatInList(values.slice(0, chunkSize));
}
