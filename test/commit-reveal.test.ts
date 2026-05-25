import { describe, expect, test } from 'vitest';
import {
  commitRevealCommitment,
  createCommitReveal,
  createSwarmKit,
  type CommitRevealReveal,
} from '../src/index.js';
import { createMockSwarmStorage, MockSwarmProvider } from './mock-provider.js';

const SALT_A = '11'.repeat(32);
const SALT_B = '22'.repeat(32);

describe('commit-reveal', () => {
  test('commits, reveals, reads, and verifies a value', async () => {
    const provider = new MockSwarmProvider();
    const protocol = createCommitReveal<{ bid: number }>(provider, {
      namespace: 'auctions',
      topic: 'auction-7',
      round: 'bid',
    });

    const commit = await protocol.commit({ bid: 42 }, { salt: SALT_A, at: 0 });
    const reveal = await protocol.reveal({ bid: 42 }, SALT_A, { at: 1_000 });
    const pair = await protocol.readPair(commit.owner);

    expect(commit.commitment).toBe(reveal.commitment);
    expect(commit.salt).toBe(SALT_A);
    expect(reveal.value.bid).toBe(42);
    expect(protocol.verify(commit, reveal)).toBe(true);
    expect(pair.commit?.reference).toBe(commit.reference);
    expect(pair.reveal?.reference).toBe(reveal.reference);
    expect(pair.verified).toBe(true);
  });

  test('returns null for missing commit and reveal', async () => {
    const provider = new MockSwarmProvider();
    const protocol = createCommitReveal(provider, { topic: 'missing', round: 'round-1' });
    const owner = await protocol.getOwner();

    expect(await protocol.readCommit(owner)).toBeNull();
    expect(await protocol.readReveal(owner)).toBeNull();
    expect(await protocol.readPair(owner)).toEqual({
      commit: null,
      reveal: null,
      verified: null,
    });
  });

  test('binds commitments to the owner address', () => {
    const value = { vote: 'yes' };
    const first = commitRevealCommitment({
      topic: 'poll',
      round: '1',
      owner: '0x1111111111111111111111111111111111111111',
      value,
      salt: SALT_A,
    });
    const second = commitRevealCommitment({
      topic: 'poll',
      round: '1',
      owner: '0x2222222222222222222222222222222222222222',
      value,
      salt: SALT_A,
    });

    expect(first).not.toBe(second);
  });

  test('rejects reveal values that do not match the commit', async () => {
    const provider = new MockSwarmProvider();
    const protocol = createCommitReveal<{ vote: string }>(provider, { topic: 'poll', round: '1' });

    await protocol.commit({ vote: 'yes' }, { salt: SALT_A });

    await expect(protocol.reveal({ vote: 'no' }, SALT_A)).rejects.toMatchObject({
      reason: 'commitment_mismatch',
    });
  });

  test('rejects revealing before committing', async () => {
    const provider = new MockSwarmProvider();
    const protocol = createCommitReveal<{ vote: string }>(provider, { topic: 'poll', round: '2' });

    await expect(protocol.reveal({ vote: 'yes' }, SALT_A)).rejects.toMatchObject({
      reason: 'commit_not_found',
    });
  });

  test('detects commit write collisions', async () => {
    const provider = new MockSwarmProvider();
    const protocol = createCommitReveal<{ vote: string }>(provider, { topic: 'poll', round: '3' });

    await protocol.commit({ vote: 'yes' }, { salt: SALT_A, at: 0 });

    await expect(protocol.commit({ vote: 'no' }, { salt: SALT_B, at: 0 })).rejects.toMatchObject({
      reason: 'soc_write_collision',
    });
  });

  test('detects reveal write collisions', async () => {
    const provider = new MockSwarmProvider();
    const protocol = createCommitReveal<{ vote: string }>(provider, { topic: 'poll', round: '4' });

    await protocol.commit({ vote: 'yes' }, { salt: SALT_A, at: 0 });
    await protocol.reveal({ vote: 'yes' }, SALT_A, { at: 1_000 });

    await expect(protocol.reveal({ vote: 'yes' }, SALT_A, { at: 2_000 })).rejects.toMatchObject({
      reason: 'soc_write_collision',
    });
  });

  test('client exposes commit-reveal factory and salt helper', async () => {
    const kit = createSwarmKit(new MockSwarmProvider());
    const protocol = kit.commitReveal.create<{ ok: boolean }>({ topic: 'client', round: 'smoke' });
    const salt = kit.commitReveal.generateSalt();

    const commit = await protocol.commit({ ok: true }, { salt });
    const reveal = await protocol.reveal({ ok: true }, salt);

    expect(salt).toHaveLength(64);
    expect(protocol.verify(commit, reveal)).toBe(true);
  });

  test('keeps the same coordinates independent for different owners', async () => {
    const storage = createMockSwarmStorage();
    const alice = new MockSwarmProvider({
      owner: '0x1111111111111111111111111111111111111111',
      storage,
    });
    const bob = new MockSwarmProvider({
      owner: '0x2222222222222222222222222222222222222222',
      storage,
    });
    const aliceProtocol = createCommitReveal<{ move: string }>(alice, { topic: 'game', round: '1' });
    const bobProtocol = createCommitReveal<{ move: string }>(bob, { topic: 'game', round: '1' });

    const aliceCommit = await aliceProtocol.commit({ move: 'rock' }, { salt: SALT_A });
    const bobCommit = await bobProtocol.commit({ move: 'rock' }, { salt: SALT_A });
    const bobReveal = await bobProtocol.reveal({ move: 'rock' }, SALT_A);

    expect(aliceCommit.identifier).toBe(bobCommit.identifier);
    expect(aliceCommit.reference).not.toBe(bobCommit.reference);
    expect(bobProtocol.verify(bobCommit, bobReveal)).toBe(true);
    expect(aliceProtocol.verify(aliceCommit, bobReveal as CommitRevealReveal<{ move: string }>)).toBe(false);
  });
});
