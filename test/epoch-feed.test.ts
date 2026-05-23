import { describe, expect, test } from 'vitest';
import { createEpochFeed } from '../src/index.js';
import { MockSwarmProvider } from './mock-provider.js';

describe('epoch feeds', () => {
  test('uses stable identifiers within an epoch', () => {
    const feed = createEpochFeed(new MockSwarmProvider(), {
      topic: 'status',
      period: 'hour',
    });

    const first = feed.identifierFor(new Date('2026-05-23T15:01:00.000Z'));
    const second = feed.identifierFor(new Date('2026-05-23T15:59:00.000Z'));
    const next = feed.identifierFor(new Date('2026-05-23T16:00:00.000Z'));

    expect(first).toBe(second);
    expect(first).not.toBe(next);
  });

  test('writes and reads an epoch entry', async () => {
    const provider = new MockSwarmProvider();
    const feed = createEpochFeed<{ status: string }>(provider, {
      topic: 'status',
      period: 'hour',
    });
    const at = new Date('2026-05-23T15:18:00.000Z');

    const written = await feed.write({ status: 'online' }, { at });
    const read = await feed.readAt(written.owner, new Date('2026-05-23T15:45:00.000Z'));

    expect(read?.value).toEqual({ status: 'online' });
    expect(read?.identifier).toBe(written.identifier);
    expect(read?.epochStartMs).toBe(Date.parse('2026-05-23T15:00:00.000Z'));
  });

  test('returns null for missing epochs', async () => {
    const feed = createEpochFeed(new MockSwarmProvider(), {
      topic: 'status',
      period: 'hour',
    });

    await expect(feed.readAt('0x1111111111111111111111111111111111111111', Date.now()))
      .resolves.toBeNull();
  });

  test('walks backwards to find the latest epoch entry', async () => {
    const provider = new MockSwarmProvider();
    const feed = createEpochFeed<{ status: string }>(provider, {
      topic: 'status',
      period: 'hour',
    });
    const owner = await feed.getOwner();

    await feed.write({ status: 'offline' }, { at: new Date('2026-05-23T13:00:00.000Z') });
    await feed.write({ status: 'online' }, { at: new Date('2026-05-23T15:00:00.000Z') });

    const latest = await feed.readLatest(owner, {
      from: new Date('2026-05-23T16:30:00.000Z'),
      lookback: 5,
    });

    expect(latest?.value).toEqual({ status: 'online' });
  });
});
