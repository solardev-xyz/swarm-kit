import { describe, expect, test } from 'vitest';
import { runSwarmProviderCompliance } from '../src/index.js';
import type { SwarmReadSingleOwnerChunkResult } from '../src/provider.js';
import { MockSwarmProvider } from './mock-provider.js';

describe('provider compliance runner', () => {
  test('passes the core contract against the mock provider', async () => {
    const report = await runSwarmProviderCompliance(new MockSwarmProvider(), {
      includeTypeMismatchTests: false,
      includeUnsupportedOptionsTest: false,
      runId: 'mock-pass',
    });

    expect(report.summary.failed).toBe(0);
    expect(report.summary.passed).toBeGreaterThan(0);
    expect(report.results.find(result => result.id === 'missing-soc-owner-identifier-error')?.status).toBe('pass');
  });

  test('surfaces missing SOC provider errors that are not normalized', async () => {
    const report = await runSwarmProviderCompliance(new BadMissingSocProvider(), {
      includeTypeMismatchTests: false,
      includeUnsupportedOptionsTest: false,
      runId: 'mock-bad-missing-soc',
    });
    const missingSoc = report.results.find(result => result.id === 'missing-soc-owner-identifier-error');

    expect(missingSoc?.status).toBe('fail');
    expect(missingSoc?.error?.message).toContain('Expected provider reason "chunk_not_found"');
  });
});

class BadMissingSocProvider extends MockSwarmProvider {
  async readSingleOwnerChunk(
    params: { address: string } | { owner: string; identifier: string },
  ): Promise<SwarmReadSingleOwnerChunkResult> {
    try {
      return await super.readSingleOwnerChunk(params);
    } catch {
      const error = new Error('Request failed with status code 500') as Error & { code: number };
      error.code = -32603;
      throw error;
    }
  }
}
