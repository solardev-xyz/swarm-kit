import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, concatBytes, normalizeBytes, utf8ToBytes, type BytesLike } from './bytes.js';

export type IdentifierPart = BytesLike | number | bigint | Date;

export function keccakHex(bytes: Uint8Array): string {
  return bytesToHex(keccak_256(bytes));
}

export function deriveIdentifier(parts: readonly IdentifierPart[]): string {
  const encoded = parts.map(encodePart);
  return keccakHex(concatBytes(encoded));
}

function encodePart(part: IdentifierPart): Uint8Array {
  if (typeof part === 'number') {
    if (!Number.isSafeInteger(part) || part < 0) {
      throw new Error('Identifier number parts must be non-negative safe integers');
    }
    return encodeTagged('number', uint64be(BigInt(part)));
  }
  if (typeof part === 'bigint') {
    if (part < 0n) throw new Error('Identifier bigint parts must be non-negative');
    return encodeTagged('bigint', uint64be(part));
  }
  if (part instanceof Date) {
    return encodeTagged('date', uint64be(BigInt(part.getTime())));
  }
  if (typeof part === 'string') {
    return encodeTagged('string', utf8ToBytes(part));
  }
  return encodeTagged('bytes', normalizeBytes(part));
}

function encodeTagged(tag: string, bytes: Uint8Array): Uint8Array {
  return concatBytes([
    uint32be(tag.length),
    utf8ToBytes(tag),
    uint32be(bytes.length),
    bytes,
  ]);
}

function uint32be(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function uint64be(value: bigint): Uint8Array {
  if (value > 0xffff_ffff_ffff_ffffn) {
    throw new Error('Identifier integer parts must fit into uint64');
  }
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value, false);
  return bytes;
}
