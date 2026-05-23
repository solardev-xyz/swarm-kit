import { bytesToJson } from './bytes.js';
import { SwarmKitError, isSwarmReason } from './errors.js';
import { deriveIdentifier, type IdentifierPart } from './identifiers.js';
import {
  getSigningIdentity,
  readSocBytesByOwnerAndIdentifier,
  writeSocJson,
  type ReadSocBytesResult,
} from './soc.js';
import type { SwarmProvider, SwarmWriteSingleOwnerChunkResult } from './provider.js';

export interface FindLatestIndexOptions {
  maxIndex?: number;
}

export type IndexedSocExistsAt = (index: number) => Promise<boolean>;

export interface IndexedSocEnvelope {
  index: number;
}

export interface IndexedSocStreamOptions<TEnvelope extends IndexedSocEnvelope> {
  namespace: string;
  parts?: readonly IdentifierPart[];
  entryTag?: string;
  label?: string;
  maxAppendAttempts?: number;
  parseEnvelope: (value: TEnvelope, context: IndexedSocReadContext) => TEnvelope;
  sameEnvelope?: (stored: TEnvelope, expected: TEnvelope) => boolean;
}

export interface IndexedSocReadOptions {
  limit?: number;
}

export interface IndexedSocReadContext {
  index: number;
  identifier: string;
  owner: string;
  reference: string;
}

export interface IndexedSocAppendContext {
  owner: string;
  index: number;
  previousReference: string | null;
}

export interface IndexedSocRecord<TEnvelope extends IndexedSocEnvelope> {
  envelope: TEnvelope;
  soc: ReadSocBytesResult;
}

export interface IndexedSocStreamEntry<TEnvelope extends IndexedSocEnvelope> {
  owner: string;
  identifier: string;
  reference: string;
  envelope: TEnvelope;
}

export interface IndexedSocAppendResult<TEnvelope extends IndexedSocEnvelope> extends IndexedSocStreamEntry<TEnvelope> {
  entryWrite: SwarmWriteSingleOwnerChunkResult;
}

export interface IndexedSocStream<TEnvelope extends IndexedSocEnvelope> {
  entryIdentifier(index: number): string;
  getOwner(): Promise<string>;
  append(
    createEnvelope: (context: IndexedSocAppendContext) => TEnvelope | Promise<TEnvelope>,
  ): Promise<IndexedSocAppendResult<TEnvelope>>;
  readRecord(owner: string, index: number): Promise<IndexedSocRecord<TEnvelope> | null>;
  readAt(owner: string, index: number): Promise<IndexedSocStreamEntry<TEnvelope> | null>;
  findLatestIndex(owner: string, options?: FindLatestIndexOptions): Promise<number>;
  readLatestRecord(owner: string): Promise<IndexedSocRecord<TEnvelope> | null>;
  readLatest(owner: string, options?: IndexedSocReadOptions): Promise<IndexedSocStreamEntry<TEnvelope>[]>;
}

const DEFAULT_ENTRY_TAG = 'entry';
const DEFAULT_LABEL = 'indexed SOC stream';
const DEFAULT_MAX_APPEND_ATTEMPTS = 3;

export function createIndexedSocStream<TEnvelope extends IndexedSocEnvelope>(
  provider: SwarmProvider,
  options: IndexedSocStreamOptions<TEnvelope>,
): IndexedSocStream<TEnvelope> {
  const parts = options.parts ?? [];
  const entryTag = options.entryTag ?? DEFAULT_ENTRY_TAG;
  const label = options.label ?? DEFAULT_LABEL;
  const maxAppendAttempts = options.maxAppendAttempts ?? DEFAULT_MAX_APPEND_ATTEMPTS;
  const sameEnvelope = options.sameEnvelope ?? defaultSameEnvelope;

  function entryIdentifier(index: number): string {
    assertIndexedSocIndex(index, `${label} index`);
    return deriveIdentifier([options.namespace, ...parts, entryTag, index]);
  }

  async function getOwner(): Promise<string> {
    return (await getSigningIdentity(provider)).owner;
  }

  async function readRecord(owner: string, index: number): Promise<IndexedSocRecord<TEnvelope> | null> {
    assertIndexedSocIndex(index, `${label} index`);
    const identifier = entryIdentifier(index);
    try {
      const soc = await readSocBytesByOwnerAndIdentifier(provider, owner, identifier);
      if (soc.identifier.toLowerCase() !== identifier.toLowerCase()) {
        throw new Error(`${label} identifier mismatch for ${soc.reference}`);
      }
      const envelope = options.parseEnvelope(bytesToJson<TEnvelope>(soc.bytes), {
        index,
        identifier,
        owner: soc.owner,
        reference: soc.reference,
      });
      return { envelope, soc };
    } catch (error) {
      if (isSwarmReason(error, 'chunk_not_found')) return null;
      throw error;
    }
  }

  async function readAt(owner: string, index: number): Promise<IndexedSocStreamEntry<TEnvelope> | null> {
    const record = await readRecord(owner, index);
    return record ? toStreamEntry(record) : null;
  }

  async function findLatestIndex(owner: string, findOptions: FindLatestIndexOptions = {}): Promise<number> {
    return findLatestContiguousIndex(
      async index => (await readRecord(owner, index)) !== null,
      findOptions,
    );
  }

  async function readLatestRecord(owner: string): Promise<IndexedSocRecord<TEnvelope> | null> {
    const index = await findLatestIndex(owner);
    return index < 0 ? null : readRecord(owner, index);
  }

  return {
    entryIdentifier,
    getOwner,
    append: async createEnvelope => {
      const owner = await getOwner();

      let lastCollision: SwarmKitError | null = null;
      for (let attempt = 0; attempt < maxAppendAttempts; attempt += 1) {
        const current = await readLatestRecord(owner);
        const index = current ? getRecordIndex(current) + 1 : 0;
        const previousReference = current?.soc.reference ?? null;
        const envelope = await createEnvelope({ owner, index, previousReference });
        const identifier = entryIdentifier(index);
        const entryWrite = await writeSocJson(provider, identifier, envelope);
        const stored = await readRecord(owner, index);

        if (stored && sameEnvelope(stored.envelope, envelope)) {
          return {
            ...toStreamEntry(stored),
            entryWrite,
          };
        }

        lastCollision = new SwarmKitError(`${label} append collision at index ${index}`, {
          reason: 'soc_write_collision',
        });
      }

      throw lastCollision ?? new SwarmKitError(`${label} append failed`, { reason: 'soc_write_collision' });
    },
    readRecord,
    readAt,
    findLatestIndex,
    readLatestRecord,
    readLatest: async (owner, readOptions = {}) => {
      const limit = readOptions.limit ?? 10;
      assertIndexedSocLimit(limit, `${label} read limit`);
      if (limit === 0) return [];

      const latestIndex = await findLatestIndex(owner);
      if (latestIndex < 0) return [];

      const start = Math.max(0, latestIndex - limit + 1);
      const entries: IndexedSocStreamEntry<TEnvelope>[] = [];
      for (let index = latestIndex; index >= start; index -= 1) {
        const entry = await readAt(owner, index);
        if (!entry) break;
        entries.push(entry);
      }
      return entries;
    },
  };
}

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

function toStreamEntry<TEnvelope extends IndexedSocEnvelope>(record: IndexedSocRecord<TEnvelope>): IndexedSocStreamEntry<TEnvelope> {
  return {
    owner: record.soc.owner,
    identifier: record.soc.identifier,
    reference: record.soc.reference,
    envelope: record.envelope,
  };
}

function getRecordIndex(record: IndexedSocRecord<IndexedSocEnvelope>): number {
  const index = record.envelope.index;
  if (Number.isSafeInteger(index) && index >= 0) return index;
  throw new Error('Indexed SOC envelope must expose its index');
}

function defaultSameEnvelope<TEnvelope extends IndexedSocEnvelope>(stored: TEnvelope, expected: TEnvelope): boolean {
  return JSON.stringify(stored) === JSON.stringify(expected);
}
