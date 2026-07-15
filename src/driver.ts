import { base64ToBytes, normalizeBytes, type BytesLike } from './bytes.js';
import {
  callSwarm,
  type SwarmCapabilities,
  type SwarmChunkReadResult,
  type SwarmMessagingIdentity,
  type SwarmProvider,
  type SwarmPublishChunkResult,
  type SwarmReadSingleOwnerChunkResult,
  type SwarmSendGsocResult,
  type SwarmSigningIdentity,
  type SwarmSubscribeResult,
  type SwarmSubscriptionKind,
  type SwarmSubscriptionMessage,
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

export interface SwarmKitSubscribeParams {
  kind: SwarmSubscriptionKind;
  topic?: string;
  address?: string;
}

export interface SwarmKitSendPssParams {
  topic: string;
  recipient: string;
  targets: string;
  data: Uint8Array;
}

export interface SwarmKitSendGsocParams {
  topic: string;
  data: Uint8Array;
}

/** A decoded `message` event: payload bytes instead of base64. */
export interface SwarmKitSubscriptionMessage {
  subscriptionId: string;
  kind: SwarmSubscriptionKind;
  key: string;
  data: Uint8Array;
  receivedAt: number;
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
  getMessagingIdentity?(): Promise<SwarmMessagingIdentity>;
  subscribe?(params: SwarmKitSubscribeParams): Promise<SwarmSubscribeResult>;
  unsubscribe?(subscriptionId: string): Promise<void>;
  sendPss?(params: SwarmKitSendPssParams): Promise<void>;
  sendGsoc?(params: SwarmKitSendGsocParams): Promise<SwarmSendGsocResult>;
  /**
   * Register a handler for decoded subscription messages. Returns an
   * unsubscribe function. Only present when the underlying provider
   * exposes an event surface (`on`/`removeListener`).
   */
  onSubscriptionMessage?(handler: (message: SwarmKitSubscriptionMessage) => void): () => void;
}

export function driverSupportsMessaging(driver: SwarmKitDriver): boolean {
  return typeof driver.subscribe === 'function' && typeof driver.onSubscriptionMessage === 'function';
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
  if (provider.getMessagingIdentity || provider.request) {
    driver.getMessagingIdentity = () => callSwarm(provider, 'swarm_getMessagingIdentity');
  }
  if (provider.subscribe || provider.request) {
    driver.subscribe = (params) => callSwarm(provider, 'swarm_subscribe', {
      kind: params.kind,
      ...(params.topic !== undefined ? { topic: params.topic } : {}),
      ...(params.address !== undefined ? { address: params.address } : {}),
    });
  }
  if (provider.unsubscribe || provider.request) {
    driver.unsubscribe = async (subscriptionId) => {
      await callSwarm(provider, 'swarm_unsubscribe', { subscriptionId });
    };
  }
  if (provider.sendPss || provider.request) {
    driver.sendPss = async (params) => {
      await callSwarm(provider, 'swarm_sendPss', {
        topic: params.topic,
        recipient: params.recipient,
        targets: params.targets,
        data: params.data,
      });
    };
  }
  if (provider.sendGsoc || provider.request) {
    driver.sendGsoc = (params) => callSwarm(provider, 'swarm_sendGsoc', {
      topic: params.topic,
      data: params.data,
    });
  }
  if (typeof provider.on === 'function') {
    // One shared provider listener regardless of subscriber count: each
    // incoming message is decoded once and fanned out, and the listener
    // detaches when the last handler unsubscribes.
    const handlers = new Set<(message: SwarmKitSubscriptionMessage) => void>();
    const shared = (payload: unknown) => {
      const message = payload as SwarmSubscriptionMessage | undefined;
      if (message?.type !== 'swarm_subscription' || !message.result) return;
      const decoded: SwarmKitSubscriptionMessage = {
        subscriptionId: message.subscription,
        kind: message.result.kind,
        key: message.result.key,
        data: base64ToBytes(message.result.data),
        receivedAt: message.result.receivedAt,
      };
      for (const handler of [...handlers]) handler(decoded);
    };
    driver.onSubscriptionMessage = (handler) => {
      if (handlers.size === 0) provider.on?.('message', shared);
      handlers.add(handler);
      return () => {
        if (!handlers.delete(handler)) return;
        if (handlers.size === 0) provider.removeListener?.('message', shared);
      };
    };
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
