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
export type PublicEncryptionKey = CryptoKey;
export type PrivateEncryptionKey = CryptoKey;
export type PublicEncryptionKeyInput = PublicEncryptionKey | JsonWebKey;
export type PrivateEncryptionKeyInput = PrivateEncryptionKey | JsonWebKey;
export type PasswordHashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

export interface EncryptionKeyPairOptions {
  extractable?: boolean;
}

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

export interface PublicKeyEncryptedBytesEnvelope {
  version: 1;
  type: 'swarm-kit:public-key-encrypted-bytes';
  algorithm: 'ECDH-P256-HKDF-SHA-256-AES-GCM';
  keyAgreement: 'ECDH-P256';
  kdf: 'HKDF-SHA-256';
  contentEncryption: 'AES-GCM';
  ephemeralPublicKey: JsonWebKey;
  salt: string;
  nonce: string;
  ciphertext: string;
  plaintextSize: number;
}

export interface PublishPublicKeyEncryptedObjectResult extends PublishObjectResult {
  plaintextSize: number;
  ciphertextSize: number;
  envelope: PublicKeyEncryptedBytesEnvelope;
}

const AES_GCM = 'AES-GCM';
const ECDH = 'ECDH';
const ECDH_NAMED_CURVE = 'P-256';
const HKDF = 'HKDF';
const AES_KEY_LENGTH = 256;
const NONCE_BYTES = 12;
const SALT_BYTES = 16;
const DEFAULT_PBKDF2_ITERATIONS = 210_000;
const DEFAULT_PBKDF2_HASH: PasswordHashAlgorithm = 'SHA-256';
const PUBLIC_KEY_ENCRYPTION_ALGORITHM = 'ECDH-P256-HKDF-SHA-256-AES-GCM';
const PUBLIC_KEY_INFO = utf8ToBytes('swarm-kit:public-key-encryption:v1');

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

export async function generateEncryptionKeyPair(
  options: EncryptionKeyPairOptions = {},
): Promise<CryptoKeyPair> {
  return getSubtle().generateKey(
    { name: ECDH, namedCurve: ECDH_NAMED_CURVE },
    options.extractable ?? true,
    ['deriveBits'],
  );
}

export async function exportPublicEncryptionKey(key: PublicEncryptionKey): Promise<JsonWebKey> {
  return getSubtle().exportKey('jwk', key);
}

export async function importPublicEncryptionKey(key: JsonWebKey): Promise<PublicEncryptionKey> {
  return getSubtle().importKey(
    'jwk',
    key,
    { name: ECDH, namedCurve: ECDH_NAMED_CURVE },
    true,
    [],
  );
}

export async function exportPrivateEncryptionKey(key: PrivateEncryptionKey): Promise<JsonWebKey> {
  return getSubtle().exportKey('jwk', key);
}

export async function importPrivateEncryptionKey(
  key: JsonWebKey,
  options: EncryptionKeyPairOptions = {},
): Promise<PrivateEncryptionKey> {
  return getSubtle().importKey(
    'jwk',
    key,
    { name: ECDH, namedCurve: ECDH_NAMED_CURVE },
    options.extractable ?? true,
    ['deriveBits'],
  );
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

export async function encryptBytesFor(
  bytes: BytesLike,
  recipientPublicKey: PublicEncryptionKeyInput,
): Promise<PublicKeyEncryptedBytesEnvelope> {
  const plaintext = normalizeBytes(bytes);
  const publicKey = await resolvePublicEncryptionKey(recipientPublicKey);
  const ephemeral = await generateEncryptionKeyPair({ extractable: true });
  const salt = randomBytes(SALT_BYTES);
  const nonce = randomBytes(NONCE_BYTES);
  const contentKey = await derivePublicKeyContentKey(ephemeral.privateKey, publicKey, salt);
  const ciphertext = new Uint8Array(await getSubtle().encrypt(
    { name: AES_GCM, iv: toArrayBuffer(nonce) },
    contentKey,
    toArrayBuffer(plaintext),
  ));

  return {
    version: 1,
    type: 'swarm-kit:public-key-encrypted-bytes',
    algorithm: PUBLIC_KEY_ENCRYPTION_ALGORITHM,
    keyAgreement: 'ECDH-P256',
    kdf: 'HKDF-SHA-256',
    contentEncryption: 'AES-GCM',
    ephemeralPublicKey: await exportPublicEncryptionKey(ephemeral.publicKey),
    salt: bytesToBase64(salt),
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
    plaintextSize: plaintext.length,
  };
}

export async function decryptBytesFrom(
  envelope: PublicKeyEncryptedBytesEnvelope,
  recipientPrivateKey: PrivateEncryptionKeyInput,
): Promise<Uint8Array> {
  validatePublicKeyEncryptedEnvelope(envelope);
  const privateKey = await resolvePrivateEncryptionKey(recipientPrivateKey);
  const ephemeralPublicKey = await importPublicEncryptionKey(envelope.ephemeralPublicKey);
  const contentKey = await derivePublicKeyContentKey(
    privateKey,
    ephemeralPublicKey,
    base64ToBytes(envelope.salt),
  );
  const plaintext = new Uint8Array(await getSubtle().decrypt(
    { name: AES_GCM, iv: toArrayBuffer(base64ToBytes(envelope.nonce)) },
    contentKey,
    toArrayBuffer(base64ToBytes(envelope.ciphertext)),
  ));
  if (plaintext.length !== envelope.plaintextSize) {
    throw new Error('Public-key encrypted object plaintext size mismatch');
  }
  return plaintext;
}

export async function encryptTextFor(
  text: string,
  recipientPublicKey: PublicEncryptionKeyInput,
): Promise<PublicKeyEncryptedBytesEnvelope> {
  return encryptBytesFor(utf8ToBytes(text), recipientPublicKey);
}

export async function decryptTextFrom(
  envelope: PublicKeyEncryptedBytesEnvelope,
  recipientPrivateKey: PrivateEncryptionKeyInput,
): Promise<string> {
  return bytesToUtf8(await decryptBytesFrom(envelope, recipientPrivateKey));
}

export async function encryptJsonFor(
  value: unknown,
  recipientPublicKey: PublicEncryptionKeyInput,
): Promise<PublicKeyEncryptedBytesEnvelope> {
  return encryptBytesFor(jsonToBytes(value), recipientPublicKey);
}

export async function decryptJsonFrom<T = unknown>(
  envelope: PublicKeyEncryptedBytesEnvelope,
  recipientPrivateKey: PrivateEncryptionKeyInput,
): Promise<T> {
  return bytesToJson<T>(await decryptBytesFrom(envelope, recipientPrivateKey));
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

export async function publishEncryptedBytesFor(
  provider: SwarmProvider,
  bytes: BytesLike,
  recipientPublicKey: PublicEncryptionKeyInput,
  options: ObjectPublishOptions = {},
): Promise<PublishPublicKeyEncryptedObjectResult> {
  const envelope = await encryptBytesFor(bytes, recipientPublicKey);
  return publishPublicKeyEncryptedEnvelope(provider, envelope, options);
}

export async function readEncryptedBytesFrom(
  provider: SwarmProvider,
  reference: string,
  recipientPrivateKey: PrivateEncryptionKeyInput,
  options: ObjectReadOptions = {},
): Promise<Uint8Array> {
  return decryptBytesFrom(await readPublicKeyEncryptedEnvelope(provider, reference, options), recipientPrivateKey);
}

export async function publishEncryptedTextFor(
  provider: SwarmProvider,
  text: string,
  recipientPublicKey: PublicEncryptionKeyInput,
  options: ObjectPublishOptions = {},
): Promise<PublishPublicKeyEncryptedObjectResult> {
  const envelope = await encryptTextFor(text, recipientPublicKey);
  return publishPublicKeyEncryptedEnvelope(provider, envelope, options);
}

export async function readEncryptedTextFrom(
  provider: SwarmProvider,
  reference: string,
  recipientPrivateKey: PrivateEncryptionKeyInput,
  options: ObjectReadOptions = {},
): Promise<string> {
  return decryptTextFrom(await readPublicKeyEncryptedEnvelope(provider, reference, options), recipientPrivateKey);
}

export async function publishEncryptedJsonFor(
  provider: SwarmProvider,
  value: unknown,
  recipientPublicKey: PublicEncryptionKeyInput,
  options: ObjectPublishOptions = {},
): Promise<PublishPublicKeyEncryptedObjectResult> {
  const envelope = await encryptJsonFor(value, recipientPublicKey);
  return publishPublicKeyEncryptedEnvelope(provider, envelope, options);
}

export async function readEncryptedJsonFrom<T = unknown>(
  provider: SwarmProvider,
  reference: string,
  recipientPrivateKey: PrivateEncryptionKeyInput,
  options: ObjectReadOptions = {},
): Promise<T> {
  return decryptJsonFrom<T>(await readPublicKeyEncryptedEnvelope(provider, reference, options), recipientPrivateKey);
}

export async function readPublicKeyEncryptedEnvelope(
  provider: SwarmProvider,
  reference: string,
  options: ObjectReadOptions = {},
): Promise<PublicKeyEncryptedBytesEnvelope> {
  const envelope = await readObjectJson<PublicKeyEncryptedBytesEnvelope>(provider, reference, options);
  validatePublicKeyEncryptedEnvelope(envelope);
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

function publishPublicKeyEncryptedEnvelope(
  provider: SwarmProvider,
  envelope: PublicKeyEncryptedBytesEnvelope,
  options: ObjectPublishOptions,
): Promise<PublishPublicKeyEncryptedObjectResult> {
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

function validatePublicKeyEncryptedEnvelope(envelope: PublicKeyEncryptedBytesEnvelope): void {
  if (
    envelope.version !== 1 ||
    envelope.type !== 'swarm-kit:public-key-encrypted-bytes' ||
    envelope.algorithm !== PUBLIC_KEY_ENCRYPTION_ALGORITHM ||
    envelope.keyAgreement !== 'ECDH-P256' ||
    envelope.kdf !== 'HKDF-SHA-256' ||
    envelope.contentEncryption !== 'AES-GCM' ||
    !isP256PublicJwk(envelope.ephemeralPublicKey) ||
    typeof envelope.salt !== 'string' ||
    base64ToBytes(envelope.salt).length !== SALT_BYTES ||
    typeof envelope.nonce !== 'string' ||
    base64ToBytes(envelope.nonce).length !== NONCE_BYTES ||
    typeof envelope.ciphertext !== 'string' ||
    typeof envelope.plaintextSize !== 'number' ||
    !Number.isSafeInteger(envelope.plaintextSize) ||
    envelope.plaintextSize < 0
  ) {
    throw new Error('Invalid public-key encrypted object envelope');
  }
}

async function derivePublicKeyContentKey(
  privateKey: PrivateEncryptionKey,
  publicKey: PublicEncryptionKey,
  salt: Uint8Array,
): Promise<EncryptionKey> {
  const sharedSecret = new Uint8Array(await getSubtle().deriveBits(
    { name: ECDH, public: publicKey },
    privateKey,
    AES_KEY_LENGTH,
  ));
  const hkdfKey = await getSubtle().importKey(
    'raw',
    toArrayBuffer(sharedSecret),
    HKDF,
    false,
    ['deriveKey'],
  );
  return getSubtle().deriveKey(
    {
      name: HKDF,
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      info: toArrayBuffer(PUBLIC_KEY_INFO),
    },
    hkdfKey,
    { name: AES_GCM, length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function resolvePublicEncryptionKey(key: PublicEncryptionKeyInput): Promise<PublicEncryptionKey> {
  return isCryptoKey(key) ? key : importPublicEncryptionKey(key);
}

async function resolvePrivateEncryptionKey(key: PrivateEncryptionKeyInput): Promise<PrivateEncryptionKey> {
  return isCryptoKey(key) ? key : importPrivateEncryptionKey(key);
}

function isCryptoKey(key: PublicEncryptionKeyInput | PrivateEncryptionKeyInput): key is CryptoKey {
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
    key.crv === ECDH_NAMED_CURVE &&
    typeof key.x === 'string' &&
    typeof key.y === 'string'
  );
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
