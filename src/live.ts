import { bytesToHex, bytesToJson, bytesToUtf8, jsonToBytes, normalizeBytes, utf8ToBytes, type BytesLike } from './bytes.js';
import { toSwarmKitDriver, driverSupportsMessaging, type SwarmKitDriver, type SwarmKitDriverInput, type SwarmKitSubscriptionMessage } from './driver.js';
import { normalizeError } from './errors.js';
import { createMultiWriterFeed, type MultiWriterFeed, type MultiWriterFeedEntry, type MultiWriterFeedOptions, type MultiWriterFeedWriter } from './multi-writer-feed.js';
import { publishObjectJson, readObjectJson } from './objects.js';
import type { SwarmMessagingIdentity, SwarmSendGsocResult } from './provider.js';

/**
 * Live messaging primitives over the provider's PSS/GSOC extension.
 *
 * Layering follows the messaging SWIP's intended architecture: durable
 * Swarm structures (feeds, SOC streams) remain the source of truth, and
 * messaging is best-effort live propagation on top. Delivery is
 * unordered, at-least-once, and unauthenticated at the transport layer —
 * everything here surfaces that honestly rather than hiding it.
 *
 * A note on node capacity: every distinct GSOC topic is its own pull
 * neighborhood on the node, and the node bounds concurrent neighborhoods
 * to a small pool shared by all origins. Applications SHOULD multiplex
 * logical channels over one topic via {@link createLiveBus} instead of
 * opening a topic per widget.
 */

// ---------------------------------------------------------------------------
// Raw live topic (GSOC) — bytes in, bytes out, no envelope
// ---------------------------------------------------------------------------

export interface LiveTopicOptions {
  topic: string;
}

export interface LiveMessage {
  data: Uint8Array;
  key: string;
  receivedAt: number;
}

export interface LiveSubscription {
  readonly subscriptionId: string;
  readonly key: string;
  unsubscribe(): Promise<void>;
}

export interface LiveTopic {
  readonly topic: string;
  subscribe(handler: (message: LiveMessage) => void): Promise<LiveSubscription>;
  sendBytes(data: BytesLike): Promise<SwarmSendGsocResult>;
  sendText(text: string): Promise<SwarmSendGsocResult>;
  sendJson(value: unknown): Promise<SwarmSendGsocResult>;
}

/**
 * Shared subscription lifecycle for GSOC topics and PSS inboxes: open,
 * filter deliveries to this subscription, and tear both down together.
 */
async function openLiveSubscription(
  driver: SwarmKitDriver,
  params: { kind: 'gsoc' | 'pss'; topic: string },
  handler: (message: LiveMessage) => void,
): Promise<LiveSubscription> {
  if (!driverSupportsMessaging(driver)) {
    throw new Error('Swarm driver does not support messaging (subscribe/message events)');
  }
  const subscription = await driver.subscribe!(params);
  const detach = driver.onSubscriptionMessage!((message) => {
    if (message.subscriptionId !== subscription.subscriptionId) return;
    handler({ data: message.data, key: message.key, receivedAt: message.receivedAt });
  });
  return {
    subscriptionId: subscription.subscriptionId,
    key: subscription.key,
    async unsubscribe() {
      detach();
      await driver.unsubscribe!(subscription.subscriptionId);
    },
  };
}

export function createLiveTopic(input: SwarmKitDriverInput, options: LiveTopicOptions): LiveTopic {
  const driver = toSwarmKitDriver(input);

  return {
    topic: options.topic,
    subscribe(handler) {
      return openLiveSubscription(driver, { kind: 'gsoc', topic: options.topic }, handler);
    },
    async sendBytes(data) {
      if (!driver.sendGsoc) throw new Error('Swarm driver does not support sendGsoc');
      return driver.sendGsoc({ topic: options.topic, data: normalizeBytes(data) });
    },
    sendText(text) {
      return this.sendBytes(utf8ToBytes(text));
    },
    sendJson(value) {
      return this.sendBytes(jsonToBytes(value));
    },
  };
}

// ---------------------------------------------------------------------------
// Live bus — multiplexed channels over ONE topic (one node pipeline)
// ---------------------------------------------------------------------------

const LIVE_BUS_PROTOCOL = 'swarm-kit:live-bus/v1';
// Conservative fallback when capabilities are unavailable; real providers
// advertise the true usable maximum via limits.maxMessageBytes.
const DEFAULT_MAX_MESSAGE_BYTES = 3584;

interface LiveBusFrame {
  p: typeof LIVE_BUS_PROTOCOL;
  /** Channel name. */
  c: string;
  /** Random nonce: keeps byte-identical app payloads distinct, since the
   * transport MAY coalesce identical messages. */
  n: string;
  /** Sender wall-clock ms (informational only — unordered transport). */
  t: number;
  /** Inline JSON payload… */
  d?: unknown;
  /** …or an object-graph reference when the payload was too large. */
  r?: string;
}

export interface LiveBusOptions {
  topic: string;
}

export interface LiveBusMessage<T = unknown> {
  channel: string;
  value: T;
  nonce: string;
  sentAt: number;
  receivedAt: number;
  /** True when the payload travelled as an object-graph reference. */
  spilled: boolean;
}

export interface LiveBusChannel<T = unknown> {
  readonly name: string;
  send(value: T): Promise<void>;
  subscribe(handler: (message: LiveBusMessage<T>) => void): Promise<() => void>;
}

export interface LiveBus {
  readonly topic: string;
  channel<T = unknown>(name: string): LiveBusChannel<T>;
  close(): Promise<void>;
}

function randomNonceHex(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(8)));
}

function parseBusFrame(data: Uint8Array): LiveBusFrame | null {
  let frame: LiveBusFrame;
  try {
    frame = bytesToJson<LiveBusFrame>(data);
  } catch {
    return null;
  }
  if (frame?.p !== LIVE_BUS_PROTOCOL || typeof frame.c !== 'string') return null;
  return frame;
}

export function createLiveBus(input: SwarmKitDriverInput, options: LiveBusOptions): LiveBus {
  const driver = toSwarmKitDriver(input);
  const topic = createLiveTopic(driver, { topic: options.topic });
  const handlers = new Map<string, Set<(message: LiveBusMessage) => void>>();
  let subscribing: Promise<LiveSubscription> | null = null;
  let maxMessageBytes: number | null = null;

  async function messageLimit(): Promise<number> {
    if (maxMessageBytes !== null) return maxMessageBytes;
    let limit = DEFAULT_MAX_MESSAGE_BYTES;
    try {
      const capabilities = await driver.getCapabilities?.();
      if (typeof capabilities?.limits?.maxMessageBytes === 'number') {
        limit = capabilities.limits.maxMessageBytes;
      }
    } catch {
      // capabilities are advisory; keep the conservative default
    }
    maxMessageBytes = limit;
    return limit;
  }

  async function dispatch(message: LiveMessage): Promise<void> {
    const frame = parseBusFrame(message.data);
    if (!frame) return;
    const channelHandlers = handlers.get(frame.c);
    if (!channelHandlers || channelHandlers.size === 0) return;

    let value: unknown;
    let spilled = false;
    if (frame.r !== undefined) {
      spilled = true;
      try {
        value = await readObjectJson(driver, frame.r);
      } catch (error) {
        // A spilled payload that cannot be fetched yet is a gap, not a
        // crash — best-effort transport semantics.
        console.warn(`[swarm-kit] live bus: failed to resolve spilled payload ${frame.r}:`, normalizeError(error).message);
        return;
      }
    } else {
      value = frame.d;
    }

    const busMessage: LiveBusMessage = {
      channel: frame.c,
      value,
      nonce: frame.n,
      sentAt: frame.t,
      receivedAt: message.receivedAt,
      spilled,
    };
    for (const handler of channelHandlers) {
      try {
        handler(busMessage);
      } catch (error) {
        console.warn('[swarm-kit] live bus handler failed:', normalizeError(error).message);
      }
    }
  }

  async function ensureSubscribed(): Promise<void> {
    subscribing ??= topic.subscribe((message) => {
      void dispatch(message);
    });
    await subscribing;
  }

  return {
    topic: options.topic,
    channel<T = unknown>(name: string): LiveBusChannel<T> {
      return {
        name,
        async send(value: T) {
          const frame: LiveBusFrame = {
            p: LIVE_BUS_PROTOCOL,
            c: name,
            n: randomNonceHex(),
            t: Date.now(),
            d: value,
          };
          const bytes = jsonToBytes(frame);
          if (bytes.length <= await messageLimit()) {
            await topic.sendBytes(bytes);
            return;
          }
          // Spill oversized payloads to a durable object graph and send
          // only the reference (the SWIP's recommended pattern).
          const published = await publishObjectJson(driver, value);
          delete frame.d;
          frame.r = published.reference;
          await topic.sendJson(frame);
        },
        async subscribe(handler: (message: LiveBusMessage<T>) => void) {
          await ensureSubscribed();
          let set = handlers.get(name);
          if (!set) {
            set = new Set();
            handlers.set(name, set);
          }
          const typedHandler = handler as (message: LiveBusMessage) => void;
          set.add(typedHandler);
          return () => {
            set.delete(typedHandler);
            if (set.size === 0) handlers.delete(name);
          };
        },
      };
    },
    async close() {
      handlers.clear();
      const pending = subscribing;
      subscribing = null;
      if (pending) await (await pending).unsubscribe();
    },
  };
}

// ---------------------------------------------------------------------------
// PSS inbox — encrypted point-to-point with shareable address cards
// ---------------------------------------------------------------------------

const INBOX_CARD_TYPE = 'swarm-kit:inbox-card/v1';
const DEFAULT_INBOX_TOPIC = 'swarm-kit:inbox/v1';

export interface LiveInboxCard {
  type: typeof INBOX_CARD_TYPE;
  pssPublicKey: string;
  pssTarget: string;
  topic: string;
}

export interface LiveInboxOptions {
  topic?: string;
}

export interface LiveInbox {
  readonly topic: string;
  /** The shareable address card peers use to reach this inbox. */
  card(): Promise<LiveInboxCard>;
  identity(): Promise<SwarmMessagingIdentity>;
  subscribe(handler: (message: LiveMessage) => void): Promise<LiveSubscription>;
}

export function createLiveInbox(input: SwarmKitDriverInput, options: LiveInboxOptions = {}): LiveInbox {
  const driver = toSwarmKitDriver(input);
  const topic = options.topic ?? DEFAULT_INBOX_TOPIC;
  let cachedIdentity: SwarmMessagingIdentity | null = null;

  async function identity(): Promise<SwarmMessagingIdentity> {
    if (!driver.getMessagingIdentity) {
      throw new Error('Swarm driver does not support getMessagingIdentity');
    }
    cachedIdentity ??= await driver.getMessagingIdentity();
    return cachedIdentity;
  }

  return {
    topic,
    identity,
    async card() {
      const resolved = await identity();
      return {
        type: INBOX_CARD_TYPE,
        pssPublicKey: resolved.pssPublicKey,
        pssTarget: resolved.pssTarget,
        topic,
      };
    },
    subscribe(handler) {
      return openLiveSubscription(driver, { kind: 'pss', topic }, handler);
    },
  };
}

export function isLiveInboxCard(value: unknown): value is LiveInboxCard {
  const card = value as LiveInboxCard | undefined;
  return (
    card?.type === INBOX_CARD_TYPE &&
    typeof card.pssPublicKey === 'string' &&
    typeof card.pssTarget === 'string' &&
    typeof card.topic === 'string'
  );
}

export async function sendToInbox(input: SwarmKitDriverInput, card: LiveInboxCard, data: BytesLike): Promise<void> {
  const driver = toSwarmKitDriver(input);
  if (!driver.sendPss) throw new Error('Swarm driver does not support sendPss');
  if (!isLiveInboxCard(card)) throw new Error('Invalid inbox card');
  await driver.sendPss({
    topic: card.topic,
    recipient: card.pssPublicKey,
    targets: card.pssTarget,
    data: normalizeBytes(data),
  });
}

export function sendTextToInbox(input: SwarmKitDriverInput, card: LiveInboxCard, text: string): Promise<void> {
  return sendToInbox(input, card, utf8ToBytes(text));
}

export function sendJsonToInbox(input: SwarmKitDriverInput, card: LiveInboxCard, value: unknown): Promise<void> {
  return sendToInbox(input, card, jsonToBytes(value));
}

// ---------------------------------------------------------------------------
// Live multi-writer feed — durable feed + GSOC head hints
// ---------------------------------------------------------------------------

const MWF_HINT_CHANNEL = 'swarm-kit:mwf-hint/v1';
// The default per-writer gap the live reader will backfill entry-by-entry
// after missing hints (e.g. while offline); larger gaps are truncated to
// the most recent entries.
const MAX_HINT_GAP = 25;

interface MultiWriterFeedHint {
  topic: string;
  owner: string;
  writerId: string;
  index: number;
}

export interface LiveMultiWriterFeedOptions extends MultiWriterFeedOptions {
  /**
   * Bus carrying the head hints. Defaults to a dedicated bus on
   * `swarm-kit:mwf/v1:<topic>` — pass a shared app bus to conserve the
   * node's subscription pool.
   */
  bus?: LiveBus;
}

export interface LiveMultiWriterFeedSubscribeOptions<T> {
  /** Writers whose entries are delivered. */
  writers: readonly MultiWriterFeedWriter[];
  onEntry: (entry: MultiWriterFeedEntry<T>) => void;
  /**
   * Called when a hint arrives from a writer not in `writers`. Add the
   * writer via the returned subscription's `addWriter` to accept it.
   */
  onWriterDiscovered?: (writer: Required<MultiWriterFeedWriter>) => void;
  /** Read and deliver existing entries before going live (default true). */
  catchUp?: boolean;
  catchUpLimitPerWriter?: number;
}

export interface LiveMultiWriterFeedSubscription {
  addWriter(writer: MultiWriterFeedWriter): Promise<void>;
  unsubscribe(): Promise<void>;
}

export interface LiveMultiWriterFeed<T = unknown> {
  readonly feed: MultiWriterFeed<T>;
  readonly topic: string;
  append(payload: T): ReturnType<MultiWriterFeed<T>['append']>;
  subscribe(options: LiveMultiWriterFeedSubscribeOptions<T>): Promise<LiveMultiWriterFeedSubscription>;
  close(): Promise<void>;
}

export function createLiveMultiWriterFeed<T = unknown>(
  input: SwarmKitDriverInput,
  options: LiveMultiWriterFeedOptions,
): LiveMultiWriterFeed<T> {
  const driver = toSwarmKitDriver(input);
  const { bus: providedBus, ...feedOptions } = options;
  const feed = createMultiWriterFeed<T>(driver, feedOptions);
  const ownsBus = !providedBus;
  const bus = providedBus ?? createLiveBus(driver, { topic: `swarm-kit:mwf/v1:${options.topic}` });
  const hints = bus.channel<MultiWriterFeedHint>(MWF_HINT_CHANNEL);

  function isHintForFeed(hint: MultiWriterFeedHint): boolean {
    return (
      hint?.topic === options.topic &&
      typeof hint.owner === 'string' &&
      typeof hint.writerId === 'string' &&
      Number.isSafeInteger(hint.index) &&
      hint.index >= 0
    );
  }

  return {
    feed,
    topic: options.topic,
    async append(payload) {
      const appended = await feed.append(payload);
      // Best-effort: a failed hint only delays peers until their next
      // catch-up; the durable entry is already written.
      try {
        await hints.send({
          topic: options.topic,
          owner: appended.owner,
          writerId: appended.writerId,
          index: appended.index,
        });
      } catch (error) {
        console.warn('[swarm-kit] live multi-writer feed hint failed:', normalizeError(error).message);
      }
      return appended;
    },
    async subscribe({ writers, onEntry, onWriterDiscovered, catchUp = true, catchUpLimitPerWriter = 10 }) {
      interface WriterState {
        writer: Required<MultiWriterFeedWriter>;
        lastDelivered: number;
        // Per-writer delivery queue: hint handling and addWriter replay
        // chain onto it, so entries reach onEntry at most once, in order.
        queue: Promise<void>;
      }
      const accepted = new Map<string, WriterState>();
      const writerKey = (owner: string, writerId: string) => `${owner.toLowerCase()}:${writerId}`;

      function acceptWriter(writer: MultiWriterFeedWriter): WriterState {
        const writerId = writer.writerId ?? feed.writerId;
        const state: WriterState = {
          writer: { owner: writer.owner, writerId },
          lastDelivered: -1,
          queue: Promise.resolve(),
        };
        accepted.set(writerKey(writer.owner, writerId), state);
        return state;
      }

      function replay(state: WriterState, entries: readonly MultiWriterFeedEntry<T>[]): void {
        // Deliver oldest-first so appends read naturally.
        for (const entry of [...entries].reverse()) {
          if (entry.index <= state.lastDelivered) continue;
          state.lastDelivered = entry.index;
          onEntry(entry);
        }
      }

      function enqueueDeliverThrough(state: WriterState, index: number): void {
        state.queue = state.queue
          .then(async () => {
            if (index <= state.lastDelivered) return;
            const from = Math.max(state.lastDelivered + 1, index - MAX_HINT_GAP + 1);
            const indices = Array.from({ length: index - from + 1 }, (_, offset) => from + offset);
            const entries = await Promise.all(
              indices.map((entryIndex) => feed.readAt(state.writer.owner, entryIndex, { writerId: state.writer.writerId })),
            );
            for (const entry of entries) {
              if (entry && entry.index > state.lastDelivered) {
                state.lastDelivered = entry.index;
                onEntry(entry);
              }
            }
          })
          .catch((error) => {
            console.warn('[swarm-kit] live multi-writer feed delivery failed:', normalizeError(error).message);
          });
      }

      for (const writer of writers) acceptWriter(writer);

      if (catchUp && writers.length > 0) {
        const existing = await feed.readLatest(writers, { limitPerWriter: catchUpLimitPerWriter });
        const byWriter = new Map<string, MultiWriterFeedEntry<T>[]>();
        for (const entry of existing) {
          const key = writerKey(entry.owner, entry.writerId);
          if (!byWriter.has(key)) byWriter.set(key, []);
          byWriter.get(key)!.push(entry);
        }
        for (const [key, entries] of byWriter) {
          const state = accepted.get(key);
          if (state) replay(state, entries);
        }
      }

      const detachHints = await hints.subscribe((message) => {
        const hint = message.value;
        if (!isHintForFeed(hint)) return;
        const state = accepted.get(writerKey(hint.owner, hint.writerId));
        if (!state) {
          onWriterDiscovered?.({ owner: hint.owner, writerId: hint.writerId });
          return;
        }
        if (hint.index <= state.lastDelivered) return;
        enqueueDeliverThrough(state, hint.index);
      });

      return {
        async addWriter(writer) {
          const writerId = writer.writerId ?? feed.writerId;
          if (accepted.has(writerKey(writer.owner, writerId))) return;
          const state = acceptWriter(writer);
          const latest = await feed.readWriter(writer.owner, { writerId, limit: catchUpLimitPerWriter });
          replay(state, latest);
        },
        async unsubscribe() {
          detachHints();
        },
      };
    },
    async close() {
      if (ownsBus) await bus.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Convenience text/JSON views over raw live messages
// ---------------------------------------------------------------------------

export function liveMessageText(message: LiveMessage): string {
  return bytesToUtf8(message.data);
}

export function liveMessageJson<T = unknown>(message: LiveMessage): T {
  return bytesToJson<T>(message.data);
}
