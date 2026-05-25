# Freedom Identity Key Directory

Status: Draft  
Audience: Freedom Browser team  
Last updated: 2026-05-25

## Summary

Freedom Browser should publish a public, wallet-rooted key directory on Swarm for
each Freedom identity.

The lookup root is the user's main Ethereum wallet address. Given only that
wallet address, another user or app should be able to deterministically resolve
the user's current public key material from Swarm.

The first concrete use case is encrypted messaging: if Alice knows Bob's wallet
address, Alice can resolve Bob's public encryption key from Swarm and encrypt a
message that only Bob's Freedom Browser can decrypt.

This document intentionally describes a Freedom Browser identity capability, not
just a `swarm-kit` library feature. Freedom Browser may implement this using
internal Bee/Freedom APIs instead of `window.swarm`. `swarm-kit` provides useful
reference primitives, but Freedom Browser can have privileged access to wallet
keys, signing identity selection, local key storage, and publishing flows that
ordinary dApps do not have.

## Goals

- Make an Ethereum wallet address a deterministic Swarm lookup root for public
  Freedom identity key material.
- Allow encrypted messages and other protocols to discover recipient public keys
  without a centralized keyserver.
- Keep all private keys local to Freedom Browser.
- Use Swarm SOCs for wallet-owned, self-authenticating publication.
- Avoid mutable SOC overwrites; every update should be a write-once revision.
- Support key rotation, revocation, and multiple devices.
- Leave app-specific protocols, such as mailbox layout or social profiles, out
  of the core key directory.

## Non-Goals

- This is not a full mailbox protocol.
- This is not a contact graph, social profile system, or DID method.
- This does not define message payload formats.
- This does not define CRDT conflict resolution.
- This does not replace the user's Ethereum wallet.
- This does not publish private keys, recovery material, encrypted seed phrases,
  or wallet secrets to Swarm.

## Terminology

- `wallet`: the user's main Ethereum address, used as the identity root.
- `directory`: the current public key directory document for a wallet.
- `revision`: one immutable version of the directory.
- `owner`: the SOC owner/signing address.
- `identifier`: the caller-chosen 32-byte SOC key.
- `reference`: the resulting Swarm chunk/SOC address.
- `message-encryption key`: a public key used by senders to encrypt messages to
  this Freedom identity.
- `device`: one Freedom Browser installation authorized for the wallet identity.

## Core Model

The core model is:

```text
Ethereum wallet address
        |
        v
wallet-owned Swarm SOC revision stream
        |
        v
Freedom identity key directory
        |
        v
public encryption keys, device keys, revocation state, service pointers
```

If a reader knows:

```text
0xAlice...
```

then the reader can compute the deterministic SOC identifiers for Alice's
Freedom key directory revisions and read them from Swarm under:

```ts
owner = '0xAlice...'
identifier = directoryRevisionIdentifier(revision)
```

The important property is that no centralized lookup service is required. The
wallet address itself tells readers where to look.

## Relationship To `swarm-kit`

`swarm-kit` already contains the generic building blocks for this pattern:

- deterministic identifier derivation
- chunk graph object storage
- indexed SOC streams
- owner records
- signed documents
- public-key encryption envelopes

Freedom Browser does not have to use `swarm-kit` internally. Browser internals
may write directly through Bee/Freedom services. However, the on-Swarm data
model should be compatible with the same principles:

- deterministic namespaced identifiers
- write-once SOC revisions
- object references for larger documents
- explicit owner validation
- canonical validation rules

Public web apps can later use `swarm-kit` to resolve or verify the same records
through `window.swarm`.

## Publication Authority

For the canonical v1 directory, the SOC owner should be the user's Ethereum
wallet address.

That means this read should work:

```ts
await readSingleOwnerChunk({
  owner: walletAddress,
  identifier: directoryRevisionIdentifier(revision),
})
```

This requires Freedom Browser to publish the SOC using the Ethereum wallet
identity, not an unrelated app-scoped identity.

Current Freedom Browser note: ordinary apps may not yet have an API to force
which signing identity the provider uses. That is acceptable for this spec
because Freedom Browser itself is the intended publisher and can enforce the
correct identity internally. If public apps later publish compatible records,
they must check the write result and fail if `write.owner !== walletAddress`.

## Revisioned, Not Mutable

The directory must not rely on overwriting a single SOC coordinate.

Instead, every update is written as a new revision:

```text
revision 0 -> identifier(wallet, 0)
revision 1 -> identifier(wallet, 1)
revision 2 -> identifier(wallet, 2)
...
```

Readers discover the latest contiguous revision by probing revision indexes.
This matches the append-only indexed SOC pattern already used in `swarm-kit`.

Reasons:

- Bee/SOC overwrite behavior is not reliable enough to treat SOCs as mutable
  pointers.
- Revision history is useful for audit, recovery, rotation, and debugging.
- Old public keys may remain relevant for decrypting old messages.
- Concurrent writers can detect collisions and retry.

## Identifier Derivation

Identifier derivation should use the same length-prefixed Keccak part encoding
used by `swarm-kit` unless Freedom Browser defines an equivalent native helper.

Canonical v1 namespace:

```text
freedom:identity-key-directory:v1
```

Directory revision identifier:

```ts
directoryRevisionIdentifier(revision) =
  deriveIdentifier([
    'freedom:identity-key-directory:v1',
    'revision',
    revision,
  ])
```

Properties:

- `revision` must be a non-negative safe integer.
- The resulting identifier is a 32-byte lowercase hex string.
- The wallet address is not included in the identifier because the SOC owner is
  already the wallet address. The full coordinate is `(owner, identifier)`.

## Storage Layout

A directory revision has two layers:

1. a small SOC revision envelope
2. a directory document stored as a Swarm object graph

This keeps the SOC payload small and lets the directory grow to include multiple
devices, keys, and services.

### SOC Revision Envelope

The SOC payload at `(wallet, directoryRevisionIdentifier(revision))` should be:

```json
{
  "version": 1,
  "type": "freedom:identity-key-directory-revision",
  "namespace": "freedom:identity-key-directory:v1",
  "wallet": "0x185479b283475854f6585ffd5393970fddb5ecaf",
  "revision": 2,
  "previousReference": "0x...",
  "directoryReference": "0x...",
  "directorySize": 1234,
  "writtenAt": "2026-05-25T12:00:00.000Z",
  "signature": {
    "scheme": "EIP-191-PERSONAL-SIGN",
    "encoding": "base64",
    "value": "..."
  }
}
```

Fields:

- `version`: currently `1`.
- `type`: exactly `freedom:identity-key-directory-revision`.
- `namespace`: exactly `freedom:identity-key-directory:v1`.
- `wallet`: normalized lowercase wallet address.
- `revision`: non-negative integer matching the identifier index.
- `previousReference`: previous revision SOC reference, or `null` for revision
  `0`.
- `directoryReference`: Swarm object graph root reference for the directory
  document.
- `directorySize`: unencrypted UTF-8 JSON byte length of the directory document.
- `writtenAt`: ISO-8601 timestamp.
- `signature`: optional portable wallet signature over canonical revision
  signing bytes. See "Portable Signatures".

### Directory Document

The object graph referenced by `directoryReference` should contain:

```json
{
  "version": 1,
  "type": "freedom:identity-key-directory",
  "wallet": "0x185479b283475854f6585ffd5393970fddb5ecaf",
  "revision": 2,
  "createdAt": "2026-05-25T10:00:00.000Z",
  "updatedAt": "2026-05-25T12:00:00.000Z",
  "devices": [
    {
      "id": "device-7b9f...",
      "label": "Freedom Browser on MacBook",
      "createdAt": "2026-05-25T10:00:00.000Z",
      "status": "active"
    }
  ],
  "keys": [
    {
      "id": "msg-enc-2026-05-25-device-7b9f",
      "deviceId": "device-7b9f...",
      "purpose": "message-encryption",
      "algorithm": "P-256-ECDH-HKDF-SHA256-AESGCM",
      "encoding": "jwk",
      "publicKey": {
        "kty": "EC",
        "crv": "P-256",
        "x": "...",
        "y": "..."
      },
      "createdAt": "2026-05-25T10:00:00.000Z",
      "notBefore": "2026-05-25T10:00:00.000Z",
      "expiresAt": null,
      "status": "active"
    }
  ],
  "services": [],
  "extensions": {}
}
```

Fields:

- `version`: currently `1`.
- `type`: exactly `freedom:identity-key-directory`.
- `wallet`: normalized lowercase wallet address.
- `revision`: matching revision number.
- `createdAt`: first directory creation timestamp.
- `updatedAt`: current revision timestamp.
- `devices`: public metadata for devices that can own keys.
- `keys`: public key entries.
- `services`: optional app-specific service pointers.
- `extensions`: optional namespaced extension data.

The directory document should not contain private keys, encrypted private keys,
wallet seeds, authentication tokens, message plaintext, or contact lists.

## Key Entries

Each public key entry should contain:

```json
{
  "id": "msg-enc-2026-05-25-device-7b9f",
  "deviceId": "device-7b9f...",
  "purpose": "message-encryption",
  "algorithm": "P-256-ECDH-HKDF-SHA256-AESGCM",
  "encoding": "jwk",
  "publicKey": {},
  "createdAt": "2026-05-25T10:00:00.000Z",
  "notBefore": "2026-05-25T10:00:00.000Z",
  "expiresAt": null,
  "status": "active",
  "retiredAt": null,
  "revokedAt": null,
  "revocationReason": null
}
```

Required fields:

- `id`: stable unique key id inside the directory.
- `purpose`: what the key is for.
- `algorithm`: exact algorithm suite.
- `encoding`: how `publicKey` is encoded.
- `publicKey`: encoded public key.
- `createdAt`: ISO-8601 timestamp.
- `status`: one of `active`, `retired`, or `revoked`.

Recommended v1 purpose:

```text
message-encryption
```

Recommended v1 algorithm:

```text
P-256-ECDH-HKDF-SHA256-AESGCM
```

Rationale: this matches browser Web Crypto and the current `swarm-kit` public
key encryption helper. Freedom Browser may later add X25519 or other algorithm
suites, but P-256 is the most compatible v1 choice.

Status semantics:

- `active`: senders may use this key for new messages.
- `retired`: do not use for new messages, but keep visible because old messages
  may still require the corresponding private key.
- `revoked`: do not use for new messages; the key should be treated as
  compromised or invalid from `revokedAt`.

## Device Entries

Device entries are optional in the strictest v1, but recommended if multi-device
support is expected.

```json
{
  "id": "device-7b9f...",
  "label": "Freedom Browser on MacBook",
  "createdAt": "2026-05-25T10:00:00.000Z",
  "lastUpdatedAt": "2026-05-25T12:00:00.000Z",
  "status": "active"
}
```

The `id` should be random and stable for the installation. Avoid embedding
hardware identifiers or anything that creates unnecessary fingerprinting risk.

## Service Entries

Service entries are optional. They allow the directory to point to app-specific
records without making those app protocols part of the key directory.

Example:

```json
{
  "type": "mailbox",
  "namespace": "freedom:mailbox:v1",
  "recordKey": "mailbox",
  "description": "Primary encrypted inbox endpoint"
}
```

Rules:

- `services` are public metadata.
- The key directory should not define mailbox payload formats.
- Service consumers must validate their own app-specific schemas.
- A service entry may point to an owner record, keyed lookup stream, Swarm
  reference, or another deterministic convention.

## Portable Signatures

The strongest v1 publication model is wallet-owned SOC plus a portable wallet
signature:

1. SOC owner is the wallet address.
2. Revision envelope includes `wallet`.
3. Directory document includes `wallet`.
4. Optional signature proves the wallet signed the revision content even if the
   object is mirrored outside the original SOC coordinate.

The portable signature should sign canonical bytes derived from the revision
envelope without the `signature` field. The signature scheme may be:

```text
EIP-191-PERSONAL-SIGN
```

or, preferably for structured signing if supported cleanly by Freedom Browser:

```text
EIP-712
```

Open point: v1 should decide whether the portable signature is required or
recommended. Since Freedom Browser is the publisher and can sign internally, the
spec leans toward requiring it if the UX/security model is acceptable.

## Write Algorithm

On initial Freedom Browser setup:

1. Create or import the user's main Ethereum wallet.
2. Generate a local Freedom message-encryption keypair.
3. Store the private key locally in Freedom Browser secure storage.
4. Build directory document revision `0`.
5. Publish the directory document as a Swarm object graph.
6. Build revision envelope `0`.
7. Publish the revision envelope as a SOC owned by the Ethereum wallet at
   `directoryRevisionIdentifier(0)`.
8. Read the SOC back and verify:
   - SOC owner equals wallet.
   - SOC identifier equals expected identifier.
   - envelope validates.
   - directory document validates.
   - portable signature verifies, if present.

On update or rotation:

1. Resolve the latest contiguous revision.
2. Copy the existing directory document.
3. Add, retire, or revoke keys/devices.
4. Increment `revision`.
5. Set `previousReference` to the previous revision SOC reference.
6. Publish the new object graph.
7. Publish the new SOC at `directoryRevisionIdentifier(revision)`.
8. Read back and verify.

Concurrent write handling:

- If the target revision already exists and matches the intended envelope, treat
  the write as successful.
- If the target revision exists with different content, recompute latest
  revision and retry with a new revision number.
- Use a bounded retry count and surface a clear error if collisions continue.

## Read Algorithm

Given a wallet address:

1. Normalize the wallet address.
2. Probe revision `0`. If missing, the wallet has no published Freedom key
   directory.
3. Discover the latest contiguous revision using exponential search plus binary
   search, or another bounded indexed-stream lookup.
4. Read the latest revision envelope.
5. Validate:
   - SOC owner equals wallet.
   - identifier equals `directoryRevisionIdentifier(revision)`.
   - envelope `type`, `version`, `namespace`, `wallet`, and `revision`.
   - `previousReference` is correct when walking history.
6. Read the directory document from `directoryReference`.
7. Validate:
   - document `type`, `version`, `wallet`, and `revision`.
   - `directorySize`, if checked.
   - portable signature, if required/present.
   - key entry shapes and statuses.
8. Return active keys for the requested purpose.

For encrypted messaging, senders should normally use active
`message-encryption` keys only.

## Key Rotation And Revocation

Rotation should produce a new directory revision.

Recommended behavior:

- Add new key with `status: active`.
- Change old key to `status: retired` when it should no longer receive new
  messages but may still decrypt old messages.
- Change compromised keys to `status: revoked` with `revokedAt`.
- Keep old public keys in the directory history and current document unless
  there is a strong privacy reason to omit them.
- Keep corresponding private keys locally as long as old messages may need to be
  decrypted.

Revocation does not make previously encrypted messages unreadable by someone who
already has the old private key. It only tells future senders not to use the
revoked public key.

## Multi-Device Model

The directory should allow multiple active devices.

Recommended v1 model:

- Each device has a random `deviceId`.
- Each device may publish one or more public keys.
- A sender may encrypt to all active `message-encryption` keys, or follow an
  app-specific policy for selecting devices.
- Freedom Browser should expose UX for retiring or revoking lost devices.

This avoids requiring private key synchronization before encrypted messaging can
work across devices. Device sync can be designed separately.

## Security Considerations

Public by design:

- Wallet address
- Public keys
- Device count or device labels, if published
- Key rotation timestamps
- Services/endpoints

Private and never published:

- Private keys
- Wallet seed/recovery phrase
- Message plaintext
- Contact list
- Local device secrets

Threats:

- Directory poisoning: mitigated by wallet-owned SOC validation and portable
  wallet signatures.
- Stale directory reads: consumers should tolerate cached/old Swarm data and may
  define freshness policies.
- Wallet compromise: if the root wallet is compromised, the attacker can publish
  malicious key directories. Root wallet recovery/rotation is a separate
  identity problem.
- Device compromise: revoke the affected device keys in a new revision.
- Metadata leakage: publishing keys/services reveals that a wallet uses Freedom
  and may reveal service endpoints.

## Privacy Considerations

Publishing this directory links a wallet address to Freedom Browser usage. That
is acceptable for users who want wallet-address-based discovery, but it should
be explicit in UX.

Freedom Browser should avoid publishing unnecessary personal metadata in v1.
Device labels should be optional and user-editable. Service entries should be
minimal.

## UX Requirements

Freedom Browser should eventually provide:

- setup flow that explains public key publication
- clear display of the wallet identity used as the directory root
- local backup/export UX for private encryption keys, if appropriate
- key rotation button
- device revoke/retire flow
- publish status and retry state
- warning if publication is attempted with the wrong signing identity

For v1, the minimum viable UX is:

- generate local encryption keypair on setup
- publish directory revision under the main wallet
- show whether publication succeeded
- allow manual republish/repair

## Compatibility With Ordinary dApps

Ordinary dApps using `window.swarm` may not be able to force wallet-owned SOC
publication today. They can still:

- ask the user to choose the Ethereum wallet signing identity
- write a compatible record
- verify that the returned SOC owner equals the intended wallet
- fail clearly if not

Freedom Browser itself should not rely on this weaker user-instruction flow for
its internal identity directory. It should publish with the correct wallet owner
directly.

## Possible Future APIs

Freedom Browser may later expose higher-level APIs over this directory:

```ts
await window.freedomIdentity.getKeyDirectory()
await window.freedomIdentity.resolveKeyDirectory(walletAddress)
await window.freedomIdentity.rotateMessageKey()
```

or lower-level provider options:

```ts
await window.swarm.writeSingleOwnerChunk({
  ownerMode: 'ethereum-wallet',
  identifier,
  data,
})
```

This spec does not require those APIs for the browser-internal implementation.

## Open Questions

1. Should portable wallet signatures be required in v1, or only recommended?
2. Should v1 use EIP-191 or EIP-712 for portable signatures?
3. Is P-256 sufficient for v1, or should Freedom Browser use X25519 internally
   and expose a web-compatible fallback?
4. Should the directory be auto-published during onboarding or require explicit
   opt-in?
5. Should each device have a separate encryption key from day one?
6. How should old private encryption keys be backed up or migrated?
7. Should `services` be included in v1 or deferred until mailbox/service specs
   exist?
8. Can the root wallet rotate, and if so, how is that announced and verified?
9. What postage/payment policy should Freedom Browser use for automatic
   directory publication?

## Suggested V1 Scope

Implement the smallest useful version:

- wallet-owned revisioned SOC directory
- one active `message-encryption` public key
- P-256 ECDH public key encoded as JWK
- local private key stored by Freedom Browser
- latest-revision discovery
- key rotation with `active`, `retired`, and `revoked` statuses
- no mailbox protocol details
- optional empty `services` array for forward compatibility
- provider/internal validation that SOC owner equals wallet

This unlocks the essential property:

```text
wallet address -> Swarm lookup -> public encryption key
```

Everything else can build on top of that.
