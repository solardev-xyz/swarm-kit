import { describe, expect, test } from 'vitest';
import { createSwarmKit, didDocumentIdentifier, readDidDocument, writeDidDocument } from '../src/index.js';
import { MockSwarmProvider } from './mock-provider.js';

describe('DID-style documents', () => {
  test('uses a stable well-known identifier', () => {
    expect(didDocumentIdentifier()).toBe(didDocumentIdentifier());
    expect(didDocumentIdentifier()).not.toBe(didDocumentIdentifier({ namespace: 'custom-profile-v1' }));
  });

  test('writes and reads a document by owner', async () => {
    const provider = new MockSwarmProvider();
    const document = {
      id: 'did:swarm:example',
      name: 'Alice',
      services: [{ id: '#status', type: 'EpochFeed', topic: 'status' }],
    };

    const written = await writeDidDocument(provider, document);
    const read = await readDidDocument<typeof document>(provider, written.owner);

    expect(read.document).toEqual(document);
    expect(read.identifier).toBe(written.identifier);
    expect(read.reference).toBe(written.documentReference);
    expect(read.pointer.documentReference).toBe(written.documentReference);
  });

  test('supports documents larger than one chunk', async () => {
    const provider = new MockSwarmProvider();
    const document = {
      id: 'did:swarm:large',
      entries: Array.from({ length: 600 }, (_, index) => ({ index, label: `entry-${index}` })),
    };

    const written = await writeDidDocument(provider, document);
    const read = await readDidDocument<typeof document>(provider, written.owner);

    expect(written.pointer.documentSize).toBeGreaterThan(4096);
    expect(read.document).toEqual(document);
  });

  test('client exposes namespaced DID helpers', async () => {
    const kit = createSwarmKit(new MockSwarmProvider());

    const written = await kit.did.writeDocument({ name: 'Bob' });
    const read = await kit.did.readDocument<{ name: string }>(written.owner);

    expect(read.document.name).toBe('Bob');
  });
});
