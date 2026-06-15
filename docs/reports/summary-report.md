The v3 reports are strong enough to hand to the Ant maintainer.

Bee baseline:

```txt
docs/reports/bee-report-3.json
36 passed / 0 failed
```

Ant:

```txt
docs/reports/ant-report-3.json
26 passed / 10 failed
```

Important update from v3: CAC is no longer a good primary accusation. The focused diagnostics show Ant can read:
- small CACs
- varied CAC sizes up to 4096
- `'x'.repeat(4096)` immediately and after delay

So the earlier CAC failure looks non-deterministic or run-specific. I would not lead with CAC.

The solid root issues are now:

1. **SOC roundtrip by address is flaky/broken in the basic test**
   - `soc-roundtrip-address` fails:
     ```txt
     writeSingleOwnerChunk -> success
     readSingleOwnerChunk({ address: returnedReference }) -> chunk_not_found
     ```
   - But the focused diagnostic `diagnostics-soc-address-owner-timeline` passes.
   - Interpretation: SOC read-after-write by address is not consistently reliable. Could be timing/race/state-specific, not purely unsupported.

2. **Native feed reads after writes are broken**
   The strongest evidence is `diagnostics-feed-auto-timeline`:

   ```txt
   create-feed -> pass
   write-auto-0 -> pass, index 0
   read-latest-after-0 -> feed_empty
   read-index-0 -> pass
   write-auto-1 -> fails because provider returns index 0 instead of 1
   read-latest-after-1 -> feed_empty
   read-index-1 -> entry_not_found
   ```

   This points to a specific feed bug:
   - exact index read can see index `0`
   - latest feed read cannot see the same entry
   - auto-increment relies on latest, so it writes `0` again instead of `1`

3. **Native feed sparse/overwrite behavior is unstable across runs**
   In v2, sparse feed failed. In v3, focused sparse diagnostics passed. But default feed tests still fail:

   ```txt
   feed-sparse-index-write-read -> entry_not_found at index 5
   feed-overwrite-protection -> duplicate index 5 unexpectedly succeeds with { index: 5 }
   ```

   Interpretation: explicit-index feed behavior is inconsistent. Sometimes sparse index writes are visible and duplicate-protected, sometimes not.

4. **Indexed SOC / composed SOC streams are unstable**
   Failures:

   ```txt
   indexed-soc-append-read -> append collision at index 2
   primitive-multi-writer-feed -> append collision at index 2
   ```

   But `diagnostics-indexed-soc-timeline` passes. Same pattern: Ant can do the operation, but not reliably under the broader suite. This suggests timing/race/read-after-write consistency problems.

**Handoff Summary For Ant Maintainer**

I’d give them:
- `docs/reports/bee-report-3.json`
- `docs/reports/ant-report-3.json`
- This distilled claim:

```md
Bee-backed Freedom passes the Swarm Kit Provider Test Center: 36/36.

Ant-backed Freedom passes provider bootstrap and many raw CAC/SOC operations, but fails 10/36 tests. The strongest reproducible issue is native feed latest/auto-index behavior:

- `swarm_writeFeedEntry({ name, data })` returns `{ index: 0 }`
- `swarm_readFeedEntry({ name })` then returns `feed_empty`
- `swarm_readFeedEntry({ name, index: 0 })` can read the entry
- a second auto `swarm_writeFeedEntry({ name, data })` returns index `0` again instead of `1`

This means exact index reads and latest reads disagree, and auto-increment cannot work reliably.

There are also intermittent/inconsistent failures around:
- `readSingleOwnerChunk({ address })` immediately after `writeSingleOwnerChunk`
- sparse explicit feed index read/duplicate protection
- indexed SOC stream append/read sequences

See the attached Ant JSON report for exact owner/topic/index/identifier/reference data.
```

I’d ship that. It’s concrete enough now.