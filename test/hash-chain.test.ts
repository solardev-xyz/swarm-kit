import { describe, expect, test } from 'vitest';
import { createHashChain, createSwarmKit } from '../src/index.js';
import { MockSwarmProvider } from './mock-provider.js';

describe('hash chains', () => {
  test('appends entries and discovers the latest entry without a mutable head SOC', async () => {
    const provider = new MockSwarmProvider();
    const chain = createHashChain<{ action: string }>(provider, { topic: 'audit-log' });

    const first = await chain.append({ action: 'created' });
    const second = await chain.append({ action: 'updated' });
    const head = await chain.readHead(second.owner);

    expect(first.index).toBe(0);
    expect(second.index).toBe(1);
    expect(second.previousReference).toBe(first.reference);
    expect(head?.payload.action).toBe('updated');
  });

  test('reads the latest entries newest first', async () => {
    const provider = new MockSwarmProvider();
    const chain = createHashChain<{ n: number }>(provider, { topic: 'numbers' });
    const owner = await chain.getOwner();

    await chain.append({ n: 1 });
    await chain.append({ n: 2 });
    await chain.append({ n: 3 });

    const latest = await chain.readLatest(owner, { limit: 2 });

    expect(latest.map(entry => entry.payload.n)).toEqual([3, 2]);
    expect(latest[0]?.previousReference).toBe(latest[1]?.reference);
  });

  test('reads entries by deterministic index', async () => {
    const provider = new MockSwarmProvider();
    const chain = createHashChain<{ n: number }>(provider, { topic: 'indexed' });
    const owner = await chain.getOwner();

    await chain.append({ n: 1 });
    await chain.append({ n: 2 });

    const first = await chain.readAt(owner, 0);
    const missing = await chain.readAt(owner, 99);

    expect(first?.payload.n).toBe(1);
    expect(missing).toBeNull();
  });

  test('supports payloads larger than one chunk', async () => {
    const provider = new MockSwarmProvider();
    const chain = createHashChain<{ entries: string[] }>(provider, { topic: 'large-events' });
    const owner = await chain.getOwner();

    await chain.append({
      entries: Array.from({ length: 800 }, (_, index) => `entry-${index}`),
    });

    const [latest] = await chain.readLatest(owner, { limit: 1 });

    expect(latest?.payload.entries).toHaveLength(800);
  });

  test('client exposes namespaced hash chain factory', async () => {
    const kit = createSwarmKit(new MockSwarmProvider());
    const chain = kit.hashChain.create<{ ok: boolean }>({ topic: 'client-chain' });

    const written = await chain.append({ ok: true });
    const latest = await chain.readLatest(written.owner);

    expect(latest[0]?.payload.ok).toBe(true);
  });
});
