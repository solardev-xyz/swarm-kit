export type BytesLike = string | Uint8Array | ArrayBuffer;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function utf8ToBytes(value: string): Uint8Array {
  return textEncoder.encode(value);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

export function normalizeBytes(value: BytesLike): Uint8Array {
  if (typeof value === 'string') return utf8ToBytes(value);
  if (value instanceof Uint8Array) return value;
  return new Uint8Array(value);
}

export function jsonToBytes(value: unknown): Uint8Array {
  return utf8ToBytes(JSON.stringify(value));
}

export function bytesToJson<T = unknown>(bytes: Uint8Array): T {
  return JSON.parse(bytesToUtf8(bytes)) as T;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.replace(/^0x/, '');
  if (normalized.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(normalized)) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function assertHex(value: string, bytes: number, label = 'hex'): string {
  const normalized = value.replace(/^0x/, '');
  if (normalized.length !== bytes * 2 || !/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error(`${label} must be a ${bytes * 2}-character hex string`);
  }
  return normalized.toLowerCase();
}
