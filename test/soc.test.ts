import { describe, expect, test } from 'vitest';
import {
  createSwarmKit,
  deriveIdentifier,
  getSigningIdentity,
  readSocJsonByAddress,
  readSocJsonByOwnerAndIdentifier,
  readSocTextByAddress,
  writeSocJson,
  writeSocText,
} from '../src/index.js';
import { MockSwarmProvider } from './mock-provider.js';

describe('SOC helpers', () => {
  test('gets the provider signing identity', async () => {
    const provider = new MockSwarmProvider({ owner: '0x2222222222222222222222222222222222222222' });

    await expect(getSigningIdentity(provider)).resolves.toMatchObject({
      owner: '0x2222222222222222222222222222222222222222',
      identityMode: 'app-scoped',
    });
  });

  test('writes and reads SOC text by address', async () => {
    const provider = new MockSwarmProvider();
    const identifier = deriveIdentifier(['note', 1]);

    const written = await writeSocText(provider, identifier, 'hello soc');
    const text = await readSocTextByAddress(provider, written.reference);

    expect(text).toBe('hello soc');
  });

  test('writes and reads SOC JSON by owner and identifier', async () => {
    const provider = new MockSwarmProvider();
    const identifier = deriveIdentifier(['profile']);

    const written = await writeSocJson(provider, identifier, { name: 'Bee' });
    const value = await readSocJsonByOwnerAndIdentifier<{ name: string }>(provider, written.owner, identifier);

    expect(value).toEqual({ name: 'Bee' });
  });

  test('reads SOC JSON by address', async () => {
    const provider = new MockSwarmProvider();
    const identifier = deriveIdentifier(['settings']);

    const written = await writeSocJson(provider, identifier, { theme: 'dark' });
    const value = await readSocJsonByAddress<{ theme: string }>(provider, written.reference);

    expect(value.theme).toBe('dark');
  });

  test('mock provider keeps the first write for a repeated SOC identifier', async () => {
    const provider = new MockSwarmProvider();
    const identifier = deriveIdentifier(['write-once']);

    const first = await writeSocJson(provider, identifier, { version: 1 });
    const second = await writeSocJson(provider, identifier, { version: 2 });
    const value = await readSocJsonByAddress<{ version: number }>(provider, second.reference);

    expect(second.reference).toBe(first.reference);
    expect(value.version).toBe(1);
  });

  test('client exposes namespaced SOC helpers', async () => {
    const kit = createSwarmKit(new MockSwarmProvider());
    const identifier = deriveIdentifier(['namespaced']);

    const written = await kit.soc.writeText(identifier, 'hello namespace');

    await expect(kit.soc.readTextByAddress(written.reference)).resolves.toBe('hello namespace');
  });
});
