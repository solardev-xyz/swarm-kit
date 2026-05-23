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

## Basic Usage

```ts
import { createSwarmKit } from '@freedom/swarm-kit'

const kit = createSwarmKit(window.swarm)

await kit.requestAccess()

const chunk = await kit.publishJson({ hello: 'swarm' })
const value = await kit.readJson(chunk.reference)

console.log(value)
```

## SOC Objects

```ts
import { createSwarmKit, deriveIdentifier } from '@freedom/swarm-kit'

const kit = createSwarmKit(window.swarm)
const identity = await kit.getSigningIdentity()
const identifier = deriveIdentifier(['profile', 'v1'])

const written = await kit.writeSocJson(identifier, {
  name: 'Alice',
  updatedAt: new Date().toISOString(),
})

const profile = await kit.readSocJsonByOwnerAndIdentifier(identity.owner, identifier)

console.log(written.reference, profile)
```

## Epoch Feeds

Epoch feeds store entries at deterministic SOC identifiers derived from a topic,
period, and epoch start. This gives O(1) lookups for "what was published during
this hour/day/etc." without Bee-native sequence feeds.

```ts
import { createSwarmKit } from '@freedom/swarm-kit'

const kit = createSwarmKit(window.swarm)
const feed = kit.createEpochFeed<{ status: string }>({
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
- SOC text/JSON/bytes helpers
- deterministic identifier derivation using Keccak-256
- epoch-feed helper
- in-memory mock provider tests

Not included yet:

- multi-chunk object graphs above 4096 bytes
- encryption helpers
- CRDT/multi-writer structures
- hash-chain helpers
- Bee-compatible ACT abstractions

