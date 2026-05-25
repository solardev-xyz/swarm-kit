import { bytesToHex, bytesToJson, normalizeBytes, type BytesLike } from './bytes.js';
import { canonicalJson } from './canonical.js';
import type { SwarmKitDriverInput } from './driver.js';
import { SwarmKitError, isSwarmReason } from './errors.js';
import { deriveIdentifier } from './identifiers.js';
import { publishObjectJson, readObjectJson } from './objects.js';
import { getSigningIdentity, readSocBytesByOwnerAndIdentifier, writeSocJson, type ReadSocBytesResult } from './soc.js';
import type { SwarmWriteSingleOwnerChunkResult } from './provider.js';

export interface CommitRevealOptions {
  namespace?: string;
  topic: string;
  round: string;
}

export interface CommitRevealCommitOptions {
  salt?: BytesLike;
  at?: Date | number | string;
}

export interface CommitRevealRevealOptions {
  at?: Date | number | string;
}

export interface CommitRevealCommitEnvelope {
  version: 1;
  type: 'swarm-kit:commit-reveal-commit';
  namespace: string;
  topic: string;
  round: string;
  algorithm: 'keccak256-length-tagged-canonical-json-owner-salt-v1';
  commitment: string;
  committedAt: string;
}

export interface CommitRevealRevealEnvelope {
  version: 1;
  type: 'swarm-kit:commit-reveal-reveal';
  namespace: string;
  topic: string;
  round: string;
  algorithm: 'keccak256-length-tagged-canonical-json-owner-salt-v1';
  commitment: string;
  salt: string;
  valueReference: string;
  valueSize: number;
  revealedAt: string;
}

export interface CommitRevealCommit extends CommitRevealCommitEnvelope {
  owner: string;
  identifier: string;
  reference: string;
}

export interface CommitRevealCommitResult extends CommitRevealCommit {
  salt: string;
  commitWrite: SwarmWriteSingleOwnerChunkResult;
}

export interface CommitRevealReveal<T = unknown> extends CommitRevealRevealEnvelope {
  owner: string;
  identifier: string;
  reference: string;
  value: T;
}

export interface CommitRevealRevealResult<T = unknown> extends CommitRevealReveal<T> {
  revealWrite: SwarmWriteSingleOwnerChunkResult;
}

export interface CommitRevealPair<T = unknown> {
  commit: CommitRevealCommit | null;
  reveal: CommitRevealReveal<T> | null;
  verified: boolean | null;
}

export interface CommitReveal<T = unknown> {
  readonly namespace: string;
  readonly topic: string;
  readonly round: string;
  commitIdentifier(): string;
  revealIdentifier(): string;
  getOwner(): Promise<string>;
  generateSalt(bytes?: number): string;
  commitmentFor(owner: string, value: T, salt: BytesLike): string;
  commit(value: T, options?: CommitRevealCommitOptions): Promise<CommitRevealCommitResult>;
  reveal(value: T, salt: BytesLike, options?: CommitRevealRevealOptions): Promise<CommitRevealRevealResult<T>>;
  readCommit(owner: string): Promise<CommitRevealCommit | null>;
  readReveal(owner: string): Promise<CommitRevealReveal<T> | null>;
  readPair(owner: string): Promise<CommitRevealPair<T>>;
  verify(commit: CommitRevealCommit, reveal: CommitRevealReveal<T>): boolean;
}

export interface CommitRevealCommitmentInput<T = unknown> extends CommitRevealOptions {
  owner: string;
  value: T;
  salt: BytesLike;
}

const DEFAULT_COMMIT_REVEAL_NAMESPACE = 'swarm-kit:commit-reveal:v1';
const COMMIT_ENVELOPE_TYPE = 'swarm-kit:commit-reveal-commit';
const REVEAL_ENVELOPE_TYPE = 'swarm-kit:commit-reveal-reveal';
const COMMITMENT_ALGORITHM = 'keccak256-length-tagged-canonical-json-owner-salt-v1';
const DEFAULT_SALT_BYTES = 32;
const MIN_SALT_BYTES = 16;
const MAX_SALT_BYTES = 64;

export function createCommitReveal<T = unknown>(
  provider: SwarmKitDriverInput,
  options: CommitRevealOptions,
): CommitReveal<T> {
  const normalized = normalizeCommitRevealOptions(options);

  function commitIdentifier(): string {
    return commitRevealCommitIdentifier(normalized);
  }

  function revealIdentifier(): string {
    return commitRevealRevealIdentifier(normalized);
  }

  async function getOwner(): Promise<string> {
    return (await getSigningIdentity(provider)).owner;
  }

  function commitmentFor(owner: string, value: T, salt: BytesLike): string {
    return commitRevealCommitment({ ...normalized, owner, value, salt });
  }

  async function readCommit(owner: string): Promise<CommitRevealCommit | null> {
    try {
      const soc = await readSocBytesByOwnerAndIdentifier(provider, owner, commitIdentifier());
      const envelope = parseCommitEnvelope(bytesToJson<CommitRevealCommitEnvelope>(soc.bytes), normalized);
      return commitFromSoc(envelope, soc);
    } catch (error) {
      if (isSwarmReason(error, 'chunk_not_found')) return null;
      throw error;
    }
  }

  async function readReveal(owner: string): Promise<CommitRevealReveal<T> | null> {
    let soc: ReadSocBytesResult;
    try {
      soc = await readSocBytesByOwnerAndIdentifier(provider, owner, revealIdentifier());
    } catch (error) {
      if (isSwarmReason(error, 'chunk_not_found')) return null;
      throw error;
    }
    const envelope = parseRevealEnvelope(bytesToJson<CommitRevealRevealEnvelope>(soc.bytes), normalized);
    const value = await readObjectJson<T>(provider, envelope.valueReference);
    return revealFromSoc(envelope, soc, value);
  }

  function verify(commit: CommitRevealCommit, reveal: CommitRevealReveal<T>): boolean {
    if (commit.type !== COMMIT_ENVELOPE_TYPE || reveal.type !== REVEAL_ENVELOPE_TYPE) return false;
    if (!sameCommitRevealCoordinates(commit, normalized)) return false;
    if (!sameCommitRevealCoordinates(reveal, normalized)) return false;
    if (commit.algorithm !== COMMITMENT_ALGORITHM || reveal.algorithm !== COMMITMENT_ALGORITHM) return false;
    if (commit.identifier.toLowerCase() !== commitIdentifier().toLowerCase()) return false;
    if (reveal.identifier.toLowerCase() !== revealIdentifier().toLowerCase()) return false;
    if (commit.owner.toLowerCase() !== reveal.owner.toLowerCase()) return false;
    if (commit.commitment !== reveal.commitment) return false;
    return commitmentFor(reveal.owner, reveal.value, reveal.salt) === commit.commitment;
  }

  return {
    namespace: normalized.namespace,
    topic: normalized.topic,
    round: normalized.round,
    commitIdentifier,
    revealIdentifier,
    getOwner,
    generateSalt: generateCommitRevealSalt,
    commitmentFor,
    async commit(value, commitOptions = {}) {
      const owner = await getOwner();
      const salt = normalizeCommitRevealSalt(commitOptions.salt ?? generateCommitRevealSalt());
      const envelope: CommitRevealCommitEnvelope = {
        version: 1,
        type: COMMIT_ENVELOPE_TYPE,
        namespace: normalized.namespace,
        topic: normalized.topic,
        round: normalized.round,
        algorithm: COMMITMENT_ALGORITHM,
        commitment: commitmentFor(owner, value, salt),
        committedAt: normalizeTimestamp(commitOptions.at, 'commit timestamp'),
      };

      const commitWrite = await writeSocJson(provider, commitIdentifier(), envelope);
      const stored = await readCommit(owner);
      if (stored && sameCommitEnvelope(stored, envelope)) {
        return { ...stored, salt, commitWrite };
      }
      throw new SwarmKitError('Commit SOC write collision', { reason: 'soc_write_collision' });
    },
    async reveal(value, saltInput, revealOptions = {}) {
      const owner = await getOwner();
      const salt = normalizeCommitRevealSalt(saltInput);
      const commitment = commitmentFor(owner, value, salt);
      const commit = await readCommit(owner);
      if (!commit) {
        throw new SwarmKitError('Cannot reveal before writing a commit', { reason: 'commit_not_found' });
      }
      if (commit.commitment !== commitment) {
        throw new SwarmKitError('Reveal does not match commit', { reason: 'commitment_mismatch' });
      }

      const publishedValue = await publishObjectJson(provider, value);
      const envelope: CommitRevealRevealEnvelope = {
        version: 1,
        type: REVEAL_ENVELOPE_TYPE,
        namespace: normalized.namespace,
        topic: normalized.topic,
        round: normalized.round,
        algorithm: COMMITMENT_ALGORITHM,
        commitment,
        salt,
        valueReference: publishedValue.reference,
        valueSize: publishedValue.size,
        revealedAt: normalizeTimestamp(revealOptions.at, 'reveal timestamp'),
      };

      const revealWrite = await writeSocJson(provider, revealIdentifier(), envelope);
      const stored = await readReveal(owner);
      if (stored && sameRevealEnvelope(stored, envelope)) {
        return { ...stored, revealWrite };
      }
      throw new SwarmKitError('Reveal SOC write collision', { reason: 'soc_write_collision' });
    },
    readCommit,
    readReveal,
    async readPair(owner) {
      const [commit, reveal] = await Promise.all([readCommit(owner), readReveal(owner)]);
      return {
        commit,
        reveal,
        verified: commit && reveal ? verify(commit, reveal) : null,
      };
    },
    verify,
  };
}

export function commitRevealCommitIdentifier(options: CommitRevealOptions): string {
  const normalized = normalizeCommitRevealOptions(options);
  return deriveIdentifier([normalized.namespace, normalized.topic, normalized.round, 'commit']);
}

export function commitRevealRevealIdentifier(options: CommitRevealOptions): string {
  const normalized = normalizeCommitRevealOptions(options);
  return deriveIdentifier([normalized.namespace, normalized.topic, normalized.round, 'reveal']);
}

export function commitRevealCommitment<T = unknown>(input: CommitRevealCommitmentInput<T>): string {
  const normalized = normalizeCommitRevealOptions(input);
  return deriveIdentifier([
    'swarm-kit:commit-reveal:commitment:v1',
    normalized.namespace,
    normalized.topic,
    normalized.round,
    normalizeOwner(input.owner),
    canonicalJson(input.value, 'commit-reveal value'),
    normalizeCommitRevealSalt(input.salt),
  ]);
}

export function generateCommitRevealSalt(bytes = DEFAULT_SALT_BYTES): string {
  if (!Number.isSafeInteger(bytes) || bytes < MIN_SALT_BYTES || bytes > MAX_SALT_BYTES) {
    throw new Error(`Commit-reveal salt byte length must be between ${MIN_SALT_BYTES} and ${MAX_SALT_BYTES}`);
  }
  const salt = new Uint8Array(bytes);
  getCrypto().getRandomValues(salt);
  return bytesToHex(salt);
}

function commitFromSoc(envelope: CommitRevealCommitEnvelope, soc: ReadSocBytesResult): CommitRevealCommit {
  return {
    ...envelope,
    owner: soc.owner,
    identifier: soc.identifier,
    reference: soc.reference,
  };
}

function revealFromSoc<T>(
  envelope: CommitRevealRevealEnvelope,
  soc: ReadSocBytesResult,
  value: T,
): CommitRevealReveal<T> {
  return {
    ...envelope,
    owner: soc.owner,
    identifier: soc.identifier,
    reference: soc.reference,
    value,
  };
}

function parseCommitEnvelope(
  value: CommitRevealCommitEnvelope,
  options: Required<CommitRevealOptions>,
): CommitRevealCommitEnvelope {
  if (
    value.version !== 1 ||
    value.type !== COMMIT_ENVELOPE_TYPE ||
    value.namespace !== options.namespace ||
    value.topic !== options.topic ||
    value.round !== options.round ||
    value.algorithm !== COMMITMENT_ALGORITHM ||
    !isHex(value.commitment, 32) ||
    typeof value.committedAt !== 'string' ||
    Number.isNaN(Date.parse(value.committedAt))
  ) {
    throw new Error('Invalid commit-reveal commit envelope');
  }
  return value;
}

function parseRevealEnvelope(
  value: CommitRevealRevealEnvelope,
  options: Required<CommitRevealOptions>,
): CommitRevealRevealEnvelope {
  if (
    value.version !== 1 ||
    value.type !== REVEAL_ENVELOPE_TYPE ||
    value.namespace !== options.namespace ||
    value.topic !== options.topic ||
    value.round !== options.round ||
    value.algorithm !== COMMITMENT_ALGORITHM ||
    !isHex(value.commitment, 32) ||
    !isValidSaltHex(value.salt) ||
    typeof value.valueReference !== 'string' ||
    !value.valueReference.trim() ||
    !Number.isSafeInteger(value.valueSize) ||
    value.valueSize < 0 ||
    typeof value.revealedAt !== 'string' ||
    Number.isNaN(Date.parse(value.revealedAt))
  ) {
    throw new Error('Invalid commit-reveal reveal envelope');
  }
  return value;
}

function sameCommitRevealCoordinates(
  value: CommitRevealCommitEnvelope | CommitRevealRevealEnvelope,
  options: Required<CommitRevealOptions>,
): boolean {
  return value.namespace === options.namespace && value.topic === options.topic && value.round === options.round;
}

function sameCommitEnvelope(a: CommitRevealCommitEnvelope, b: CommitRevealCommitEnvelope): boolean {
  return (
    a.version === b.version &&
    a.type === b.type &&
    a.namespace === b.namespace &&
    a.topic === b.topic &&
    a.round === b.round &&
    a.algorithm === b.algorithm &&
    a.commitment === b.commitment &&
    a.committedAt === b.committedAt
  );
}

function sameRevealEnvelope(a: CommitRevealRevealEnvelope, b: CommitRevealRevealEnvelope): boolean {
  return (
    a.version === b.version &&
    a.type === b.type &&
    a.namespace === b.namespace &&
    a.topic === b.topic &&
    a.round === b.round &&
    a.algorithm === b.algorithm &&
    a.commitment === b.commitment &&
    a.salt === b.salt &&
    a.valueReference === b.valueReference &&
    a.valueSize === b.valueSize &&
    a.revealedAt === b.revealedAt
  );
}

function normalizeCommitRevealOptions(options: CommitRevealOptions): Required<CommitRevealOptions> {
  return {
    namespace: normalizeNonEmpty(options.namespace ?? DEFAULT_COMMIT_REVEAL_NAMESPACE, 'commit-reveal namespace'),
    topic: normalizeNonEmpty(options.topic, 'commit-reveal topic'),
    round: normalizeNonEmpty(options.round, 'commit-reveal round'),
  };
}

function normalizeCommitRevealSalt(salt: BytesLike): string {
  const hex = typeof salt === 'string' ? salt.replace(/^0x/, '') : bytesToHex(normalizeBytes(salt));
  if (!isValidSaltHex(hex)) {
    throw new Error(`Commit-reveal salt must be a hex string between ${MIN_SALT_BYTES} and ${MAX_SALT_BYTES} bytes`);
  }
  return hex.toLowerCase();
}

function normalizeTimestamp(value: Date | number | string | undefined, label: string): string {
  const date = value === undefined ? new Date() : value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Commit-reveal ${label} must be a valid date`);
  }
  return date.toISOString();
}

function normalizeOwner(owner: string): string {
  const normalized = owner.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
    throw new Error('Commit-reveal owner must be a 0x-prefixed Ethereum address');
  }
  return `0x${normalized.slice(2).toLowerCase()}`;
}

function normalizeNonEmpty(value: string, label: string): string {
  const normalized = String(value).trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function isHex(value: string, bytes: number): boolean {
  return value.length === bytes * 2 && /^[0-9a-fA-F]+$/.test(value);
}

function isValidSaltHex(value: string): boolean {
  return (
    value.length % 2 === 0 &&
    value.length >= MIN_SALT_BYTES * 2 &&
    value.length <= MAX_SALT_BYTES * 2 &&
    /^[0-9a-fA-F]+$/.test(value)
  );
}

function getCrypto(): Crypto {
  if (!globalThis.crypto) {
    throw new Error('Web Crypto is not available in this environment');
  }
  return globalThis.crypto;
}
