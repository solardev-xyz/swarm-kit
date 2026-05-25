export function canonicalJson(value: unknown, label = 'value'): string {
  const normalized = JSON.stringify(value);
  if (normalized === undefined) {
    throw new Error(`${label} must be JSON serializable`);
  }
  return stringifyCanonical(JSON.parse(normalized));
}

function stringifyCanonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => stringifyCanonical(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key =>
    `${JSON.stringify(key)}:${stringifyCanonical(record[key])}`
  ).join(',')}}`;
}
