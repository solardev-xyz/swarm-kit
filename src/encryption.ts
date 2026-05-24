import {
  base64ToBytes,
  bytesToBase64,
  bytesToJson,
  bytesToUtf8,
  jsonToBytes,
  normalizeBytes,
  utf8ToBytes,
  type BytesLike,
} from './bytes.js';
import {
  publishObjectJson,
  readObjectJson,
  type ObjectPublishOptions,
  type ObjectReadOptions,
  type PublishObjectResult,
} from './objects.js';
import type { SwarmProvider } from './provider.js';

export type EncryptionKey = CryptoKey;
export type PasswordHashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

export interface PasswordKeyOptions {
  salt?: string | Uint8Array | ArrayBuffer;
  iterations?: number;
  hash?: PasswordHashAlgorithm;
}

export interface DerivedEncryptionKey {
  key: EncryptionKey;
  salt: string;
  iterations: number;
  hash: PasswordHashAlgorithm;
}

export interface EncryptedBytesEnvelope {
  version: 1;
  type: 'swarm-kit:encrypted-bytes';
  algorithm: 'AES-GCM';
  keyLength: 256;
  nonce: string;
  ciphertext: string;
  plaintextSize: number;
}

export interface PublishEncryptedObjectResult extends PublishObjectResult {
  plaintextSize: number;
  ciphertextSize: number;
  envelope: EncryptedBytesEnvelope;
}

const AES_GCM = 'AES-GCM';
const AES_KEY_LENGTH = 256;
const NONCE_BYTES = 12;
const SALT_BYTES = 16;
const DEFAULT_PBKDF2_ITERATIONS = 210_000;
const DEFAULT_PBKDF2_HASH: PasswordHashAlgorithm = 'SHA-256';

export async function generateEncryptionKey(): Promise<EncryptionKey> {
  return getSubtle().generateKey(
    { name: AES_GCM, length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function exportEncryptionKey(key: EncryptionKey): Promise<string> {
  return bytesToBase64(new Uint8Array(await getSubtle().exportKey('raw', key)));
}

export async function importEncryptionKey(key: string | Uint8Array | ArrayBuffer): Promise<EncryptionKey> {
  const bytes = typeof key === 'string' ? base64ToBytes(key) : normalizeBytes(key);
  if (bytes.length !== 32) {
    throw new Error('AES-GCM keys must be 32 bytes');
  }
  return getSubtle().importKey('raw', toArrayBuffer(bytes), AES_GCM, true, ['encrypt', 'decrypt']);
}

export async function deriveEncryptionKeyFromPassword(
  password: string,
  options: PasswordKeyOptions = {},
): Promise<DerivedEncryptionKey> {
  const saltBytes = options.salt === undefined
    ? randomBytes(SALT_BYTES)
    : typeof options.salt === 'string'
      ? base64ToBytes(options.salt)
      : normalizeBytes(options.salt);
  const iterations = options.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  const hash = options.hash ?? DEFAULT_PBKDF2_HASH;

  if (!Number.isSafeInteger(iterations) || iterations <= 0) {
    throw new Error('PBKDF2 iterations must be a positive safe integer');
  }

  const passwordKey = await getSubtle().importKey(
    'raw',
    toArrayBuffer(utf8ToBytes(password)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await getSubtle().deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(saltBytes),
      iterations,
      hash,
    },
    passwordKey,
    { name: AES_GCM, length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  );

  return {
    key,
    salt: bytesToBase64(saltBytes),
    iterations,
    hash,
  };
}

export async function encryptBytes(
  bytes: BytesLike,
  key: EncryptionKey,
): Promise<EncryptedBytesEnvelope> {
  const plaintext = normalizeBytes(bytes);
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = new Uint8Array(await getSubtle().encrypt(
    { name: AES_GCM, iv: toArrayBuffer(nonce) },
    key,
    toArrayBuffer(plaintext),
  ));

  return {
    version: 1,
    type: 'swarm-kit:encrypted-bytes',
    algorithm: 'AES-GCM',
    keyLength: AES_KEY_LENGTH,
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
    plaintextSize: plaintext.length,
  };
}

export async function decryptBytes(
  envelope: EncryptedBytesEnvelope,
  key: EncryptionKey,
): Promise<Uint8Array> {
  validateEncryptedEnvelope(envelope);
  const plaintext = new Uint8Array(await getSubtle().decrypt(
    { name: AES_GCM, iv: toArrayBuffer(base64ToBytes(envelope.nonce)) },
    key,
    toArrayBuffer(base64ToBytes(envelope.ciphertext)),
  ));
  if (plaintext.length !== envelope.plaintextSize) {
    throw new Error('Encrypted object plaintext size mismatch');
  }
  return plaintext;
}

export async function encryptText(text: string, key: EncryptionKey): Promise<EncryptedBytesEnvelope> {
  return encryptBytes(utf8ToBytes(text), key);
}

export async function decryptText(envelope: EncryptedBytesEnvelope, key: EncryptionKey): Promise<string> {
  return bytesToUtf8(await decryptBytes(envelope, key));
}

export async function encryptJson(value: unknown, key: EncryptionKey): Promise<EncryptedBytesEnvelope> {
  return encryptBytes(jsonToBytes(value), key);
}

export async function decryptJson<T = unknown>(envelope: EncryptedBytesEnvelope, key: EncryptionKey): Promise<T> {
  return bytesToJson<T>(await decryptBytes(envelope, key));
}

export async function publishEncryptedBytes(
  provider: SwarmProvider,
  bytes: BytesLike,
  key: EncryptionKey,
  options: ObjectPublishOptions = {},
): Promise<PublishEncryptedObjectResult> {
  const envelope = await encryptBytes(bytes, key);
  return publishEncryptedEnvelope(provider, envelope, options);
}

export async function readEncryptedBytes(
  provider: SwarmProvider,
  reference: string,
  key: EncryptionKey,
  options: ObjectReadOptions = {},
): Promise<Uint8Array> {
  return decryptBytes(await readEncryptedEnvelope(provider, reference, options), key);
}

export async function publishEncryptedText(
  provider: SwarmProvider,
  text: string,
  key: EncryptionKey,
  options: ObjectPublishOptions = {},
): Promise<PublishEncryptedObjectResult> {
  const envelope = await encryptText(text, key);
  return publishEncryptedEnvelope(provider, envelope, options);
}

export async function readEncryptedText(
  provider: SwarmProvider,
  reference: string,
  key: EncryptionKey,
  options: ObjectReadOptions = {},
): Promise<string> {
  return decryptText(await readEncryptedEnvelope(provider, reference, options), key);
}

export async function publishEncryptedJson(
  provider: SwarmProvider,
  value: unknown,
  key: EncryptionKey,
  options: ObjectPublishOptions = {},
): Promise<PublishEncryptedObjectResult> {
  const envelope = await encryptJson(value, key);
  return publishEncryptedEnvelope(provider, envelope, options);
}

export async function readEncryptedJson<T = unknown>(
  provider: SwarmProvider,
  reference: string,
  key: EncryptionKey,
  options: ObjectReadOptions = {},
): Promise<T> {
  return decryptJson<T>(await readEncryptedEnvelope(provider, reference, options), key);
}

export async function readEncryptedEnvelope(
  provider: SwarmProvider,
  reference: string,
  options: ObjectReadOptions = {},
): Promise<EncryptedBytesEnvelope> {
  const envelope = await readObjectJson<EncryptedBytesEnvelope>(provider, reference, options);
  validateEncryptedEnvelope(envelope);
  return envelope;
}

function publishEncryptedEnvelope(
  provider: SwarmProvider,
  envelope: EncryptedBytesEnvelope,
  options: ObjectPublishOptions,
): Promise<PublishEncryptedObjectResult> {
  return publishObjectJson(provider, envelope, options).then(published => ({
    ...published,
    plaintextSize: envelope.plaintextSize,
    ciphertextSize: base64ToBytes(envelope.ciphertext).length,
    envelope,
  }));
}

function validateEncryptedEnvelope(envelope: EncryptedBytesEnvelope): void {
  if (
    envelope.version !== 1 ||
    envelope.type !== 'swarm-kit:encrypted-bytes' ||
    envelope.algorithm !== 'AES-GCM' ||
    envelope.keyLength !== AES_KEY_LENGTH ||
    typeof envelope.nonce !== 'string' ||
    base64ToBytes(envelope.nonce).length !== NONCE_BYTES ||
    typeof envelope.ciphertext !== 'string' ||
    typeof envelope.plaintextSize !== 'number' ||
    !Number.isSafeInteger(envelope.plaintextSize) ||
    envelope.plaintextSize < 0
  ) {
    throw new Error('Invalid encrypted object envelope');
  }
}

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  getCrypto().getRandomValues(bytes);
  return bytes;
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
