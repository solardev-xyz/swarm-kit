import { base64ToBytes, bytesToUtf8, utf8ToBytes } from './bytes.js';
import { createSwarmKit } from './client.js';
import { getSwarmErrorReason } from './errors.js';
import { deriveIdentifier } from './identifiers.js';
import { createIndexedSocStream, type IndexedSocStreamEntry } from './indexed-soc.js';
import {
  callSwarm,
  type SwarmCapabilities,
  type SwarmCreateFeedResult,
  type SwarmFeedRecord,
  type SwarmPublishDataResult,
  type SwarmProvider,
  type SwarmProviderErrorLike,
  type SwarmReadFeedEntryResult,
  type SwarmSigningIdentity,
  type SwarmUpdateFeedResult,
  type SwarmWriteFeedEntryResult,
} from './provider.js';

export type ProviderTestCenterSuiteId =
  | 'bootstrap'
  | 'cac'
  | 'soc'
  | 'feed'
  | 'indexed-soc'
  | 'primitives'
  | 'diagnostics'
  | 'stress';

export type ProviderTestCenterStatus = 'pass' | 'fail' | 'skip' | 'warn';

export interface ProviderTestCenterOptions {
  runId?: string;
  requestAccess?: boolean;
  suites?: readonly ProviderTestCenterSuiteId[];
  stress?: {
    socWrites?: number;
    feedWrites?: number;
  };
}

export interface ProviderTestCenterResult {
  id: string;
  suite: ProviderTestCenterSuiteId;
  label: string;
  status: ProviderTestCenterStatus;
  durationMs: number;
  details?: unknown;
  error?: SerializedProviderTestError;
}

export interface ProviderTestCenterSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  warned: number;
}

export interface ProviderTestCenterReport {
  runId: string;
  startedAt: string;
  finishedAt: string;
  selectedSuites: ProviderTestCenterSuiteId[];
  summary: ProviderTestCenterSummary;
  results: ProviderTestCenterResult[];
}

export interface SerializedProviderTestError {
  name?: string;
  message: string;
  code?: number;
  reason?: string;
  data?: unknown;
  details?: unknown;
}

interface ProviderTestCenterContext {
  provider: SwarmProvider;
  kit: ReturnType<typeof createSwarmKit>;
  runId: string;
  capabilities?: SwarmCapabilities;
  identity?: SwarmSigningIdentity;
  cac?: {
    reference: string;
    text: string;
  };
  soc?: {
    reference: string;
    owner: string;
    identifier: string;
    text: string;
  };
  feed?: {
    name: string;
    owner: string;
    topic: string;
    writes: Array<{
      index: number;
      text: string;
    }>;
  };
}

interface ProviderTestCase {
  id: string;
  suite: ProviderTestCenterSuiteId;
  label: string;
  enabled?: boolean;
  skipReason?: string;
  run: (context: ProviderTestCenterContext) => Promise<unknown | WarningDetails>;
}

interface NormalizedProviderTestCenterOptions {
  requestAccess: boolean;
  stress: {
    socWrites: number;
    feedWrites: number;
  };
}

interface WarningDetails {
  warning: true;
  details: unknown;
}

interface DiagnosticStep<T = unknown> {
  name: string;
  status: 'pass' | 'fail';
  durationMs: number;
  value?: T;
  error?: SerializedProviderTestError;
}

interface TestEnvelope {
  version: 1;
  type: 'swarm-kit:test-center:indexed-soc-entry';
  index: number;
  previousReference: string | null;
  value: string;
}

interface SwarmitUserFeedEntryFixture {
  protocol: 'freedom-board/user-feed-entry/v1';
  submissionRef: string;
  boardSlug: string;
  kind: 'post' | 'reply';
  createdAt: number;
}

interface FeedManifestFixture {
  protocol: 'swarm-kit:test-center:feed-manifest/v1';
  runId: string;
  label: string;
  updatedAt: string;
  entries: Array<{
    submissionRef: string;
    createdAt: number;
  }>;
}

const DEFAULT_SUITES: ProviderTestCenterSuiteId[] = [
  'bootstrap',
  'cac',
  'soc',
  'feed',
  'indexed-soc',
  'primitives',
  'diagnostics',
];

const DEFAULT_OPTIONS = {
  requestAccess: true,
  stress: {
    socWrites: 5,
    feedWrites: 5,
  },
};

export async function runSwarmProviderTestCenter(
  provider: SwarmProvider,
  options: ProviderTestCenterOptions = {},
): Promise<ProviderTestCenterReport> {
  const runId = options.runId ?? createRunId();
  const selectedSuites = Array.from(new Set(options.suites ?? DEFAULT_SUITES));
  const effective: NormalizedProviderTestCenterOptions = {
    requestAccess: options.requestAccess ?? DEFAULT_OPTIONS.requestAccess,
    stress: {
      socWrites: options.stress?.socWrites ?? DEFAULT_OPTIONS.stress.socWrites,
      feedWrites: options.stress?.feedWrites ?? DEFAULT_OPTIONS.stress.feedWrites,
    },
  };
  const startedAt = new Date().toISOString();
  const context: ProviderTestCenterContext = {
    provider,
    kit: createSwarmKit(provider),
    runId,
  };
  const results: ProviderTestCenterResult[] = [];

  for (const testCase of createTestCases(effective)) {
    if (!selectedSuites.includes(testCase.suite)) continue;
    results.push(await runTestCase(testCase, context));
  }

  const finishedAt = new Date().toISOString();
  return {
    runId,
    startedAt,
    finishedAt,
    selectedSuites,
    summary: summarizeResults(results),
    results,
  };
}

function createTestCases(options: NormalizedProviderTestCenterOptions): ProviderTestCase[] {
  return [
    {
      id: 'bootstrap-request-access',
      suite: 'bootstrap',
      label: 'requestAccess resolves',
      enabled: options.requestAccess,
      skipReason: 'disabled by options',
      run: async context => summarizeValue(await callSwarm(context.provider, 'swarm_requestAccess')),
    },
    {
      id: 'bootstrap-capabilities',
      suite: 'bootstrap',
      label: 'getCapabilities exposes limits',
      run: async context => {
        const capabilities = await callSwarm<SwarmCapabilities>(context.provider, 'swarm_getCapabilities');
        assertCondition(typeof capabilities.canPublish === 'boolean', 'capabilities.canPublish must be boolean');
        context.capabilities = capabilities;
        return {
          specVersion: capabilities.specVersion ?? null,
          canPublish: capabilities.canPublish,
          reason: capabilities.reason,
          limits: capabilities.limits ?? null,
        };
      },
    },
    {
      id: 'bootstrap-signing-identity',
      suite: 'bootstrap',
      label: 'getSigningIdentity returns stable owner',
      run: async context => {
        const first = await callSwarm<SwarmSigningIdentity>(context.provider, 'swarm_getSigningIdentity');
        const second = await callSwarm<SwarmSigningIdentity>(context.provider, 'swarm_getSigningIdentity');
        assertOwner(first.owner);
        assertSameLower(second.owner, first.owner, 'signing owner');
        context.identity = first;
        return {
          owner: first.owner,
          identityMode: first.identityMode ?? null,
        };
      },
    },
    {
      id: 'cac-small-roundtrip',
      suite: 'cac',
      label: 'CAC small byte roundtrip',
      run: async context => {
        const text = `swarm-kit test center CAC ${context.runId}`;
        const published = await context.kit.chunks.publishText(text);
        const read = await context.kit.chunks.readText(published.reference);
        assertEqual(read, text, 'CAC text');
        context.cac = { reference: published.reference, text };
        return {
          reference: published.reference,
          bytes: utf8ToBytes(text).length,
        };
      },
    },
    {
      id: 'cac-4096-roundtrip',
      suite: 'cac',
      label: 'CAC 4096-byte roundtrip',
      run: async context => {
        const text = 'x'.repeat(4096);
        const published = await context.kit.chunks.publishText(text);
        const read = await context.kit.chunks.readText(published.reference);
        assertEqual(read.length, text.length, 'CAC 4096-byte length');
        assertEqual(read, text, 'CAC 4096-byte payload');
        return {
          reference: published.reference,
          bytes: text.length,
        };
      },
    },
    {
      id: 'cac-missing',
      suite: 'cac',
      label: 'Missing CAC returns chunk_not_found',
      run: async context => expectProviderReason(
        () => context.kit.chunks.readBytes(missingReference(context.runId, 'cac')),
        'chunk_not_found',
      ),
    },
    {
      id: 'soc-roundtrip-address',
      suite: 'soc',
      label: 'SOC write/read by address',
      run: async context => {
        const text = `swarm-kit test center SOC ${context.runId}`;
        const identifier = deriveIdentifier(['swarm-kit:test-center:soc', context.runId, 'roundtrip']);
        const written = await context.kit.soc.writeText(identifier, text);
        const read = await context.kit.soc.readTextByAddress(written.reference);
        assertEqual(read, text, 'SOC text by address');
        context.soc = {
          reference: written.reference,
          owner: written.owner,
          identifier,
          text,
        };
        return {
          reference: written.reference,
          owner: written.owner,
          identifier,
        };
      },
    },
    {
      id: 'soc-roundtrip-owner-identifier',
      suite: 'soc',
      label: 'SOC read by owner and identifier',
      run: async context => {
        const soc = requireSoc(context);
        const read = await context.kit.soc.readTextByOwnerAndIdentifier(soc.owner, soc.identifier);
        assertEqual(read, soc.text, 'SOC text by owner+identifier');
        return {
          reference: soc.reference,
          owner: soc.owner,
          identifier: soc.identifier,
        };
      },
    },
    {
      id: 'soc-missing-owner-identifier',
      suite: 'soc',
      label: 'Missing SOC by owner+identifier returns chunk_not_found',
      run: async context => {
        const owner = context.soc?.owner ?? context.identity?.owner;
        if (!owner) throw new Error('No owner available for missing SOC probe');
        return expectProviderReason(
          () => context.kit.soc.readBytesByOwnerAndIdentifier(owner, missingReference(context.runId, 'soc-owner-identifier')),
          'chunk_not_found',
        );
      },
    },
    {
      id: 'soc-missing-address',
      suite: 'soc',
      label: 'Missing SOC by address returns chunk_not_found',
      run: async context => expectProviderReason(
        () => context.kit.soc.readBytesByAddress(missingReference(context.runId, 'soc-address')),
        'chunk_not_found',
      ),
    },
    {
      id: 'soc-cac-type-mismatch',
      suite: 'soc',
      label: 'CAC read as SOC returns chunk_type_mismatch',
      run: async context => {
        const cac = requireCac(context);
        return expectProviderReason(
          () => context.kit.soc.readBytesByAddress(cac.reference),
          'chunk_type_mismatch',
        );
      },
    },
    {
      id: 'soc-as-cac-type-mismatch',
      suite: 'soc',
      label: 'SOC read as CAC returns chunk_type_mismatch',
      run: async context => {
        const soc = requireSoc(context);
        return expectProviderReason(
          () => context.kit.chunks.readBytes(soc.reference),
          'chunk_type_mismatch',
        );
      },
    },
    {
      id: 'feed-create',
      suite: 'feed',
      label: 'createFeed returns feed coordinates',
      run: async context => {
        const name = feedName(context.runId, 'journal');
        const feed = await callSwarm<SwarmCreateFeedResult>(context.provider, 'swarm_createFeed', { name });
        assertEqual(feed.feedId, name, 'feedId');
        assertOwner(feed.owner);
        assertHex(feed.topic, 32, 'feed topic');
        context.feed = {
          name,
          owner: feed.owner,
          topic: feed.topic,
          writes: [],
        };
        return summarizeFeed(feed);
      },
    },
    {
      id: 'feed-auto-index-0',
      suite: 'feed',
      label: 'writeFeedEntry auto-writes index 0',
      run: async context => {
        const feed = requireFeed(context);
        const text = feedPayload(context.runId, 'auto-0');
        const write = await writeFeedEntry(context.provider, { name: feed.name, data: text });
        assertEqual(write.index, 0, 'first feed index');
        feed.writes.push({ index: write.index, text });
        return {
          name: feed.name,
          index: write.index,
          bytes: utf8ToBytes(text).length,
        };
      },
    },
    {
      id: 'feed-read-index-0-name',
      suite: 'feed',
      label: 'readFeedEntry reads exact index 0 by name',
      run: async context => {
        const feed = requireFeed(context);
        const expected = requireFeedWrite(feed, 0);
        const read = await readFeedEntry(context.provider, { name: feed.name, index: 0 });
        assertEqual(read.index, 0, 'read feed index');
        assertEqual(decodeFeedText(read), expected.text, 'feed index 0 payload');
        return summarizeFeedRead(feed, read);
      },
    },
    {
      id: 'feed-auto-index-1-latest',
      suite: 'feed',
      label: 'readFeedEntry latest returns highest index and nextIndex',
      run: async context => {
        const feed = requireFeed(context);
        const text = feedPayload(context.runId, 'auto-1');
        const write = await writeFeedEntry(context.provider, { name: feed.name, data: text });
        assertEqual(write.index, 1, 'second feed index');
        feed.writes.push({ index: write.index, text });

        const latest = await readFeedEntry(context.provider, { name: feed.name });
        assertEqual(latest.index, 1, 'latest feed index');
        assertEqual(latest.nextIndex, 2, 'latest nextIndex');
        assertEqual(decodeFeedText(latest), text, 'latest feed payload');
        return summarizeFeedRead(feed, latest);
      },
    },
    {
      id: 'feed-sparse-index-write-read',
      suite: 'feed',
      label: 'Sparse explicit feed index uses exact-match semantics',
      run: async context => {
        const feed = requireFeed(context);
        const text = feedPayload(context.runId, 'sparse-5');
        const write = await writeFeedEntry(context.provider, { name: feed.name, data: text, index: 5 });
        assertEqual(write.index, 5, 'sparse feed index');
        feed.writes.push({ index: write.index, text });

        const read = await readFeedEntry(context.provider, { name: feed.name, index: 5 });
        assertEqual(read.index, 5, 'sparse read index');
        assertEqual(decodeFeedText(read), text, 'sparse feed payload');
        return summarizeFeedRead(feed, read);
      },
    },
    {
      id: 'feed-missing-index-exact',
      suite: 'feed',
      label: 'Missing explicit feed index returns entry_not_found',
      run: async context => {
        const feed = requireFeed(context);
        return expectProviderReason(
          () => readFeedEntry(context.provider, { name: feed.name, index: 4 }),
          'entry_not_found',
        );
      },
    },
    {
      id: 'feed-overwrite-protection',
      suite: 'feed',
      label: 'Occupied explicit feed index returns index_already_exists',
      run: async context => {
        const feed = requireFeed(context);
        return expectProviderReason(
          () => writeFeedEntry(context.provider, {
            name: feed.name,
            data: feedPayload(context.runId, 'duplicate-5'),
            index: 5,
          }),
          'index_already_exists',
        );
      },
    },
    {
      id: 'feed-read-topic-owner',
      suite: 'feed',
      label: 'readFeedEntry reads by raw topic and owner',
      run: async context => {
        const feed = requireFeed(context);
        const expected = requireFeedWrite(feed, 0);
        const read = await readFeedEntry(context.provider, { topic: feed.topic, owner: feed.owner, index: 0 });
        assertEqual(read.index, 0, 'topic+owner read index');
        assertEqual(decodeFeedText(read), expected.text, 'topic+owner feed payload');
        return summarizeFeedRead(feed, read);
      },
    },
    {
      id: 'feed-list-includes-created-feed',
      suite: 'feed',
      label: 'listFeeds includes created feed',
      run: async context => {
        const feed = requireFeed(context);
        const feeds = await callSwarm<SwarmFeedRecord[]>(context.provider, 'swarm_listFeeds');
        const match = feeds.find(item => item.name === feed.name);
        assertCondition(Boolean(match), `listFeeds did not include ${feed.name}`);
        return {
          count: feeds.length,
          match,
        };
      },
    },
    {
      id: 'indexed-soc-append-read',
      suite: 'indexed-soc',
      label: 'Indexed SOC stream appends and discovers latest',
      run: async context => {
        const stream = createTestIndexedStream(context);
        const first = await stream.append(({ index, previousReference }) => ({
          version: 1,
          type: 'swarm-kit:test-center:indexed-soc-entry',
          index,
          previousReference,
          value: 'first',
        }));
        const second = await stream.append(({ index, previousReference }) => ({
          version: 1,
          type: 'swarm-kit:test-center:indexed-soc-entry',
          index,
          previousReference,
          value: 'second',
        }));
        const third = await stream.append(({ index, previousReference }) => ({
          version: 1,
          type: 'swarm-kit:test-center:indexed-soc-entry',
          index,
          previousReference,
          value: 'third',
        }));
        assertEqual(first.envelope.index, 0, 'first indexed SOC index');
        assertEqual(second.envelope.index, 1, 'second indexed SOC index');
        assertEqual(third.envelope.index, 2, 'third indexed SOC index');
        assertSameLower(second.envelope.previousReference ?? '', first.reference, 'second previous reference');
        assertSameLower(third.envelope.previousReference ?? '', second.reference, 'third previous reference');

        const latestIndex = await stream.findLatestIndex(third.owner);
        const latest = await stream.readLatest(third.owner, { limit: 3 });
        assertEqual(latestIndex, 2, 'latest indexed SOC index');
        assertEqual(latest.map(entry => entry.envelope.value).join(','), 'third,second,first', 'indexed SOC latest order');
        return {
          owner: third.owner,
          latestIndex,
          references: latest.map(entry => entry.reference),
        };
      },
    },
    {
      id: 'indexed-soc-missing-next',
      suite: 'indexed-soc',
      label: 'Indexed SOC missing next index returns null',
      run: async context => {
        const stream = createTestIndexedStream(context);
        const owner = await stream.getOwner();
        const missing = await stream.readAt(owner, 3);
        assertEqual(missing, null, 'missing indexed SOC entry');
        return { owner, missingIndex: 3 };
      },
    },
    {
      id: 'primitive-object-graph',
      suite: 'primitives',
      label: 'Object graph stores payload above one raw chunk',
      run: async context => {
        const text = `swarm-kit test center object ${context.runId}\n${'payload-'.repeat(800)}`;
        const published = await context.kit.objects.publishText(text);
        const read = await context.kit.objects.readText(published.reference);
        assertEqual(read, text, 'object graph text');
        return {
          reference: published.reference,
          size: published.size,
          chunkCount: published.chunkCount,
          nodeCount: published.nodeCount,
        };
      },
    },
    {
      id: 'primitive-epoch-feed',
      suite: 'primitives',
      label: 'Epoch feed write/readLatest',
      run: async context => {
        const feed = context.kit.epochFeed.create<{ status: string }>({
          topic: `swarm-kit-test-center-epoch-${context.runId}`,
          period: 'minute',
        });
        const at = Date.now();
        const owner = await feed.getOwner();
        const written = await feed.write({ status: 'ok' }, { at });
        const read = await feed.readLatest(owner, { from: at, lookback: 3 });
        assertCondition(Boolean(read), 'epoch feed readLatest returned null');
        assertEqual(read?.value.status, 'ok', 'epoch feed value');
        return {
          owner,
          reference: written.reference,
          identifier: written.identifier,
          epochStartMs: written.epochStartMs,
        };
      },
    },
    {
      id: 'primitive-hash-chain',
      suite: 'primitives',
      label: 'Hash chain appends and walks previous references',
      run: async context => {
        const chain = context.kit.hashChain.create<{ step: number }>({
          topic: `swarm-kit-test-center-chain-${context.runId}`,
        });
        const first = await chain.append({ step: 1 });
        const second = await chain.append({ step: 2 });
        const latest = await chain.readLatest(second.owner, { limit: 2 });
        assertEqual(first.index, 0, 'first hash chain index');
        assertEqual(second.index, 1, 'second hash chain index');
        assertEqual(latest.length, 2, 'hash chain latest count');
        assertEqual(latest[0]?.index, 1, 'hash chain latest index');
        assertEqual(latest[1]?.index, 0, 'hash chain previous index');
        assertEqual(latest[0]?.payload.step, 2, 'hash chain latest payload');
        assertSameLower(second.previousReference ?? '', first.reference, 'hash chain previous reference');
        return {
          owner: second.owner,
          latest: latest.map(entry => ({ index: entry.index, reference: entry.reference })),
        };
      },
    },
    {
      id: 'primitive-multi-writer-feed',
      suite: 'primitives',
      label: 'Multi-writer feed single-writer stream works',
      run: async context => {
        const feed = context.kit.multiWriterFeed.create<{ step: number }>({
          topic: `swarm-kit-test-center-multi-${context.runId}`,
          writerId: 'local',
        });
        const first = await feed.append({ step: 1 });
        const second = await feed.append({ step: 2 });
        const entries = await feed.readWriter(second.owner, { writerId: 'local', limit: 2 });
        assertEqual(first.index, 0, 'first multi-writer index');
        assertEqual(second.index, 1, 'second multi-writer index');
        assertEqual(entries.length, 2, 'multi-writer entry count');
        assertEqual(entries[0]?.index, 1, 'multi-writer latest index');
        assertEqual(entries[1]?.index, 0, 'multi-writer previous index');
        assertEqual(entries[0]?.payload.step, 2, 'multi-writer latest payload');
        assertSameLower(second.previousReference ?? '', first.reference, 'multi-writer previous reference');
        return {
          owner: second.owner,
          entries: entries.map(entry => ({ index: entry.index, reference: entry.reference })),
        };
      },
    },
    {
      id: 'primitive-keyed-lookup',
      suite: 'primitives',
      label: 'Keyed lookup writes and reads latest value',
      run: async context => {
        const lookup = context.kit.lookup.create<{ value: string }>({
          namespace: `swarm-kit-test-center-lookup-${context.runId}`,
        });
        const first = await lookup.write('key', { value: 'first' });
        const second = await lookup.write('key', { value: 'second' });
        const latest = await lookup.readLatest(second.owner, 'key');
        assertEqual(first.index, 0, 'first keyed lookup index');
        assertEqual(second.index, 1, 'second keyed lookup index');
        assertEqual(latest?.index, 1, 'keyed lookup latest index');
        assertEqual(latest?.value.value, 'second', 'keyed lookup latest value');
        assertSameLower(second.previousReference ?? '', first.reference, 'keyed lookup previous reference');
        return {
          owner: second.owner,
          latest: latest ? { index: latest.index, reference: latest.reference } : null,
        };
      },
    },
    {
      id: 'primitive-commit-reveal',
      suite: 'primitives',
      label: 'Commit-reveal commit/read/reveal/readPair',
      run: async context => {
        const protocol = context.kit.commitReveal.create<{ vote: string }>({
          topic: `swarm-kit-test-center-commit-${context.runId}`,
          round: 'round-1',
        });
        const salt = context.kit.commitReveal.generateSalt();
        const commit = await protocol.commit({ vote: 'yes' }, { salt });
        const reveal = await protocol.reveal({ vote: 'yes' }, salt);
        const pair = await protocol.readPair(commit.owner);
        assertEqual(pair.verified, true, 'commit-reveal verification');
        return {
          owner: commit.owner,
          commitReference: commit.reference,
          revealReference: reveal.reference,
          verified: pair.verified,
        };
      },
    },
    {
      id: 'diagnostics-cac-size-matrix',
      suite: 'diagnostics',
      label: 'Diagnostics: CAC size matrix immediate read-after-write',
      run: async context => {
        const sizes = [1, 31, 32, 33, 42, 100, 1000, 4095, 4096, 4097, 8192];
        const steps: DiagnosticStep[] = [];
        for (const size of sizes) {
          steps.push(await captureStep(`cac-size-${size}`, async () => {
            const text = payloadOfSize(size, `cac:${context.runId}:${size}`);
            if (size > 4096) {
              const error = await expectProviderReason(
                () => context.kit.chunks.publishText(text),
                'payload_too_large',
              );
              return {
                size,
                expectedRejection: true,
                error,
              };
            }
            const published = await context.kit.chunks.publishText(text);
            const read = await context.kit.chunks.readText(published.reference);
            assertEqual(read.length, text.length, `CAC size ${size} read length`);
            assertEqual(read, text, `CAC size ${size} payload`);
            return {
              size,
              reference: published.reference,
            };
          }));
        }
        assertDiagnosticSteps(steps, 'CAC size matrix failed');
        return { sizes, steps };
      },
    },
    {
      id: 'diagnostics-cac-delayed-small-read',
      suite: 'diagnostics',
      label: 'Diagnostics: CAC small chunk delayed read-after-write',
      run: async context => {
        const size = 42;
        const text = payloadOfSize(size, `cac-delayed:${context.runId}`);
        const published = await context.kit.chunks.publishText(text);
        const delays = [0, 250, 1000, 3000];
        const steps: DiagnosticStep[] = [];
        for (const delayMs of delays) {
          steps.push(await captureStep(`read-after-${delayMs}ms`, async () => {
            if (delayMs > 0) await sleep(delayMs);
            const read = await context.kit.chunks.readText(published.reference);
            assertEqual(read, text, `CAC delayed read after ${delayMs}ms`);
            return {
              delayMs,
              reference: published.reference,
              size,
            };
          }));
        }
        assertDiagnosticSteps(steps, 'CAC delayed read failed');
        return {
          size,
          reference: published.reference,
          steps,
        };
      },
    },
    {
      id: 'diagnostics-cac-uniform-4096-read',
      suite: 'diagnostics',
      label: 'Diagnostics: CAC uniform 4096-byte delayed read-after-write',
      run: async context => {
        const size = 4096;
        const text = 'x'.repeat(size);
        const published = await context.kit.chunks.publishText(text);
        const delays = [0, 250, 1000, 3000];
        const steps: DiagnosticStep[] = [];
        for (const delayMs of delays) {
          steps.push(await captureStep(`read-after-${delayMs}ms`, async () => {
            if (delayMs > 0) await sleep(delayMs);
            const read = await context.kit.chunks.readText(published.reference);
            assertEqual(read.length, text.length, `CAC uniform 4096 read length after ${delayMs}ms`);
            assertEqual(read, text, `CAC uniform 4096 payload after ${delayMs}ms`);
            return {
              delayMs,
              reference: published.reference,
              size,
              payload: "x.repeat(4096)",
            };
          }));
        }
        assertDiagnosticSteps(steps, 'CAC uniform 4096 delayed read failed');
        return {
          size,
          payload: "x.repeat(4096)",
          reference: published.reference,
          steps,
        };
      },
    },
    {
      id: 'diagnostics-soc-address-owner-timeline',
      suite: 'diagnostics',
      label: 'Diagnostics: SOC read by address versus owner+identifier',
      run: async context => {
        const identifier = deriveIdentifier(['swarm-kit:test-center:diagnostics:soc-address', context.runId]);
        const text = `swarm-kit diagnostics SOC address ${context.runId}`;
        let written: { reference: string; owner: string; identifier: string } | null = null;
        const steps: DiagnosticStep[] = [];

        steps.push(await captureStep('write-soc', async () => {
          written = await context.kit.soc.writeText(identifier, text);
          assertSameLower(written.identifier, identifier, 'diagnostic SOC identifier');
          return written;
        }));

        for (const delayMs of [0, 250, 1000, 3000]) {
          steps.push(await captureStep(`read-address-after-${delayMs}ms`, async () => {
            if (!written) throw new Error('SOC write did not produce coordinates');
            if (delayMs > 0) await sleep(delayMs);
            const read = await context.kit.soc.readTextByAddress(written.reference);
            assertEqual(read, text, `SOC address read after ${delayMs}ms`);
            return {
              delayMs,
              reference: written.reference,
              owner: written.owner,
              identifier: written.identifier,
              text: read,
            };
          }));
        }

        for (const delayMs of [0, 250, 1000, 3000]) {
          steps.push(await captureStep(`read-owner-identifier-after-${delayMs}ms`, async () => {
            if (!written) throw new Error('SOC write did not produce coordinates');
            if (delayMs > 0) await sleep(delayMs);
            const read = await context.kit.soc.readTextByOwnerAndIdentifier(written.owner, written.identifier);
            assertEqual(read, text, `SOC owner+identifier read after ${delayMs}ms`);
            return {
              delayMs,
              reference: written.reference,
              owner: written.owner,
              identifier: written.identifier,
              text: read,
            };
          }));
        }

        assertDiagnosticSteps(steps, 'SOC address versus owner+identifier timeline failed');
        return {
          coordinates: written,
          steps,
        };
      },
    },
    {
      id: 'diagnostics-feed-auto-timeline',
      suite: 'diagnostics',
      label: 'Diagnostics: native feed auto-index timeline',
      run: async context => {
        const name = feedName(context.runId, 'diag-auto');
        let feed: SwarmCreateFeedResult | null = null;
        const payload0 = feedPayload(context.runId, 'diag-auto-0');
        const payload1 = feedPayload(context.runId, 'diag-auto-1');
        const steps: DiagnosticStep[] = [];

        steps.push(await captureStep('create-feed', async () => {
          feed = await callSwarm<SwarmCreateFeedResult>(context.provider, 'swarm_createFeed', { name });
          return summarizeFeed(feed);
        }));
        steps.push(await captureStep('write-auto-0', async () => {
          const write = await writeFeedEntry(context.provider, { name, data: payload0 });
          assertEqual(write.index, 0, 'first auto feed index');
          return write;
        }));
        steps.push(await captureStep('read-latest-after-0', async () => {
          const read = await readFeedEntry(context.provider, { name });
          assertEqual(read.index, 0, 'latest index after first feed write');
          assertEqual(decodeFeedText(read), payload0, 'latest payload after first feed write');
          return summarizeDiagnosticFeedRead(read);
        }));
        steps.push(await captureStep('read-index-0', async () => {
          const read = await readFeedEntry(context.provider, { name, index: 0 });
          assertEqual(read.index, 0, 'explicit feed index 0');
          assertEqual(decodeFeedText(read), payload0, 'explicit feed payload 0');
          return summarizeDiagnosticFeedRead(read);
        }));
        steps.push(await captureStep('write-auto-1', async () => {
          const write = await writeFeedEntry(context.provider, { name, data: payload1 });
          assertEqual(write.index, 1, 'second auto feed index');
          return write;
        }));
        steps.push(await captureStep('read-latest-after-1', async () => {
          const read = await readFeedEntry(context.provider, { name });
          assertEqual(read.index, 1, 'latest index after second feed write');
          assertEqual(decodeFeedText(read), payload1, 'latest payload after second feed write');
          return summarizeDiagnosticFeedRead(read);
        }));
        steps.push(await captureStep('read-index-1', async () => {
          const read = await readFeedEntry(context.provider, { name, index: 1 });
          assertEqual(read.index, 1, 'explicit feed index 1');
          assertEqual(decodeFeedText(read), payload1, 'explicit feed payload 1');
          return summarizeDiagnosticFeedRead(read);
        }));

        assertDiagnosticSteps(steps, 'Native feed auto-index timeline failed');
        return {
          name,
          feed: feed ? summarizeFeed(feed) : null,
          steps,
        };
      },
    },
    {
      id: 'diagnostics-feed-sparse-timeline',
      suite: 'diagnostics',
      label: 'Diagnostics: native feed sparse explicit-index timeline',
      run: async context => {
        const name = feedName(context.runId, 'diag-sparse');
        let feed: SwarmCreateFeedResult | null = null;
        const payload0 = feedPayload(context.runId, 'diag-sparse-0');
        const payload5 = feedPayload(context.runId, 'diag-sparse-5');
        const duplicatePayload5 = feedPayload(context.runId, 'diag-sparse-5-duplicate');
        const steps: DiagnosticStep[] = [];

        steps.push(await captureStep('create-feed', async () => {
          feed = await callSwarm<SwarmCreateFeedResult>(context.provider, 'swarm_createFeed', { name });
          return summarizeFeed(feed);
        }));
        steps.push(await captureStep('write-index-0', async () => {
          const write = await writeFeedEntry(context.provider, { name, data: payload0, index: 0 });
          assertEqual(write.index, 0, 'explicit feed write index 0');
          return write;
        }));
        steps.push(await captureStep('write-index-5', async () => {
          const write = await writeFeedEntry(context.provider, { name, data: payload5, index: 5 });
          assertEqual(write.index, 5, 'explicit feed write index 5');
          return write;
        }));
        steps.push(await captureStep('read-index-0', async () => {
          const read = await readFeedEntry(context.provider, { name, index: 0 });
          assertEqual(read.index, 0, 'explicit feed read index 0');
          assertEqual(decodeFeedText(read), payload0, 'explicit feed payload 0');
          return summarizeDiagnosticFeedRead(read);
        }));
        steps.push(await captureStep('read-index-5', async () => {
          const read = await readFeedEntry(context.provider, { name, index: 5 });
          assertEqual(read.index, 5, 'explicit feed read index 5');
          assertEqual(decodeFeedText(read), payload5, 'explicit feed payload 5');
          return summarizeDiagnosticFeedRead(read);
        }));
        steps.push(await captureExpectedReasonStep('duplicate-index-5', async () => writeFeedEntry(context.provider, {
          name,
          data: duplicatePayload5,
          index: 5,
        }), 'index_already_exists'));

        assertDiagnosticSteps(steps, 'Native feed sparse timeline failed');
        return {
          name,
          feed: feed ? summarizeFeed(feed) : null,
          steps,
        };
      },
    },
    {
      id: 'diagnostics-swarmit-user-feed-journal',
      suite: 'diagnostics',
      label: 'Diagnostics: Swarmit-style user feed latest and history reconstruction',
      run: async context => {
        const name = feedName(context.runId, 'swarmit-user');
        let feed: SwarmCreateFeedResult | null = null;
        const createdAtBase = Date.now();
        const entries: SwarmitUserFeedEntryFixture[] = [
          createSwarmitUserFeedEntry(context.runId, 0, createdAtBase),
          createSwarmitUserFeedEntry(context.runId, 1, createdAtBase + 1_000),
          createSwarmitUserFeedEntry(context.runId, 2, createdAtBase + 2_000),
        ];
        const steps: DiagnosticStep[] = [];

        steps.push(await captureStep('create-feed', async () => {
          feed = await callSwarm<SwarmCreateFeedResult>(context.provider, 'swarm_createFeed', { name });
          return summarizeFeed(feed);
        }));

        for (let index = 0; index < entries.length; index += 1) {
          steps.push(await captureStep(`write-entry-${index}`, async () => {
            const entry = entries[index];
            if (!entry) throw new Error(`Missing fixture entry ${index}`);
            const write = await writeFeedEntry(context.provider, {
              name,
              data: JSON.stringify(entry),
            });
            assertEqual(write.index, index, `Swarmit-style feed write index ${index}`);
            return {
              index: write.index,
              entry,
            };
          }));
        }

        steps.push(await captureStep('read-latest-by-topic-owner', async () => {
          if (!feed) throw new Error('Feed creation did not produce coordinates');
          const latest = await readFeedEntry(context.provider, {
            topic: feed.topic,
            owner: feed.owner,
          });
          const decoded = decodeFeedJson<SwarmitUserFeedEntryFixture>(latest);
          assertEqual(latest.index, entries.length - 1, 'Swarmit-style latest index');
          assertEqual(latest.nextIndex, entries.length, 'Swarmit-style latest nextIndex');
          assertEqual(decoded.submissionRef, entries[entries.length - 1]?.submissionRef, 'Swarmit-style latest submissionRef');
          return {
            ...summarizeDiagnosticFeedRead(latest),
            entry: decoded,
          };
        }));

        steps.push(await captureStep('parallel-history-by-topic-owner', async () => {
          if (!feed) throw new Error('Feed creation did not produce coordinates');
          const { owner, topic } = feed;
          const latest = await readFeedEntry(context.provider, {
            topic,
            owner,
          });
          const totalEntries = latest.nextIndex ?? latest.index + 1;
          assertEqual(totalEntries, entries.length, 'Swarmit-style total entries from latest');
          const reads = await Promise.all(Array.from({ length: totalEntries }, (_, index) =>
            readFeedEntry(context.provider, {
              topic,
              owner,
              index,
            })
          ));
          const decoded = reads.map(read => decodeFeedJson<SwarmitUserFeedEntryFixture>(read));
          assertEqual(
            decoded.map(entry => entry.submissionRef).join('|'),
            entries.map(entry => entry.submissionRef).join('|'),
            'Swarmit-style reconstructed submission refs',
          );
          const newestFirst = [...decoded].sort((a, b) => b.createdAt - a.createdAt);
          assertEqual(newestFirst[0]?.submissionRef, entries[2]?.submissionRef, 'Swarmit-style newest-first sort');
          assertEqual(new Set(decoded.map(entry => entry.submissionRef)).size, entries.length, 'Swarmit-style submissionRef dedupe size');
          return {
            totalEntries,
            reads: reads.map(summarizeDiagnosticFeedRead),
            decoded,
            newestFirst,
          };
        }));

        assertDiagnosticSteps(steps, 'Swarmit-style user feed journal failed');
        return {
          name,
          feed: feed ? summarizeFeed(feed) : null,
          entries,
          steps,
        };
      },
    },
    {
      id: 'diagnostics-feed-manifest-resolution',
      suite: 'diagnostics',
      label: 'Diagnostics: feed manifest resolves latest JSON through bzz fetch',
      run: async context => {
        const name = feedName(context.runId, 'manifest');
        let feed: SwarmCreateFeedResult | null = null;
        let manifestUrl: string | null = null;
        let firstPublish: SwarmPublishDataResult | null = null;
        let secondPublish: SwarmPublishDataResult | null = null;
        let firstReference: string | null = null;
        let secondReference: string | null = null;
        const firstObject = createFeedManifestFixture(context.runId, 'first');
        const secondObject = createFeedManifestFixture(context.runId, 'second');
        const steps: DiagnosticStep[] = [];

        steps.push(await captureStep('create-feed', async () => {
          feed = await callSwarm<SwarmCreateFeedResult>(context.provider, 'swarm_createFeed', { name });
          manifestUrl = feedManifestUrl(feed);
          return {
            ...summarizeFeed(feed),
            manifestUrl,
          };
        }));

        steps.push(await captureStep('publish-first-json', async () => {
          firstPublish = await publishProviderJson(context.provider, firstObject, `${name}-first.json`);
          firstReference = firstPublish.reference;
          return firstPublish;
        }));

        steps.push(await captureStep('update-feed-first-reference', async () => {
          if (!feed || !firstPublish) throw new Error('Feed or first publish result is unavailable');
          const update = await callSwarm<SwarmUpdateFeedResult>(context.provider, 'swarm_updateFeed', {
            feedId: feed.feedId,
            reference: firstPublish.reference,
          });
          assertEqual(update.reference, firstPublish.reference, 'first feed update reference');
          return update;
        }));

        steps.push(await captureStep('fetch-manifest-first', async () => {
          if (!manifestUrl) throw new Error('Feed creation did not produce a manifest URL');
          const resolved = await fetchJsonWithTimeout(manifestUrl);
          assertFeedManifestFixture(resolved, 'first');
          return {
            manifestUrl,
            resolved,
          };
        }));

        steps.push(await captureStep('publish-second-json', async () => {
          secondPublish = await publishProviderJson(context.provider, secondObject, `${name}-second.json`);
          secondReference = secondPublish.reference;
          return secondPublish;
        }));

        steps.push(await captureStep('update-feed-second-reference', async () => {
          if (!feed || !secondPublish) throw new Error('Feed or second publish result is unavailable');
          const update = await callSwarm<SwarmUpdateFeedResult>(context.provider, 'swarm_updateFeed', {
            feedId: feed.feedId,
            reference: secondPublish.reference,
          });
          assertEqual(update.reference, secondPublish.reference, 'second feed update reference');
          return update;
        }));

        steps.push(await captureStep('fetch-manifest-second', async () => {
          if (!manifestUrl) throw new Error('Feed creation did not produce a manifest URL');
          const resolved = await fetchJsonWithTimeout(manifestUrl);
          assertFeedManifestFixture(resolved, 'second');
          return {
            manifestUrl,
            resolved,
          };
        }));

        assertDiagnosticSteps(steps, 'Feed manifest latest-resolution failed');
        return {
          name,
          feed: feed ? summarizeFeed(feed) : null,
          manifestUrl,
          firstReference,
          secondReference,
          steps,
        };
      },
    },
    {
      id: 'diagnostics-indexed-soc-timeline',
      suite: 'diagnostics',
      label: 'Diagnostics: indexed SOC stream append/read timeline',
      run: async context => {
        const stream = createDiagnosticIndexedStream(context);
        const owner = await stream.getOwner();
        const steps: DiagnosticStep[] = [];

        steps.push(await captureStep('append-0', async () => {
          const appended = await stream.append(({ index, previousReference }) => ({
            version: 1,
            type: 'swarm-kit:test-center:indexed-soc-entry',
            index,
            previousReference,
            value: 'diag-first',
          }));
          assertEqual(appended.envelope.index, 0, 'diagnostic append index 0');
          return summarizeIndexedSocEntry(appended);
        }));
        steps.push(await captureStep('read-0', async () => {
          const entry = await stream.readAt(owner, 0);
          assertCondition(entry !== null, 'diagnostic indexed SOC read index 0 returned null');
          assertEqual(entry.envelope.value, 'diag-first', 'diagnostic indexed SOC value 0');
          return summarizeIndexedSocEntry(entry);
        }));
        steps.push(await captureStep('append-1', async () => {
          const appended = await stream.append(({ index, previousReference }) => ({
            version: 1,
            type: 'swarm-kit:test-center:indexed-soc-entry',
            index,
            previousReference,
            value: 'diag-second',
          }));
          assertEqual(appended.envelope.index, 1, 'diagnostic append index 1');
          return summarizeIndexedSocEntry(appended);
        }));
        steps.push(await captureStep('read-1', async () => {
          const entry = await stream.readAt(owner, 1);
          assertCondition(entry !== null, 'diagnostic indexed SOC read index 1 returned null');
          assertEqual(entry.envelope.value, 'diag-second', 'diagnostic indexed SOC value 1');
          return summarizeIndexedSocEntry(entry);
        }));
        steps.push(await captureStep('append-2', async () => {
          const appended = await stream.append(({ index, previousReference }) => ({
            version: 1,
            type: 'swarm-kit:test-center:indexed-soc-entry',
            index,
            previousReference,
            value: 'diag-third',
          }));
          assertEqual(appended.envelope.index, 2, 'diagnostic append index 2');
          return summarizeIndexedSocEntry(appended);
        }));
        steps.push(await captureStep('read-2', async () => {
          const entry = await stream.readAt(owner, 2);
          assertCondition(entry !== null, 'diagnostic indexed SOC read index 2 returned null');
          assertEqual(entry.envelope.value, 'diag-third', 'diagnostic indexed SOC value 2');
          return summarizeIndexedSocEntry(entry);
        }));
        steps.push(await captureStep('read-latest', async () => {
          const latest = await stream.readLatest(owner, { limit: 3 });
          assertEqual(latest.map(entry => entry.envelope.value).join(','), 'diag-third,diag-second,diag-first', 'diagnostic indexed SOC latest order');
          return latest.map(summarizeIndexedSocEntry);
        }));

        assertDiagnosticSteps(steps, 'Indexed SOC timeline failed');
        return {
          owner,
          identifiers: [0, 1, 2].map(index => ({
            index,
            identifier: stream.entryIdentifier(index),
          })),
          steps,
        };
      },
    },
    {
      id: 'stress-soc-sequential',
      suite: 'stress',
      label: 'Stress: sequential SOC write/read batch',
      run: async context => {
        const count = options.stress.socWrites;
        const writes = [];
        for (let index = 0; index < count; index += 1) {
          const identifier = deriveIdentifier(['swarm-kit:test-center:stress:soc', context.runId, index]);
          const text = `stress soc ${context.runId} ${index}`;
          const written = await context.kit.soc.writeText(identifier, text);
          const read = await context.kit.soc.readTextByOwnerAndIdentifier(written.owner, identifier);
          assertEqual(read, text, `stress SOC ${index}`);
          writes.push({ index, owner: written.owner, identifier, reference: written.reference });
        }
        return { count, writes };
      },
    },
    {
      id: 'stress-feed-concurrent-auto-writes',
      suite: 'stress',
      label: 'Stress: concurrent feed auto-writes get unique indices',
      run: async context => {
        const name = feedName(context.runId, 'stress');
        const feed = await callSwarm<SwarmCreateFeedResult>(context.provider, 'swarm_createFeed', { name });
        const count = options.stress.feedWrites;
        const writes = await Promise.all(Array.from({ length: count }, (_, index) =>
          writeFeedEntry(context.provider, {
            name,
            data: feedPayload(context.runId, `stress-${index}`),
          })
        ));
        const indices = writes.map(write => write.index).sort((a, b) => a - b);
        assertEqual(new Set(indices).size, count, 'unique concurrent feed indices');
        assertEqual(indices[0], 0, 'first concurrent feed index');
        assertEqual(indices[indices.length - 1], count - 1, 'last concurrent feed index');
        const reads = await Promise.all(indices.map(index => readFeedEntry(context.provider, { name, index })));
        assertEqual(reads.length, count, 'concurrent feed read count');
        return {
          name,
          owner: feed.owner,
          topic: feed.topic,
          indices,
        };
      },
    },
  ];
}

async function runTestCase(
  testCase: ProviderTestCase,
  context: ProviderTestCenterContext,
): Promise<ProviderTestCenterResult> {
  const started = now();
  if (testCase.enabled === false) {
    return {
      id: testCase.id,
      suite: testCase.suite,
      label: testCase.label,
      status: 'skip',
      durationMs: elapsed(started),
      details: testCase.skipReason ?? 'skipped',
    };
  }

  try {
    const details = await testCase.run(context);
    if (isWarning(details)) {
      return {
        id: testCase.id,
        suite: testCase.suite,
        label: testCase.label,
        status: 'warn',
        durationMs: elapsed(started),
        details: details.details,
      };
    }
    return {
      id: testCase.id,
      suite: testCase.suite,
      label: testCase.label,
      status: 'pass',
      durationMs: elapsed(started),
      details,
    };
  } catch (error) {
    return {
      id: testCase.id,
      suite: testCase.suite,
      label: testCase.label,
      status: 'fail',
      durationMs: elapsed(started),
      error: serializeProviderTestError(error),
    };
  }
}

async function writeFeedEntry(
  provider: SwarmProvider,
  params: { name: string; data: string | Uint8Array | ArrayBuffer; index?: number },
): Promise<SwarmWriteFeedEntryResult> {
  return callSwarm(provider, 'swarm_writeFeedEntry', params);
}

async function readFeedEntry(
  provider: SwarmProvider,
  params: { name: string; owner?: string; index?: number } | { topic: string; owner: string; index?: number },
): Promise<SwarmReadFeedEntryResult> {
  const result = await callSwarm<SwarmReadFeedEntryResult>(provider, 'swarm_readFeedEntry', params);
  assertEqual(result.encoding, 'base64', 'feed entry encoding');
  assertCondition(Number.isSafeInteger(result.index) && result.index >= 0, 'feed entry index must be a non-negative safe integer');
  assertCondition(
    result.nextIndex === null || (Number.isSafeInteger(result.nextIndex) && result.nextIndex >= 0),
    'feed entry nextIndex must be null or a non-negative safe integer',
  );
  return result;
}

async function publishProviderJson(
  provider: SwarmProvider,
  value: unknown,
  name: string,
): Promise<SwarmPublishDataResult> {
  const result = await callSwarm<SwarmPublishDataResult>(provider, 'swarm_publishData', {
    data: JSON.stringify(value),
    contentType: 'application/json',
    name,
  });
  assertHex(result.reference, 32, 'publishData reference');
  return result;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 12_000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status} for ${url}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function expectProviderReason(
  action: () => Promise<unknown>,
  expectedReason: string,
): Promise<SerializedProviderTestError> {
  try {
    const value = await action();
    throw new Error(`Expected provider error ${expectedReason}, but call resolved with ${JSON.stringify(summarizeValue(value))}`);
  } catch (error) {
    const reason = getSwarmErrorReason(error);
    if (reason !== expectedReason) {
      const serialized = serializeProviderTestError(error);
      throw new Error(`Expected provider reason "${expectedReason}", received "${reason ?? 'none'}": ${serialized.message}`);
    }
    return serializeProviderTestError(error);
  }
}

function createTestIndexedStream(context: ProviderTestCenterContext) {
  return createIndexedSocStream<TestEnvelope>(context.provider, {
    namespace: 'swarm-kit:test-center:indexed-soc:v1',
    parts: [context.runId],
    parseEnvelope: (value, readContext) => {
      if (
        value.version !== 1 ||
        value.type !== 'swarm-kit:test-center:indexed-soc-entry' ||
        value.index !== readContext.index ||
        !(typeof value.previousReference === 'string' || value.previousReference === null) ||
        typeof value.value !== 'string'
      ) {
        throw new Error('Invalid test-center indexed SOC envelope');
      }
      return value;
    },
  });
}

function createDiagnosticIndexedStream(context: ProviderTestCenterContext) {
  return createIndexedSocStream<TestEnvelope>(context.provider, {
    namespace: 'swarm-kit:test-center:indexed-soc:v1',
    parts: [context.runId, 'diagnostics'],
    parseEnvelope: (value, readContext) => {
      if (
        value.version !== 1 ||
        value.type !== 'swarm-kit:test-center:indexed-soc-entry' ||
        value.index !== readContext.index ||
        !(typeof value.previousReference === 'string' || value.previousReference === null) ||
        typeof value.value !== 'string'
      ) {
        throw new Error('Invalid diagnostic indexed SOC envelope');
      }
      return value;
    },
  });
}

async function captureStep<T>(
  name: string,
  action: () => Promise<T>,
): Promise<DiagnosticStep<T>> {
  const started = now();
  try {
    const value = await action();
    return {
      name,
      status: 'pass',
      durationMs: elapsed(started),
      value,
    };
  } catch (error) {
    return {
      name,
      status: 'fail',
      durationMs: elapsed(started),
      error: serializeProviderTestError(error),
    };
  }
}

async function captureExpectedReasonStep(
  name: string,
  action: () => Promise<unknown>,
  expectedReason: string,
): Promise<DiagnosticStep<SerializedProviderTestError>> {
  return captureStep(name, async () => expectProviderReason(action, expectedReason));
}

function assertDiagnosticSteps(steps: readonly DiagnosticStep[], message: string): void {
  const failed = steps.filter(step => step.status === 'fail');
  if (failed.length > 0) {
    throw diagnosticFailure(message, {
      failed,
      steps,
    });
  }
}

function diagnosticFailure(message: string, details: unknown): Error & { details: unknown } {
  const error = new Error(message) as Error & { details: unknown };
  error.name = 'ProviderDiagnosticError';
  error.details = details;
  return error;
}

function summarizeResults(results: ProviderTestCenterResult[]): ProviderTestCenterSummary {
  return {
    total: results.length,
    passed: results.filter(result => result.status === 'pass').length,
    failed: results.filter(result => result.status === 'fail').length,
    skipped: results.filter(result => result.status === 'skip').length,
    warned: results.filter(result => result.status === 'warn').length,
  };
}

function summarizeFeed(feed: SwarmCreateFeedResult): {
  feedId: string;
  owner: string;
  topic: string;
  manifestReference: string;
  identityMode: string | null;
} {
  return {
    feedId: feed.feedId,
    owner: feed.owner,
    topic: feed.topic,
    manifestReference: feed.manifestReference,
    identityMode: feed.identityMode ?? null,
  };
}

function summarizeFeedRead(
  feed: NonNullable<ProviderTestCenterContext['feed']>,
  read: SwarmReadFeedEntryResult,
): unknown {
  return {
    name: feed.name,
    owner: feed.owner,
    topic: feed.topic,
    index: read.index,
    nextIndex: read.nextIndex,
    text: decodeFeedText(read),
  };
}

function summarizeDiagnosticFeedRead(read: SwarmReadFeedEntryResult): {
  index: number;
  nextIndex: number | null;
  text: string;
} {
  return {
    index: read.index,
    nextIndex: read.nextIndex,
    text: decodeFeedText(read),
  };
}

function createSwarmitUserFeedEntry(
  runId: string,
  index: number,
  createdAt: number,
): SwarmitUserFeedEntryFixture {
  return {
    protocol: 'freedom-board/user-feed-entry/v1',
    submissionRef: `bzz://${deriveIdentifier(['swarm-kit:test-center:swarmit-submission', runId, index])}`,
    boardSlug: 'general',
    kind: index % 2 === 0 ? 'post' : 'reply',
    createdAt,
  };
}

function createFeedManifestFixture(runId: string, label: string): FeedManifestFixture {
  const createdAt = Date.now();
  return {
    protocol: 'swarm-kit:test-center:feed-manifest/v1',
    runId,
    label,
    updatedAt: new Date(createdAt).toISOString(),
    entries: [
      {
        submissionRef: `bzz://${deriveIdentifier(['swarm-kit:test-center:feed-manifest-entry', runId, label])}`,
        createdAt,
      },
    ],
  };
}

function feedManifestUrl(feed: SwarmCreateFeedResult): string {
  if (feed.bzzUrl) return feed.bzzUrl;
  assertHex(feed.manifestReference, 32, 'feed manifest reference');
  return `bzz://${feed.manifestReference}/`;
}

function assertFeedManifestFixture(value: unknown, expectedLabel: string): asserts value is FeedManifestFixture {
  assertCondition(isRecord(value), 'resolved feed manifest value must be an object');
  assertEqual(value.protocol, 'swarm-kit:test-center:feed-manifest/v1', 'feed manifest protocol');
  assertEqual(value.label, expectedLabel, 'feed manifest label');
  assertCondition(typeof value.runId === 'string' && value.runId.length > 0, 'feed manifest runId must be a non-empty string');
  assertCondition(typeof value.updatedAt === 'string' && value.updatedAt.length > 0, 'feed manifest updatedAt must be a non-empty string');
  assertCondition(Array.isArray(value.entries) && value.entries.length === 1, 'feed manifest entries must contain one item');
  const entry = value.entries[0];
  assertCondition(isRecord(entry), 'feed manifest entry must be an object');
  assertCondition(typeof entry.submissionRef === 'string' && entry.submissionRef.startsWith('bzz://'), 'feed manifest entry submissionRef must be bzz://');
  assertCondition(typeof entry.createdAt === 'number' && Number.isSafeInteger(entry.createdAt), 'feed manifest entry createdAt must be a safe integer');
}

function summarizeIndexedSocEntry(entry: IndexedSocStreamEntry<TestEnvelope>): unknown {
  return {
    owner: entry.owner,
    identifier: entry.identifier,
    reference: entry.reference,
    envelope: entry.envelope,
  };
}

function summarizeValue(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'object') return value;
  const summarized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    summarized[key] = typeof item === 'string' && item.length > 96
      ? `${item.slice(0, 96)}...`
      : item;
  }
  return summarized;
}

function serializeProviderTestError(error: unknown): SerializedProviderTestError {
  const providerError = error as SwarmProviderErrorLike & { name?: string };
  const serialized: SerializedProviderTestError = {
    message: providerError?.message ?? String(error),
  };
  if (providerError?.name !== undefined) serialized.name = providerError.name;
  if (providerError?.code !== undefined) serialized.code = providerError.code;
  const reason = getSwarmErrorReason(error);
  if (reason !== undefined) serialized.reason = reason;
  if (providerError?.data !== undefined) serialized.data = providerError.data;
  const details = (error as { details?: unknown } | undefined)?.details;
  if (details !== undefined) serialized.details = details;
  return serialized;
}

function requireCac(context: ProviderTestCenterContext): NonNullable<ProviderTestCenterContext['cac']> {
  if (!context.cac) throw new Error('CAC suite did not produce a reference');
  return context.cac;
}

function requireSoc(context: ProviderTestCenterContext): NonNullable<ProviderTestCenterContext['soc']> {
  if (!context.soc) throw new Error('SOC suite did not produce a reference');
  return context.soc;
}

function requireFeed(context: ProviderTestCenterContext): NonNullable<ProviderTestCenterContext['feed']> {
  if (!context.feed) throw new Error('Feed suite did not create a feed');
  return context.feed;
}

function requireFeedWrite(
  feed: NonNullable<ProviderTestCenterContext['feed']>,
  index: number,
): { index: number; text: string } {
  const write = feed.writes.find(item => item.index === index);
  if (!write) throw new Error(`Feed write at index ${index} is not available`);
  return write;
}

function decodeFeedText(read: SwarmReadFeedEntryResult): string {
  return bytesToUtf8(base64ToBytes(read.data));
}

function decodeFeedJson<T>(read: SwarmReadFeedEntryResult): T {
  return JSON.parse(decodeFeedText(read)) as T;
}

function payloadOfSize(size: number, seed: string): string {
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error(`Payload size must be a non-negative safe integer: ${size}`);
  }
  if (size === 0) return '';
  const pattern = `${seed}|`;
  return pattern.repeat(Math.ceil(size / pattern.length)).slice(0, size);
}

function feedPayload(runId: string, label: string): string {
  return JSON.stringify({
    type: 'swarm-kit:test-center:feed-payload',
    runId,
    label,
  });
}

function feedName(runId: string, label: string): string {
  return `sk-test-${label}-${runId}`.slice(0, 64);
}

function missingReference(runId: string, tag: string): string {
  return deriveIdentifier(['swarm-kit:test-center:missing', runId, tag]);
}

function createRunId(): string {
  return deriveIdentifier(['swarm-kit:test-center:run', randomBytes(16)]).slice(0, 16);
}

function randomBytes(length: number): Uint8Array {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.getRandomValues) {
    throw new Error('crypto.getRandomValues is required');
  }
  const bytes = new Uint8Array(length);
  cryptoObject.getRandomValues(bytes);
  return bytes;
}

function assertOwner(owner: string): void {
  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) {
    throw new Error(`Invalid owner: ${owner}`);
  }
}

function assertHex(value: string, bytes: number, label: string): void {
  const normalized = value.replace(/^0x/, '');
  if (normalized.length !== bytes * 2 || !/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error(`${label} must be ${bytes * 2} hex characters`);
  }
}

function assertSameLower(actual: string, expected: string, label: string): void {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${label} mismatch: expected ${expected}, received ${actual}`);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isWarning(value: unknown): value is WarningDetails {
  return Boolean(value && typeof value === 'object' && (value as WarningDetails).warning === true);
}

function now(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function elapsed(started: number): number {
  return Math.max(0, Math.round((now() - started) * 10) / 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
