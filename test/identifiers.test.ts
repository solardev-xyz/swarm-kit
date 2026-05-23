import { describe, expect, test } from 'vitest';
import { deriveIdentifier, keccakHex } from '../src/index.js';

describe('identifier helpers', () => {
  test('derives deterministic 32-byte identifiers', () => {
    const a = deriveIdentifier(['topic', 'hour', 123n]);
    const b = deriveIdentifier(['topic', 'hour', 123n]);
    const c = deriveIdentifier(['topic', 'hour', 124n]);

    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  test('hashes bytes as hex', () => {
    expect(keccakHex(new Uint8Array([1, 2, 3]))).toMatch(/^[0-9a-f]{64}$/);
  });
});
