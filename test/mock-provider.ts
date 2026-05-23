import { bytesToBase64, normalizeBytes } from '../src/bytes.js';
import { deriveIdentifier } from '../src/identifiers.js';
import type {
  SwarmCapabilities,
  SwarmChunkReadResult,
  SwarmProvider,
  SwarmReadSingleOwnerChunkResult,
  SwarmSigningIdentity,
} from '../src/provider.js';

export interface MockSwarmProviderOptions {
  owner?: string;
  storage?: MockSwarmProviderStorage;
}

export interface MockSwarmProviderStorage {
  chunks: Map<string, Uint8Array>;
  socs: Map<string, { owner: string; identifier: string; bytes: Uint8Array }>;
}

export function createMockSwarmStorage(): MockSwarmProviderStorage {
  return {
    chunks: new Map(),
    socs: new Map(),
  };
}

export class MockSwarmProvider implements SwarmProvider {
  readonly isFreedomBrowser = true;
  readonly owner: string;
  private readonly chunks: MockSwarmProviderStorage['chunks'];
  private readonly socs: MockSwarmProviderStorage['socs'];

  constructor(options: MockSwarmProviderOptions = {}) {
    this.owner = options.owner ?? '0x1111111111111111111111111111111111111111';
    this.chunks = options.storage?.chunks ?? new Map();
    this.socs = options.storage?.socs ?? new Map();
  }

  async requestAccess(): Promise<{ connected: true; origin: string; capabilities: string[] }> {
    return {
      connected: true,
      origin: 'mock://swarm-kit',
      capabilities: ['publish'],
    };
  }

  async getCapabilities(): Promise<SwarmCapabilities> {
    return {
      specVersion: '1.0',
      canPublish: true,
      reason: null,
      limits: {
        maxChunkPayloadBytes: 4096,
        maxPathBytes: 100,
      },
    };
  }

  async publishChunk(params: { data: string | Uint8Array | ArrayBuffer }): Promise<{ reference: string }> {
    const bytes = normalizeBytes(params.data);
    const reference = deriveIdentifier(['mock:cac', bytes]);
    this.chunks.set(reference, bytes);
    return { reference };
  }

  async readChunk(params: { reference: string }): Promise<SwarmChunkReadResult> {
    const bytes = this.chunks.get(params.reference);
    if (!bytes) throw providerError(-32602, `Chunk not found: ${params.reference}`, 'chunk_not_found');
    return {
      data: bytesToBase64(bytes),
      encoding: 'base64',
      span: bytes.length,
    };
  }

  async getSigningIdentity(): Promise<SwarmSigningIdentity> {
    return {
      owner: this.owner,
      identityMode: 'app-scoped',
    };
  }

  async writeSingleOwnerChunk(params: { identifier: string; data: string | Uint8Array | ArrayBuffer }): Promise<{ reference: string; owner: string; identifier: string }> {
    const bytes = normalizeBytes(params.data);
    const reference = this.socReference(this.owner, params.identifier);
    if (!this.socs.has(reference)) {
      this.socs.set(reference, {
        owner: this.owner,
        identifier: params.identifier,
        bytes,
      });
    }
    return {
      reference,
      owner: this.owner,
      identifier: params.identifier,
    };
  }

  async readSingleOwnerChunk(params: { address: string } | { owner: string; identifier: string }): Promise<SwarmReadSingleOwnerChunkResult> {
    const reference = 'address' in params
      ? params.address
      : this.socReference(params.owner, params.identifier);
    const entry = this.socs.get(reference);
    if (!entry) throw providerError(-32602, 'Single Owner Chunk not found', 'chunk_not_found');
    return {
      data: bytesToBase64(entry.bytes),
      encoding: 'base64',
      span: entry.bytes.length,
      reference,
      owner: entry.owner,
      identifier: entry.identifier,
      signature: '00'.repeat(65),
    };
  }

  private socReference(owner: string, identifier: string): string {
    return deriveIdentifier(['mock:soc', owner.toLowerCase(), identifier.toLowerCase()]);
  }
}

export function providerError(code: number, message: string, reason: string): Error & { code: number; data: { reason: string } } {
  const error = new Error(message) as Error & { code: number; data: { reason: string } };
  error.code = code;
  error.data = { reason };
  return error;
}
