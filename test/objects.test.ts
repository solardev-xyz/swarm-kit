import { describe, expect, test } from 'vitest';
import { createSwarmKit, publishObjectBytes, publishObjectJson, readObjectBytes, readObjectJson } from '../src/index.js';
import { MockSwarmProvider } from './mock-provider.js';

describe('object graph helpers', () => {
  test('publishes and reads bytes spanning multiple chunks', async () => {
    const provider = new MockSwarmProvider();
    const bytes = new Uint8Array(10_000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;

    const published = await publishObjectBytes(provider, bytes);
    const read = await readObjectBytes(provider, published.reference);

    expect(published.size).toBe(bytes.length);
    expect(published.chunkCount).toBeGreaterThan(1);
    expect(read).toEqual(bytes);
  });

  test('builds recursive graph nodes for many chunks', async () => {
    const provider = new MockSwarmProvider();
    const bytes = new Uint8Array(140_000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 17) % 256;

    const published = await publishObjectBytes(provider, bytes);
    const read = await readObjectBytes(provider, published.reference);

    expect(published.chunkCount).toBeGreaterThan(32);
    expect(published.nodeCount).toBeGreaterThan(1);
    expect(read).toEqual(bytes);
  });

  test('publishes and reads large JSON objects', async () => {
    const provider = new MockSwarmProvider();
    const value = {
      title: 'large object',
      entries: Array.from({ length: 500 }, (_, index) => ({
        index,
        value: `entry-${index}`,
      })),
    };

    const published = await publishObjectJson(provider, value);
    const read = await readObjectJson<typeof value>(provider, published.reference);

    expect(read).toEqual(value);
  });

  test('client exposes namespaced object helpers', async () => {
    const kit = createSwarmKit(new MockSwarmProvider());

    const published = await kit.objects.publishJson({ hello: 'objects' });

    await expect(kit.objects.readJson(published.reference)).resolves.toEqual({ hello: 'objects' });
  });
});
