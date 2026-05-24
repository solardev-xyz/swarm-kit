import { describe, expect, test } from 'vitest';
import {
  decryptJson,
  deriveEncryptionKeyFromPassword,
  encryptJson,
  exportEncryptionKey,
  generateEncryptionKey,
  importEncryptionKey,
  readEncryptedJson,
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
});
