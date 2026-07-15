import { describe, expect, it } from 'vitest';
import { createWindowSwarmDriver, driverSupportsMessaging } from '../src/driver.js';
import { bytesToUtf8, utf8ToBytes } from '../src/bytes.js';
import {
  createLiveBus,
  createLiveInbox,
  createLiveMultiWriterFeed,
  createLiveTopic,
  isLiveInboxCard,
  liveMessageJson,
  liveMessageText,
  sendJsonToInbox,
  sendTextToInbox,
} from '../src/live.js';
import type { MultiWriterFeedEntry, MultiWriterFeedWriter } from '../src/multi-writer-feed.js';
import { createMockSwarmStorage, mockGsocAddress, MockSwarmProvider } from './mock-provider.js';

const OWNER_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OWNER_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function twoPeers() {
  const storage = createMockSwarmStorage();
  const peerA = new MockSwarmProvider({ owner: OWNER_A, storage });
  const peerB = new MockSwarmProvider({ owner: OWNER_B, storage });
  return { storage, peerA, peerB };
}

async function waitFor<T>(collect: () => T[], count: number, timeoutMs = 500): Promise<T[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const values = collect();
    if (values.length >= count) return values;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for ${count} value(s); got ${collect().length}`);
}

describe('messaging driver surface', () => {
  it('exposes the messaging methods and decoded message events', async () => {
    const { peerA, peerB } = twoPeers();
    const driverA = createWindowSwarmDriver(peerA);
    const driverB = createWindowSwarmDriver(peerB);
    expect(driverSupportsMessaging(driverA)).toBe(true);

    const received: string[] = [];
    const subscription = await driverA.subscribe!({ kind: 'gsoc', topic: 'room' });
    expect(subscription.key).toBe(mockGsocAddress('room'));

    const detach = driverA.onSubscriptionMessage!((message) => {
      expect(message.subscriptionId).toBe(subscription.subscriptionId);
      expect(message.kind).toBe('gsoc');
      expect(message.data).toBeInstanceOf(Uint8Array);
      received.push(bytesToUtf8(message.data));
    });

    const sent = await driverB.sendGsoc!({ topic: 'room', data: utf8ToBytes('hello') });
    expect(sent).toEqual({ sent: true, address: subscription.key });

    await waitFor(() => received, 1);
    expect(received).toEqual(['hello']);

    detach();
    await driverA.unsubscribe!(subscription.subscriptionId);
    await expect(driverA.unsubscribe!(subscription.subscriptionId)).rejects.toMatchObject({
      data: { reason: 'subscription_not_found' },
    });
  });

  it('omits the event surface for providers without on()', () => {
    const requestOnly = {
      request: async () => {
        throw new Error('unused');
      },
    };
    const driver = createWindowSwarmDriver(requestOnly);
    expect(driver.subscribe).toBeDefined();
    expect(driver.onSubscriptionMessage).toBeUndefined();
    expect(driverSupportsMessaging(driver)).toBe(false);
  });
});

describe('live topic', () => {
  it('round-trips raw bytes between two peers and resolves the address', async () => {
    const { peerA, peerB } = twoPeers();
    const topicA = createLiveTopic(peerA, { topic: 'room:doc' });
    const topicB = createLiveTopic(peerB, { topic: 'room:doc' });

    const received: string[] = [];
    const subscription = await topicA.subscribe((message) => received.push(liveMessageText(message)));
    expect(subscription.key).toBe(mockGsocAddress('room:doc'));

    const sent = await topicB.sendJson({ hello: 'room' });
    expect(sent.address).toBe(subscription.key);

    await waitFor(() => received, 1);
    expect(JSON.parse(received[0]!)).toEqual({ hello: 'room' });

    await subscription.unsubscribe();
    await topicB.sendText('after unsubscribe');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(received).toHaveLength(1);
  });
});

describe('live bus', () => {
  it('multiplexes channels over one subscription and keeps identical payloads distinct', async () => {
    const { peerA, peerB } = twoPeers();
    const busA = createLiveBus(peerA, { topic: 'app' });
    const busB = createLiveBus(peerB, { topic: 'app' });

    const chat: unknown[] = [];
    const presence: unknown[] = [];
    await busA.channel('chat').subscribe((message) => chat.push(message.value));
    await busA.channel('presence').subscribe((message) => presence.push(message.value));

    await busB.channel('chat').send({ text: 'hi' });
    // Byte-identical app payloads must still arrive individually (nonce).
    await busB.channel('chat').send({ text: 'hi' });
    await busB.channel('presence').send({ typing: true });

    await waitFor(() => chat, 2);
    await waitFor(() => presence, 1);
    expect(chat).toEqual([{ text: 'hi' }, { text: 'hi' }]);
    expect(presence).toEqual([{ typing: true }]);

    await busA.close();
    await busB.channel('chat').send({ text: 'closed' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(chat).toHaveLength(2);
  });

  it('spills oversized payloads to an object graph and resolves them on receive', async () => {
    const { peerA, peerB } = twoPeers();
    const busA = createLiveBus(peerA, { topic: 'app' });
    const busB = createLiveBus(peerB, { topic: 'app' });

    const received: Array<{ value: unknown; spilled: boolean }> = [];
    await busA.channel('bulk').subscribe((message) => {
      received.push({ value: message.value, spilled: message.spilled });
    });

    const large = { blob: 'x'.repeat(20_000) };
    await busB.channel('bulk').send(large);

    await waitFor(() => received, 1);
    expect(received[0]!.spilled).toBe(true);
    expect(received[0]!.value).toEqual(large);
  });
});

describe('live inbox (PSS)', () => {
  it('delivers only to the card owner', async () => {
    const { peerA, peerB } = twoPeers();
    const inboxA = createLiveInbox(peerA);
    const inboxB = createLiveInbox(peerB);

    const cardA = await inboxA.card();
    expect(isLiveInboxCard(cardA)).toBe(true);
    expect(cardA.pssPublicKey).toMatch(/^02[0-9a-f]{64}$/);
    expect(cardA.pssTarget).toMatch(/^[0-9a-f]{6}$/);

    const forA: string[] = [];
    const forB: string[] = [];
    await inboxA.subscribe((message) => forA.push(liveMessageText(message)));
    await inboxB.subscribe((message) => forB.push(liveMessageText(message)));

    await sendTextToInbox(peerB, cardA, 'private hello');
    await waitFor(() => forA, 1);
    expect(forA).toEqual(['private hello']);
    // Same topic, different recipient key: B must not receive A's mail.
    expect(forB).toHaveLength(0);
  });

  it('sends JSON payloads via the kit helper', async () => {
    const { peerA, peerB } = twoPeers();
    const inboxA = createLiveInbox(peerA);
    const cardA = await inboxA.card();

    const received: unknown[] = [];
    await inboxA.subscribe((message) => received.push(liveMessageJson(message)));
    await sendJsonToInbox(peerB, cardA, { kind: 'dm', text: 'yo' });

    await waitFor(() => received, 1);
    expect(received).toEqual([{ kind: 'dm', text: 'yo' }]);
  });
});

describe('live multi-writer feed', () => {
  interface Post {
    text: string;
  }

  it('catches up from the durable feed, then delivers live entries via hints', async () => {
    const { peerA, peerB } = twoPeers();
    const feedA = createLiveMultiWriterFeed<Post>(peerA, { topic: 'team', writerId: 'a' });
    const feedB = createLiveMultiWriterFeed<Post>(peerB, { topic: 'team', writerId: 'b' });

    // Durable history before anyone subscribes.
    await feedA.append({ text: 'old-1' });
    await feedA.append({ text: 'old-2' });

    const ownerA = await feedA.feed.getOwner();
    const writers: MultiWriterFeedWriter[] = [{ owner: ownerA, writerId: 'a' }];

    const entries: MultiWriterFeedEntry<Post>[] = [];
    const subscription = await feedB.subscribe({
      writers,
      onEntry: (entry) => entries.push(entry),
    });

    // Catch-up delivered oldest-first.
    expect(entries.map((entry) => entry.payload.text)).toEqual(['old-1', 'old-2']);

    await feedA.append({ text: 'live-3' });
    await waitFor(() => entries, 3);
    expect(entries[2]!.payload.text).toBe('live-3');
    expect(entries[2]!.index).toBe(2);

    await subscription.unsubscribe();
    await feedA.close();
    await feedB.close();
  });

  it('backfills gaps and surfaces unknown writers for explicit acceptance', async () => {
    const { peerA, peerB } = twoPeers();
    const feedA = createLiveMultiWriterFeed<Post>(peerA, { topic: 'team', writerId: 'a' });
    const feedB = createLiveMultiWriterFeed<Post>(peerB, { topic: 'team', writerId: 'b' });

    const entries: MultiWriterFeedEntry<Post>[] = [];
    const discovered: Array<Required<MultiWriterFeedWriter>> = [];
    const subscription = await feedB.subscribe({
      writers: [],
      onEntry: (entry) => entries.push(entry),
      onWriterDiscovered: (writer) => discovered.push(writer),
    });

    await feedA.append({ text: 'from-unknown' });
    await waitFor(() => discovered, 1);
    expect(entries).toHaveLength(0);
    expect(discovered[0]!.writerId).toBe('a');

    // Accepting the writer replays its history…
    await subscription.addWriter(discovered[0]!);
    expect(entries.map((entry) => entry.payload.text)).toEqual(['from-unknown']);

    // …and a hint for index 2 backfills the missed index 1.
    await feedA.feed.append({ text: 'silent-1' }); // append without hint
    await feedA.append({ text: 'hinted-2' });
    await waitFor(() => entries, 3);
    expect(entries.map((entry) => entry.payload.text)).toEqual(['from-unknown', 'silent-1', 'hinted-2']);

    await subscription.unsubscribe();
    await feedA.close();
    await feedB.close();
  });
});
