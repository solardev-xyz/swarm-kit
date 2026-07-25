# SQL Over Swarm Via The Provider (swarmlite Integration Sketch)

Status: Draft  
Audience: Swarm Kit and Freedom Browser teams  
Last updated: 2026-07-25

## Summary

[swarmlite](https://github.com/petfold/swarmlite) is verifiable serverless
SQLite on Swarm: a page opens a *published* SQLite file and runs `SELECT`
against it, fetching only the 4 KB B-tree pages the query plan touches (one
page = one Swarm chunk). Measured live: a cold indexed lookup on a 41.9 MB
database costs 5 fetches / 20 KB; costs grow logarithmically with database
size. Writes never happen over the network — a publisher edits a local file
and ships an immutable snapshot, optionally advancing a feed.

That makes a SQL database exactly the kind of thing Swarm Kit describes as a
"reusable browser-friendly data structure" over chunk primitives: apps like
wiki search, geocoding, or catalogs need *queries* (reader-chosen questions),
which neither raw chunks nor pre-rendered pages provide.

swarmlite's reader has two transport modes today, and the second one maps
almost 1:1 onto the `window.swarm` provider:

1. **Range mode** (default): HTTP `Range: bytes=a-b` reads against a
   `/bzz/<root>/<path>` URL. Inside Freedom Browser this rides the `bzz://`
   protocol handler's Range pass-through (see
   solardev-xyz/freedom-browser#169) and needs nothing from the provider.
2. **Verified mode** (`verify: true`): the client resolves the Mantaray
   manifest itself and reads content chunk-by-chunk, BMT-checking every chunk
   against the reference it was requested by. Its *only* transport need is
   `chunk(reference) -> bytes` — which is `provider.readChunk`.

## Mapping verified mode onto the provider

swarmlite's verified reader is built around a `VerifiedChunkStore` whose one
I/O dependency is a fetch function. A provider-backed store is ~20 lines:

```js
import { VerifiedChunkStore } from 'swarmlite/verify';

function providerChunkStore(swarm) {
  return {
    async chunk(refHex) {
      const { data, span } = await swarm.readChunk({ reference: refHex });
      const payload = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const spanBytes = new Uint8Array(8);
      new DataView(spanBytes.buffer).setBigUint64(0, BigInt(span), true);
      const chunk = new Uint8Array(8 + payload.length);
      chunk.set(spanBytes);
      chunk.set(payload, 8);
      // swarmlite verifies: BMT(chunk) must equal refHex, else throws
      return chunk;
    },
  };
}
```

On top of that, swarmlite already implements (as pure functions over the
chunk store): the Mantaray manifest walk (path → file reference), the
range-descending tree reader (only the subtrees a query needs), and the
SQLite VFS that turns `SELECT` into those reads. Feed resolution maps onto
`readFeedEntry` / `readSingleOwnerChunk`; swarmlite's own single-owner-chunk
verification (address derivation + owner-signature recovery) can then run on
the returned bytes, so a dapp need not trust the resolver.

## One provider-contract question: span byte fidelity

`SwarmChunkReadResult` returns `span` as a parsed `number | bigint`. BMT
verification hashes the stored chunk bytes *as-is*, and Bee packs the
erasure-coding redundancy level into the span's top byte (`span[7] > 128`)
on redundancy-uploaded content. A parsed integer cannot round-trip that
byte, so verification of erasure-coded content would fail through the
provider even when the content is genuine.

Two possible resolutions, either of which works for swarmlite:

- expose the raw 8 span bytes (e.g. `spanBytes: base64`) alongside the
  parsed value, or
- document that `readChunk` returns *normalized* spans and that the provider
  itself has already BMT-verified the chunk against the requested reference
  (in which case app-level verification is redundant by contract, and the
  provider guarantee should say so explicitly).

This is exactly the class of guarantee the provider-compliance page pins
down, so it seemed worth raising while the contract is young. (Background:
swarmlite's tree walker originally assumed a 128-ref fanout and failed live
on redundancy-uploaded files — 107 data + 21 parity refs per intermediate
chunk. The fix, inferring the per-child span unit from the first child's own
span, is in both swarmlite and swarmfs now, and any provider-side joiner
wants the same behavior.)

## Status and next steps

- The reader, verified mode, and a pure-JS publisher exist and are tested
  (npm package `swarmlite`; live demo root
  `bzz://d1d54686def7f40714d093f2d8c4a2739d6d905d16b834b41f04b7128be8690b/`).
- The provider adapter above is a sketch: it type-checks against
  `src/provider.ts` but has not yet run inside Freedom Browser. The natural
  first test is the provider-compliance route: a small page that opens a
  published database through `providerChunkStore` and asserts a known query
  result plus a tampered-chunk rejection.
- If the direction looks right to the Swarm Kit team, we would follow up
  with that test page and, if wanted, a `swarmlite` peer-dependency example
  under `examples/`.
