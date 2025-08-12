export function formatInList(values: Array<string | null | undefined>): string {
  const v = values.filter(Boolean) as string[];
  if (v.length === 0) return '()';
  const f = v.map(x => `"${String(x).replace(/\"/g, '\\"')}"`);
  return `(${f.join(',')})`;
}

export function formatLargeInList(values: Array<string | null | undefined>, chunkSize = 100): string {
  if (values.length <= chunkSize) return formatInList(values);
  console.warn(`[postgrest] Large array (${values.length}) used with formatLargeInList.`);
  return formatInList(values.slice(0, chunkSize));
}
