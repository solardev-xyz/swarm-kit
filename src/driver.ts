import { base64ToBytes, normalizeBytes, type BytesLike } from './bytes.js';
import {
  callSwarm,
  type SwarmCapabilities,
  type SwarmChunkReadResult,
  type SwarmProvider,
  type SwarmPublishChunkResult,
  type SwarmReadSingleOwnerChunkResult,
  type SwarmSigningIdentity,
  type SwarmWriteSingleOwnerChunkResult,
} from './provider.js';

export interface SwarmKitPublishChunkParams {
  data: Uint8Array;
  span?: number | bigint;
  signal?: AbortSignal;
}

export interface SwarmKitReadChunkParams {
  reference: string;
  signal?: AbortSignal;
}

export interface SwarmKitReadChunkResult {
  data: Uint8Array;
  span: number | bigint;
}

export interface SwarmKitWriteSingleOwnerChunkParams {
  identifier: string;
  data: Uint8Array;
  span?: number | bigint;
  signal?: AbortSignal;
}

export interface SwarmKitReadSingleOwnerChunkByAddressParams {
  address: string;
  signal?: AbortSignal;
}

export interface SwarmKitReadSingleOwnerChunkByOwnerParams {
  owner: string;
  identifier: string;
  signal?: AbortSignal;
}

export interface SwarmKitReadSingleOwnerChunkResult extends SwarmKitReadChunkResult {
  reference: string;
  owner: string;
  identifier: string;
  signature?: string;
}

export interface SwarmKitDriver {
  readonly isSwarmKitDriver: true;
  publishChunk(params: SwarmKitPublishChunkParams): Promise<SwarmPublishChunkResult>;
  readChunk(params: SwarmKitReadChunkParams): Promise<SwarmKitReadChunkResult>;
  writeSingleOwnerChunk(params: SwarmKitWriteSingleOwnerChunkParams): Promise<SwarmWriteSingleOwnerChunkResult>;
  readSingleOwnerChunk(
    params: SwarmKitReadSingleOwnerChunkByAddressParams | SwarmKitReadSingleOwnerChunkByOwnerParams,
  ): Promise<SwarmKitReadSingleOwnerChunkResult>;
  getSigningIdentity?(): Promise<SwarmSigningIdentity>;
  getCapabilities?(): Promise<SwarmCapabilities>;
  requestAccess?(): Promise<unknown>;
}

export type SwarmKitDriverInput = SwarmKitDriver | SwarmProvider;

export function createWindowSwarmDriver(provider: SwarmProvider): SwarmKitDriver {
  const driver: SwarmKitDriver = {
    isSwarmKitDriver: true,
    async publishChunk(params) {
      return callSwarm(provider, 'swarm_publishChunk', {
        data: normalizeBytes(params.data),
        ...(params.span !== undefined ? { span: params.span } : {}),
      });
    },
    async readChunk(params) {
      const result = await callSwarm<SwarmChunkReadResult>(provider, 'swarm_readChunk', {
        reference: params.reference,
      });
      return decodeChunkRead(result);
    },
    async writeSingleOwnerChunk(params) {
      return callSwarm(provider, 'swarm_writeSingleOwnerChunk', {
        identifier: params.identifier,
        data: normalizeBytes(params.data),
        ...(params.span !== undefined ? { span: params.span } : {}),
      });
    },
    async readSingleOwnerChunk(params) {
      const result = await callSwarm<SwarmReadSingleOwnerChunkResult>(
        provider,
        'swarm_readSingleOwnerChunk',
        'address' in params
          ? { address: params.address }
          : { owner: params.owner, identifier: params.identifier },
      );
      return decodeSocRead(result);
    },
  };
  if (provider.getSigningIdentity || provider.request) {
    driver.getSigningIdentity = () => callSwarm(provider, 'swarm_getSigningIdentity');
  }
  if (provider.getCapabilities || provider.request) {
    driver.getCapabilities = () => callSwarm(provider, 'swarm_getCapabilities');
  }
  if (provider.requestAccess || provider.request) {
    driver.requestAccess = () => callSwarm(provider, 'swarm_requestAccess');
  }
  return driver;
}

export function toSwarmKitDriver(input: SwarmKitDriverInput): SwarmKitDriver {
  return isSwarmKitDriver(input) ? input : createWindowSwarmDriver(input);
}

export function isSwarmKitDriver(input: SwarmKitDriverInput): input is SwarmKitDriver {
  return (input as Partial<SwarmKitDriver>).isSwarmKitDriver === true;
}

function decodeChunkRead(result: SwarmChunkReadResult): SwarmKitReadChunkResult {
  return {
    data: base64ToBytes(result.data),
    span: result.span,
  };
}

function decodeSocRead(result: SwarmReadSingleOwnerChunkResult): SwarmKitReadSingleOwnerChunkResult {
  const decoded: SwarmKitReadSingleOwnerChunkResult = {
    data: base64ToBytes(result.data),
    span: result.span,
    reference: result.reference,
    owner: result.owner,
    identifier: result.identifier,
  };
  if (result.signature !== undefined) decoded.signature = result.signature;
  return decoded;
}

export function normalizeDriverBytes(value: BytesLike): Uint8Array {
  return normalizeBytes(value);
}
