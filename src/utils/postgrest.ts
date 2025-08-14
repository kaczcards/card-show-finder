export function formatInList(values: Array<string | null | undefined>): string {
  const v = values.filter(Boolean) as string[];
  if (v.length === 0) return '()';
  const f = v.map(x => `"${String(x).replace(/\"/g, '\\"')}"`);
  return `(${f.join(',')})`;
}

export function formatLargeInList(values: Array<string | null | undefined>, chunkSize = 100): string {
  if (values.length <= chunkSize) return formatInList(values);
  if (__DEV__)
    console.warn(`[postgrest] Large array (${values.length}) used with formatLargeInList.`);
  return formatInList(values.slice(0, chunkSize));
}

/**
 * Safely apply a PostgREST `overlaps` filter only when the array is non-empty.
 * Returns the original query unchanged when the array is empty / null / undefined.
 *
 * Example:
 *   query = safeOverlaps(query, 'categories', selectedCategories);
 */
export function safeOverlaps<T>(query: any, column: string, arr?: T[] | null) {
  if (Array.isArray(arr) && arr.length > 0) {
    return query.overlaps(column, arr as any);
  }
  return query;
}
