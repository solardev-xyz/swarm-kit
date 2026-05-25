import { deriveIdentifier } from './identifiers.js';
import { isSwarmReason } from './errors.js';
import { getSigningIdentity, readSocJsonByOwnerAndIdentifier, writeSocJson } from './soc.js';
import type { SwarmKitDriverInput } from './driver.js';
import type { SwarmWriteSingleOwnerChunkResult } from './provider.js';

export type EpochPeriod = 'minute' | 'hour' | 'day' | { seconds: number };

export interface EpochFeedOptions {
  topic: string;
  period: EpochPeriod;
  namespace?: string;
}

export interface EpochFeedEnvelope<T> {
  version: 1;
  topic: string;
  periodMs: number;
  epochStartMs: number;
  writtenAt: string;
  value: T;
}

export interface EpochFeedWriteResult<T> extends SwarmWriteSingleOwnerChunkResult {
  epochStartMs: number;
  envelope: EpochFeedEnvelope<T>;
}

export interface EpochFeedReadResult<T> {
  owner: string;
  identifier: string;
  epochStartMs: number;
  value: T;
  envelope: EpochFeedEnvelope<T>;
}

export interface EpochFeed<T = unknown> {
  readonly topic: string;
  readonly periodMs: number;
  identifierFor(date: Date | number): string;
  epochStartFor(date: Date | number): number;
  getOwner(): Promise<string>;
  write(value: T, options?: { at?: Date | number }): Promise<EpochFeedWriteResult<T>>;
  readAt(owner: string, date: Date | number): Promise<EpochFeedReadResult<T> | null>;
  readCurrent(owner: string): Promise<EpochFeedReadResult<T> | null>;
  readLatest(owner: string, options?: { from?: Date | number; lookback?: number }): Promise<EpochFeedReadResult<T> | null>;
}

const DEFAULT_NAMESPACE = 'swarm-kit:epoch-feed:v1';

export function createEpochFeed<T = unknown>(
  provider: SwarmKitDriverInput,
  options: EpochFeedOptions,
): EpochFeed<T> {
  const periodMs = periodToMs(options.period);
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;

  function epochStartFor(date: Date | number): number {
    const time = typeof date === 'number' ? date : date.getTime();
    return Math.floor(time / periodMs) * periodMs;
  }

  function identifierFor(date: Date | number): string {
    return deriveIdentifier([
      namespace,
      options.topic,
      periodMs,
      epochStartFor(date),
    ]);
  }

  async function readAt(owner: string, date: Date | number): Promise<EpochFeedReadResult<T> | null> {
    const epochStartMs = epochStartFor(date);
    const identifier = identifierFor(epochStartMs);
    try {
      const envelope = await readSocJsonByOwnerAndIdentifier<EpochFeedEnvelope<T>>(provider, owner, identifier);
      return {
        owner,
        identifier,
        epochStartMs,
        value: envelope.value,
        envelope,
      };
    } catch (error) {
      if (isSwarmReason(error, 'chunk_not_found')) return null;
      throw error;
    }
  }

  return {
    topic: options.topic,
    periodMs,
    identifierFor,
    epochStartFor,
    async getOwner() {
      return (await getSigningIdentity(provider)).owner;
    },
    async write(value, writeOptions = {}) {
      const at = writeOptions.at ?? Date.now();
      const epochStartMs = epochStartFor(at);
      const identifier = identifierFor(epochStartMs);
      const envelope: EpochFeedEnvelope<T> = {
        version: 1,
        topic: options.topic,
        periodMs,
        epochStartMs,
        writtenAt: new Date().toISOString(),
        value,
      };
      const result = await writeSocJson(provider, identifier, envelope);
      return {
        ...result,
        epochStartMs,
        envelope,
      };
    },
    readAt,
    readCurrent(owner) {
      return readAt(owner, Date.now());
    },
    async readLatest(owner, readOptions = {}) {
      const lookback = readOptions.lookback ?? 24;
      const from = readOptions.from ?? Date.now();
      const start = epochStartFor(from);
      for (let i = 0; i < lookback; i++) {
        const result = await readAt(owner, start - i * periodMs);
        if (result) return result;
      }
      return null;
    },
  };
}

function periodToMs(period: EpochPeriod): number {
  if (period === 'minute') return 60_000;
  if (period === 'hour') return 3_600_000;
  if (period === 'day') return 86_400_000;
  if (!Number.isSafeInteger(period.seconds) || period.seconds <= 0) {
    throw new Error('Custom epoch period must be a positive integer number of seconds');
  }
  return period.seconds * 1000;
}
