import { describe, expect, test } from 'vitest';
import { createIndexedSocStream } from '../src/index.js';
import { MockSwarmProvider } from './mock-provider.js';

interface TestEnvelope {
  version: 1;
  type: 'test-entry';
  index: number;
  previousReference: string | null;
  value: string;
}

describe('indexed SOC streams', () => {
  test('appends write-once indexed SOC entries and discovers latest', async () => {
    const provider = new MockSwarmProvider();
    const stream = createIndexedSocStream<TestEnvelope>(provider, {
      namespace: 'test:indexed-stream',
      parts: ['activity'],
      parseEnvelope: (value, context) => {
        if (
          value.version !== 1 ||
          value.type !== 'test-entry' ||
          value.index !== context.index ||
          !(typeof value.previousReference === 'string' || value.previousReference === null) ||
          typeof value.value !== 'string'
        ) {
          throw new Error('Invalid test entry');
        }
        return value;
      },
    });

    const first = await stream.append(({ index, previousReference }) => ({
      version: 1,
      type: 'test-entry',
      index,
      previousReference,
      value: 'first',
    }));
    const second = await stream.append(({ index, previousReference }) => ({
      version: 1,
      type: 'test-entry',
      index,
      previousReference,
      value: 'second',
    }));

    const latestIndex = await stream.findLatestIndex(second.owner);
    const latest = await stream.readLatest(second.owner);
    const missing = await stream.readAt(second.owner, 99);

    expect(first.envelope.index).toBe(0);
    expect(second.envelope.index).toBe(1);
    expect(second.envelope.previousReference).toBe(first.reference);
    expect(latestIndex).toBe(1);
    expect(latest.map(entry => entry.envelope.value)).toEqual(['second', 'first']);
    expect(missing).toBeNull();
  });
});
