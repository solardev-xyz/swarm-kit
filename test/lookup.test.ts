import { describe, expect, test } from 'vitest';
import { createKeyedLookup, createSwarmKit } from '../src/index.js';
import { MockSwarmProvider } from './mock-provider.js';

describe('keyed lookup streams', () => {
  test('writes and reads latest value for one key', async () => {
    const provider = new MockSwarmProvider();
    const lookup = createKeyedLookup<{ status: string }>(provider, { namespace: 'profiles' });

    const first = await lookup.write('alice', { status: 'online' });
    const second = await lookup.write('alice', { status: 'away' });
    const latest = await lookup.readLatest(second.owner, 'alice');

    expect(first.index).toBe(0);
    expect(second.index).toBe(1);
    expect(second.previousReference).toBe(first.reference);
    expect(latest?.value.status).toBe('away');
  });

  test('keeps independent history per key', async () => {
    const provider = new MockSwarmProvider();
    const lookup = createKeyedLookup<{ value: number }>(provider, { namespace: 'settings' });
    const owner = await lookup.getOwner();

    await lookup.write('theme', { value: 1 });
    await lookup.write('theme', { value: 2 });
    await lookup.write('layout', { value: 99 });

    const themeHistory = await lookup.readHistory(owner, 'theme');
    const layoutLatest = await lookup.readLatest(owner, 'layout');
    const missing = await lookup.readLatest(owner, 'unknown');

    expect(themeHistory.map(entry => entry.value.value)).toEqual([2, 1]);
    expect(layoutLatest?.index).toBe(0);
    expect(layoutLatest?.value.value).toBe(99);
    expect(missing).toBeNull();
  });

  test('reads keyed entries by deterministic index', async () => {
    const provider = new MockSwarmProvider();
    const lookup = createKeyedLookup<{ n: number }>(provider, { namespace: 'numbers' });
    const owner = await lookup.getOwner();

    await lookup.write('odd', { n: 1 });
    await lookup.write('odd', { n: 3 });

    const first = await lookup.readAt(owner, 'odd', 0);
    const secondIdentifier = lookup.entryIdentifier('odd', 1);

    expect(first?.value.n).toBe(1);
    expect(secondIdentifier).toBe((await lookup.readAt(owner, 'odd', 1))?.identifier);
  });

  test('client exposes namespaced keyed lookup factory', async () => {
    const kit = createSwarmKit(new MockSwarmProvider());
    const lookup = kit.lookup.create<{ ok: boolean }>({ namespace: 'client-lookup' });

    const written = await lookup.write('ready', { ok: true });
    const latest = await lookup.readLatest(written.owner, 'ready');

    expect(latest?.value.ok).toBe(true);
  });
});
