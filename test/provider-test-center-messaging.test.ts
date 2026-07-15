import { describe, expect, it } from 'vitest';
import { runSwarmProviderTestCenter } from '../src/provider-test-center.js';
import { MockSwarmProvider } from './mock-provider.js';

describe('provider test center messaging suite', () => {
  // The gsoc round-trip case includes a deliberate 5s "no delivery after
  // unsubscribe" observation window.
  it('passes against the messaging-capable mock provider', { timeout: 20_000 }, async () => {
    const provider = new MockSwarmProvider();
    const report = await runSwarmProviderTestCenter(provider, { suites: ['messaging'] });

    const byId = new Map(report.results.map((result) => [result.id, result]));
    const failed = report.results.filter((result) => result.status === 'fail');
    expect(failed, JSON.stringify(failed, null, 2)).toHaveLength(0);

    for (const id of [
      'messaging-feature-detection',
      'messaging-identity-shape',
      'messaging-subscribe-param-validation',
      'messaging-sendpss-param-validation',
      'messaging-sendgsoc-raw-address-rejected',
      'messaging-empty-payload-bounds',
      'messaging-payload-too-large',
      'messaging-subscription-lifecycle',
      'messaging-per-origin-cap',
      'messaging-gsoc-roundtrip',
      'messaging-pss-roundtrip',
    ]) {
      expect(byId.get(id)?.status, id).toBe('pass');
    }

    // The mock has no node-wide pipeline pool, so the capacity probe
    // reports its bounded no-refusal outcome as a warning.
    expect(byId.get('messaging-node-capacity-distinction')?.status).toBe('warn');
  });

  it('warn-skips the suite when the provider does not advertise messaging', async () => {
    const provider = new MockSwarmProvider();
    const withoutMessaging = Object.create(provider) as MockSwarmProvider;
    withoutMessaging.getCapabilities = async () => ({
      specVersion: '1.0',
      canPublish: true,
      reason: null,
      limits: { maxChunkPayloadBytes: 4096 },
    });

    const report = await runSwarmProviderTestCenter(withoutMessaging, { suites: ['messaging'] });
    // Detection warns (a visible heads-up); the gated cases skip.
    expect(report.results[0]).toMatchObject({ id: 'messaging-feature-detection', status: 'warn' });
    expect(report.results.slice(1).every((result) => result.status === 'skip')).toBe(true);
    expect(report.summary.failed).toBe(0);
  });
});
