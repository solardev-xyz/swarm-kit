import { describe, expect, test } from 'vitest';
import { createSwarmKit, publishJson, publishText, readJson, readText } from '../src/index.js';
import { MockSwarmProvider } from './mock-provider.js';

describe('chunk helpers', () => {
  test('publishes and reads text chunks', async () => {
    const provider = new MockSwarmProvider();

    const published = await publishText(provider, 'hello swarm');
    const text = await readText(provider, published.reference);

    expect(text).toBe('hello swarm');
  });

  test('publishes and reads JSON chunks', async () => {
    const provider = new MockSwarmProvider();

    const published = await publishJson(provider, { ok: true, count: 2 });
    const value = await readJson<{ ok: boolean; count: number }>(provider, published.reference);

    expect(value).toEqual({ ok: true, count: 2 });
  });

  test('client factory binds helpers to a provider', async () => {
    const kit = createSwarmKit(new MockSwarmProvider());

    const published = await kit.chunks.publishText('bound provider');
    await expect(kit.chunks.readText(published.reference)).resolves.toBe('bound provider');

    const aliasPublished = await kit.publishText('flat aliases still work');
    await expect(kit.readText(aliasPublished.reference)).resolves.toBe('flat aliases still work');
  });
});
