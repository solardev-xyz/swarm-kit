import { describe, expect, test } from 'vitest';
import {
  createSwarmKit,
  didDocumentIdentifier,
  didDocumentRevisionIdentifier,
  readDidDocument,
  writeDidDocument,
} from '../src/index.js';
import { MockSwarmProvider } from './mock-provider.js';

describe('revisioned DID-style documents', () => {
  test('derives stable revision identifiers', () => {
    expect(didDocumentIdentifier()).toBe(didDocumentRevisionIdentifier(0));
    expect(didDocumentRevisionIdentifier(0)).not.toBe(didDocumentRevisionIdentifier(1));
    expect(didDocumentRevisionIdentifier(0)).not.toBe(didDocumentRevisionIdentifier(0, { namespace: 'custom-profile-v1' }));
  });

  test('writes and reads the latest document by owner', async () => {
    const provider = new MockSwarmProvider();

    const first = await writeDidDocument(provider, { name: 'Alice' });
    const second = await writeDidDocument(provider, { name: 'Alice', status: 'online' });
    const read = await readDidDocument<{ name: string; status?: string }>(provider, second.owner);

    expect(first.revision).toBe(0);
    expect(second.revision).toBe(1);
    expect(second.previousReference).toBe(first.reference);
    expect(read.document).toEqual({ name: 'Alice', status: 'online' });
    expect(read.reference).toBe(second.reference);
    expect(read.documentReference).toBe(second.documentReference);
  });

  test('reads document history newest first', async () => {
    const kit = createSwarmKit(new MockSwarmProvider());
    const did = kit.did.create<{ name: string; n: number }>();
    const owner = await did.getOwner();

    await did.write({ name: 'Alice', n: 1 });
    await did.write({ name: 'Alice', n: 2 });
    await did.write({ name: 'Alice', n: 3 });

    const history = await did.readHistory(owner, { limit: 2 });
    const first = await did.readAt(owner, 0);

    expect(history.map(revision => revision.document.n)).toEqual([3, 2]);
    expect(first?.document.n).toBe(1);
  });

  test('supports documents larger than one chunk', async () => {
    const provider = new MockSwarmProvider();
    const document = {
      id: 'did:swarm:large',
      entries: Array.from({ length: 600 }, (_, index) => ({ index, label: `entry-${index}` })),
    };

    const written = await writeDidDocument(provider, document);
    const read = await readDidDocument<typeof document>(provider, written.owner);

    expect(written.documentSize).toBeGreaterThan(4096);
    expect(read.document).toEqual(document);
  });

  test('client exposes revisioned DID helpers', async () => {
    const kit = createSwarmKit(new MockSwarmProvider());

    const first = await kit.did.writeDocument({ name: 'Bob' });
    const second = await kit.did.writeDocument({ name: 'Bob', status: 'busy' });
    const read = await kit.did.readDocument<{ name: string; status: string }>(second.owner);

    expect(first.revision).toBe(0);
    expect(read.document.status).toBe('busy');
  });
});
