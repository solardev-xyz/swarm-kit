import { createIndexedSocStream, assertIndexedSocLimit, type IndexedSocRecord, type IndexedSocStreamEntry } from './indexed-soc.js';
import { publishObjectJson, readObjectJson } from './objects.js';
import type { SwarmProvider, SwarmWriteSingleOwnerChunkResult } from './provider.js';

export interface KeyedLookupOptions {
  namespace: string;
}

export interface KeyedLookupWriteOptions {
  at?: Date | number;
}

export interface KeyedLookupReadHistoryOptions {
  limit?: number;
}

export interface KeyedLookupEntryEnvelope {
  version: 1;
  type: 'swarm-kit:keyed-lookup-entry';
  namespace: string;
  key: string;
  index: number;
  previousReference: string | null;
  valueReference: string;
  valueSize: number;
  writtenAt: string;
}

export interface KeyedLookupEntry<T = unknown> extends KeyedLookupEntryEnvelope {
  owner: string;
  identifier: string;
  reference: string;
  value: T;
}

export interface KeyedLookupWriteResult<T = unknown> extends KeyedLookupEntry<T> {
  entryWrite: SwarmWriteSingleOwnerChunkResult;
}

export interface KeyedLookup<T = unknown> {
  readonly namespace: string;
  entryIdentifier(key: string, index: number): string;
  getOwner(): Promise<string>;
  write(key: string, value: T, options?: KeyedLookupWriteOptions): Promise<KeyedLookupWriteResult<T>>;
  readAt(owner: string, key: string, index: number): Promise<KeyedLookupEntry<T> | null>;
  readLatest(owner: string, key: string): Promise<KeyedLookupEntry<T> | null>;
  readHistory(owner: string, key: string, options?: KeyedLookupReadHistoryOptions): Promise<KeyedLookupEntry<T>[]>;
}

const DEFAULT_LOOKUP_LABEL = 'keyed lookup';

export function createKeyedLookup<T = unknown>(
  provider: SwarmProvider,
  options: KeyedLookupOptions,
): KeyedLookup<T> {
  const namespace = normalizeNamespace(options.namespace);

  function streamFor(key: string) {
    const normalizedKey = normalizeKey(key);
    return createIndexedSocStream<KeyedLookupEntryEnvelope>(provider, {
      namespace,
      parts: [normalizedKey],
      entryTag: 'entry',
      label: DEFAULT_LOOKUP_LABEL,
      parseEnvelope: (value, context) => {
        const envelope = parseLookupEnvelope(value, namespace, normalizedKey);
        if (envelope.index !== context.index) {
          throw new Error(`Keyed lookup entry index mismatch for ${context.reference}`);
        }
        return envelope;
      },
      sameEnvelope,
    });
  }

  async function hydrateEntry(record: IndexedSocRecord<KeyedLookupEntryEnvelope>): Promise<KeyedLookupEntry<T>> {
    return hydrateStreamEntry({
      owner: record.soc.owner,
      identifier: record.soc.identifier,
      reference: record.soc.reference,
      envelope: record.envelope,
    });
  }

  async function hydrateStreamEntry(entry: IndexedSocStreamEntry<KeyedLookupEntryEnvelope>): Promise<KeyedLookupEntry<T>> {
    const value = await readObjectJson<T>(provider, entry.envelope.valueReference);
    return {
      ...entry.envelope,
      owner: entry.owner,
      identifier: entry.identifier,
      reference: entry.reference,
      value,
    };
  }

  return {
    namespace,
    entryIdentifier: (key, index) => streamFor(key).entryIdentifier(index),
    getOwner: streamFor('__owner__').getOwner,
    async write(key, value, writeOptions = {}) {
      const normalizedKey = normalizeKey(key);
      const published = await publishObjectJson(provider, value);
      const writtenAt = new Date(writeOptions.at ?? Date.now()).toISOString();
      const appended = await streamFor(normalizedKey).append(({ index, previousReference }) => ({
        version: 1,
        type: 'swarm-kit:keyed-lookup-entry',
        namespace,
        key: normalizedKey,
        index,
        previousReference,
        valueReference: published.reference,
        valueSize: published.size,
        writtenAt,
      }));
      return {
        ...appended.envelope,
        owner: appended.owner,
        identifier: appended.identifier,
        reference: appended.reference,
        value,
        entryWrite: appended.entryWrite,
      };
    },
    async readAt(owner, key, index) {
      const record = await streamFor(key).readRecord(owner, index);
      return record ? hydrateEntry(record) : null;
    },
    async readLatest(owner, key) {
      const record = await streamFor(key).readLatestRecord(owner);
      return record ? hydrateEntry(record) : null;
    },
    async readHistory(owner, key, readOptions = {}) {
      const limit = readOptions.limit ?? 10;
      assertIndexedSocLimit(limit, 'keyed lookup history limit');
      const entries = await streamFor(key).readLatest(owner, { limit });
      return Promise.all(entries.map(hydrateStreamEntry));
    },
  };
}

function parseLookupEnvelope(
  value: KeyedLookupEntryEnvelope,
  namespace: string,
  key: string,
): KeyedLookupEntryEnvelope {
  if (
    value.version !== 1 ||
    value.type !== 'swarm-kit:keyed-lookup-entry' ||
    value.namespace !== namespace ||
    value.key !== key ||
    !Number.isSafeInteger(value.index) ||
    value.index < 0 ||
    !(typeof value.previousReference === 'string' || value.previousReference === null) ||
    typeof value.valueReference !== 'string' ||
    typeof value.valueSize !== 'number' ||
    !Number.isSafeInteger(value.valueSize) ||
    value.valueSize < 0 ||
    typeof value.writtenAt !== 'string'
  ) {
    throw new Error('Invalid keyed lookup entry');
  }
  return value;
}

function sameEnvelope(a: KeyedLookupEntryEnvelope, b: KeyedLookupEntryEnvelope): boolean {
  return (
    a.version === b.version &&
    a.type === b.type &&
    a.namespace === b.namespace &&
    a.key === b.key &&
    a.index === b.index &&
    a.previousReference === b.previousReference &&
    a.valueReference === b.valueReference &&
    a.valueSize === b.valueSize &&
    a.writtenAt === b.writtenAt
  );
}

function normalizeNamespace(namespace: string): string {
  if (!namespace.trim()) throw new Error('Keyed lookup namespace must not be empty');
  return namespace;
}

function normalizeKey(key: string): string {
  if (!key.trim()) throw new Error('Keyed lookup key must not be empty');
  return key;
}
