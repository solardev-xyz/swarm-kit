import { base64ToBytes, bytesToBase64, bytesToHex, bytesToJson, hexToBytes, jsonToBytes, normalizeBytes } from './bytes.js';
import { canonicalJson } from './canonical.js';
import { deriveIdentifier } from './identifiers.js';
import {
  publishObjectJson,
  readObjectJson,
  type ObjectPublishOptions,
  type ObjectReadOptions,
  type PublishObjectResult,
} from './objects.js';
import type { SwarmKitDriverInput } from './driver.js';
import { verifyMessage, type Address, type Hex } from 'viem';

export type SignatureBytes = Uint8Array | ArrayBuffer;
export type MaybePromise<T> = T | Promise<T>;

export interface SignedDocumentSigner {
  id: string;
  scheme: string;
  publicKey?: JsonWebKey;
  sign: (bytes: Uint8Array) => MaybePromise<SignatureBytes>;
}

export interface SignedDocumentVerifier {
  verify: (input: SignedDocumentVerificationInput) => MaybePromise<boolean>;
}

export interface SignedDocumentVerificationInput {
  envelope: SignedDocumentEnvelope;
  bytes: Uint8Array;
  signature: Uint8Array;
}

export interface SignedDocumentOptions {
  subject: string;
  signer: SignedDocumentSigner;
  signedAt?: Date | string;
}

export interface SignedDocumentPayload<T = unknown> {
  version: 1;
  type: 'swarm-kit:signed-document-payload';
  subject: string;
  signedAt: string;
  payload: T;
}

export interface SignedDocumentSignature {
  scheme: string;
  signer: string;
  encoding: 'base64';
  value: string;
  publicKey?: JsonWebKey;
}

export interface SignedDocumentEnvelope<T = unknown> extends SignedDocumentPayload<T> {
  signature: SignedDocumentSignature;
}

export interface PublishSignedDocumentResult<T = unknown> extends PublishObjectResult {
  envelope: SignedDocumentEnvelope<T>;
}

export interface P256DocumentSignerOptions {
  id?: string;
  publicKey?: JsonWebKey;
}

export interface P256DocumentVerifierOptions {
  signer?: string;
  publicKey?: CryptoKey | JsonWebKey;
}

export interface Eip1193Provider {
  request: <T = unknown>(request: { method: string; params?: unknown[] }) => Promise<T>;
}

export interface Eip1193PersonalSignerOptions {
  address: string;
}

export type Eip191PersonalRecoverAddress = (
  message: Uint8Array,
  signature: Uint8Array,
) => MaybePromise<string>;

export interface EthereumPersonalVerifierOptions {
  address?: string;
}

const SIGNED_DOCUMENT_PAYLOAD_TYPE = 'swarm-kit:signed-document-payload';
const SIGNED_DOCUMENT_SIGNATURE_ENCODING = 'base64';
const P256_SIGNATURE_SCHEME = 'ECDSA-P256-SHA-256';
const EIP_191_PERSONAL_SIGN_SCHEME = 'EIP-191-PERSONAL-SIGN';
const ECDSA = 'ECDSA';
const P256_NAMED_CURVE = 'P-256';

export async function signDocument<T>(
  payload: T,
  options: SignedDocumentOptions,
): Promise<SignedDocumentEnvelope<T>> {
  const unsigned = createSignedDocumentPayload(payload, options);
  const bytes = signedDocumentPayloadBytes(unsigned);
  const signature = normalizeSignatureBytes(await options.signer.sign(bytes));
  const envelope: SignedDocumentEnvelope<T> = {
    ...unsigned,
    signature: {
      scheme: options.signer.scheme,
      signer: options.signer.id,
      encoding: SIGNED_DOCUMENT_SIGNATURE_ENCODING,
      value: bytesToBase64(signature),
    },
  };
  if (options.signer.publicKey !== undefined) {
    envelope.signature.publicKey = options.signer.publicKey;
  }
  validateSignedDocumentEnvelope(envelope);
  return envelope;
}

export async function verifySignedDocument(
  envelope: SignedDocumentEnvelope,
  verifier: SignedDocumentVerifier,
): Promise<boolean> {
  validateSignedDocumentEnvelope(envelope);
  return verifier.verify({
    envelope,
    bytes: signedDocumentPayloadBytes(envelope),
    signature: base64ToBytes(envelope.signature.value),
  });
}

export async function assertSignedDocument(
  envelope: SignedDocumentEnvelope,
  verifier: SignedDocumentVerifier,
): Promise<SignedDocumentEnvelope> {
  if (!(await verifySignedDocument(envelope, verifier))) {
    throw new Error('Signed document verification failed');
  }
  return envelope;
}

export function signedDocumentPayloadBytes(payload: SignedDocumentPayload): Uint8Array {
  return jsonToBytes(JSON.parse(canonicalJson(toUnsignedPayload(payload))));
}

export async function publishSignedDocument<T>(
  provider: SwarmKitDriverInput,
  payload: T,
  options: SignedDocumentOptions & ObjectPublishOptions,
): Promise<PublishSignedDocumentResult<T>> {
  const envelope = await signDocument(payload, options);
  const published = await publishObjectJson(provider, envelope, options);
  return {
    ...published,
    envelope,
  };
}

export async function readSignedDocument<T = unknown>(
  provider: SwarmKitDriverInput,
  reference: string,
  options: ObjectReadOptions = {},
): Promise<SignedDocumentEnvelope<T>> {
  const envelope = await readObjectJson<SignedDocumentEnvelope<T>>(provider, reference, options);
  validateSignedDocumentEnvelope(envelope);
  return envelope;
}

export async function readAndVerifySignedDocument<T = unknown>(
  provider: SwarmKitDriverInput,
  reference: string,
  verifier: SignedDocumentVerifier,
  options: ObjectReadOptions = {},
): Promise<SignedDocumentEnvelope<T>> {
  const envelope = await readSignedDocument<T>(provider, reference, options);
  await assertSignedDocument(envelope, verifier);
  return envelope;
}

export async function generateP256SigningKeyPair(extractable = true): Promise<CryptoKeyPair> {
  return getSubtle().generateKey(
    { name: ECDSA, namedCurve: P256_NAMED_CURVE },
    extractable,
    ['sign', 'verify'],
  );
}

export async function exportP256PublicSigningKey(key: CryptoKey): Promise<JsonWebKey> {
  return getSubtle().exportKey('jwk', key);
}

export async function importP256PublicSigningKey(key: JsonWebKey): Promise<CryptoKey> {
  return getSubtle().importKey(
    'jwk',
    key,
    { name: ECDSA, namedCurve: P256_NAMED_CURVE },
    true,
    ['verify'],
  );
}

export async function exportP256PrivateSigningKey(key: CryptoKey): Promise<JsonWebKey> {
  return getSubtle().exportKey('jwk', key);
}

export async function importP256PrivateSigningKey(key: JsonWebKey, extractable = true): Promise<CryptoKey> {
  return getSubtle().importKey(
    'jwk',
    key,
    { name: ECDSA, namedCurve: P256_NAMED_CURVE },
    extractable,
    ['sign'],
  );
}

export async function createP256DocumentSigner(
  keyPair: CryptoKeyPair,
  options: P256DocumentSignerOptions = {},
): Promise<SignedDocumentSigner> {
  const publicKey = options.publicKey ?? await exportP256PublicSigningKey(keyPair.publicKey);
  return {
    id: options.id ?? p256PublicKeyId(publicKey),
    scheme: P256_SIGNATURE_SCHEME,
    publicKey,
    sign: bytes => getSubtle().sign(
      { name: ECDSA, hash: 'SHA-256' },
      keyPair.privateKey,
      toArrayBuffer(bytes),
    ),
  };
}

export function createP256DocumentVerifier(
  options: P256DocumentVerifierOptions = {},
): SignedDocumentVerifier {
  return {
    verify: async ({ envelope, bytes, signature }) => {
      if (envelope.signature.scheme !== P256_SIGNATURE_SCHEME) return false;
      if (options.signer !== undefined && envelope.signature.signer !== options.signer) return false;
      const publicKey = await resolveP256PublicSigningKey(options.publicKey ?? envelope.signature.publicKey);
      if (!publicKey) return false;
      return getSubtle().verify(
        { name: ECDSA, hash: 'SHA-256' },
        publicKey,
        toArrayBuffer(signature),
        toArrayBuffer(bytes),
      );
    },
  };
}

export function createEip1193PersonalSigner(
  provider: Eip1193Provider,
  options: Eip1193PersonalSignerOptions,
): SignedDocumentSigner {
  const address = normalizeAddress(options.address);
  return {
    id: address,
    scheme: EIP_191_PERSONAL_SIGN_SCHEME,
    sign: async bytes => {
      const signature = await provider.request<string>({
        method: 'personal_sign',
        params: [`0x${bytesToHex(bytes)}`, address],
      });
      return hexToBytes(signature);
    },
  };
}

export function createEip191PersonalVerifier(
  recoverAddress: Eip191PersonalRecoverAddress,
  expectedAddress?: string,
): SignedDocumentVerifier {
  const normalizedExpected = expectedAddress ? normalizeAddress(expectedAddress) : null;
  return {
    verify: async ({ envelope, bytes, signature }) => {
      if (envelope.signature.scheme !== EIP_191_PERSONAL_SIGN_SCHEME) return false;
      const recovered = normalizeAddress(await recoverAddress(bytes, signature));
      const signer = normalizeAddress(envelope.signature.signer);
      return recovered === signer && (normalizedExpected === null || recovered === normalizedExpected);
    },
  };
}

export function createEthereumPersonalVerifier(
  options: EthereumPersonalVerifierOptions = {},
): SignedDocumentVerifier {
  const expected = options.address ? normalizeAddress(options.address) : null;
  return {
    verify: async ({ envelope, bytes, signature }) => {
      if (envelope.signature.scheme !== EIP_191_PERSONAL_SIGN_SCHEME) return false;
      const signer = normalizeAddress(envelope.signature.signer);
      if (expected !== null && signer !== expected) return false;
      return verifyMessage({
        address: signer as Address,
        message: { raw: bytes },
        signature: `0x${bytesToHex(signature)}` as Hex,
      });
    },
  };
}

function createSignedDocumentPayload<T>(
  payload: T,
  options: SignedDocumentOptions,
): SignedDocumentPayload<T> {
  return {
    version: 1,
    type: SIGNED_DOCUMENT_PAYLOAD_TYPE,
    subject: normalizeSubject(options.subject),
    signedAt: normalizeSignedAt(options.signedAt),
    payload,
  };
}

function toUnsignedPayload<T>(payload: SignedDocumentPayload<T>): SignedDocumentPayload<T> {
  return {
    version: 1,
    type: SIGNED_DOCUMENT_PAYLOAD_TYPE,
    subject: normalizeSubject(payload.subject),
    signedAt: normalizeSignedAt(payload.signedAt),
    payload: payload.payload,
  };
}

function validateSignedDocumentEnvelope(envelope: SignedDocumentEnvelope): void {
  if (
    envelope.version !== 1 ||
    envelope.type !== SIGNED_DOCUMENT_PAYLOAD_TYPE ||
    typeof envelope.subject !== 'string' ||
    !envelope.subject.trim() ||
    typeof envelope.signedAt !== 'string' ||
    Number.isNaN(Date.parse(envelope.signedAt)) ||
    envelope.signature?.encoding !== SIGNED_DOCUMENT_SIGNATURE_ENCODING ||
    typeof envelope.signature.scheme !== 'string' ||
    !envelope.signature.scheme.trim() ||
    typeof envelope.signature.signer !== 'string' ||
    !envelope.signature.signer.trim() ||
    typeof envelope.signature.value !== 'string'
  ) {
    throw new Error('Invalid signed document envelope');
  }
  base64ToBytes(envelope.signature.value);
}

function normalizeSignatureBytes(signature: SignatureBytes): Uint8Array {
  return normalizeBytes(signature);
}

async function resolveP256PublicSigningKey(key: CryptoKey | JsonWebKey | undefined): Promise<CryptoKey | null> {
  if (!key) return null;
  if (isCryptoKey(key)) return key;
  if (!isP256PublicJwk(key)) return null;
  return importP256PublicSigningKey(key);
}

function isCryptoKey(key: CryptoKey | JsonWebKey): key is CryptoKey {
  return (
    typeof key === 'object' &&
    key !== null &&
    'algorithm' in key &&
    'extractable' in key &&
    'type' in key &&
    'usages' in key
  );
}

function isP256PublicJwk(key: JsonWebKey): boolean {
  return (
    key !== null &&
    typeof key === 'object' &&
    key.kty === 'EC' &&
    key.crv === P256_NAMED_CURVE &&
    typeof key.x === 'string' &&
    typeof key.y === 'string'
  );
}

function p256PublicKeyId(publicKey: JsonWebKey): string {
  return `p256:${deriveIdentifier(['swarm-kit:p256-public-signing-key', canonicalJson(publicKey)]).slice(0, 40)}`;
}

function normalizeSubject(subject: string): string {
  const normalized = subject.trim();
  if (!normalized) throw new Error('Signed document subject must not be empty');
  return normalized;
}

function normalizeSignedAt(signedAt: Date | string | undefined): string {
  const normalized = signedAt === undefined
    ? new Date()
    : signedAt instanceof Date
      ? signedAt
      : new Date(signedAt);
  if (Number.isNaN(normalized.getTime())) {
    throw new Error('Signed document signedAt must be a valid date');
  }
  return normalized.toISOString();
}

function normalizeAddress(address: string): string {
  const normalized = String(address).trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
    throw new Error('Ethereum address must be 0x-prefixed with 40 hex characters');
  }
  return `0x${normalized.slice(2).toLowerCase()}`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function getCrypto(): Crypto {
  if (!globalThis.crypto) {
    throw new Error('Web Crypto is not available in this environment');
  }
  return globalThis.crypto;
}

function getSubtle(): SubtleCrypto {
  const subtle = getCrypto().subtle;
  if (!subtle) {
    throw new Error('Web Crypto subtle API is not available in this environment');
  }
  return subtle;
}
