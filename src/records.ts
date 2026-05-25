import { createIndexedSocStream, assertIndexedSocLimit, type IndexedSocEnvelope, type IndexedSocRecord, type IndexedSocStreamEntry } from './indexed-soc.js';
import { publishObjectJson, readObjectJson } from './objects.js';
import { SwarmKitError } from './errors.js';
import type { SwarmProvider, SwarmWriteSingleOwnerChunkResult } from './provider.js';

export interface OwnerRecordsOptions {
  namespace: string;
}

export interface OwnerRecordWriteOptions {
  expectedOwner?: string;
  at?: Date | number;
}

export interface OwnerRecordReadHistoryOptions {
  limit?: number;
}

export interface OwnerRecordEnvelope {
  version: 1;
  type: 'swarm-kit:owner-record';
  namespace: string;
  key: string;
  revision: number;
  previousReference: string | null;
  valueReference: string;
  valueSize: number;
  writtenAt: string;
}

interface StoredOwnerRecordEnvelope extends IndexedSocEnvelope {
  version: 1;
  type: 'swarm-kit:owner-record';
  namespace: string;
  key: string;
  previousReference: string | null;
  valueReference: string;
  valueSize: number;
  writtenAt: string;
}

export interface OwnerRecord<T = unknown> extends OwnerRecordEnvelope {
  owner: string;
  identifier: string;
  reference: string;
  value: T;
}

export interface OwnerRecordWriteResult<T = unknown> extends OwnerRecord<T> {
  entryWrite: SwarmWriteSingleOwnerChunkResult;
}

export interface OwnerRecords<T = unknown> {
  readonly namespace: string;
  revisionIdentifier(key: string, revision: number): string;
  getOwner(): Promise<string>;
  write(key: string, value: T, options?: OwnerRecordWriteOptions): Promise<OwnerRecordWriteResult<T>>;
  readAt(owner: string, key: string, revision: number): Promise<OwnerRecord<T> | null>;
  readLatest(owner: string, key: string): Promise<OwnerRecord<T> | null>;
  readHistory(owner: string, key: string, options?: OwnerRecordReadHistoryOptions): Promise<OwnerRecord<T>[]>;
}

const DEFAULT_RECORDS_LABEL = 'owner records';

export function createOwnerRecords<T = unknown>(
  provider: SwarmProvider,
  options: OwnerRecordsOptions,
): OwnerRecords<T> {
  const namespace = normalizeNamespace(options.namespace);

  function streamFor(key: string) {
    const normalizedKey = normalizeKey(key);
    return createIndexedSocStream<StoredOwnerRecordEnvelope>(provider, {
      namespace,
      parts: [normalizedKey],
      entryTag: 'revision',
      label: DEFAULT_RECORDS_LABEL,
      parseEnvelope: (value, context) => {
        const envelope = parseRecordEnvelope(value, namespace, normalizedKey);
        if (envelope.index !== context.index) {
          throw new Error(`Owner record revision mismatch for ${context.reference}`);
        }
        return envelope;
      },
      sameEnvelope,
    });
  }

  async function assertExpectedOwner(stream: ReturnType<typeof streamFor>, expectedOwner?: string): Promise<void> {
    if (expectedOwner === undefined) return;
    const actualOwner = await stream.getOwner();
    if (!sameOwner(actualOwner, expectedOwner)) {
      throw new SwarmKitError(`Provider is signing as ${actualOwner}, expected ${expectedOwner}`, {
        reason: 'owner_mismatch',
      });
    }
  }

  async function hydrateRecord(
    record: IndexedSocRecord<StoredOwnerRecordEnvelope>,
    expectedOwner: string,
  ): Promise<OwnerRecord<T>> {
    if (!sameOwner(record.soc.owner, expectedOwner)) {
      throw new SwarmKitError(`Owner record resolved to ${record.soc.owner}, expected ${expectedOwner}`, {
        reason: 'owner_mismatch',
      });
    }
    return hydrateStreamEntry({
      owner: record.soc.owner,
      identifier: record.soc.identifier,
      reference: record.soc.reference,
      envelope: record.envelope,
    });
  }

  async function hydrateStreamEntry(entry: IndexedSocStreamEntry<StoredOwnerRecordEnvelope>): Promise<OwnerRecord<T>> {
    const value = await readObjectJson<T>(provider, entry.envelope.valueReference);
    return {
      ...toPublicEnvelope(entry.envelope),
      owner: entry.owner,
      identifier: entry.identifier,
      reference: entry.reference,
      value,
    };
  }

  return {
    namespace,
    revisionIdentifier: (key, revision) => streamFor(key).entryIdentifier(revision),
    getOwner: streamFor('__owner__').getOwner,
    async write(key, value, writeOptions = {}) {
      const normalizedKey = normalizeKey(key);
      const stream = streamFor(normalizedKey);
      await assertExpectedOwner(stream, writeOptions.expectedOwner);

      const published = await publishObjectJson(provider, value);
      const writtenAt = new Date(writeOptions.at ?? Date.now()).toISOString();
      const appended = await stream.append(({ index, previousReference }) => ({
        version: 1,
        type: 'swarm-kit:owner-record',
        namespace,
        key: normalizedKey,
        index,
        previousReference,
        valueReference: published.reference,
        valueSize: published.size,
        writtenAt,
      }));
      return {
        ...toPublicEnvelope(appended.envelope),
        owner: appended.owner,
        identifier: appended.identifier,
        reference: appended.reference,
        value,
        entryWrite: appended.entryWrite,
      };
    },
    async readAt(owner, key, revision) {
      const record = await streamFor(key).readRecord(owner, revision);
      return record ? hydrateRecord(record, owner) : null;
    },
    async readLatest(owner, key) {
      const record = await streamFor(key).readLatestRecord(owner);
      return record ? hydrateRecord(record, owner) : null;
    },
    async readHistory(owner, key, readOptions = {}) {
      const limit = readOptions.limit ?? 10;
      assertIndexedSocLimit(limit, 'owner record history limit');
      const entries = await streamFor(key).readLatest(owner, { limit });
      return Promise.all(entries.map(entry => {
        if (!sameOwner(entry.owner, owner)) {
          throw new SwarmKitError(`Owner record resolved to ${entry.owner}, expected ${owner}`, {
            reason: 'owner_mismatch',
          });
        }
        return hydrateStreamEntry(entry);
      }));
    },
  };
}

function parseRecordEnvelope(
  value: StoredOwnerRecordEnvelope,
  namespace: string,
  key: string,
): StoredOwnerRecordEnvelope {
  if (
    value.version !== 1 ||
    value.type !== 'swarm-kit:owner-record' ||
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
    throw new Error('Invalid owner record');
  }
  return value;
}

function sameEnvelope(a: StoredOwnerRecordEnvelope, b: StoredOwnerRecordEnvelope): boolean {
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

function toPublicEnvelope(envelope: StoredOwnerRecordEnvelope): OwnerRecordEnvelope {
  return {
    version: envelope.version,
    type: envelope.type,
    namespace: envelope.namespace,
    key: envelope.key,
    revision: envelope.index,
    previousReference: envelope.previousReference,
    valueReference: envelope.valueReference,
    valueSize: envelope.valueSize,
    writtenAt: envelope.writtenAt,
  };
}

function normalizeNamespace(namespace: string): string {
  if (!namespace.trim()) throw new Error('Owner records namespace must not be empty');
  return namespace;
}

function normalizeKey(key: string): string {
  if (!key.trim()) throw new Error('Owner record key must not be empty');
  return key;
}

function sameOwner(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
