# @freedom/swarm-kit

High-level data structures over the Freedom Browser `window.swarm` provider.

This package is intentionally built on the provider API, not direct Bee access.
It never handles private keys and never talks to a node directly. The browser
provider remains responsible for permissions, signing, postage, and resource
limits.

This is an early prototype. The repository is public, but the package is still
marked `"private": true` and is not published to npm yet.

`swarm-kit` targets Freedom Browser's `window.swarm` provider. It is not a Bee
HTTP client and should not be expected to run against a plain Bee node directly.

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

## SOC Objects

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

## Public-Key Encryption Envelopes

Public-key helpers use browser Web Crypto with P-256 ECDH, HKDF-SHA-256, and
AES-GCM. They are for encrypting to a recipient key, not for proving who sent
the payload. Pair them with signed/verifiable documents when identity matters.

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

## Current Scope

- provider adapter and `window.swarm` type surface
- base64, UTF-8, JSON, bytes, and hex helpers
- CAC text/JSON/bytes helpers
- indexed SOC stream helper
- chunk graph text/JSON/bytes helpers
- SOC text/JSON/bytes helpers
- AES-GCM encrypted object helpers
- P-256 ECDH public-key encrypted object helpers
- revisioned DID-style document helper
- single-writer hash-chain helper
- multi-writer feed helper
- keyed lookup stream helper
- deterministic identifier derivation using Keccak-256
- epoch-feed helper
- browser-runnable provider compliance checks
- in-memory mock provider tests

Not included yet:

- wallet-bound recipient key discovery and exchange
- signed/verifiable document envelopes
- CRDT conflict resolution on top of multi-writer entries
- mailbox/inbox discovery conventions
- Bee-compatible ACT abstractions
