import { bytesToJson } from './bytes.js';
import { createIndexedSocStream, assertIndexedSocLimit, type IndexedSocRecord } from './indexed-soc.js';
import { publishObjectJson, readObjectJson } from './objects.js';
import { readSocBytesByAddress } from './soc.js';
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

const DEFAULT_HASH_CHAIN_NAMESPACE = 'swarm-kit:hash-chain:v1';

export function createHashChain<T = unknown>(
  provider: SwarmProvider,
  options: HashChainOptions,
): HashChain<T> {
  const namespace = options.namespace ?? DEFAULT_HASH_CHAIN_NAMESPACE;
  const stream = createIndexedSocStream<HashChainEntryEnvelope>(provider, {
    namespace,
    parts: [options.topic],
    entryTag: 'entry',
    label: 'hash chain',
    parseEnvelope: (value, context) => {
      const envelope = parseEntryEnvelope(value, options.topic);
      if (envelope.index !== context.index) {
        throw new Error(`Hash chain entry index mismatch for ${context.reference}`);
      }
      return envelope;
    },
    sameEnvelope,
  });

  async function hydrateEntry(record: IndexedSocRecord<HashChainEntryEnvelope>): Promise<HashChainEntry<T>> {
    const payload = await readObjectJson<T>(provider, record.envelope.payloadReference);
    return {
      ...record.envelope,
      owner: record.soc.owner,
      identifier: record.soc.identifier,
      reference: record.soc.reference,
      payload,
    };
  }

  async function readEntryByAddress(reference: string, owner: string): Promise<HashChainEntry<T>> {
    const soc = await readSocBytesByAddress(provider, reference);
    if (soc.owner.toLowerCase() !== owner.toLowerCase()) {
      throw new Error(`Hash chain owner mismatch for ${reference}`);
    }

    const envelope = parseEntryEnvelope(bytesToJson<HashChainEntryEnvelope>(soc.bytes), options.topic);
    if (soc.identifier.toLowerCase() !== stream.entryIdentifier(envelope.index).toLowerCase()) {
      throw new Error(`Hash chain identifier mismatch for ${reference}`);
    }

    return hydrateEntry({ envelope, soc });
  }

  async function readAt(owner: string, index: number): Promise<HashChainEntry<T> | null> {
    const record = await stream.readRecord(owner, index);
    return record ? hydrateEntry(record) : null;
  }

  async function readHead(owner: string): Promise<HashChainEntry<T> | null> {
    const record = await stream.readLatestRecord(owner);
    return record ? hydrateEntry(record) : null;
  }

  return {
    topic: options.topic,
    entryIdentifier: stream.entryIdentifier,
    getOwner: stream.getOwner,
    async append(payload, appendOptions = {}) {
      const publishedPayload = await publishObjectJson(provider, payload);
      const writtenAt = new Date(appendOptions.at ?? Date.now()).toISOString();
      const appended = await stream.append(({ index, previousReference }) => ({
          version: 1,
          type: 'swarm-kit:hash-chain-entry',
          topic: options.topic,
          index,
          previousReference,
          payloadReference: publishedPayload.reference,
          payloadSize: publishedPayload.size,
          writtenAt,
      }));
      return {
        ...appended.envelope,
        owner: appended.owner,
        identifier: appended.identifier,
        reference: appended.reference,
        payload,
        entryWrite: appended.entryWrite,
      };
    },
    readHead,
    readAt,
    async readLatest(owner, readOptions = {}) {
      const limit = readOptions.limit ?? 10;
      assertIndexedSocLimit(limit, 'hash chain read limit');
      if (limit === 0) return [];

      const latest = await stream.readLatestRecord(owner);
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

function sameEnvelope(a: HashChainEntryEnvelope, b: HashChainEntryEnvelope): boolean {
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
