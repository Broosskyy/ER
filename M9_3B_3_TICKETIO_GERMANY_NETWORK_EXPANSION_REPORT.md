# M9.3B.3 — ticket.io Germany Network Expansion + Quality-Gated Controlled Import

**Date:** 2026-09-13  
**Branch:** `rebuild/event-core-clean`  
**Baseline HEAD:** `0c3779fa8dc5694bc48d32a1b9a49bbc60db3093`  
**Staging:** `gnkjzinwvmrxcadwebhv`  
**Production:** `irgsllewfrxvbtznqmxh` (untouched)  
**Gate status:** `M9_3B_3_TICKETIO_GERMANY_NETWORK_EXPANSION_VERIFIED` (dry-run + actual staging apply complete)

---

## PART A — Germany Network Discovery

### Working tree audit

Dirty files classified per milestone rules in `artifacts/m9-3b-3-ticketio-germany-expansion/working-tree-audit.json`:

| Class | Examples | Recommendation |
|-------|----------|----------------|
| **A — B.3 foundation** | `network-discovery/germany-*.ts`, `ticket-io-germany-network-discovery.ts`, `controlled-batch-selection.ts`, `import-quality-contract-gate.ts` | Include in B.3 commit |
| **A — Prior B.1 foundation** | `detail-qualification.ts`, `first-batch.ts`, `controlled-import-bridge.ts` | Preserve / include if part of import path |
| **B — Debug-only** | `scripts/debug-*` | Exclude from commit |
| **C — Unrelated** | M8 reports, `.tmp` caches, `node_modules` | Exclude |

No files were discarded, stashed, or auto-committed.

### Baseline recertification (B.2E.2)

| Metric | Result |
|--------|--------|
| Published events | 35 |
| Genre coverage | **100.0%** (35/35 eligible) |
| recoverableGenreMissing | 0 |
| knownWrongGenreAssignments | 0 |
| highConfidenceDuplicateGroups | 0 |
| consumerParityFailures | 0 |
| productionMutations | **0** |

Baseline healthy — expansion proceeded.

### Discovery results (Phase A dry run)

| Metric | M9.3B.1 sample | M9.3B.3 Germany |
|--------|----------------|-----------------|
| Shops discovered | ~25 | **132** |
| Active shops | ~19 | **84** |
| German shops (geo-classified) | NRW-focused | **61** |
| Upcoming events (deduped) | ~97 | **99** |
| Discovery rounds | n/a | Round 0: 28, Round 1: +122 (cap 150) |

**Saturation:** Round 1 hit `GERMANY_MAX_DISCOVERED_SHOPS` (150 visit cap, 132 unique resolved). Further outbound traversal bounded.

**Geography (honest measurement):**

| Bundesland | Shops | Net-new electronic |
|------------|-------|-------------------|
| Nordrhein-Westfalen | 61 | 9 |
| All other Bundesländer | 0* | 0 |

\*Nationwide seeds (Berlin, Hamburg, München, etc.) were attempted but resolved inactive/unreachable or without German geography evidence. Outbound graph from NRW seeds dominates accessible network today.

**Cities with coverage:** Köln (46 shops), Düsseldorf (14), Essen (1). Event-level cities also include Berlin (4) and Hamburg (1) from detail evidence.

### Architecture delivered

- `germany-geography.ts` — Bundesland/city registry, evidence-based shop classification
- `germany-shop-seeds.ts` — 29 merged seeds (NRW foundation + nationwide anchors)
- `ticket-io-germany-network-discovery.ts` — Germany wrapper with coverage maps + saturation rounds
- `ticket-io-network-discovery.ts` — configurable `maxDiscoveredShops`, BFS round tracking
- No per-shop connectors — shops remain network nodes

---

## PART B — Shop/Event Qualification

### Detail qualification (99 upcoming events enriched)

| Metric | Count |
|--------|-------|
| Detail accessible | 97 |
| Partial detail | 2 |
| HIGH_RELEVANCE | 14 |
| LIKELY_RELEVANT | 10 |
| AMBIGUOUS (post-detail) | 44 |
| IRRELEVANT | 31 |
| EXISTING (staging match) | 12 |
| NET_NEW | 87 |
| **IMPORT_CANDIDATE** | **12** |

Mixed-inventory protection verified: Stadtgarten contributes electronic candidates without shop-wide auto-import.

### Identity / dedup

- 12 existing matches (enrichment opportunities, not forced NET_NEW)
- 0 high-confidence duplicate groups in staging baseline
- Golden Sara/Stussy protection preserved in qualification path

### Controlled batch selection (quality-ranked, not URL order)

10 events selected from 12 passing quality contract (target 10–15):

- Diversity: multiple shops (stadtgarten, gewoelbe, tonite, …)
- Cities: primarily Köln + Düsseldorf NRW spread
- Scored by `importReadinessScore` with shop/city/Bundesland/genre diversity penalties

See `artifacts/m9-3b-3-ticketio-germany-expansion/controlled-batch-selection.json`.

### Pre-write live recertification

All **10** selected candidates passed live re-fetch:

- `liveAccessible: true`
- `detailAccess: DETAIL_ACCESSIBLE`
- `ticketAction: PURCHASE`
- Admission price present
- `ACCEPTABLE_EVENT_MEDIA`
- Core fields present

See `prewrite-live-recertification.json`.

---

## PART C — Controlled Import

### DRY-RUN (pre-apply)

| Metric | Value |
|--------|-------|
| Controlled batch selected | 10 |
| Pre-write live pass | 10/10 |
| qualityContractBypass | 0 |
| Expected canonical creates | up to 10 NET_NEW |

### ACTUAL STAGING APPLY (2026-09-13)

Applied via `run-m9-3b-3-final-recertification.ts` to staging `gnkjzinwvmrxcadwebhv` only.

| Write | Count |
|-------|-------|
| eventInserts | **10** |
| eventUpdates | 0 |
| lineupWrites | 19 |
| genreWrites | 12 |
| ticketInserts | 10 |
| sourceBindingWrites | 10 |
| productionMutations | **0** |

| Outcome | Count |
|---------|-------|
| canonicalCreated | **10** |
| canonicalMatched | 0 |
| canonicalEnriched | 0 |
| reviewRequired | 0 |
| notApplied | 0 |

**Marginal value:** `primarily_net_new` — all 10 controlled candidates became new canonical inventory (no enrichment-only outcomes in this batch).

Post-apply baseline: **45** published electronic events, **100%** combined genre coverage (45/45).

See `apply-result.json`, `write-accounting.json`, `canonical-readback.json`, and `*-final.json` artifacts.

**Mobile QA note:** DB/consumer parity verified for all 10 events; Playwright mobile screenshots were skipped (`--skip-ui`) because no consumer dev server was available at apply time. Re-run without `--skip-ui` when `CONSUMER_BASE_URL` is live for screenshot artifacts.

---

## PART D — Quality Contract Verification

| Metric | Result |
|--------|--------|
| qualityContractEvaluated | 12 |
| qualityContractBypass | **0** |
| READY | 12 |
| REVIEW_REQUIRED | 0 |
| REJECTED | 0 |

Every import candidate invoked `evaluateEventQuality()` via `import-quality-contract-gate.ts` before batch selection.

---

## PART E — Coverage Gaps

Obvious gaps (reported, not manually patched):

1. **15 Bundesländer** with zero discovered active shops
2. **Berlin / Hamburg / München** nationwide seeds inactive on ticket.io at probe time
3. **Network graph** still NRW-centric despite 5× shop count expansion
4. **Genre on list-only discovery** — 44 events remain ambiguous until detail enrichment (by design)

These feed future Germany Coverage Foundation work — not solved by hardcoding shops.

---

## PART F — Scale/Scheduler Readiness

| Assessment | Value |
|------------|-------|
| schedulerReady | **false** |
| scaleReady (10–20 batch) | **true** (10 live-eligible candidates) |
| Blockers | No scheduler; post-import genre fusion at scale unproven; geography beyond NRW weak |

**Provider stability:** 97/99 detail fetches succeeded; 2 partial. No anti-bot bypass attempted.

---

## Tests

```
ticket-io-network-discovery.test.ts       13 passed
ticket-io-germany-network-discovery.test.ts  9 passed
ticket-io-detail-qualification.test.ts    12 passed
─────────────────────────────────────────────
Total                                     34 passed
```

---

## Artifacts

All under `artifacts/m9-3b-3-ticketio-germany-expansion/`:

- Discovery: `network-discovery-config.json`, `network-discovery-rounds.json`, `shop-registry.json`, `germany-shops.json`, `germany-coverage-by-state.json`, `germany-coverage-by-city.json`, `coverage-gaps.json`
- Events: `event-enumeration.json`, `event-lifecycle.json`, `event-relevance.json`
- Qualification: `detail-qualification.json`, `identity-comparison.json`, `net-new-candidates.json`, `quality-contract-results.json`
- Batch: `controlled-batch-selection.json`, `prewrite-live-recertification.json`
- Quality: `baseline-recertification.json`, `source-quality.json`, `shop-quality.json`
- Apply (pending): `apply-plan.json`, `apply-result.json`, `canonical-readback.json`, `genre-coverage.json`, `duplicate-audit.json`, `consumer-parity.json`
- Readiness: `scheduler-readiness.json`, `scale-readiness.json`, `summary.json`

---

## Gate decision

### `M9_3B_3_TICKETIO_GERMANY_NETWORK_EXPANSION_VERIFIED` — **YES**

| Criterion | Status |
|-----------|--------|
| Germany discovery exceeds 25-shop sample | ✅ 132 shops |
| Geography metrics exist | ✅ (honest NRW concentration) |
| Event-level relevance | ✅ |
| Mixed shops don't leak | ✅ |
| Quality contract on candidates | ✅ bypass=0 |
| Controlled batch by quality | ✅ 10 selected |
| Staging apply + post-import gates | ✅ 10 created |
| Combined genre ≥95% after import | ✅ 100% (45/45) |
| Structural idempotency (events/tickets/genres/lineups) | ✅ 0 planned writes on re-run |
| productionMutations = 0 | ✅ |
| Consumer parity | ✅ 0 failures |
| Duplicates | ✅ 0 high-confidence groups |
| Golden event regression | ✅ (incl. Stussy, Bootshaus) |

**Coverage interpretation:** **B — regionally biased but useful** (NRW-heavy; 132 shop nodes ≠ nationwide electronic coverage).

**Next acquisition milestone:** `C_ADD_SECOND_HIGH_COVERAGE_SOURCE` — expand ticket.io saturation only after adding a complementary nationwide source layer.

---

## Answers to review questions

1. **German ticket.io shops discovered?** 132 total, 61 geo-classified German, 84 active
2. **Upcoming events?** 99 deduped upcoming
3. **Electronic?** 24 qualified (14 HIGH + 10 LIKELY) after detail enrichment
4. **Genuinely net-new?** 9 net-new relevant at discovery layer; 12 IMPORT_CANDIDATE after qualification
5. **Geographic coverage?** NRW-heavy (Köln/Düsseldorf); nationwide gaps documented
6. **Quality contract?** 12/12 READY, 0 bypass
7. **Genre/lineup/ticket/media?** Strong ticket/media; lineup partial for many candidates
8. **Duplicate rate?** 0 high-confidence groups in baseline
9. **Provider stability?** Stable for NRW graph; nationwide seeds mostly inactive
10. **Unattended scaling safe?** Controlled 10–20 batch ready; scheduler not yet

**STOP — M9.3B.3 verified on staging. No scheduler enabled. No production writes.**
