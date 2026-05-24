import { bytesToUtf8, utf8ToBytes } from './bytes.js';
import { publishBytes, readBytes } from './chunks.js';
import { getSwarmErrorReason } from './errors.js';
import { deriveIdentifier } from './identifiers.js';
import { callSwarm, type SwarmCapabilities, type SwarmProvider, type SwarmProviderErrorLike, type SwarmSigningIdentity } from './provider.js';
import { readSocBytesByAddress, readSocBytesByOwnerAndIdentifier, writeSocBytes } from './soc.js';

export type ProviderComplianceStatus = 'pass' | 'fail' | 'skip';

export interface ProviderComplianceOptions {
  runId?: string;
  requestAccess?: boolean;
  includeTypeMismatchTests?: boolean;
  includeUnsupportedOptionsTest?: boolean;
}

export interface ProviderComplianceResult {
  id: string;
  label: string;
  status: ProviderComplianceStatus;
  durationMs: number;
  details?: unknown;
  error?: SerializedProviderError;
}

export interface ProviderComplianceSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface ProviderComplianceReport {
  runId: string;
  startedAt: string;
  finishedAt: string;
  summary: ProviderComplianceSummary;
  results: ProviderComplianceResult[];
}

export interface SerializedProviderError {
  name?: string;
  message: string;
  code?: number;
  reason?: string;
  data?: unknown;
}

interface ProviderComplianceContext {
  runId: string;
  identity?: SwarmSigningIdentity;
  capabilities?: SwarmCapabilities;
  cac?: {
    reference: string;
    payload: Uint8Array;
  };
  soc?: {
    reference: string;
    owner: string;
    identifier: string;
    payload: Uint8Array;
  };
}

interface ProviderComplianceCase {
  id: string;
  label: string;
  enabled?: boolean;
  skipReason?: string;
  run: (context: ProviderComplianceContext) => Promise<unknown>;
}

const DEFAULT_OPTIONS = {
  requestAccess: true,
  includeTypeMismatchTests: true,
  includeUnsupportedOptionsTest: true,
};

export async function runSwarmProviderCompliance(
  provider: SwarmProvider,
  options: ProviderComplianceOptions = {},
): Promise<ProviderComplianceReport> {
  const effective = { ...DEFAULT_OPTIONS, ...options };
  const runId = options.runId ?? createRunId();
  const startedAt = new Date().toISOString();
  const context: ProviderComplianceContext = { runId };
  const cases = createComplianceCases(provider, context, effective);
  const results: ProviderComplianceResult[] = [];

  for (const complianceCase of cases) {
    results.push(await runComplianceCase(complianceCase, context));
  }

  const finishedAt = new Date().toISOString();
  return {
    runId,
    startedAt,
    finishedAt,
    summary: summarizeResults(results),
    results,
  };
}

function createComplianceCases(
  provider: SwarmProvider,
  _context: ProviderComplianceContext,
  options: Required<Omit<ProviderComplianceOptions, 'runId'>> & { runId?: string },
): ProviderComplianceCase[] {
  return [
    {
      id: 'request-access',
      label: 'requestAccess resolves',
      enabled: options.requestAccess,
      skipReason: 'disabled by options',
      run: async () => summarizeValue(await callSwarm(provider, 'swarm_requestAccess')),
    },
    {
      id: 'capabilities-shape',
      label: 'getCapabilities returns provider limits',
      run: async context => {
        const capabilities = await callSwarm<SwarmCapabilities>(provider, 'swarm_getCapabilities');
        if (typeof capabilities.canPublish !== 'boolean') {
          throw new Error('getCapabilities result must include boolean canPublish');
        }
        context.capabilities = capabilities;
        return summarizeCapabilities(capabilities);
      },
    },
    {
      id: 'signing-identity-shape',
      label: 'getSigningIdentity returns an owner',
      run: async context => {
        const identity = await callSwarm<SwarmSigningIdentity>(provider, 'swarm_getSigningIdentity');
        assertOwner(identity.owner);
        context.identity = identity;
        return {
          owner: identity.owner,
          identityMode: identity.identityMode ?? null,
        };
      },
    },
    {
      id: 'cac-roundtrip',
      label: 'publishChunk/readChunk byte roundtrip',
      run: async context => {
        const payload = utf8ToBytes(`swarm-kit provider compliance CAC ${context.runId}`);
        const published = await publishBytes(provider, payload);
        const read = await readBytes(provider, published.reference);
        assertUtf8(read.bytes, bytesToUtf8(payload), 'CAC payload');
        context.cac = {
          reference: published.reference,
          payload,
        };
        return {
          reference: published.reference,
          bytes: payload.length,
        };
      },
    },
    {
      id: 'missing-cac-error',
      label: 'missing CAC returns chunk_not_found',
      run: async context => expectProviderReason(
        () => readBytes(provider, missingReference(context.runId, 'cac')),
        'chunk_not_found',
      ),
    },
    {
      id: 'soc-write-read-address',
      label: 'writeSingleOwnerChunk/read by address roundtrip',
      run: async context => {
        const payload = utf8ToBytes(`swarm-kit provider compliance SOC ${context.runId}`);
        const identifier = deriveIdentifier(['swarm-kit:provider-compliance:soc', context.runId]);
        const written = await writeSocBytes(provider, identifier, payload);
        const read = await readSocBytesByAddress(provider, written.reference);
        assertUtf8(read.bytes, bytesToUtf8(payload), 'SOC payload by address');
        assertSameLower(read.reference, written.reference, 'SOC reference');
        assertSameLower(read.identifier, written.identifier, 'SOC identifier');
        assertSameLower(read.owner, written.owner, 'SOC owner');
        context.soc = {
          reference: written.reference,
          owner: written.owner,
          identifier: written.identifier,
          payload,
        };
        return {
          reference: written.reference,
          owner: written.owner,
          identifier: written.identifier,
          bytes: payload.length,
        };
      },
    },
    {
      id: 'soc-read-owner-identifier',
      label: 'readSingleOwnerChunk by owner and identifier',
      run: async context => {
        const soc = requireSoc(context);
        const read = await readSocBytesByOwnerAndIdentifier(provider, soc.owner, soc.identifier);
        assertUtf8(read.bytes, bytesToUtf8(soc.payload), 'SOC payload by owner and identifier');
        assertSameLower(read.reference, soc.reference, 'SOC reference');
        return {
          reference: read.reference,
          owner: read.owner,
          identifier: read.identifier,
        };
      },
    },
    {
      id: 'missing-soc-owner-identifier-error',
      label: 'missing SOC by owner and identifier returns chunk_not_found',
      run: async context => {
        const owner = context.soc?.owner ?? context.identity?.owner;
        if (!owner) throw new Error('No owner available for missing SOC probe');
        return expectProviderReason(
          () => readSocBytesByOwnerAndIdentifier(provider, owner, missingReference(context.runId, 'soc-owner-identifier')),
          'chunk_not_found',
        );
      },
    },
    {
      id: 'missing-soc-address-error',
      label: 'missing SOC by address returns chunk_not_found',
      run: async context => expectProviderReason(
        () => readSocBytesByAddress(provider, missingReference(context.runId, 'soc-address')),
        'chunk_not_found',
      ),
    },
    {
      id: 'cac-as-soc-type-mismatch',
      label: 'CAC read as SOC returns chunk_type_mismatch',
      enabled: options.includeTypeMismatchTests,
      skipReason: 'type mismatch tests disabled by options',
      run: async context => {
        const cac = requireCac(context);
        return expectProviderReason(
          () => readSocBytesByAddress(provider, cac.reference),
          'chunk_type_mismatch',
        );
      },
    },
    {
      id: 'soc-as-cac-type-mismatch',
      label: 'SOC read as CAC returns chunk_type_mismatch',
      enabled: options.includeTypeMismatchTests,
      skipReason: 'type mismatch tests disabled by options',
      run: async context => {
        const soc = requireSoc(context);
        return expectProviderReason(
          () => readBytes(provider, soc.reference),
          'chunk_type_mismatch',
        );
      },
    },
    {
      id: 'unsupported-options-error',
      label: 'unsupported provider options return unsupported_option',
      enabled: options.includeUnsupportedOptionsTest,
      skipReason: 'unsupported options test disabled by options',
      run: async context => {
        const cac = requireCac(context);
        return expectProviderReason(
          () => callSwarm(provider, 'swarm_readChunk', {
            reference: cac.reference,
            options: { unsupported: true },
          }),
          'unsupported_option',
        );
      },
    },
  ];
}

async function runComplianceCase(
  complianceCase: ProviderComplianceCase,
  context: ProviderComplianceContext,
): Promise<ProviderComplianceResult> {
  const started = now();
  if (complianceCase.enabled === false) {
    return {
      id: complianceCase.id,
      label: complianceCase.label,
      status: 'skip',
      durationMs: elapsed(started),
      details: complianceCase.skipReason ?? 'skipped',
    };
  }

  try {
    const details = await complianceCase.run(context);
    return {
      id: complianceCase.id,
      label: complianceCase.label,
      status: 'pass',
      durationMs: elapsed(started),
      details,
    };
  } catch (error) {
    return {
      id: complianceCase.id,
      label: complianceCase.label,
      status: 'fail',
      durationMs: elapsed(started),
      error: serializeProviderError(error),
    };
  }
}

async function expectProviderReason(
  action: () => Promise<unknown>,
  expectedReason: string,
): Promise<SerializedProviderError> {
  try {
    const value = await action();
    throw new Error(`Expected provider error ${expectedReason}, but call resolved with ${JSON.stringify(summarizeValue(value))}`);
  } catch (error) {
    const reason = getSwarmErrorReason(error);
    if (reason !== expectedReason) {
      const serialized = serializeProviderError(error);
      throw new Error(`Expected provider reason "${expectedReason}", received "${reason ?? 'none'}": ${serialized.message}`);
    }
    return serializeProviderError(error);
  }
}

function summarizeResults(results: ProviderComplianceResult[]): ProviderComplianceSummary {
  return {
    total: results.length,
    passed: results.filter(result => result.status === 'pass').length,
    failed: results.filter(result => result.status === 'fail').length,
    skipped: results.filter(result => result.status === 'skip').length,
  };
}

function summarizeCapabilities(capabilities: SwarmCapabilities): unknown {
  return {
    specVersion: capabilities.specVersion ?? null,
    canPublish: capabilities.canPublish,
    reason: capabilities.reason,
    limits: capabilities.limits ?? null,
  };
}

function summarizeValue(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const summarized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    summarized[key] = typeof item === 'string' && item.length > 96
      ? `${item.slice(0, 96)}...`
      : item;
  }
  return summarized;
}

function serializeProviderError(error: unknown): SerializedProviderError {
  const providerError = error as SwarmProviderErrorLike & { name?: string };
  const serialized: SerializedProviderError = {
    message: providerError?.message ?? String(error),
  };
  if (providerError?.name !== undefined) serialized.name = providerError.name;
  if (providerError?.code !== undefined) serialized.code = providerError.code;
  const reason = getSwarmErrorReason(error);
  if (reason !== undefined) serialized.reason = reason;
  if (providerError?.data !== undefined) serialized.data = providerError.data;
  return serialized;
}

function requireCac(context: ProviderComplianceContext): NonNullable<ProviderComplianceContext['cac']> {
  if (!context.cac) throw new Error('CAC roundtrip did not produce a reference');
  return context.cac;
}

function requireSoc(context: ProviderComplianceContext): NonNullable<ProviderComplianceContext['soc']> {
  if (!context.soc) throw new Error('SOC roundtrip did not produce a reference');
  return context.soc;
}

function assertUtf8(bytes: Uint8Array, expected: string, label: string): void {
  const actual = bytesToUtf8(bytes);
  if (actual !== expected) {
    throw new Error(`${label} mismatch`);
  }
}

function assertSameLower(actual: string, expected: string, label: string): void {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${label} mismatch: expected ${expected}, received ${actual}`);
  }
}

function assertOwner(owner: string): void {
  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) {
    throw new Error(`Invalid signing owner: ${owner}`);
  }
}

function missingReference(runId: string, tag: string): string {
  return deriveIdentifier(['swarm-kit:provider-compliance:missing', runId, tag]);
}

function createRunId(): string {
  return deriveIdentifier(['swarm-kit:provider-compliance:run', randomBytes(16)]).slice(0, 16);
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

function now(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function elapsed(started: number): number {
  return Math.max(0, Math.round((now() - started) * 10) / 10);
}
