import { deriveIdentifier } from './identifiers.js';
import { assertIndexedSocIndex, createIndexedSocStream, type IndexedSocRecord, type IndexedSocStreamEntry } from './indexed-soc.js';
import { publishObjectJson, readObjectJson } from './objects.js';
import type { SwarmKitDriverInput } from './driver.js';
import type { SwarmWriteSingleOwnerChunkResult } from './provider.js';

export interface DidDocumentOptions {
  namespace?: string;
}

export interface DidDocumentWriteOptions {
  at?: Date | number;
}

export interface DidDocumentReadHistoryOptions {
  limit?: number;
}

export interface DidDocumentRevisionEnvelope {
  version: 1;
  type: 'swarm-kit:did-document-revision';
  revision: number;
  index: number;
  previousReference: string | null;
  documentReference: string;
  documentSize: number;
  writtenAt: string;
}

export type DidDocumentPointer = DidDocumentRevisionEnvelope;

export interface DidDocumentRevision<T = unknown> extends DidDocumentRevisionEnvelope {
  owner: string;
  identifier: string;
  reference: string;
  document: T;
  pointer: DidDocumentRevisionEnvelope;
}

export interface WriteDidDocumentResult<T = unknown> extends DidDocumentRevision<T> {
  revisionWrite: SwarmWriteSingleOwnerChunkResult;
  entryWrite: SwarmWriteSingleOwnerChunkResult;
}

export type ReadDidDocumentResult<T = unknown> = DidDocumentRevision<T>;

export interface RevisionedDidDocument<T = unknown> {
  revisionIdentifier(index: number): string;
  getOwner(): Promise<string>;
  write(document: T, options?: DidDocumentWriteOptions): Promise<WriteDidDocumentResult<T>>;
  readAt(owner: string, revision: number): Promise<ReadDidDocumentResult<T> | null>;
  readLatest(owner: string): Promise<ReadDidDocumentResult<T> | null>;
  readHistory(owner: string, options?: DidDocumentReadHistoryOptions): Promise<ReadDidDocumentResult<T>[]>;
}

const DEFAULT_DID_NAMESPACE = 'swarm-kit:did-document:v1';

export function didDocumentIdentifier(options: DidDocumentOptions = {}): string {
  return didDocumentRevisionIdentifier(0, options);
}

export function didDocumentRevisionIdentifier(index: number, options: DidDocumentOptions = {}): string {
  assertIndexedSocIndex(index, 'DID document revision');
  return deriveIdentifier([options.namespace ?? DEFAULT_DID_NAMESPACE, 'revision', index]);
}

export function createDidDocument<T = unknown>(
  provider: SwarmKitDriverInput,
  options: DidDocumentOptions = {},
): RevisionedDidDocument<T> {
  const stream = createDidDocumentStream(provider, options);

  async function hydrateRevision(
    entry: IndexedSocStreamEntry<DidDocumentRevisionEnvelope>,
  ): Promise<DidDocumentRevision<T>> {
    const document = await readObjectJson<T>(provider, entry.envelope.documentReference);
    return {
      ...entry.envelope,
      owner: entry.owner,
      identifier: entry.identifier,
      reference: entry.reference,
      document,
      pointer: entry.envelope,
    };
  }

  async function hydrateRecord(record: IndexedSocRecord<DidDocumentRevisionEnvelope>): Promise<DidDocumentRevision<T>> {
    return hydrateRevision({
      owner: record.soc.owner,
      identifier: record.soc.identifier,
      reference: record.soc.reference,
      envelope: record.envelope,
    });
  }

  return {
    revisionIdentifier: stream.entryIdentifier,
    getOwner: stream.getOwner,
    async write(document, writeOptions = {}) {
      const published = await publishObjectJson(provider, document);
      const writtenAt = new Date(writeOptions.at ?? Date.now()).toISOString();
      const appended = await stream.append(({ index, previousReference }) => ({
        version: 1,
        type: 'swarm-kit:did-document-revision',
        revision: index,
        index,
        previousReference,
        documentReference: published.reference,
        documentSize: published.size,
        writtenAt,
      }));

      return {
        ...appended.envelope,
        owner: appended.owner,
        identifier: appended.identifier,
        reference: appended.reference,
        document,
        pointer: appended.envelope,
        revisionWrite: appended.entryWrite,
        entryWrite: appended.entryWrite,
      };
    },
    async readAt(owner, revision) {
      const entry = await stream.readAt(owner, revision);
      return entry ? hydrateRevision(entry) : null;
    },
    async readLatest(owner) {
      const record = await stream.readLatestRecord(owner);
      return record ? hydrateRecord(record) : null;
    },
    async readHistory(owner, readOptions = {}) {
      const entries = await stream.readLatest(owner, { limit: readOptions.limit ?? 10 });
      return Promise.all(entries.map(hydrateRevision));
    },
  };
}

export async function writeDidDocument<T = unknown>(
  provider: SwarmKitDriverInput,
  document: T,
  options: DidDocumentOptions = {},
): Promise<WriteDidDocumentResult<T>> {
  return createDidDocument<T>(provider, options).write(document);
}

export async function readDidDocument<T = unknown>(
  provider: SwarmKitDriverInput,
  owner: string,
  options: DidDocumentOptions = {},
): Promise<ReadDidDocumentResult<T>> {
  const latest = await createDidDocument<T>(provider, options).readLatest(owner);
  if (!latest) {
    throw new Error('DID document not found');
  }
  return latest;
}

function createDidDocumentStream(
  provider: SwarmKitDriverInput,
  options: DidDocumentOptions,
) {
  return createIndexedSocStream<DidDocumentRevisionEnvelope>(provider, createDidDocumentStreamOptions(options));
}

function createDidDocumentStreamOptions(options: DidDocumentOptions) {
  const namespace = options.namespace ?? DEFAULT_DID_NAMESPACE;
  return {
    namespace,
    entryTag: 'revision',
    label: 'DID document',
    parseEnvelope: (value: DidDocumentRevisionEnvelope, context: { index: number; reference: string }) => {
      validateRevisionEnvelope(value);
      if (value.index !== context.index || value.revision !== context.index) {
        throw new Error(`DID document revision index mismatch for ${context.reference}`);
      }
      return value;
    },
    sameEnvelope,
  };
}

function validateRevisionEnvelope(revision: DidDocumentRevisionEnvelope): void {
  if (
    revision.version !== 1 ||
    revision.type !== 'swarm-kit:did-document-revision' ||
    !Number.isSafeInteger(revision.revision) ||
    revision.revision < 0 ||
    !Number.isSafeInteger(revision.index) ||
    revision.index < 0 ||
    !(typeof revision.previousReference === 'string' || revision.previousReference === null) ||
    typeof revision.documentReference !== 'string' ||
    typeof revision.documentSize !== 'number' ||
    !Number.isSafeInteger(revision.documentSize) ||
    revision.documentSize < 0 ||
    typeof revision.writtenAt !== 'string'
  ) {
    throw new Error('Invalid DID document revision');
  }
}

function sameEnvelope(a: DidDocumentRevisionEnvelope, b: DidDocumentRevisionEnvelope): boolean {
  return (
    a.version === b.version &&
    a.type === b.type &&
    a.revision === b.revision &&
    a.index === b.index &&
    a.previousReference === b.previousReference &&
    a.documentReference === b.documentReference &&
    a.documentSize === b.documentSize &&
    a.writtenAt === b.writtenAt
  );
}
