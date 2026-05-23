import { afterEach, describe, expect, test } from 'vitest';
import { detectWindowSwarm, waitForSwarm, type SwarmProvider } from '../src/index.js';
import { MockSwarmProvider } from './mock-provider.js';

const globalWithSwarm = globalThis as typeof globalThis & { swarm?: SwarmProvider };

describe('provider discovery', () => {
  afterEach(() => {
    delete globalWithSwarm.swarm;
  });

  test('detects an existing global swarm provider', () => {
    const provider = new MockSwarmProvider();
    globalWithSwarm.swarm = provider;

    expect(detectWindowSwarm()).toBe(provider);
  });

  test('can require the Freedom Browser marker', () => {
    globalWithSwarm.swarm = {};

    expect(detectWindowSwarm({ requireFreedomBrowser: true })).toBeNull();

    globalWithSwarm.swarm.isFreedomBrowser = true;

    expect(detectWindowSwarm({ requireFreedomBrowser: true })).toBe(globalWithSwarm.swarm);
  });

  test('waits for delayed provider injection', async () => {
    const provider = new MockSwarmProvider();
    setTimeout(() => {
      globalWithSwarm.swarm = provider;
    }, 5);

    await expect(waitForSwarm({ timeoutMs: 100, pollIntervalMs: 1 })).resolves.toBe(provider);
  });

  test('rejects when no provider appears before timeout', async () => {
    await expect(waitForSwarm({ timeoutMs: 1, pollIntervalMs: 1 })).rejects.toThrow('window.swarm');
  });
});
