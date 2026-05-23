import { deriveIdentifier } from './identifiers.js';
import { publishObjectJson, readObjectJson } from './objects.js';
import { readSocJsonByOwnerAndIdentifier, writeSocJson } from './soc.js';
import type { SwarmProvider, SwarmWriteSingleOwnerChunkResult } from './provider.js';

export interface DidDocumentOptions {
  namespace?: string;
}

export interface DidDocumentPointer {
  version: 1;
  type: 'swarm-kit:did-document-pointer';
  documentReference: string;
  documentSize: number;
  writtenAt: string;
}

export interface WriteDidDocumentResult<T = unknown> extends SwarmWriteSingleOwnerChunkResult {
  document: T;
  documentReference: string;
  pointer: DidDocumentPointer;
}

export interface ReadDidDocumentResult<T = unknown> {
  owner: string;
  identifier: string;
  reference: string;
  document: T;
  pointer: DidDocumentPointer;
}

const DEFAULT_DID_NAMESPACE = 'swarm-kit:did-document:v1';

export function didDocumentIdentifier(options: DidDocumentOptions = {}): string {
  return deriveIdentifier([options.namespace ?? DEFAULT_DID_NAMESPACE]);
}

export async function writeDidDocument<T = unknown>(
  provider: SwarmProvider,
  document: T,
  options: DidDocumentOptions = {},
): Promise<WriteDidDocumentResult<T>> {
  const identifier = didDocumentIdentifier(options);
  const published = await publishObjectJson(provider, document);
  const pointer: DidDocumentPointer = {
    version: 1,
    type: 'swarm-kit:did-document-pointer',
    documentReference: published.reference,
    documentSize: published.size,
    writtenAt: new Date().toISOString(),
  };
  const result = await writeSocJson(provider, identifier, pointer);
  return {
    ...result,
    document,
    documentReference: published.reference,
    pointer,
  };
}

export async function readDidDocument<T = unknown>(
  provider: SwarmProvider,
  owner: string,
  options: DidDocumentOptions = {},
): Promise<ReadDidDocumentResult<T>> {
  const identifier = didDocumentIdentifier(options);
  const pointer = await readSocJsonByOwnerAndIdentifier<DidDocumentPointer>(provider, owner, identifier);
  validatePointer(pointer);
  const document = await readObjectJson<T>(provider, pointer.documentReference);
  return {
    owner,
    identifier,
    reference: pointer.documentReference,
    document,
    pointer,
  };
}

function validatePointer(pointer: DidDocumentPointer): void {
  if (
    pointer.version !== 1 ||
    pointer.type !== 'swarm-kit:did-document-pointer' ||
    typeof pointer.documentReference !== 'string' ||
    typeof pointer.documentSize !== 'number' ||
    !Number.isSafeInteger(pointer.documentSize) ||
    pointer.documentSize < 0 ||
    typeof pointer.writtenAt !== 'string'
  ) {
    throw new Error('Invalid DID document pointer');
  }
}
