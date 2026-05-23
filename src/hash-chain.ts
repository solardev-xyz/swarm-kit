import { bytesToJson } from './bytes.js';
import { SwarmKitError, isSwarmReason } from './errors.js';
import { deriveIdentifier } from './identifiers.js';
import { assertIndexedSocIndex, assertIndexedSocLimit, findLatestContiguousIndex } from './indexed-soc.js';
import { publishObjectJson, readObjectJson } from './objects.js';
import {
  getSigningIdentity,
  readSocBytesByAddress,
  readSocBytesByOwnerAndIdentifier,
  writeSocJson,
  type ReadSocBytesResult,
} from './soc.js';
import type { SwarmProvider, SwarmWriteSingleOwnerChunkResult } from './provider.js';

export interface HashChainOptions {
  topic: string;
  namespace?: string;
}

export interface HashChainAppendOptions {
  at?: Date | number;
}

export interface HashChainReadOptions {
  limit?: number;
}

export interface HashChainEntryEnvelope {
  version: 1;
  type: 'swarm-kit:hash-chain-entry';
  topic: string;
  index: number;
  previousReference: string | null;
  payloadReference: string;
  payloadSize: number;
  writtenAt: string;
}

export interface HashChainEntry<T = unknown> extends HashChainEntryEnvelope {
  owner: string;
  identifier: string;
  reference: string;
  payload: T;
}

export interface HashChainAppendResult<T = unknown> extends HashChainEntry<T> {
  entryWrite: SwarmWriteSingleOwnerChunkResult;
}

export interface HashChain<T = unknown> {
  readonly topic: string;
  entryIdentifier(index: number): string;
  getOwner(): Promise<string>;
  append(payload: T, options?: HashChainAppendOptions): Promise<HashChainAppendResult<T>>;
  readHead(owner: string): Promise<HashChainEntry<T> | null>;
  readAt(owner: string, index: number): Promise<HashChainEntry<T> | null>;
  readLatest(owner: string, options?: HashChainReadOptions): Promise<HashChainEntry<T>[]>;
}

interface HashChainEntryRecord {
  envelope: HashChainEntryEnvelope;
  soc: ReadSocBytesResult;
}

const DEFAULT_HASH_CHAIN_NAMESPACE = 'swarm-kit:hash-chain:v1';
const MAX_APPEND_ATTEMPTS = 3;

export function createHashChain<T = unknown>(
  provider: SwarmProvider,
  options: HashChainOptions,
): HashChain<T> {
  const namespace = options.namespace ?? DEFAULT_HASH_CHAIN_NAMESPACE;

  async function getOwner(): Promise<string> {
    return (await getSigningIdentity(provider)).owner;
  }

  function entryIdentifier(index: number): string {
    assertIndexedSocIndex(index, 'hash chain index');
    return deriveIdentifier([namespace, options.topic, 'entry', index]);
  }

  async function hydrateEntry(record: HashChainEntryRecord): Promise<HashChainEntry<T>> {
    const payload = await readObjectJson<T>(provider, record.envelope.payloadReference);
    return {
      ...record.envelope,
      owner: record.soc.owner,
      identifier: record.soc.identifier,
      reference: record.soc.reference,
      payload,
    };
  }

  async function readEntryRecord(owner: string, index: number): Promise<HashChainEntryRecord | null> {
    assertIndexedSocIndex(index, 'hash chain index');
    try {
      const identifier = entryIdentifier(index);
      const soc = await readSocBytesByOwnerAndIdentifier(provider, owner, identifier);
      const envelope = parseEntryEnvelope(bytesToJson<HashChainEntryEnvelope>(soc.bytes), options.topic);
      if (envelope.index !== index) {
        throw new Error(`Hash chain entry index mismatch for ${soc.reference}`);
      }
      if (soc.identifier.toLowerCase() !== identifier.toLowerCase()) {
        throw new Error(`Hash chain identifier mismatch for ${soc.reference}`);
      }
      return { envelope, soc };
    } catch (error) {
      if (isSwarmReason(error, 'chunk_not_found')) return null;
      throw error;
    }
  }

  async function readEntryByAddress(reference: string, owner: string): Promise<HashChainEntry<T>> {
    const soc = await readSocBytesByAddress(provider, reference);
    if (soc.owner.toLowerCase() !== owner.toLowerCase()) {
      throw new Error(`Hash chain owner mismatch for ${reference}`);
    }

    const envelope = parseEntryEnvelope(bytesToJson<HashChainEntryEnvelope>(soc.bytes), options.topic);
    if (soc.identifier.toLowerCase() !== entryIdentifier(envelope.index).toLowerCase()) {
      throw new Error(`Hash chain identifier mismatch for ${reference}`);
    }

    return hydrateEntry({ envelope, soc });
  }

  async function readAt(owner: string, index: number): Promise<HashChainEntry<T> | null> {
    const record = await readEntryRecord(owner, index);
    return record ? hydrateEntry(record) : null;
  }

  async function findLatestIndex(owner: string): Promise<number> {
    return findLatestContiguousIndex(async index => (await readEntryRecord(owner, index)) !== null);
  }

  async function readLatestRecord(owner: string): Promise<HashChainEntryRecord | null> {
    const index = await findLatestIndex(owner);
    return index < 0 ? null : readEntryRecord(owner, index);
  }

  async function readHead(owner: string): Promise<HashChainEntry<T> | null> {
    const record = await readLatestRecord(owner);
    return record ? hydrateEntry(record) : null;
  }

  return {
    topic: options.topic,
    entryIdentifier,
    getOwner,
    async append(payload, appendOptions = {}) {
      const owner = await getOwner();
      const publishedPayload = await publishObjectJson(provider, payload);
      const writtenAt = new Date(appendOptions.at ?? Date.now()).toISOString();

      let lastCollision: SwarmKitError | null = null;
      for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
        const current = await readLatestRecord(owner);
        const index = current ? current.envelope.index + 1 : 0;
        const previousReference = current?.soc.reference ?? null;
        const envelope: HashChainEntryEnvelope = {
          version: 1,
          type: 'swarm-kit:hash-chain-entry',
          topic: options.topic,
          index,
          previousReference,
          payloadReference: publishedPayload.reference,
          payloadSize: publishedPayload.size,
          writtenAt,
        };

        const identifier = entryIdentifier(index);
        const entryWrite = await writeSocJson(provider, identifier, envelope);
        const stored = await readEntryRecord(owner, index);
        if (stored && sameEntryEnvelope(stored.envelope, envelope)) {
          return {
            ...envelope,
            owner: entryWrite.owner,
            identifier: entryWrite.identifier,
            reference: entryWrite.reference,
            payload,
            entryWrite,
          };
        }

        lastCollision = new SwarmKitError(`Hash chain append collision at index ${index}`, {
          reason: 'soc_write_collision',
        });
      }

      throw lastCollision ?? new SwarmKitError('Hash chain append failed', { reason: 'soc_write_collision' });
    },
    readHead,
    readAt,
    async readLatest(owner, readOptions = {}) {
      const limit = readOptions.limit ?? 10;
      assertIndexedSocLimit(limit, 'hash chain read limit');
      if (limit === 0) return [];

      const latest = await readLatestRecord(owner);
      if (!latest) return [];

      const entries: HashChainEntry<T>[] = [];
      let current: HashChainEntry<T> | null = await hydrateEntry(latest);
      while (current && entries.length < limit) {
        entries.push(current);
        current = current.previousReference
          ? await readEntryByAddress(current.previousReference, owner)
          : null;
      }
      return entries;
    },
  };
}

function parseEntryEnvelope(value: HashChainEntryEnvelope, topic: string): HashChainEntryEnvelope {
  if (
    value.version !== 1 ||
    value.type !== 'swarm-kit:hash-chain-entry' ||
    value.topic !== topic ||
    !Number.isSafeInteger(value.index) ||
    value.index < 0 ||
    !(typeof value.previousReference === 'string' || value.previousReference === null) ||
    typeof value.payloadReference !== 'string' ||
    typeof value.payloadSize !== 'number' ||
    !Number.isSafeInteger(value.payloadSize) ||
    value.payloadSize < 0 ||
    typeof value.writtenAt !== 'string'
  ) {
    throw new Error('Invalid hash chain entry');
  }
  return value;
}

function sameEntryEnvelope(a: HashChainEntryEnvelope, b: HashChainEntryEnvelope): boolean {
  return (
    a.version === b.version &&
    a.type === b.type &&
    a.topic === b.topic &&
    a.index === b.index &&
    a.previousReference === b.previousReference &&
    a.payloadReference === b.payloadReference &&
    a.payloadSize === b.payloadSize &&
    a.writtenAt === b.writtenAt
  );
}
