# @freedom/swarm-kit

High-level data structures over the Freedom Browser `window.swarm` provider.

This package is intentionally built on the provider API, not direct Bee access.
It never handles private keys and never talks to a node directly. The browser
provider remains responsible for permissions, signing, postage, and resource
limits.

## Install

```sh
npm install
```

## Build And Test

```sh
npm run typecheck
npm test
npm run build
```

`npm run build` also refreshes the self-contained browser bundle used by the
playground in `examples/epoch-feed-smoke`. After building, upload that example
folder to Swarm and open the resulting `bzz://...` URL in Freedom Browser.

For local Freedom Browser smoke testing without uploading first:

```sh
npm run dev:playground
```

Then open `http://127.0.0.1:4173/` in Freedom Browser. Use
`PORT=4174 npm run dev:playground` if the default port is busy.

## Basic Usage

```ts
import { createSwarmKit, waitForSwarm } from '@freedom/swarm-kit'

const kit = createSwarmKit(await waitForSwarm())

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

## DID-Style Documents

DID-style documents store the document as a chunk graph and write a small SOC
pointer at a well-known identifier. Any reader can resolve a user's current
document from `(owner, identifier)`.

```ts
const written = await kit.did.writeDocument({
  name: 'Alice',
  services: [{ id: '#status', type: 'EpochFeed', topic: 'status' }],
})

const resolved = await kit.did.readDocument(written.owner)

console.log(resolved.document)
```

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

This first pass includes:

- provider adapter and `window.swarm` type surface
- base64, UTF-8, JSON, bytes, and hex helpers
- CAC text/JSON/bytes helpers
- chunk graph text/JSON/bytes helpers
- SOC text/JSON/bytes helpers
- DID-style document helper
- single-writer hash-chain helper
- multi-writer feed helper
- deterministic identifier derivation using Keccak-256
- epoch-feed helper
- in-memory mock provider tests

Not included yet:

- encryption helpers
- CRDT conflict resolution on top of multi-writer entries
- Bee-compatible ACT abstractions
