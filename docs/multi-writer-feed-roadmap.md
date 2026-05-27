# Multi-Writer Feed Maturation Concept

Status: Draft  
Audience: Swarm Kit, Freedom Browser, and app protocol implementers  
Last updated: 2026-05-25

## Summary

Swarm Kit already has a first useful multi-writer feed primitive:

- each writer owns their own deterministic SOC index space
- each entry is written as a SOC
- each entry payload is stored as an object graph
- readers can fan out across known writers and merge entries

That proves the core thesis: raw SOC writes with caller-chosen identifiers make
multi-writer structures possible without Bee-native feed support.

However, the current primitive is intentionally low-level. It answers "how does
one writer append entries under a deterministic writer namespace?" It does not
yet answer the app-level questions that make multi-writer data structures feel
mature:

- How does a reader discover the writers?
- Which writers are trusted, active, revoked, or merely observed?
- What did a writer know when they wrote an entry?
- How does a reader sync new entries without rereading everything?
- How are concurrent edits detected and resolved?
- How does a long-running feed avoid replaying history from genesis?
- How should encrypted group feeds rotate keys?

This document sketches a layered path from today's `multiWriterFeed` to a more
complete multi-writer substrate.

## Current Primitive

Current API shape:

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
```

Current storage shape:

```text
owner A + topic + writerId A + index 0 -> SOC entry
owner A + topic + writerId A + index 1 -> SOC entry

owner B + topic + writerId B + index 0 -> SOC entry
owner B + topic + writerId B + index 1 -> SOC entry
```

Each writer stream is append-only and contiguous. Each entry links to the
previous entry by the same writer:

```ts
interface MultiWriterFeedEntryEnvelope {
  version: 1
  type: 'swarm-kit:multi-writer-feed-entry'
  topic: string
  writerId: string
  index: number
  previousReference: string | null
  payloadReference: string
  payloadSize: number
  writtenAt: string
}
```

This is enough for simple merge-by-time demos and status streams. It is not
enough for collaborative documents, group chat, shared task lists, replicated
state, or serious multi-party protocols.

## Design Principles

1. **Keep the core feed small.**
   The existing feed should remain a deterministic storage primitive, not a
   complete collaboration framework.

2. **Layer app semantics above storage.**
   Membership, trust, conflict resolution, encryption policy, moderation, and
   business rules should be explicit layers.

3. **Make optional layers composable.**
   A simple app should be able to use just writer discovery. A serious app
   should be able to add causal heads, sync cursors, reducers, snapshots, and
   encryption.

4. **Do not pretend timestamps are authority.**
   `writtenAt` is useful for UI ordering, but the writer controls it. Causal
   metadata is needed for robust conflict detection.

5. **Treat SOC ownership as the trust root, not as the whole identity model.**
   A writer is at least `{ owner, writerId }`. Apps may additionally bind owners
   to Ethereum wallets, DID-style records, Freedom identity records, or signed
   documents.

6. **Readers choose policy.**
   Swarm cannot erase already-published chunks. Revocation, moderation, and
   trust decisions are reader-side rules.

## Proposed Layer Stack

```text
Application protocol
        |
        v
Reducers / materialized views / app schemas
        |
        v
Sync cursors + snapshots
        |
        v
Causal multi-writer entries
        |
        v
Writer group / membership discovery
        |
        v
Current per-writer indexed SOC feed
```

The layers can be built incrementally.

## Layer 1: Writer Groups And Membership

The current feed requires readers to already know all writers:

```ts
await feed.readLatest([
  { owner: alice, writerId: 'laptop' },
  { owner: bob, writerId: 'phone' },
])
```

That is the biggest ergonomic gap. A mature multi-writer primitive needs a
discoverable writer set.

### Concept

Introduce a `MultiWriterGroup` primitive that stores a revisioned group
manifest. The manifest lists writers, labels, roles, status, and optional
public keys or profile references.

Example:

```ts
const group = kit.multiWriterGroup.create({
  namespace: 'com.example.team',
  topic: 'status',
})

await group.writeManifest({
  title: 'Core Team Status',
  writers: [
    {
      owner: aliceOwner,
      writerId: 'laptop',
      label: 'Alice Laptop',
      role: 'admin',
      status: 'active',
    },
    {
      owner: bobOwner,
      writerId: 'phone',
      label: 'Bob Phone',
      role: 'member',
      status: 'active',
    },
  ],
})

const latest = await group.readLatest({ limit: 50 })
```

### Manifest Shape

Draft envelope:

```ts
interface MultiWriterGroupManifest {
  version: 1
  type: 'swarm-kit:multi-writer-group-manifest'
  namespace: string
  topic: string
  groupId: string
  title?: string
  revision: number
  writers: MultiWriterGroupWriter[]
  policies?: MultiWriterGroupPolicies
  encryption?: MultiWriterGroupEncryptionPolicy
  updatedAt: string
}

interface MultiWriterGroupWriter {
  owner: string
  writerId: string
  label?: string
  role?: 'owner' | 'admin' | 'member' | 'observer' | string
  status: 'active' | 'revoked' | 'paused' | 'observed'
  joinedAt?: string
  revokedAt?: string
  publicKeys?: Record<string, unknown>
  profileReference?: string
}
```

### Authority Models

There are several possible authority models. Swarm Kit should support the
storage shapes without pretending one is universally correct.

**Single-authority group**

One owner controls the group manifest through an owner record or indexed SOC
record. This is simple and good for teams, channels, and app-created groups.

```text
authorityOwner + group-manifest + revision -> SOC
```

**Wallet-rooted profile discovery**

Each writer publishes their own profile or DID-style record saying which groups
they participate in. Readers discover writers by following profile links.

**Invitation/share-link discovery**

A group URL or invitation contains the authority owner, namespace, topic, and
optional encryption metadata. Readers resolve the current manifest from there.

**Multi-authority manifests**

Multiple admins can publish manifest proposals. Apps choose a rule such as
"accept the highest revision signed by any current admin" or "require threshold
signatures." This is powerful but should be a later layer.

### Revocation

Revocation cannot remove old chunks or make old encryption keys unknowable. It
can only change reader policy.

A revoked writer should have:

- `status: 'revoked'`
- `revokedAt`
- optional `revokedAfterIndex`
- optional `revokedAfterReference`

Readers can then ignore entries beyond the revocation point while still
accepting historical entries.

## Layer 2: Causal Multi-Writer Entries

The current entry links only to the writer's previous entry:

```ts
previousReference: string | null
```

That proves each writer's local append history, but it does not say what other
writers this entry had observed.

For collaborative protocols, entries should optionally include observed heads:

```ts
interface MultiWriterObservedHead {
  owner: string
  writerId: string
  index: number
  reference: string
}

interface MultiWriterFeedEntryEnvelopeV2 {
  version: 2
  type: 'swarm-kit:multi-writer-feed-entry'
  namespace: string
  topic: string
  writerId: string
  index: number
  previousReference: string | null
  observedHeads: MultiWriterObservedHead[]
  payloadReference: string
  payloadSize: number
  writtenAt: string
}
```

### Why Causal Heads Matter

If Alice writes A3 and includes Bob B2 in `observedHeads`, then readers know:

```text
B2 happened-before A3
```

If Alice A3 does not observe Bob B3, and Bob B3 does not observe Alice A3, those
entries are concurrent. The application can surface or resolve the conflict
deterministically.

This makes multi-writer feeds useful for:

- collaborative editing
- CRDT operations
- issue/task state
- group chat read models
- replicated key/value maps
- audit logs with causal context

### API Sketch

```ts
const sync = group.createSync({ cursor })

const entry = await group.feed.append({
  type: 'set-status',
  status: 'online',
}, {
  observedHeads: sync.heads(),
})
```

For convenience, a sync helper should be able to provide `observedHeads`
automatically from the reader's current cursor.

## Layer 3: Sync Cursors

Today, a reader commonly asks for the latest N entries from every known writer.
That is fine for smoke tests and terrible as a long-term app sync strategy.

Introduce a cursor shape:

```ts
interface MultiWriterSyncCursor {
  version: 1
  type: 'swarm-kit:multi-writer-sync-cursor'
  namespace: string
  topic: string
  heads: MultiWriterObservedHead[]
  updatedAt: string
}
```

The cursor records the latest accepted entry per writer. It can live:

- in local app storage
- in an app database
- in a user-owned private record
- in a public SOC if the app wants to publish read state

### API Sketch

```ts
const sync = group.createSync({
  manifest,
  cursor,
})

const batch = await sync.readNew({
  limitPerWriter: 100,
})

cursor = batch.cursor
```

Potential result shape:

```ts
interface MultiWriterSyncBatch<T> {
  entries: MultiWriterFeedEntry<T>[]
  cursor: MultiWriterSyncCursor
  warnings: MultiWriterSyncWarning[]
  failures: MultiWriterSyncFailure[]
}
```

The sync layer should avoid failing the entire read because one writer is
temporarily unavailable. It should report partial failures in a structured way.

## Layer 4: Reducers And Materialized Views

The raw feed gives entries. Apps usually want state.

Swarm Kit should provide a reducer harness and a small set of generic reducers,
without pretending to be a full CRDT framework.

### Generic Harness

```ts
const view = await group.materialize({
  cursor,
  reducer: createLwwMapReducer({
    key: event => event.key,
    value: event => event.value,
  }),
})

console.log(view.state)
console.log(view.conflicts)
console.log(view.cursor)
```

Reducer interface:

```ts
interface MultiWriterReducer<TEntry, TState> {
  id: string
  initialState(): TState
  apply(
    state: TState,
    entry: MultiWriterFeedEntry<TEntry>,
    context: MultiWriterReducerContext,
  ): TState
}
```

### Candidate Built-In Reducers

**Append timeline**

Deterministically sorts entries and returns a timeline. Good for chat, activity
feeds, and audit logs.

**Last-writer-wins register/map**

Useful for simple replicated settings, status, profile fields, and feature
flags. Tie-breakers must be deterministic and explicit.

**Observed-remove set**

Supports add/remove operations with causal context. Good for membership-like
sets, tags, and lightweight collaborative lists.

**Presence map**

Maps writer to latest status entry. Good for user presence and health/status
dashboards.

**Conflict collector**

Does not resolve conflicts. It groups concurrent operations by key so the app
can show a merge UI.

### Important Constraint

Reducers should dedupe by entry reference. They must be deterministic. They
should not trust timestamps for correctness unless the reducer explicitly says
so.

## Layer 5: Snapshots And Compaction

Long-running feeds cannot require replay from genesis forever.

Introduce snapshots that record a materialized state plus the writer heads it is
based on:

```ts
interface MultiWriterSnapshotEnvelope {
  version: 1
  type: 'swarm-kit:multi-writer-snapshot'
  namespace: string
  topic: string
  reducerId: string
  basisHeads: MultiWriterObservedHead[]
  stateReference: string
  stateSize: number
  createdAt: string
}
```

Snapshots can be:

- local-only
- published by each reader for themselves
- published by a group authority
- published by any writer and verified by replaying from `basisHeads`

### Verification Model

A snapshot is trustworthy only under an app policy.

The minimal safe policy:

1. Read snapshot.
2. Treat it as an optimization, not as truth.
3. Replay entries after `basisHeads`.
4. Optionally verify snapshot state by replaying from genesis when practical.

For many apps, an authority-signed snapshot is enough. For adversarial apps,
snapshots need stronger verification or periodic full replay.

## Layer 6: Encrypted Group Feeds

Multi-writer feeds become much more interesting when combined with public-key
encryption and identity records.

Basic model:

1. Group has a content encryption key for the current key epoch.
2. Entry payloads are encrypted before publishing.
3. Group manifest points to key metadata.
4. Recipients obtain wrapped group keys through records, signed documents, or a
   Freedom identity key directory.

Draft metadata:

```ts
interface MultiWriterGroupEncryptionPolicy {
  mode: 'none' | 'shared-key' | 'public-key-wrapped-group-key'
  keyEpoch?: number
  keyRecordReference?: string
}
```

Revocation with encryption is subtle. Removing a writer from future access
requires rotating the group key. It does not make old entries unreadable to
someone who already had the old key.

## Error And Policy Model

Mature multi-writer reads should distinguish:

- missing writer stream
- missing entry
- malformed entry
- payload read failure
- revoked writer
- unknown writer
- duplicate writer tuple
- invalid causal head
- invalid payload schema
- transient provider/node error

The API should prefer structured partial results over all-or-nothing failure:

```ts
interface MultiWriterReadResult<T> {
  entries: MultiWriterFeedEntry<T>[]
  warnings: MultiWriterWarning[]
  failures: MultiWriterFailure[]
}
```

Strict apps can opt into throwing on any warning or failure.

## Proposed Public API Direction

This is a concept sketch, not a final API.

```ts
const group = kit.multiWriterGroup.create({
  namespace: 'com.example.project',
  topic: 'tasks',
  authorityOwner,
})

const manifest = await group.readManifest()

const sync = group.createSync({
  manifest,
  cursor: loadCursor(),
})

const batch = await sync.readNew({
  limitPerWriter: 100,
})

saveCursor(batch.cursor)

const view = await group.materialize(batch.entries, {
  reducer: kit.multiWriterReducers.lwwMap({
    key: event => event.taskId,
  }),
})
```

Append with causal context:

```ts
await group.feed.append({
  type: 'set-title',
  taskId: 'task-1',
  title: 'Ship Swarm Kit',
}, {
  observedHeads: sync.heads(),
})
```

Read latest with built-in membership:

```ts
const entries = await group.readLatest({
  limit: 50,
})
```

## Compatibility With Current `multiWriterFeed`

The current primitive should remain available. It is still useful as the lowest
layer and for simple apps.

Possible path:

1. Keep `kit.multiWriterFeed.create(...)` as the low-level feed.
2. Add `kit.multiWriterGroup.create(...)` for membership-aware feeds.
3. Add entry envelope v2 with `observedHeads`, while still being able to read
   v1 entries.
4. Add sync cursor helpers that work for both v1 and v2, but expose causal
   features only for v2.
5. Add reducers and snapshots above groups.

## What Belongs In Swarm Kit

Good Swarm Kit responsibilities:

- deterministic identifiers and storage envelopes
- writer manifest storage helpers
- membership read/write helpers
- per-writer stream fan-out
- sync cursors
- causal-head helpers
- deterministic ordering and dedupe
- generic reducer harness
- small generic reducers
- snapshot envelope helpers
- encryption envelope integration points

App responsibilities:

- deciding who is allowed in a group
- deciding who has admin authority
- resolving trust in membership manifests
- validating payload schemas
- defining app-specific event semantics
- choosing conflict policies
- rendering merge/conflict UI
- deciding key management and rotation UX
- enforcing deadlines, moderation, and business rules

## Suggested Implementation Phases

### Phase 1: Writer Group Manifest

Build a small membership primitive first.

Deliverables:

- `src/multi-writer-group.ts`
- manifest write/read/history helpers
- group `feed()` wrapper around current `multiWriterFeed`
- playground panel for group membership
- tests for writer discovery and revoked/active filtering

This gives immediate practical value: readers no longer need hard-coded writer
lists.

### Phase 2: Sync Cursors

Add cursor-based incremental reads.

Deliverables:

- cursor type
- `readNew(...)`
- cursor merge/update helpers
- partial failure reporting
- tests for incremental sync across multiple writers

This turns multi-writer feeds from a demo into something apps can poll.

### Phase 3: Causal Entries

Add optional `observedHeads` in a v2 entry envelope.

Deliverables:

- v2 writer entry envelope
- append with observed heads
- happened-before/concurrency helpers
- compatibility reads for v1 entries

This unlocks real conflict detection.

### Phase 4: Reducer Harness

Add deterministic state materialization.

Deliverables:

- reducer interface
- timeline reducer
- LWW register/map reducer
- observed-remove set reducer
- conflict collector
- tests for deterministic replay

This is where the primitive starts feeling like an app framework.

### Phase 5: Snapshots

Add state snapshots and replay-from-basis.

Deliverables:

- snapshot envelope helpers
- publish/read snapshot helpers
- apply snapshot + delta flow
- snapshot verification notes

This makes long-running groups practical.

### Phase 6: Encrypted Groups

Integrate encryption metadata without forcing one key management scheme.

Deliverables:

- group encryption policy shape
- encrypted payload helper wrappers
- key epoch metadata
- docs on revocation and key rotation limits

This should probably wait until Freedom identity/key-directory work is clearer.

## Open Questions

- Should the first group manifest be single-authority only?
- Should group manifests be owner records, DID-style documents, or a new
  revisioned primitive?
- Should manifest envelopes be signed documents in addition to SOC-owned?
- What is the right default for writer identity: one writer per owner, or
  owner plus device-level `writerId`?
- Should `writerId` be app-chosen, random, device-derived, or key-derived?
- How much v1/v2 compatibility should the group layer expose?
- Should Swarm Kit provide payload schema validation hooks, or keep that fully
  outside?
- Which reducers are generic enough to include without creating false
  confidence?
- How should snapshots be trusted in adversarial settings?
- How should this line up with Freedom Browser wallet-owned identity records
  and future key directory work?

## Recommendation

Start with **Phase 1: Writer Group Manifest**.

It fixes the most visible weakness in the current multi-writer primitive:
readers need a known writer list. It is also conceptually clean and does not
force us to solve CRDTs, snapshots, or encrypted groups immediately.

After that, add **Sync Cursors** and **Causal Entries**. Those two layers are the
turning point where multi-writer feeds become a serious substrate for
collaborative apps instead of a merge-by-timestamp demo.
