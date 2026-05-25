import { describe, expect, test } from 'vitest';
import { createOwnerRecords, createSwarmKit, isSwarmReason } from '../src/index.js';
import { MockSwarmProvider } from './mock-provider.js';

describe('owner records', () => {
  test('writes and reads revisioned owner records', async () => {
    const provider = new MockSwarmProvider({ owner: '0xAa00000000000000000000000000000000000000' });
    const records = createOwnerRecords<{ status: string }>(provider, { namespace: 'com.example.profile' });

    const first = await records.write('profile', { status: 'online' }, {
      expectedOwner: provider.owner.toLowerCase(),
      at: new Date('2026-05-25T10:00:00.000Z'),
    });
    const second = await records.write('profile', { status: 'away' }, {
      expectedOwner: provider.owner,
      at: new Date('2026-05-25T11:00:00.000Z'),
    });

    expect(first.revision).toBe(0);
    expect(second.revision).toBe(1);
    expect(second.previousReference).toBe(first.reference);
    expect(records.revisionIdentifier('profile', 1)).toBe(second.identifier);

    await expect(records.readLatest(provider.owner, 'profile')).resolves.toMatchObject({
      owner: provider.owner,
      revision: 1,
      value: { status: 'away' },
    });
    await expect(records.readAt(provider.owner, 'profile', 0)).resolves.toMatchObject({
      revision: 0,
      value: { status: 'online' },
    });
    await expect(records.readHistory(provider.owner, 'profile')).resolves.toMatchObject([
      { revision: 1, value: { status: 'away' } },
      { revision: 0, value: { status: 'online' } },
    ]);
  });

  test('returns null for missing owner records', async () => {
    const provider = new MockSwarmProvider();
    const records = createOwnerRecords(provider, { namespace: 'com.example.missing' });

    await expect(records.readLatest(provider.owner, 'profile')).resolves.toBeNull();
    await expect(records.readAt(provider.owner, 'profile', 0)).resolves.toBeNull();
  });

  test('checks the expected owner before writing', async () => {
    const provider = new MockSwarmProvider({ owner: '0x1111111111111111111111111111111111111111' });
    const records = createOwnerRecords(provider, { namespace: 'com.example.wallet-root' });

    await expect(records.write('profile', { ok: true }, {
      expectedOwner: '0x2222222222222222222222222222222222222222',
    })).rejects.toSatisfy(error => isSwarmReason(error, 'owner_mismatch'));

    await expect(records.readLatest(provider.owner, 'profile')).resolves.toBeNull();
  });

  test('client exposes owner record factory', async () => {
    const kit = createSwarmKit(new MockSwarmProvider());
    const records = kit.records.create<{ ok: boolean }>({ namespace: 'client-records' });

    const written = await records.write('ready', { ok: true });

    await expect(records.readLatest(written.owner, 'ready')).resolves.toMatchObject({
      revision: 0,
      value: { ok: true },
    });
  });
});
