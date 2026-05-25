# Swarm Kit Driver Abstraction Proposal

Status: Draft  
Audience: Swarm Kit and Freedom Browser teams  
Last updated: 2026-05-25

Freedom Browser review status: accepted in principle. The browser-side feedback
confirmed that a privileged internal driver is feasible, signer binding at
driver construction is preferred for wallet-owned identity records, the driver
should be byte-oriented, progress should stay outside the low-level interface,
and semantic error reasons should match the public provider contract.

## Summary

`swarm-kit` currently targets a `window.swarm`-compatible provider. That is the
right API for ordinary web apps running inside Freedom Browser.

However, Freedom Browser internals may want to use the same high-level Swarm Kit
primitives with capabilities that ordinary websites should not have, especially
wallet-owned SOC writes for Freedom identity records.

This proposal introduces a small generic driver interface underneath Swarm Kit's
high-level primitives:

```text
Swarm Kit primitives
        |
        v
SwarmKitDriver
        |
        +--> window.swarm adapter
        +--> Freedom Browser internal adapter
        +--> mock/test adapter
        +--> future direct Bee adapter, if wanted
```

The goal is to let Swarm Kit remain useful both as a web dApp library and as a
shared implementation layer for trusted Freedom Browser internals, without
exposing internal privileges to untrusted websites.

## Current State

Today the package effectively assumes this shape:

```text
high-level primitive -> SwarmProvider/callSwarm -> window.swarm
```

Examples:

- `kit.records.create(...)`
- `kit.lookup.create(...)`
- `kit.did.create(...)`
- `kit.hashChain.create(...)`
- `kit.crypto.publishJsonFor(...)`

All of these eventually use provider-style methods such as:

```ts
publishChunk({ data })
readChunk({ reference })
writeSingleOwnerChunk({ identifier, data })
readSingleOwnerChunk({ owner, identifier })
readSingleOwnerChunk({ address })
getSigningIdentity()
getCapabilities()
requestAccess()
```

The adapter already tolerates both direct provider methods and request-style
providers through `callSwarm(...)`.

## Problem

Freedom Browser internals may need to do things that an ordinary webpage cannot
and should not do directly:

- publish SOCs owned by the user's Ethereum wallet
- bind a write flow to a privileged internal signing identity
- skip end-user provider permission prompts for browser-owned background tasks
- choose postage/payment behavior internally
- access lower-level Bee/Freedom services without going through `window.swarm`
- publish identity/key-directory records during onboarding or key rotation

For example, the Freedom Identity Key Directory proposal needs Freedom Browser
to publish a revisioned SOC stream where:

```ts
owner = userEthereumWalletAddress
identifier = directoryRevisionIdentifier(revision)
```

An ordinary dApp might only be able to say "please choose your Ethereum wallet
identity before clicking write." Freedom Browser itself should be able to enforce
the correct signer internally.

If Swarm Kit remains hard-coupled to `window.swarm`, Freedom Browser internals
would either:

- reimplement the high-level primitives independently, or
- awkwardly pretend to be an injected webpage provider.

Both outcomes are undesirable.

## Goals

- Let Swarm Kit primitives depend on a small generic driver interface.
- Keep the current `window.swarm` path working for ordinary dApps.
- Allow Freedom Browser internals to implement the same driver with privileged
  capabilities.
- Keep privileged signer selection outside the generic high-level primitives.
- Preserve current user-facing Swarm Kit APIs where possible.
- Make mocks and compliance tests easier to share.
- Avoid leaking Freedom-internal powers into public webpage APIs.

## Non-Goals

- Do not expose wallet-owned SOC writes to all websites by default.
- Do not design a new Freedom Browser permission model here.
- Do not require Freedom Browser internals to call `window.swarm`.
- Do not turn Swarm Kit into a direct Bee client as part of this proposal.
- Do not add mailbox, identity, or key-directory application semantics to the
  driver.

## Proposed Interface

Introduce a generic driver interface with the exact capabilities Swarm Kit
primitives need.

Naming is open. Candidate names:

- `SwarmKitDriver`
- `SwarmKitTransport`
- `SwarmKitChunkDriver`
- `SwarmChunkStore`

This draft uses `SwarmKitDriver`.

Drivers are explicitly branded with `isSwarmKitDriver: true` so Swarm Kit can
distinguish a decoded-byte driver from an old direct-method `window.swarm`
provider. That matters because both shapes expose methods named
`readChunk(...)`, but the provider returns base64 while the driver returns
`Uint8Array`.

```ts
export interface SwarmKitDriver {
  readonly isSwarmKitDriver: true

  publishChunk(params: SwarmKitPublishChunkParams): Promise<SwarmKitPublishChunkResult>
  readChunk(params: SwarmKitReadChunkParams): Promise<SwarmKitReadChunkResult>

  writeSingleOwnerChunk(
    params: SwarmKitWriteSingleOwnerChunkParams,
  ): Promise<SwarmKitWriteSingleOwnerChunkResult>

  readSingleOwnerChunk(
    params: SwarmKitReadSingleOwnerChunkByAddressParams
      | SwarmKitReadSingleOwnerChunkByOwnerParams,
  ): Promise<SwarmKitReadSingleOwnerChunkResult>

  getSigningIdentity?(): Promise<SwarmKitSigningIdentity>
  getCapabilities?(): Promise<SwarmKitCapabilities>
  requestAccess?(): Promise<unknown>
}
```

Suggested base types:

```ts
export interface SwarmKitPublishChunkParams {
  data: Uint8Array
  signal?: AbortSignal
}

export interface SwarmKitPublishChunkResult {
  reference: string
}

export interface SwarmKitReadChunkParams {
  reference: string
  signal?: AbortSignal
}

export interface SwarmKitReadChunkResult {
  data: Uint8Array
  span: number | bigint
}

export interface SwarmKitWriteSingleOwnerChunkParams {
  identifier: string
  data: Uint8Array
  span?: number | bigint
  signal?: AbortSignal
}

export interface SwarmKitWriteSingleOwnerChunkResult {
  reference: string
  owner: string
  identifier: string
}

export interface SwarmKitReadSingleOwnerChunkByAddressParams {
  address: string
  signal?: AbortSignal
}

export interface SwarmKitReadSingleOwnerChunkByOwnerParams {
  owner: string
  identifier: string
  signal?: AbortSignal
}

export interface SwarmKitReadSingleOwnerChunkResult {
  data: Uint8Array
  span: number | bigint
  reference: string
  owner: string
  identifier: string
  signature?: string
}

export interface SwarmKitSigningIdentity {
  owner: string
  identityMode?: string
}
```

The driver should use decoded `Uint8Array` bytes. Adapters can handle provider
base64 encoding or Bee-specific response shapes at the edge.

## Adapter: `window.swarm`

The current provider support becomes an adapter:

```ts
const driver = createWindowSwarmDriver(window.swarm)
const kit = createSwarmKit(driver)
```

For backwards compatibility, this should keep working:

```ts
const kit = createSwarmKit(window.swarm)
```

Implementation can detect whether the input is already a driver or wrap it as a
provider.

The `window.swarm` adapter is responsible for:

- calling direct methods or `provider.request(...)`
- converting bytes to/from provider-supported encodings
- preserving existing provider error shapes
- exposing optional `requestAccess`, `getCapabilities`, and `getSigningIdentity`

## Adapter: Freedom Browser Internal Driver

Freedom Browser can implement `SwarmKitDriver` directly against internal
services.

Conceptually:

```ts
const driver = createFreedomInternalSwarmDriver({
  signer: {
    type: 'ethereum-wallet',
    address: walletAddress,
  },
  postagePolicy: 'browser-default',
})

const kit = createSwarmKit(driver)
```

This driver would be trusted browser-internal code, not a public webpage API.

It can:

- write SOCs using the user's Ethereum wallet identity
- publish during onboarding/key rotation
- choose internal postage behavior
- read/write through lower-level Bee/Freedom services
- return `owner = walletAddress` from `writeSingleOwnerChunk`

The high-level Swarm Kit primitive does not need to know why the write is
wallet-owned. It just observes the returned owner and can apply normal
`expectedOwner` checks.

## Bind Privilege At Driver Construction

Preferred design:

```ts
const walletDriver = createFreedomInternalSwarmDriver({
  signer: { type: 'ethereum-wallet', address: walletAddress },
})

const kit = createSwarmKit(walletDriver)
await kit.records.create({ namespace }).write('profile', value, {
  expectedOwner: walletAddress,
})
```

Avoid this if possible:

```ts
await kit.records.create({ namespace }).write('profile', value, {
  signer: { type: 'ethereum-wallet', address: walletAddress },
})
```

Reason: putting Freedom-specific signer options into every high-level primitive
would leak browser-internal concepts upward and make the generic API harder to
keep clean.

The driver should be the authority boundary. A driver can be "bound" to the
signing identity it is allowed to use.

## Expected Owner Checks Still Matter

Even with a privileged driver, high-level callers should keep using explicit
owner validation:

```ts
await records.write('key-directory', value, {
  expectedOwner: walletAddress,
})
```

This gives a clear failure if the driver is misconfigured and signs with an
unexpected identity.

The write result should always include:

```ts
{
  owner,
  identifier,
  reference,
}
```

so the caller can validate the actual result.

## Error Semantics

Drivers should preserve the semantic reasons that Swarm Kit already depends on:

- `chunk_not_found`
- `chunk_type_mismatch`
- `unsupported_option`
- `soc_write_collision`
- `owner_mismatch`

The exact JavaScript error class can differ, but `getSwarmErrorReason(error)`
should be able to recover the reason.

Important behavior:

- Missing CAC/SOC reads should be distinguishable from transient node failures.
- Generic/transient 500s should not be collapsed into `chunk_not_found`.
- Type mismatches should remain validation errors.

## Capabilities And Optional Methods

Some drivers may not need public permission prompts.

For a Freedom internal driver:

- `requestAccess` may be a no-op or omitted.
- `getCapabilities` may return internal limits or be omitted.
- `getSigningIdentity` should probably return the bound owner/signing identity.

Swarm Kit should tolerate optional methods where high-level primitives do not
need them.

However, primitives that append/write usually need a signing identity. If
`getSigningIdentity` is unavailable, the driver must still return `owner` from
write calls, and helpers that require pre-write owner checks may need a clear
error.

## Migration Plan

1. Introduce `SwarmKitDriver` types.
2. Implement `createWindowSwarmDriver(provider)`.
3. Update low-level `chunks.ts` and `soc.ts` to depend on the driver shape.
4. Keep `SwarmProvider` and `callSwarm` for public provider compatibility.
5. Let `createSwarmKit(input)` accept either a driver or a provider-compatible
   object.
6. Update `MockSwarmProvider` or add `MockSwarmDriver`.
7. Keep all existing public examples working.
8. Later, Freedom Browser can implement an internal driver in its own codebase.

This should be mostly an internal refactor for ordinary Swarm Kit users.

## Compatibility With Provider Compliance

The provider compliance harness should continue to test public `window.swarm`
behavior.

If Freedom Browser adds an internal driver, it may also want a separate internal
driver test harness that checks:

- wallet-owned SOC writes return `owner = walletAddress`
- missing reads normalize correctly
- type mismatches are detectable
- write/read bytes roundtrip
- identity binding cannot accidentally fall back to app-scoped owner

This is adjacent to, not a replacement for, public provider compliance.

## Freedom Browser Feedback Summary

Freedom Browser review accepted the abstraction with these constraints:

- Implement the Freedom internal driver as privileged browser-internal
  infrastructure, not by routing through `window.swarm`.
- Bind signer identity at driver construction. For the key directory, every SOC
  revision must be owned by the selected Ethereum wallet.
- Avoid per-write signer selection unless a concrete internal use case appears.
- Keep the driver byte-oriented. Provider serialization belongs in the
  `window.swarm` adapter.
- Include `signal?: AbortSignal` in driver params even if Freedom initially
  supports it only best-effort.
- Keep progress callbacks outside the low-level driver.
- Keep `ownerMode` out of per-call options. It belongs in driver construction.
- Optional postage override may be useful later, but browser-default policy is
  enough for the key directory.
- Preserve semantic errors, especially `chunk_not_found` and
  `chunk_type_mismatch`.
- Wallet-owned SOC writes should enforce returned `owner === walletAddress` and
  throw `owner_mismatch` otherwise.
- Portable wallet signatures and local encryption key storage are outside the
  driver; they belong in separate identity/signing/key-management layers.

This feedback is reflected in the current Swarm Kit refactor.
