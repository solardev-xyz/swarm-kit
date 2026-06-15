# @freedom/swarm-kit

High-level data structures over the Freedom Browser `window.swarm` provider.

This package is intentionally built on the provider API, not direct Bee access.
It never talks to a node directly and does not manage provider signing keys. The
browser provider remains responsible for permissions, SOC signing, postage, and
resource limits. App-level crypto helpers operate on caller-managed Web Crypto
keys.

This is an early prototype. The repository is public, but the package is still
marked `"private": true` and is not published to npm yet.

`swarm-kit` targets Freedom Browser's `window.swarm` provider. It is not a Bee
HTTP client and should not be expected to run against a plain Bee node directly.

The core idea is simple: Freedom Browser exposes low-level CAC and SOC chunk
transport, and Swarm Kit turns those primitives into reusable browser-friendly
data structures. App-specific protocols such as mailboxes, profiles, service
records, or social feeds should sit on top of these generic building blocks.

## Development Setup

```sh
git clone git@github.com:solardev-xyz/swarm-kit.git
cd swarm-kit
npm install
```

## Build And Test

```sh
npm run typecheck
npm test
npm run build
```

`npm run build` also refreshes the self-contained browser bundles used by the
playground in `examples/epoch-feed-smoke` and provider compliance page in
`examples/provider-compliance`. After building, upload either example folder to
Swarm and open the resulting `bzz://...` URL in Freedom Browser.

For local Freedom Browser smoke testing without uploading first:

```sh
npm run dev:playground
```

Then open `http://127.0.0.1:4173/` in Freedom Browser. Use
`PORT=4174 npm run dev:playground` if the default port is busy.

For provider contract checks against the real injected `window.swarm`:

```sh
npm run dev:provider-compliance
```

Then open `http://127.0.0.1:4175/` in Freedom Browser and run the checks. The
compliance page writes small test CAC/SOC chunks and verifies provider behavior
that higher-level Swarm Kit structures depend on, including missing-read
normalization and CAC/SOC type mismatch errors.

## Basic Usage

```ts
import { createSwarmKit, waitForSwarm } from '@freedom/swarm-kit'

const provider = await waitForSwarm({ requireFreedomBrowser: true })
const kit = createSwarmKit(provider)

await kit.requestAccess()

const chunk = await kit.chunks.publishJson({ hello: 'swarm' })
const value = await kit.chunks.readJson(chunk.reference)

console.log(value)
```

## Primitive Map

| Layer | Client API | What It Provides |
| --- | --- | --- |
| Driver/provider adapter | `createSwarmKit`, `createWindowSwarmDriver`, `waitForSwarm`, `callSwarm` | Normalizes direct and request-style `window.swarm` providers behind a byte-oriented driver. |
| Byte/codecs | `utf8ToBytes`, `bytesToBase64`, `jsonToBytes`, `hexToBytes` | Browser-safe encoding helpers without Node `Buffer`. |
| Identifiers | `deriveIdentifier`, `keccakHex` | Deterministic Keccak-based SOC identifiers from length-prefixed parts. |
| CAC chunks | `kit.chunks.*` | Raw content-addressed bytes/text/JSON, one chunk payload. |
| SOC chunks | `kit.soc.*` | Raw single-owner bytes/text/JSON at caller-chosen identifiers. |
| Object graphs | `kit.objects.*` | Larger content-addressed bytes/text/JSON split across CAC chunks. |
| Indexed SOC streams | `createIndexedSocStream` | Generic write-once append stream over deterministic SOC indexes. |
| Owner records | `kit.records.create` | Generic revisioned records under an owner, namespace, and key. |
| Keyed lookup streams | `kit.lookup.create` | Revisioned values per application-defined key. |
| Epoch feeds | `kit.epochFeed.create` | Time-bucketed SOC entries for O(1) reads at time epochs. |
| Hash chains | `kit.hashChain.create` | Single-writer append logs with previous-entry references. |
| Multi-writer feeds | `kit.multiWriterFeed.create` | Per-writer append streams with reader-side fan-out and merge. |
| DID-style documents | `kit.did.create` | Revisioned document history with object-graph document bodies. |
| Encryption | `kit.crypto.*` | Symmetric AES-GCM and P-256 ECDH public-key encrypted envelopes. |
| Signed documents | `kit.signedDocuments.*` | Canonical signed JSON envelopes with P-256 and Ethereum wallet support. |
| Commit-reveal | `kit.commitReveal.create` | Deterministic SOC commits and later reveals for sealed values. |
| Provider compliance | `runSwarmProviderCompliance` | Browser-runnable contract checks for real provider behavior. |

## Driver And Provider Adapter

Swarm Kit primitives depend on a small byte-oriented driver interface. Ordinary
web apps usually pass Freedom Browser's `window.swarm` provider directly, and
Swarm Kit wraps it with `createWindowSwarmDriver(...)`.

```ts
import { createSwarmKit, createWindowSwarmDriver, waitForSwarm } from '@freedom/swarm-kit'

const provider = await waitForSwarm({ requireFreedomBrowser: true })
const driver = createWindowSwarmDriver(provider)
const kit = createSwarmKit(driver)

await kit.requestAccess()
```

For backwards compatibility, this is equivalent:

```ts
const kit = createSwarmKit(window.swarm)
```

Trusted environments, such as Freedom Browser internals, can implement the same
`SwarmKitDriver` interface directly and bind privileged signer choices at driver
construction. High-level primitives stay generic and only observe the returned
SOC `owner`, `identifier`, and `reference`.

## Identifier Helpers

SOC identifiers are deterministic 32-byte hex strings. `deriveIdentifier`
hashes length-prefixed parts, so different part boundaries cannot collide by
ambiguous concatenation.

```ts
import { deriveIdentifier } from '@freedom/swarm-kit'

const profileIdentifier = deriveIdentifier([
  'com.example.app',
  'profile',
  'v1',
])
```

Use namespaces that are specific to the application/protocol you are building.
Swarm Kit's higher-level helpers use the same pattern internally.

## CAC Chunks

CAC helpers publish and read raw content-addressed chunks. They are ideal for
small immutable values. For larger values, use object graphs instead.

```ts
const published = await kit.chunks.publishJson({
  hello: 'swarm',
})

const value = await kit.chunks.readJson(published.reference)
console.log(published.reference, value)
```

## Raw SOC Helpers

```ts
import { createSwarmKit, deriveIdentifier } from '@freedom/swarm-kit'

const kit = createSwarmKit(window.swarm)
const identity = await kit.soc.getSigningIdentity()
const identifier = deriveIdentifier(['profile', 'v1'])

const written = await kit.soc.writeJson(identifier, {
  name: 'Alice',
  updatedAt: new Date().toISOString(),
})

const profile = await kit.soc.readJsonByOwnerAndIdentifier(identity.owner, identifier)

console.log(written.reference, profile)
```

Treat raw SOC identifiers as write-once. Re-writing the same `(owner,
identifier)` pair is undefined at the Bee/network layer, so append-only
structures in this package use deterministic index identifiers instead of
mutable SOC pointers.

SOC terminology:

- `owner`: the address/signing identity that owns the SOC.
- `identifier`: the caller-chosen 32-byte key under that owner.
- `reference` or `address`: the resulting SOC chunk address.
- `(owner, identifier)`: the coordinate readers can use to find a deterministic
  SOC without knowing its final address.

## Indexed SOC Streams

Indexed SOC streams are the core write-once append pattern used by the higher
level helpers. Each entry is written to a deterministic SOC identifier derived
from a namespace and index. The stream discovers the latest contiguous index for
callers. Stream envelopes must expose their own `index` so reads can validate
that the returned SOC is the exact entry requested.

```ts
import { createIndexedSocStream } from '@freedom/swarm-kit'

interface EventEntry {
  version: 1
  index: number
  previousReference: string | null
  value: string
}

const stream = createIndexedSocStream(window.swarm, {
  namespace: 'my-app:events:v1',
  parseEnvelope(value: EventEntry, context) {
    if (value.index !== context.index) throw new Error('wrong index')
    return value
  },
})

const written = await stream.append(({ index, previousReference }) => ({
  version: 1,
  index,
  previousReference,
  value: 'hello',
}))

const latest = await stream.readLatest(written.owner)
```

## Owner Records

Owner records are revisioned JSON records under a namespace and key. They are
generic on purpose: an app decides whether a key means "profile", "mailbox",
"service", or something else. Swarm Kit handles deterministic identifiers,
append-only revisions, larger value storage, missing reads, and optional owner
checks.

```ts
const records = kit.records.create({
  namespace: 'com.example.app',
})

const written = await records.write('profile', {
  displayName: 'Alice',
  encryptionPublicKey: publicKey,
}, {
  expectedOwner: walletAddress,
})

const latest = await records.readLatest(walletAddress, 'profile')
const history = await records.readHistory(walletAddress, 'profile')

console.log(written.revision, latest?.value, history.length)
```

`expectedOwner` is useful when the user must choose a specific signing identity
in Freedom Browser. The write fails before publishing the SOC if the provider is
currently signing as a different owner.

This is the right primitive when an app wants "given this owner address, look up
the latest value for this well-known key" without baking that key's app-level
schema into Swarm Kit.

## Chunk Graph Objects

Raw CAC chunks are limited to one chunk payload. Object helpers split larger
bytes, text, or JSON into content-addressed chunk graphs and return a root
reference.

```ts
const big = await kit.objects.publishJson({
  entries: Array.from({ length: 500 }, (_, index) => ({ index })),
})

const value = await kit.objects.readJson(big.reference)

console.log(big.chunkCount, value)
```

## Choosing Between Records And Lookup Streams

`records` and `lookup` are intentionally similar, but they answer slightly
different questions.

Use `records` when the owner address is the root of discovery:

```ts
const profile = await records.readLatest(ownerAddress, 'profile')
```

Use `lookup` when the key is the root of an app-specific index under a writer:

```ts
const status = await lookup.readLatest(writerOwner, 'alice')
```

Both are built on indexed SOC streams and object graphs. Neither decides what a
profile, mailbox, status, or service record means; that belongs to the
application protocol.

## Encryption Helpers

Encryption helpers use browser Web Crypto with caller-managed AES-GCM keys.
Freedom Browser stores and transports only ciphertext bytes; key storage,
backup, and sharing remain the application's responsibility in this first
version.

```ts
const key = await kit.crypto.generateKey()
const exported = await kit.crypto.exportKey(key)

const encrypted = await kit.crypto.publishJson({
  secret: 'hello',
}, key)

const sameKey = await kit.crypto.importKey(exported)
const value = await kit.crypto.readJson(encrypted.reference, sameKey)

console.log(value)
```

For password-based demos, derive a symmetric key with PBKDF2:

```ts
const derived = await kit.crypto.deriveKeyFromPassword(password)
const key = derived.key
```

Symmetric encryption is a transport/storage primitive. Swarm Kit does not manage
where keys are stored, how they are backed up, or who should receive them.

## Public-Key Encryption Envelopes

Public-key helpers use browser Web Crypto with P-256 ECDH, HKDF-SHA-256, and
AES-GCM. They are for encrypting to a recipient key, not for proving who sent
the payload. Pair them with signed documents when identity matters.

Apps can use Swarm Kit's keypair helpers or provide their own Web Crypto
`CryptoKey`s/JWKs.

```ts
const recipient = await kit.crypto.generateKeyPair()
const publicKey = await kit.crypto.exportPublicKey(recipient.publicKey)

const encrypted = await kit.crypto.publishJsonFor({
  message: 'only the recipient can decrypt this',
}, publicKey)

const value = await kit.crypto.readJsonFrom(
  encrypted.reference,
  recipient.privateKey,
)

console.log(value)
```

This is the primitive for encrypting data to a recipient-controlled public key.
Discovering that public key is intentionally left to app protocols built on
records, signed documents, or another convention.

## Signed Documents

Signed documents bind a JSON payload to a subject string with canonical signing
bytes. Swarm Kit includes Web Crypto P-256 sign/verify helpers and an EIP-1193
`personal_sign` signer adapter for wallet-bound documents. Ethereum
`personal_sign` verification is backed by `viem`; apps can still use the lower
level EIP-191 verifier hook if they want to provide their own recovery logic.

```ts
const signingKey = await kit.signedDocuments.generateP256KeyPair()
const signer = await kit.signedDocuments.createP256Signer(signingKey)

const published = await kit.signedDocuments.publish({
  encryptionPublicKey: publicKey,
  delivery: [],
}, {
  subject: 'wallet:0xabc...',
  signer,
})

const verified = await kit.signedDocuments.readAndVerify(
  published.reference,
  kit.signedDocuments.createP256Verifier(),
)

console.log(verified.payload)
```

For wallet signatures:

```ts
const signer = kit.signedDocuments.createEip1193PersonalSigner(window.ethereum, {
  address: walletAddress,
})

const envelope = await kit.signedDocuments.sign(profile, {
  subject: `wallet:${walletAddress}`,
  signer,
})

const ok = await kit.signedDocuments.verify(
  envelope,
  kit.signedDocuments.createEthereumPersonalVerifier({
    address: walletAddress,
  }),
)
```

Signed documents are portable attestations. They can be stored as object graphs,
referenced from owner records, mirrored by third parties, or sent through another
protocol while remaining independently verifiable.

## Commit-Reveal

Commit-reveal protocols let a writer publish a commitment to a hidden JSON value
now, then reveal the value and salt later. Swarm Kit stores the commit and reveal
as deterministic SOCs under the writer's owner address, while revealed values are
stored as object graphs.

This is most useful in multiplayer or multi-party protocols where everyone uses
the same namespace/topic/round, but each participant writes under their own SOC
owner. The app can later read each participant's pair and verify that every
reveal matches the value they committed before seeing the others.

```ts
const poll = kit.commitReveal.create<{ vote: string }>({
  namespace: 'example.polls',
  topic: 'proposal-7',
  round: 'vote',
})

const commit = await poll.commit({ vote: 'yes' })

// Keep this salt secret until the reveal phase.
await poll.reveal({ vote: 'yes' }, commit.salt)

const pair = await poll.readPair(commit.owner)

console.log(pair.verified)
```

For a group, collect known participant owners and read each owner's pair:

```ts
const results = await Promise.all(
  participantOwners.map(owner => poll.readPair(owner)),
)

const validReveals = results.filter(result => result.verified)
```

Commitments are domain-separated, canonical JSON hashes over namespace, topic,
round, owner, value, and salt. Binding the owner prevents someone from copying
another writer's hidden commitment as their own. Swarm Kit does not enforce
deadlines, quorum, penalties, or phase transitions; those rules belong to the
application protocol. Example app-level uses include sealed-bid auctions,
simultaneous game moves, sealed voting, prediction contests, and shared
randomness beacons.

## DID-Style Documents

DID-style documents store each document body as a chunk graph and each document
revision as an indexed SOC entry. Readers can resolve the latest revision or
walk document history from an owner address.

```ts
const profile = kit.did.create({
  namespace: 'my-profile',
})

const first = await profile.write({
  name: 'Alice',
  services: [{ id: '#status', type: 'EpochFeed', topic: 'status' }],
})

const second = await profile.write({
  name: 'Alice',
  status: 'online',
})

const resolved = await profile.readLatest(second.owner)
const history = await profile.readHistory(second.owner)

console.log(resolved?.document, history.map(revision => revision.revision))
```

For simple callers, `kit.did.writeDocument(...)` and
`kit.did.readDocument(owner)` are aliases for writing a new revision and reading
the latest revision.

## Hash Chains

Hash chains are single-writer append-only logs. Each payload is stored as an
object graph and each entry is a SOC at a deterministic index. The library
discovers the latest contiguous index for callers, so applications do not need
to keep their own local counter.

```ts
const log = kit.hashChain.create<{ action: string }>({
  topic: 'audit-log',
})

const written = await log.append({ action: 'published' })
const latest = await log.readLatest(written.owner, { limit: 10 })
const first = await log.readAt(written.owner, 0)

console.log(first?.payload, latest.map(entry => entry.payload))
```

## Multi-Writer Feeds

Multi-writer feeds give each writer a deterministic identifier namespace.
Readers fan out across known writer owners, discover each writer's latest
contiguous index, and merge entries newest-first.

```ts
const feed = kit.multiWriterFeed.create<{ status: string }>({
  topic: 'team-status',
  writerId: 'device-a',
})

const written = await feed.append({ status: 'online' })

const merged = await feed.readLatest([
  { owner: written.owner, writerId: 'device-a' },
  { owner: '0x...' },
])

console.log(merged.map(entry => entry.payload))
```

Multi-writer feeds do not solve conflict resolution by themselves. They provide
the transport shape for collecting each writer's signed append stream; CRDT or
application-specific merge rules belong above this layer.

## Keyed Lookup Streams

Keyed lookup streams are revisioned records per application-defined key: latest
profile per username, latest status per category, history for a search key, and
similar lookup patterns that are not native Bee sequence feeds.

```ts
const lookup = kit.lookup.create<{ status: string }>({
  namespace: 'presence',
})

const written = await lookup.write('alice', { status: 'online' })
await lookup.write('alice', { status: 'away' })

const latest = await lookup.readLatest(written.owner, 'alice')
const history = await lookup.readHistory(written.owner, 'alice')

console.log(latest?.value, history.map(entry => entry.index))
```

## Epoch Feeds

Epoch feeds store entries at deterministic SOC identifiers derived from a topic,
period, and epoch start. This gives O(1) lookups for "what was published during
this hour/day/etc." without Bee-native sequence feeds.

```ts
import { createSwarmKit } from '@freedom/swarm-kit'

const kit = createSwarmKit(window.swarm)
const feed = kit.epochFeed.create<{ status: string }>({
  topic: 'status',
  period: 'hour',
})

await kit.requestAccess()

const owner = await feed.getOwner()
await feed.write({ status: 'online' })

const current = await feed.readCurrent(owner)
const latest = await feed.readLatest(owner, { lookback: 24 })

console.log(current?.value, latest?.value)
```

## Provider Compliance

The provider compliance harness is a browser-runnable test page for real
`window.swarm` implementations. It checks the provider behavior that Swarm Kit's
higher-level structures rely on:

- provider access and capabilities
- signing identity shape
- CAC publish/read roundtrip
- SOC write/read by address
- SOC read by `(owner, identifier)`
- missing CAC/SOC reads normalized to `chunk_not_found`
- CAC/SOC type mismatch errors
- unsupported option errors

```sh
npm run dev:provider-compliance
```

Then open `http://127.0.0.1:4175/` in Freedom Browser and run the checks.

## Provider Test Center

The provider test center is a broader browser-runnable diagnostic page for
comparing real `window.swarm` implementations, especially Bee-backed Freedom
Browser versus Ant-backed Freedom Browser. It runs selectable suites for:

- provider bootstrap and signing identity stability
- CAC roundtrips and missing reads
- SOC reads by address and by `(owner, identifier)`
- native feed journal exact-index semantics
- indexed SOC streams
- high-level Swarm Kit primitives
- focused diagnostics for CAC size boundaries, delayed reads, native feed
  timelines, sparse feed timelines, Swarmit-style user feed reconstruction,
  feed-manifest `bzz` latest resolution, and indexed SOC timelines
- optional SOC/feed stress checks

```sh
npm run dev:test-center
```

Then open `http://127.0.0.1:4176/` in Freedom Browser, select suites, run, and
copy or download the JSON report.

Recommended provider comparison workflow:

1. Run the default selected suites in Bee-backed Freedom Browser. Keep `Stress`
   disabled for the first baseline run.
2. Save the JSON report.
3. Run the same selected suites in the provider implementation under test, such
   as Ant-backed Freedom Browser.
4. Compare pass/fail summaries and failing step details. The diagnostics suite
   includes exact owner, topic, identifier, index, reference, expected value, and
   observed error data where available.

Example Bee/Ant comparison reports live in `docs/reports`.

## Playground

The playground in `examples/epoch-feed-smoke` exercises the high-level
primitives against the real injected provider. It includes panels for:

- epoch feeds
- object graphs
- encryption
- signed documents and Ethereum wallet signatures
- owner records
- DID-style documents
- hash chains
- multi-writer feeds
- keyed lookup streams
- commit-reveal

```sh
npm run dev:playground
```

Then open `http://127.0.0.1:4173/` in Freedom Browser.

## Discovery And Storage Policy Notes

Several primitives in this package produce useful owner-addressed structures,
but they do not by themselves solve discovery. For example, a multi-writer feed
reader still needs to know which `{ owner, writerId }` pairs to read, and a
mailbox-style app still needs a way to discover a recipient's public keys and
delivery records.

Candidate discovery layers include:

- explicit share links that contain owners, topics, and record keys
- wallet-owned or Freedom-owned identity/key-directory records
- group manifests that list accepted writers for a topic
- open "graffiti feed" style signal feeds, as described in
  [FIP-62](https://github.com/fairDataSociety/FIPs/blob/master/text/0062-graffiti-feed.md)

Graffiti feeds are best treated as an open signaling/discovery layer, not as a
replacement for trusted membership. A likely mature shape is:

```text
open discovery signal -> owner records / writer streams -> optional group manifest -> reducers or app state
```

Storage policy is another layer Swarm Kit does not currently control. Swarm
postage batches can be immutable or mutable. Immutable batches are appropriate
for archival records, signed documents, identity data, commit-reveal history,
and audit logs. Mutable batches can be useful for frequently updated or
ephemeral signals such as presence, latest-status feeds, graffiti discovery, or
GSOC-style messages. See the
[Swarm postage stamp documentation](https://docs.ethswarm.org/docs/concepts/incentives/postage-stamps/)
for the underlying batch behavior.

At the time of writing, Freedom Browser's `window.swarm` API does not expose
postage-batch mutability or any per-write storage policy. Swarm Kit therefore
cannot request "mutable" or "immutable" storage from the provider; it simply
publishes chunks through the available driver. A future provider or internal
Freedom driver could expose this as a storage policy, for example:

```ts
const kit = createSwarmKit(createWindowSwarmDriver(window.swarm, {
  storage: { mutability: 'immutable' },
}))

await feed.write(value, {
  storage: { mutability: 'mutable' },
})
```

That API is illustrative only. The important design point is that high-level
primitives can signal their storage needs, while Freedom Browser or another
driver decides which postage batch to use.

## Responsibility Split

Swarm Kit provides generic, deterministic, browser-friendly data structures over
`window.swarm`. It deliberately does not define product protocols such as
mailboxes, social profiles, delivery semantics, trust graphs, or CRDT merge
rules.

Applications should define:

- record keys and payload schemas
- key discovery and key rotation UX
- whether wallet-owned SOCs, signed documents, or both are required
- mailbox/inbox conventions
- multi-writer conflict resolution
- migration and compatibility rules

Not included yet:

- wallet-bound recipient key discovery and exchange
- open discovery/graffiti signal conventions
- storage policy controls for mutable vs immutable postage batches
- CRDT conflict resolution on top of multi-writer entries
- mailbox/inbox discovery conventions
- Bee-compatible ACT abstractions
