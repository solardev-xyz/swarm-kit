import { describe, expect, test } from 'vitest';
import { createMultiWriterFeed, createSwarmKit } from '../src/index.js';
import { createMockSwarmStorage, MockSwarmProvider } from './mock-provider.js';

describe('multi-writer feeds', () => {
  test('appends and reads one writer stream', async () => {
    const provider = new MockSwarmProvider();
    const feed = createMultiWriterFeed<{ status: string }>(provider, {
      topic: 'status',
      writerId: 'device-a',
    });
    const owner = await feed.getOwner();

    await feed.append({ status: 'offline' });
    await feed.append({ status: 'online' });

    const entries = await feed.readWriter(owner, { writerId: 'device-a', limit: 5 });

    expect(entries.map(entry => entry.payload.status)).toEqual(['online', 'offline']);
    expect(entries[0]?.previousReference).toBe(entries[1]?.reference);
  });

  test('fans out across owners and merges newest first', async () => {
    const storage = createMockSwarmStorage();
    const alice = new MockSwarmProvider({
      owner: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      storage,
    });
    const bob = new MockSwarmProvider({
      owner: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      storage,
    });
    const aliceFeed = createMultiWriterFeed<{ from: string }>(alice, {
      topic: 'team-status',
      writerId: 'default',
    });
    const bobFeed = createMultiWriterFeed<{ from: string }>(bob, {
      topic: 'team-status',
      writerId: 'default',
    });

    await aliceFeed.append({ from: 'alice' }, { at: new Date('2026-05-23T10:00:00.000Z') });
    await bobFeed.append({ from: 'bob' }, { at: new Date('2026-05-23T11:00:00.000Z') });

    const merged = await aliceFeed.readLatest([
      { owner: alice.owner },
      { owner: bob.owner },
    ]);

    expect(merged.map(entry => entry.payload.from)).toEqual(['bob', 'alice']);
  });

  test('separates writerId streams for the same owner', async () => {
    const provider = new MockSwarmProvider();
    const phone = createMultiWriterFeed<{ device: string }>(provider, {
      topic: 'presence',
      writerId: 'phone',
    });
    const laptop = createMultiWriterFeed<{ device: string }>(provider, {
      topic: 'presence',
      writerId: 'laptop',
    });
    const owner = await phone.getOwner();

    await phone.append({ device: 'phone' }, { at: new Date('2026-05-23T12:00:00.000Z') });
    await laptop.append({ device: 'laptop' }, { at: new Date('2026-05-23T13:00:00.000Z') });

    const merged = await phone.readLatest([
      { owner, writerId: 'phone' },
      { owner, writerId: 'laptop' },
    ]);

    expect(merged.map(entry => entry.payload.device)).toEqual(['laptop', 'phone']);
  });

  test('reads one writer entry by deterministic index', async () => {
    const provider = new MockSwarmProvider();
    const feed = createMultiWriterFeed<{ n: number }>(provider, {
      topic: 'indexed-team-status',
      writerId: 'device-a',
    });
    const owner = await feed.getOwner();

    await feed.append({ n: 1 });
    await feed.append({ n: 2 });

    const second = await feed.readAt(owner, 1, { writerId: 'device-a' });
    const missing = await feed.readAt(owner, 99, { writerId: 'device-a' });

    expect(second?.payload.n).toBe(2);
    expect(missing).toBeNull();
  });

  test('client exposes namespaced multi-writer feed factory', async () => {
    const kit = createSwarmKit(new MockSwarmProvider());
    const feed = kit.multiWriterFeed.create<{ ok: boolean }>({
      topic: 'client-mw',
    });

    const written = await feed.append({ ok: true });
    const entries = await feed.readWriter(written.owner);

    expect(entries[0]?.payload.ok).toBe(true);
  });
});
