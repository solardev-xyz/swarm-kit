import { bytesToBase64, normalizeBytes } from '../src/bytes.js';
import { deriveIdentifier } from '../src/identifiers.js';
import type {
  SwarmCapabilities,
  SwarmChunkReadResult,
  SwarmMessagingIdentity,
  SwarmProvider,
  SwarmReadSingleOwnerChunkResult,
  SwarmSendGsocResult,
  SwarmSendPssResult,
  SwarmSigningIdentity,
  SwarmSubscribeResult,
  SwarmSubscriptionKind,
  SwarmSubscriptionMessage,
  SwarmUnsubscribeResult,
} from '../src/provider.js';

export interface MockSwarmProviderOptions {
  owner?: string;
  storage?: MockSwarmProviderStorage;
}

interface MockSubscription {
  subscriptionId: string;
  kind: SwarmSubscriptionKind;
  key: string;
  provider: MockSwarmProvider;
}

export interface MockSwarmProviderStorage {
  chunks: Map<string, Uint8Array>;
  socs: Map<string, { owner: string; identifier: string; bytes: Uint8Array }>;
  /** Shared messaging fabric: subscriptions across every provider on this storage. */
  subscriptions: Map<string, MockSubscription>;
}

export function createMockSwarmStorage(): MockSwarmProviderStorage {
  return {
    chunks: new Map(),
    socs: new Map(),
    subscriptions: new Map(),
  };
}

const MOCK_MAX_MESSAGE_BYTES = 4000;
const MOCK_MAX_SUBSCRIPTIONS = 32;

export class MockSwarmProvider implements SwarmProvider {
  readonly isFreedomBrowser = true;
  readonly owner: string;
  private readonly chunks: MockSwarmProviderStorage['chunks'];
  private readonly socs: MockSwarmProviderStorage['socs'];
  private readonly subscriptions: MockSwarmProviderStorage['subscriptions'];
  private readonly messageListeners = new Set<(data: unknown) => void>();
  private subscriptionCounter = 0;

  constructor(options: MockSwarmProviderOptions = {}) {
    this.owner = options.owner ?? '0x1111111111111111111111111111111111111111';
    const storage = options.storage ?? createMockSwarmStorage();
    this.chunks = storage.chunks;
    this.socs = storage.socs;
    this.subscriptions = storage.subscriptions;
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
      features: ['messaging'],
      limits: {
        maxChunkPayloadBytes: 4096,
        maxPathBytes: 100,
        maxMessageBytes: MOCK_MAX_MESSAGE_BYTES,
        maxTargetDepth: 3,
        maxSubscriptions: MOCK_MAX_SUBSCRIPTIONS,
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

  // --- Messaging extension (PSS/GSOC) ---------------------------------

  async getMessagingIdentity(): Promise<SwarmMessagingIdentity> {
    return {
      pssPublicKey: mockPssPublicKey(this.owner),
      pssTarget: deriveIdentifier(['mock:overlay', this.owner.toLowerCase()]).slice(0, 6),
      identityMode: 'bee-wallet',
    };
  }

  async subscribe(params: { kind: SwarmSubscriptionKind; topic?: string; address?: string }): Promise<SwarmSubscribeResult> {
    if (params.kind !== 'gsoc' && params.kind !== 'pss') {
      throw providerError(-32602, 'kind must be "gsoc" or "pss"', 'invalid_kind');
    }
    const hasTopic = params.topic !== undefined && params.topic !== null;
    const hasAddress = params.address !== undefined && params.address !== null;
    if (params.kind === 'gsoc') {
      if (hasTopic === hasAddress) {
        throw providerError(-32602, 'Provide either topic or address, not both', 'invalid_params');
      }
      if (hasAddress && !/^[0-9a-fA-F]{64}$/.test(params.address!)) {
        throw providerError(-32602, 'address must be a 64-character hex string', 'invalid_address');
      }
    } else {
      if (hasAddress) {
        throw providerError(-32602, 'address is only valid for gsoc subscriptions', 'invalid_params');
      }
      if (!hasTopic) {
        throw providerError(-32602, 'topic is required', 'invalid_topic');
      }
    }
    let ownCount = 0;
    for (const subscription of this.subscriptions.values()) {
      if (subscription.provider === this) ownCount++;
    }
    if (ownCount >= MOCK_MAX_SUBSCRIPTIONS) {
      throw providerError(-32602, 'Too many subscriptions', 'too_many_subscriptions');
    }
    const key = params.kind === 'gsoc'
      ? (params.address ?? mockGsocAddress(params.topic ?? ''))
      : mockPssTopicHex(params.topic ?? '');
    const subscriptionId = `mock-sub-${++this.subscriptionCounter}-${this.owner.slice(2, 8)}`;
    this.subscriptions.set(subscriptionId, { subscriptionId, kind: params.kind, key, provider: this });
    return { subscriptionId, kind: params.kind, key };
  }

  async unsubscribe(params: { subscriptionId: string }): Promise<SwarmUnsubscribeResult> {
    const subscription = this.subscriptions.get(params.subscriptionId);
    if (!subscription || subscription.provider !== this) {
      throw providerError(-32602, `No active subscription: ${params.subscriptionId}`, 'subscription_not_found');
    }
    this.subscriptions.delete(params.subscriptionId);
    return { unsubscribed: true };
  }

  async sendGsoc(params: { topic?: string; address?: string; data: string | Uint8Array | ArrayBuffer }): Promise<SwarmSendGsocResult> {
    if (params.address !== undefined) {
      throw providerError(-32602, 'Sending to a raw GSOC address is not supported', 'invalid_address');
    }
    if (typeof params.topic !== 'string' || params.topic.length === 0) {
      throw providerError(-32602, 'topic must be a non-empty string', 'invalid_topic');
    }
    const bytes = normalizeBytes(params.data);
    if (bytes.length === 0) {
      throw providerError(-32602, 'data must not be empty', 'invalid_payload');
    }
    this.assertMessageSize(bytes);
    const address = mockGsocAddress(params.topic);
    this.deliver('gsoc', address, bytes);
    return { sent: true, address };
  }

  async sendPss(params: { topic: string; recipient: string; targets: string; data: string | Uint8Array | ArrayBuffer }): Promise<SwarmSendPssResult> {
    if (typeof params.topic !== 'string' || params.topic.length === 0) {
      throw providerError(-32602, 'topic must be a non-empty string', 'invalid_topic');
    }
    if (!/^0[23][0-9a-fA-F]{64}$/.test(params.recipient ?? '')) {
      throw providerError(-32602, 'recipient must be a compressed secp256k1 public key', 'invalid_recipient');
    }
    if (!/^([0-9a-fA-F]{2}){1,3}$/.test(params.targets ?? '')) {
      throw providerError(-32602, 'targets must be 1-3 bytes of hex', 'invalid_target');
    }
    const bytes = normalizeBytes(params.data);
    this.assertMessageSize(bytes);
    // Deliver only to providers whose messaging identity matches the
    // recipient key (PSS encrypts to the recipient).
    this.deliver('pss', mockPssTopicHex(params.topic), bytes, (subscription) =>
      mockPssPublicKey(subscription.provider.owner).toLowerCase() === params.recipient.toLowerCase());
    return { sent: true };
  }

  on(event: string, handler: (data: unknown) => void): void {
    if (event === 'message') this.messageListeners.add(handler);
  }

  removeListener(event: string, handler: (data: unknown) => void): void {
    if (event === 'message') this.messageListeners.delete(handler);
  }

  private assertMessageSize(bytes: Uint8Array): void {
    if (bytes.length > MOCK_MAX_MESSAGE_BYTES) {
      throw providerError(-32602, `Payload exceeds maximum message size of ${MOCK_MAX_MESSAGE_BYTES} bytes`, 'payload_too_large');
    }
  }

  private deliver(
    kind: SwarmSubscriptionKind,
    key: string,
    bytes: Uint8Array,
    accepts: (subscription: MockSubscription) => boolean = () => true,
  ): void {
    for (const subscription of [...this.subscriptions.values()]) {
      if (subscription.kind !== kind || subscription.key !== key) continue;
      if (!accepts(subscription)) continue;
      subscription.provider.emitSubscriptionMessage(subscription, bytes);
    }
  }

  private emitSubscriptionMessage(subscription: MockSubscription, bytes: Uint8Array): void {
    const message: SwarmSubscriptionMessage = {
      type: 'swarm_subscription',
      subscription: subscription.subscriptionId,
      result: {
        kind: subscription.kind,
        key: subscription.key,
        data: bytesToBase64(bytes),
        encoding: 'base64',
        receivedAt: Date.now(),
      },
    };
    // Async delivery, like the real event relay.
    queueMicrotask(() => {
      for (const listener of [...this.messageListeners]) {
        listener(message);
      }
    });
  }

  private socReference(owner: string, identifier: string): string {
    return deriveIdentifier(['mock:soc', owner.toLowerCase(), identifier.toLowerCase()]);
  }
}

export function mockGsocAddress(topic: string): string {
  return deriveIdentifier(['mock:gsoc-address', topic]);
}

export function mockPssPublicKey(owner: string): string {
  return `02${deriveIdentifier(['mock:pss-key', owner.toLowerCase()])}`;
}

export function mockPssTopicHex(topic: string): string {
  return deriveIdentifier(['mock:pss-topic', topic]);
}

export function providerError(code: number, message: string, reason: string): Error & { code: number; data: { reason: string } } {
  const error = new Error(message) as Error & { code: number; data: { reason: string } };
  error.code = code;
  error.data = { reason };
  return error;
}
