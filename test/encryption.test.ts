import { describe, expect, test } from 'vitest';
import {
  decryptJson,
  decryptJsonFrom,
  deriveEncryptionKeyFromPassword,
  encryptJson,
  encryptJsonFor,
  exportEncryptionKey,
  exportPrivateEncryptionKey,
  exportPublicEncryptionKey,
  generateEncryptionKey,
  generateEncryptionKeyPair,
  importEncryptionKey,
  importPrivateEncryptionKey,
  importPublicEncryptionKey,
  publishEncryptedJsonFor,
  readEncryptedJson,
  readEncryptedJsonFrom,
  readEncryptedText,
  createSwarmKit,
  publishEncryptedJson,
  publishEncryptedText,
} from '../src/index.js';
import { MockSwarmProvider } from './mock-provider.js';

describe('encryption helpers', () => {
  test('encrypts and decrypts JSON with a generated key', async () => {
    const key = await generateEncryptionKey();
    const envelope = await encryptJson({ secret: 'hello' }, key);
    const value = await decryptJson<{ secret: string }>(envelope, key);

    expect(envelope.type).toBe('swarm-kit:encrypted-bytes');
    expect(envelope.ciphertext).not.toContain('hello');
    expect(value.secret).toBe('hello');
  });

  test('exports and imports raw AES keys', async () => {
    const key = await generateEncryptionKey();
    const exported = await exportEncryptionKey(key);
    const imported = await importEncryptionKey(exported);
    const envelope = await encryptJson({ ok: true }, key);

    await expect(decryptJson(envelope, imported)).resolves.toEqual({ ok: true });
  });

  test('derives repeatable keys from a password and salt', async () => {
    const first = await deriveEncryptionKeyFromPassword('correct horse', { iterations: 1000 });
    const second = await deriveEncryptionKeyFromPassword('correct horse', {
      salt: first.salt,
      iterations: first.iterations,
      hash: first.hash,
    });
    const envelope = await encryptJson({ private: true }, first.key);

    await expect(decryptJson(envelope, second.key)).resolves.toEqual({ private: true });
  });

  test('publishes and reads encrypted JSON objects', async () => {
    const provider = new MockSwarmProvider();
    const key = await generateEncryptionKey();

    const published = await publishEncryptedJson(provider, { message: 'secret' }, key);
    const read = await readEncryptedJson<{ message: string }>(provider, published.reference, key);

    expect(published.plaintextSize).toBeGreaterThan(0);
    expect(published.ciphertextSize).toBeGreaterThan(published.plaintextSize);
    expect(read.message).toBe('secret');
  });

  test('client exposes encrypted object helpers', async () => {
    const kit = createSwarmKit(new MockSwarmProvider());
    const key = await kit.crypto.generateKey();

    const published = await kit.crypto.publishText('quiet data', key);

    await expect(kit.crypto.readText(published.reference, key)).resolves.toBe('quiet data');
  });

  test('rejects decrypting with the wrong key', async () => {
    const provider = new MockSwarmProvider();
    const key = await generateEncryptionKey();
    const wrongKey = await generateEncryptionKey();
    const published = await publishEncryptedText(provider, 'not yours', key);

    await expect(readEncryptedText(provider, published.reference, wrongKey)).rejects.toThrow();
  });

  test('encrypts JSON to a generated public key pair', async () => {
    const keyPair = await generateEncryptionKeyPair();
    const envelope = await encryptJsonFor({ secret: 'hello' }, keyPair.publicKey);
    const value = await decryptJsonFrom<{ secret: string }>(envelope, keyPair.privateKey);

    expect(envelope.type).toBe('swarm-kit:public-key-encrypted-bytes');
    expect(envelope.algorithm).toBe('ECDH-P256-HKDF-SHA-256-AES-GCM');
    expect(envelope.ciphertext).not.toContain('hello');
    expect(value.secret).toBe('hello');
  });

  test('exports and imports public-key encryption keys as JWK', async () => {
    const keyPair = await generateEncryptionKeyPair();
    const publicKey = await exportPublicEncryptionKey(keyPair.publicKey);
    const privateKey = await exportPrivateEncryptionKey(keyPair.privateKey);
    const envelope = await encryptJsonFor({ ok: true }, publicKey);
    const importedPrivateKey = await importPrivateEncryptionKey(privateKey);

    await expect(decryptJsonFrom(envelope, importedPrivateKey)).resolves.toEqual({ ok: true });
    await expect(decryptJsonFrom(envelope, privateKey)).resolves.toEqual({ ok: true });
    await expect(importPublicEncryptionKey(publicKey)).resolves.toBeTruthy();
  });

  test('accepts caller-provided Web Crypto ECDH keys', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
    const envelope = await encryptJsonFor({ provided: true }, keyPair.publicKey);

    await expect(decryptJsonFrom(envelope, keyPair.privateKey)).resolves.toEqual({ provided: true });
  });

  test('publishes and reads public-key encrypted JSON objects', async () => {
    const provider = new MockSwarmProvider();
    const keyPair = await generateEncryptionKeyPair();

    const published = await publishEncryptedJsonFor(provider, { message: 'for you' }, keyPair.publicKey);
    const read = await readEncryptedJsonFrom<{ message: string }>(provider, published.reference, keyPair.privateKey);

    expect(published.plaintextSize).toBeGreaterThan(0);
    expect(published.ciphertextSize).toBeGreaterThan(published.plaintextSize);
    expect(read.message).toBe('for you');
  });

  test('rejects public-key decryption with the wrong private key', async () => {
    const recipient = await generateEncryptionKeyPair();
    const other = await generateEncryptionKeyPair();
    const envelope = await encryptJsonFor({ private: true }, recipient.publicKey);

    await expect(decryptJsonFrom(envelope, other.privateKey)).rejects.toThrow();
  });

  test('client exposes public-key encrypted object helpers', async () => {
    const kit = createSwarmKit(new MockSwarmProvider());
    const keyPair = await kit.crypto.generateKeyPair();

    const published = await kit.crypto.publishJsonFor({ subject: 'hi' }, keyPair.publicKey);

    await expect(kit.crypto.readJsonFrom(published.reference, keyPair.privateKey))
      .resolves.toEqual({ subject: 'hi' });
  });
});
