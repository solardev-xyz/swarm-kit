export interface FindLatestIndexOptions {
  maxIndex?: number;
}

export type IndexedSocExistsAt = (index: number) => Promise<boolean>;

export async function findLatestContiguousIndex(
  existsAt: IndexedSocExistsAt,
  options: FindLatestIndexOptions = {},
): Promise<number> {
  const maxIndex = options.maxIndex ?? Number.MAX_SAFE_INTEGER;
  assertIndexedSocIndex(maxIndex, 'maxIndex');

  if (!(await existsAt(0))) return -1;

  let low = 0;
  let high = 1;

  while (high <= maxIndex && await existsAt(high)) {
    low = high;
    if (high === maxIndex) return high;
    high = Math.min(high * 2, maxIndex);
  }

  let left = low + 1;
  let right = Math.min(high - 1, maxIndex);

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (await existsAt(mid)) {
      low = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return low;
}

export function assertIndexedSocIndex(index: number, label = 'index'): void {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Error(`Indexed SOC ${label} must be a non-negative safe integer`);
  }
}

export function assertIndexedSocLimit(limit: number, label = 'limit'): void {
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new Error(`Indexed SOC ${label} must be a non-negative safe integer`);
  }
}
