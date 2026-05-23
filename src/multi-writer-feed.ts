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

export interface MultiWriterFeedOptions {
  topic: string;
  writerId?: string;
  namespace?: string;
}

export interface MultiWriterFeedAppendOptions {
  at?: Date | number;
}

export interface MultiWriterFeedReadAtOptions {
  writerId?: string;
}

export interface MultiWriterFeedReadWriterOptions {
  writerId?: string;
  limit?: number;
}

export interface MultiWriterFeedReadLatestOptions {
  limitPerWriter?: number;
  limit?: number;
}

export interface MultiWriterFeedWriter {
  owner: string;
  writerId?: string;
}

export interface MultiWriterFeedEntryEnvelope {
  version: 1;
  type: 'swarm-kit:multi-writer-feed-entry';
  topic: string;
  writerId: string;
  index: number;
  previousReference: string | null;
  payloadReference: string;
  payloadSize: number;
  writtenAt: string;
}

export interface MultiWriterFeedEntry<T = unknown> extends MultiWriterFeedEntryEnvelope {
  owner: string;
  identifier: string;
  reference: string;
  payload: T;
}

export interface MultiWriterFeedAppendResult<T = unknown> extends MultiWriterFeedEntry<T> {
  entryWrite: SwarmWriteSingleOwnerChunkResult;
}

export interface MultiWriterFeed<T = unknown> {
  readonly topic: string;
  readonly writerId: string;
  entryIdentifier(index: number, writerId?: string): string;
  getOwner(): Promise<string>;
  append(payload: T, options?: MultiWriterFeedAppendOptions): Promise<MultiWriterFeedAppendResult<T>>;
  readAt(owner: string, index: number, options?: MultiWriterFeedReadAtOptions): Promise<MultiWriterFeedEntry<T> | null>;
  readWriter(owner: string, options?: MultiWriterFeedReadWriterOptions): Promise<MultiWriterFeedEntry<T>[]>;
  readLatest(writers: readonly MultiWriterFeedWriter[], options?: MultiWriterFeedReadLatestOptions): Promise<MultiWriterFeedEntry<T>[]>;
}

interface MultiWriterFeedEntryRecord {
  envelope: MultiWriterFeedEntryEnvelope;
  soc: ReadSocBytesResult;
}

const DEFAULT_MULTI_WRITER_NAMESPACE = 'swarm-kit:multi-writer-feed:v1';
const DEFAULT_WRITER_ID = 'default';
const MAX_APPEND_ATTEMPTS = 3;

export function createMultiWriterFeed<T = unknown>(
  provider: SwarmProvider,
  options: MultiWriterFeedOptions,
): MultiWriterFeed<T> {
  const namespace = options.namespace ?? DEFAULT_MULTI_WRITER_NAMESPACE;
  const localWriterId = options.writerId ?? DEFAULT_WRITER_ID;

  function normalizeWriterId(writerId = localWriterId): string {
    if (!writerId.trim()) throw new Error('Multi-writer feed writerId must not be empty');
    return writerId;
  }

  function entryIdentifier(index: number, writerId = localWriterId): string {
    assertIndexedSocIndex(index, 'multi-writer feed index');
    return deriveIdentifier([namespace, options.topic, normalizeWriterId(writerId), 'entry', index]);
  }

  async function getOwner(): Promise<string> {
    return (await getSigningIdentity(provider)).owner;
  }

  async function hydrateEntry(record: MultiWriterFeedEntryRecord): Promise<MultiWriterFeedEntry<T>> {
    const payload = await readObjectJson<T>(provider, record.envelope.payloadReference);
    return {
      ...record.envelope,
      owner: record.soc.owner,
      identifier: record.soc.identifier,
      reference: record.soc.reference,
      payload,
    };
  }

  async function readEntryRecord(
    owner: string,
    index: number,
    writerId: string,
  ): Promise<MultiWriterFeedEntryRecord | null> {
    assertIndexedSocIndex(index, 'multi-writer feed index');
    try {
      const identifier = entryIdentifier(index, writerId);
      const soc = await readSocBytesByOwnerAndIdentifier(provider, owner, identifier);
      const envelope = parseEntryEnvelope(bytesToJson<MultiWriterFeedEntryEnvelope>(soc.bytes), options.topic, writerId);
      if (envelope.index !== index) {
        throw new Error(`Multi-writer feed entry index mismatch for ${soc.reference}`);
      }
      if (soc.identifier.toLowerCase() !== identifier.toLowerCase()) {
        throw new Error(`Multi-writer feed identifier mismatch for ${soc.reference}`);
      }
      return { envelope, soc };
    } catch (error) {
      if (isSwarmReason(error, 'chunk_not_found')) return null;
      throw error;
    }
  }

  async function readEntryByAddress(
    reference: string,
    owner: string,
    writerId: string,
  ): Promise<MultiWriterFeedEntry<T>> {
    const soc = await readSocBytesByAddress(provider, reference);
    if (soc.owner.toLowerCase() !== owner.toLowerCase()) {
      throw new Error(`Multi-writer feed owner mismatch for ${reference}`);
    }

    const envelope = parseEntryEnvelope(bytesToJson<MultiWriterFeedEntryEnvelope>(soc.bytes), options.topic, writerId);
    if (soc.identifier.toLowerCase() !== entryIdentifier(envelope.index, writerId).toLowerCase()) {
      throw new Error(`Multi-writer feed identifier mismatch for ${reference}`);
    }

    return hydrateEntry({ envelope, soc });
  }

  async function readAt(
    owner: string,
    index: number,
    readOptions: MultiWriterFeedReadAtOptions = {},
  ): Promise<MultiWriterFeedEntry<T> | null> {
    const writerId = normalizeWriterId(readOptions.writerId);
    const record = await readEntryRecord(owner, index, writerId);
    return record ? hydrateEntry(record) : null;
  }

  async function findLatestIndex(owner: string, writerId: string): Promise<number> {
    return findLatestContiguousIndex(async index => (await readEntryRecord(owner, index, writerId)) !== null);
  }

  async function readLatestRecord(owner: string, writerId: string): Promise<MultiWriterFeedEntryRecord | null> {
    const index = await findLatestIndex(owner, writerId);
    return index < 0 ? null : readEntryRecord(owner, index, writerId);
  }

  async function readWriter(owner: string, readOptions: MultiWriterFeedReadWriterOptions = {}): Promise<MultiWriterFeedEntry<T>[]> {
    const writerId = normalizeWriterId(readOptions.writerId);
    const limit = readOptions.limit ?? 10;
    assertIndexedSocLimit(limit, 'multi-writer feed read limit');
    if (limit === 0) return [];

    const latest = await readLatestRecord(owner, writerId);
    if (!latest) return [];

    const entries: MultiWriterFeedEntry<T>[] = [];
    let current: MultiWriterFeedEntry<T> | null = await hydrateEntry(latest);
    while (current && entries.length < limit) {
      entries.push(current);
      current = current.previousReference
        ? await readEntryByAddress(current.previousReference, owner, writerId)
        : null;
    }
    return entries;
  }

  return {
    topic: options.topic,
    writerId: localWriterId,
    entryIdentifier,
    getOwner,
    async append(payload, appendOptions = {}) {
      const owner = await getOwner();
      const publishedPayload = await publishObjectJson(provider, payload);
      const writtenAt = new Date(appendOptions.at ?? Date.now()).toISOString();

      let lastCollision: SwarmKitError | null = null;
      for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
        const current = await readLatestRecord(owner, localWriterId);
        const index = current ? current.envelope.index + 1 : 0;
        const previousReference = current?.soc.reference ?? null;
        const envelope: MultiWriterFeedEntryEnvelope = {
          version: 1,
          type: 'swarm-kit:multi-writer-feed-entry',
          topic: options.topic,
          writerId: localWriterId,
          index,
          previousReference,
          payloadReference: publishedPayload.reference,
          payloadSize: publishedPayload.size,
          writtenAt,
        };

        const entryWrite = await writeSocJson(provider, entryIdentifier(index), envelope);
        const stored = await readEntryRecord(owner, index, localWriterId);
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

        lastCollision = new SwarmKitError(`Multi-writer feed append collision at index ${index}`, {
          reason: 'soc_write_collision',
        });
      }

      throw lastCollision ?? new SwarmKitError('Multi-writer feed append failed', { reason: 'soc_write_collision' });
    },
    readAt,
    readWriter,
    async readLatest(writers, readOptions = {}) {
      const limitPerWriter = readOptions.limitPerWriter ?? 10;
      assertIndexedSocLimit(limitPerWriter, 'multi-writer feed limitPerWriter');
      if (
        readOptions.limit !== undefined &&
        (!Number.isSafeInteger(readOptions.limit) || readOptions.limit < 0)
      ) {
        throw new Error('Multi-writer feed limit must be a non-negative safe integer');
      }

      const results = await Promise.all(writers.map(writer =>
        readWriter(writer.owner, {
          writerId: writer.writerId ?? localWriterId,
          limit: limitPerWriter,
        })
      ));

      const merged = results.flat().sort(compareEntriesNewestFirst);
      return readOptions.limit === undefined ? merged : merged.slice(0, readOptions.limit);
    },
  };
}

function parseEntryEnvelope(
  value: MultiWriterFeedEntryEnvelope,
  topic: string,
  writerId: string,
): MultiWriterFeedEntryEnvelope {
  if (
    value.version !== 1 ||
    value.type !== 'swarm-kit:multi-writer-feed-entry' ||
    value.topic !== topic ||
    value.writerId !== writerId ||
    !Number.isSafeInteger(value.index) ||
    value.index < 0 ||
    !(typeof value.previousReference === 'string' || value.previousReference === null) ||
    typeof value.payloadReference !== 'string' ||
    typeof value.payloadSize !== 'number' ||
    !Number.isSafeInteger(value.payloadSize) ||
    value.payloadSize < 0 ||
    typeof value.writtenAt !== 'string'
  ) {
    throw new Error('Invalid multi-writer feed entry');
  }
  return value;
}

function sameEntryEnvelope(a: MultiWriterFeedEntryEnvelope, b: MultiWriterFeedEntryEnvelope): boolean {
  return (
    a.version === b.version &&
    a.type === b.type &&
    a.topic === b.topic &&
    a.writerId === b.writerId &&
    a.index === b.index &&
    a.previousReference === b.previousReference &&
    a.payloadReference === b.payloadReference &&
    a.payloadSize === b.payloadSize &&
    a.writtenAt === b.writtenAt
  );
}

function compareEntriesNewestFirst<T>(a: MultiWriterFeedEntry<T>, b: MultiWriterFeedEntry<T>): number {
  const time = Date.parse(b.writtenAt) - Date.parse(a.writtenAt);
  if (time !== 0) return time;
  const index = b.index - a.index;
  if (index !== 0) return index;
  const owner = a.owner.localeCompare(b.owner);
  if (owner !== 0) return owner;
  return a.writerId.localeCompare(b.writerId);
}
