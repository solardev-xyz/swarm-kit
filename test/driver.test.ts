import { describe, expect, test } from 'vitest';
import { bytesToBase64 } from '../src/bytes.js';
import { createSwarmKit, createWindowSwarmDriver, type SwarmKitDriver } from '../src/index.js';
import { MockSwarmProvider } from './mock-provider.js';

describe('swarm kit drivers', () => {
  test('wraps a window.swarm provider as a byte-oriented driver', async () => {
    const provider = new MockSwarmProvider();
    const driver = createWindowSwarmDriver(provider);

    const published = await driver.publishChunk({ data: new Uint8Array([1, 2, 3]) });
    const read = await driver.readChunk({ reference: published.reference });

    expect(read.data).toEqual(new Uint8Array([1, 2, 3]));
    await expect(driver.getSigningIdentity?.()).resolves.toMatchObject({
      owner: provider.owner,
    });
  });

  test('createSwarmKit accepts a direct driver without provider base64 serialization', async () => {
    const chunks = new Map<string, Uint8Array>();
    const driver: SwarmKitDriver = {
      isSwarmKitDriver: true,
      async publishChunk({ data }) {
        const reference = bytesToBase64(data);
        chunks.set(reference, data);
        return { reference };
      },
      async readChunk({ reference }) {
        const data = chunks.get(reference);
        if (!data) throw new Error('missing');
        return { data, span: data.length };
      },
      async writeSingleOwnerChunk({ identifier }) {
        return {
          reference: `soc:${identifier}`,
          owner: '0x3333333333333333333333333333333333333333',
          identifier,
        };
      },
      async readSingleOwnerChunk() {
        throw new Error('not implemented');
      },
      async getSigningIdentity() {
        return {
          owner: '0x3333333333333333333333333333333333333333',
          identityMode: 'test-driver',
        };
      },
    };

    const kit = createSwarmKit(driver);
    const published = await kit.chunks.publishText('driver bytes');

    await expect(kit.chunks.readText(published.reference)).resolves.toBe('driver bytes');
    await expect(kit.soc.getSigningIdentity()).resolves.toMatchObject({
      identityMode: 'test-driver',
    });
  });
});
