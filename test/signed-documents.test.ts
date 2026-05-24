import { describe, expect, test } from 'vitest';
import {
  createEip1193PersonalSigner,
  createEip191PersonalVerifier,
  createP256DocumentSigner,
  createP256DocumentVerifier,
  createSwarmKit,
  generateP256SigningKeyPair,
  publishSignedDocument,
  readAndVerifySignedDocument,
  signDocument,
  verifySignedDocument,
} from '../src/index.js';
import { bytesToUtf8 } from '../src/bytes.js';
import { MockSwarmProvider } from './mock-provider.js';

describe('signed documents', () => {
  test('signs and verifies JSON payloads with P-256 keys', async () => {
    const keyPair = await generateP256SigningKeyPair();
    const signer = await createP256DocumentSigner(keyPair);
    const verifier = createP256DocumentVerifier();

    const envelope = await signDocument({ mailbox: { publicKey: 'abc' } }, {
      subject: 'profile:alice',
      signer,
      signedAt: '2026-05-24T12:00:00.000Z',
    });

    expect(envelope.signature.scheme).toBe('ECDSA-P256-SHA-256');
    expect(envelope.signature.publicKey).toBeTruthy();
    await expect(verifySignedDocument(envelope, verifier)).resolves.toBe(true);
  });

  test('rejects tampered P-256 payloads', async () => {
    const keyPair = await generateP256SigningKeyPair();
    const signer = await createP256DocumentSigner(keyPair);
    const verifier = createP256DocumentVerifier();
    const envelope = await signDocument({ ok: true }, {
      subject: 'profile:alice',
      signer,
      signedAt: '2026-05-24T12:00:00.000Z',
    });

    const tampered = {
      ...envelope,
      payload: { ok: false },
    };

    await expect(verifySignedDocument(tampered, verifier)).resolves.toBe(false);
  });

  test('publishes and reads verified signed documents', async () => {
    const provider = new MockSwarmProvider();
    const keyPair = await generateP256SigningKeyPair();
    const signer = await createP256DocumentSigner(keyPair);
    const verifier = createP256DocumentVerifier({ signer: signer.id });

    const published = await publishSignedDocument(provider, {
      encryptionPublicKey: 'public-key',
    }, {
      subject: 'wallet:0x1111111111111111111111111111111111111111',
      signer,
      signedAt: '2026-05-24T12:00:00.000Z',
    });
    const read = await readAndVerifySignedDocument<{ encryptionPublicKey: string }>(
      provider,
      published.reference,
      verifier,
    );

    expect(read.payload.encryptionPublicKey).toBe('public-key');
  });

  test('client exposes signed document helpers', async () => {
    const kit = createSwarmKit(new MockSwarmProvider());
    const keyPair = await kit.signedDocuments.generateP256KeyPair();
    const signer = await kit.signedDocuments.createP256Signer(keyPair);
    const verifier = kit.signedDocuments.createP256Verifier();

    const envelope = await kit.signedDocuments.sign({ ready: true }, {
      subject: 'demo',
      signer,
    });

    await expect(kit.signedDocuments.verify(envelope, verifier)).resolves.toBe(true);
  });

  test('creates an EIP-1193 personal_sign document signer', async () => {
    const calls: unknown[] = [];
    const eip1193 = {
      request: async ({ method, params }: { method: string; params?: unknown[] }) => {
        calls.push({ method, params });
        return `0x${'11'.repeat(65)}`;
      },
    };
    const signer = createEip1193PersonalSigner(eip1193, {
      address: '0xaDb5c3765eC235a34Aed383cC313F4f84009900F',
    });
    const envelope = await signDocument({ walletBound: true }, {
      subject: 'wallet:0xaDb5c3765eC235a34Aed383cC313F4f84009900F',
      signer,
      signedAt: '2026-05-24T12:00:00.000Z',
    });

    expect(envelope.signature.scheme).toBe('EIP-191-PERSONAL-SIGN');
    expect(envelope.signature.signer).toBe('0xadb5c3765ec235a34aed383cc313f4f84009900f');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: 'personal_sign',
      params: [
        expect.stringMatching(/^0x[0-9a-f]+$/),
        '0xadb5c3765ec235a34aed383cc313f4f84009900f',
      ],
    });
  });

  test('verifies EIP-191 personal signatures with caller-provided recovery', async () => {
    const verifier = createEip191PersonalVerifier((message, signature) => {
      expect(bytesToUtf8(message)).toContain('swarm-kit:signed-document-payload');
      expect(signature).toEqual(new Uint8Array([1, 2, 3]));
      return '0xaDb5c3765eC235a34Aed383cC313F4f84009900F';
    });
    const envelope = {
      version: 1 as const,
      type: 'swarm-kit:signed-document-payload' as const,
      subject: 'wallet:0xaDb5c3765eC235a34Aed383cC313F4f84009900F',
      signedAt: '2026-05-24T12:00:00.000Z',
      payload: { walletBound: true },
      signature: {
        scheme: 'EIP-191-PERSONAL-SIGN',
        signer: '0xadb5c3765ec235a34aed383cc313f4f84009900f',
        encoding: 'base64' as const,
        value: 'AQID',
      },
    };

    await expect(verifySignedDocument(envelope, verifier)).resolves.toBe(true);
  });
});
