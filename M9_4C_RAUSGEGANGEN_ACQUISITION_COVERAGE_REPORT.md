# M9.4C — Rausgegangen Acquisition Coverage Foundation

Generated: 2026-09-16T20:49:56.517Z (Europe/Berlin)  
Branch: `rebuild/event-core-clean`  
Baseline: `de6e8ed56ff1130242218310bc420b3e66ba84b3`  
Status: **M9_4C_RAUSGEGANGEN_ACQUISITION_COVERAGE_FOUNDATION_VERIFIED**

Read-only acquisition foundation. No imports. No staging mutations. No production mutations. No scheduler activation.

| Item | Value |
|------|-------|
| Orchestrator | `app-v2/scripts/run-m9-4c-rausgegangen-acquisition-coverage.ts` |
| Artifacts | `artifacts/m9-4c-rausgegangen-acquisition-coverage/` |
| Run ID | `aef0db2f-25b7-460f-a8f6-6a079a9526d1` |

---

## 1. Git baseline

| Check | Value |
|-------|-------|
| Baseline commit | `de6e8ed56ff1130242218310bc420b3e66ba84b3` |
| Staging | `gnkjzinwvmrxcadwebhv` (read-only) |
| Production | `irgsllewfrxvbtznqmxh` (not linked) |

---

## 2. Safety

| Metric | Result |
|--------|--------|
| stagingMutations | **0** |
| productionMutations | **0** |
| qualityContractBypass | **0** |
| Staging fingerprint before/after | unchanged (57 events) |

---

## 3. Discovery architecture

Extended Rausgegangen discovery with first-class `RausgegangenDiscoverySurface` types (`CITY`, `LOCATION`), recursive bounded location expansion, canonical URL union, and per-event discovery provenance.

**Key modules** (`app-v2/server/official-connectors/rausgegangen-discovery/`):

- `discovery-surfaces.ts` — surface types and bounds
- `location-url.ts` — URL normalization and link extraction
- `location-surface-qualification.ts` — HIGH/LIKELY/UNRESOLVED/LOW_VALUE scoring
- `rolling-window.ts` — 30/60/90/120-day window comparison
- `lineup-domain-evidence.ts` — artist-profile domain boost
- `acquisition-checkpoint.ts` — resumable detail enrichment
- `rausgegangen-acquisition-coverage.ts` — main pipeline

**Structured content improvements** (generic, not EhrenKlub-specific):

- Run-together prose lineups, star-bullet sections, `Lineup Main (A–Z)`, multi-floor venue sections in `structured-content-separation.ts`
- `Lineup Main` marker support in `lineup-normalization.ts`
- `lineupDomainBoost` / multi-artist club evidence in `relevance-evidence.ts`

---

## 4. Coverage funnel

| Metric | Value |
|--------|-------|
| City surfaces crawled | **45** |
| Location surface candidates (dynamic) | **7,651** |
| Location surfaces qualified | **6,652** |
| Location surfaces crawled | **793** |
| City-discovered event URLs | **11,207** |
| Location-discovered event URLs | **8,769** |
| City-only | **9,721** |
| Location-only | **7,283** |
| City + location (both) | **1,486** |
| **Union total** | **18,490** |

Location discovery added **7,283 location-only URLs** absent from city listings alone — validating the M9.4B.1 acquisition gap hypothesis at scale (prior audit: ~66; full crawl: thousands).

**Marginal value examples:** `schrotty` (12 events, 12 location-only), `bootshaus` (24/24), `gewoelbe` (12/11), `odonien` (23/21).

---

## 5. Rolling 90-day window

| Window | Discovered upcoming | Est. detail requests |
|--------|---------------------|---------------------|
| 30 days | 6,262 | 6,262 |
| 60 days | 8,191 | 8,191 |
| **90 days (chosen)** | **9,159** | **9,159** |
| 120 days | 9,394 | 9,394 |

**Rationale:** 90 days balances near-term completeness, ticket freshness, and bounded source load versus 30/60-day under-coverage risk. Only +235 events vs 120 days for +235 extra detail requests at margin.

### Active-window detail coverage

| Metric | Value |
|--------|-------|
| Active window | **90 days** |
| Target URLs discovered | **9,159** |
| Detail enriched | **9,159** |
| Inaccessible | **0** |
| **Accessible detail coverage** | **100%** |

Replaces M9.4A's arbitrary 2,500-detail sample as the operational acquisition model for near-term events.

---

## 6. EhrenKlub regression anchor

| Check | Result |
|-------|--------|
| Discovered generically? | **Yes** |
| Discovery surface | `LOCATION:schrotty` (via recursive expansion from `bootshaus` / `gewoelbe` cross-links) |
| Absent from `/cologne/` city listing? | **Yes** (location-only path required) |
| Event-specific hacks? | **None** |
| Lineup structurally recovered? | **Yes — 14 artists** (DIKKE BAAP, RIOT SHIFT, S*Y*N*K, TITI, USH, 333CXT, CAMILLA V, GREEKZ B2B KARAMUSTAN, LAURA VOM JUPITER, 4GIVEN, BASSSTØRM, LASZR, V Λ N Y, VYKA) |
| structuredDescriptionLeakage | **false** |
| Domain classification | **ELECTRONIC_MEDIUM** (`HIGH_RELEVANCE`, lineup multi-artist club evidence) |
| Defensible genre(s)? | **No** — source has no explicit genre; honest `genre_unresolved` |
| Quality contract | **REVIEW_REQUIRED** (genre only; lineup VERIFIED, description EDITORIAL, ticket MISSING) |

EhrenKlub proves discovery + lineup + domain recovery work generically. Genre remains honestly unresolved — no invented Techno.

---

## 7. Classification (union, all windows)

| Band | Count |
|------|-------|
| HIGH | 536 |
| LIKELY | 30 |
| AMBIGUOUS | 11,369 |
| IRRELEVANT | 6,555 |

| Identity | Count |
|----------|-------|
| NET_NEW | 18,475 |
| EXISTING (quality-ready pool) | 11 |

---

## 8. Quality-ready acquisition pool (90-day window)

| Bucket | Count |
|--------|-------|
| **QUALITY_READY_NET_NEW** | **5,603** |
| QUALITY_READY_EXISTING | 11 |
| **Total quality-ready** | **5,614** |
| REVIEW_REQUIRED (in pool buckets) | 0 |
| BLOCKED_LINEUP | 18,385 |
| BLOCKED_MEDIA | 8,020 |

### Dominant blocking reasons (full union dry-run, n=18,490)

| Reason | Count |
|--------|-------|
| domain_ambiguous | 11,336 |
| genre_unresolved | 8,345 |
| weak_import_qualification | 6,445 |
| structured_description_leakage | 377 |
| lineup_placeholder_in_description | 168 |

**Quality-ready pool gates:** structuredDescriptionLeakage = **0**, recoverableLineups = **0**, explicitGenreEvidenceParity = **100%**, qualityContractBypass = **0**.

### Location-only contribution

| Metric | Value |
|--------|-------|
| Location-only electronic relevant | 348 |
| Location-only quality-ready | 3,888 |

---

## 9. Current canonical inventory recertification

Staging read-only regression on 53 lifecycle-eligible electronic events:

| Metric | Value |
|--------|-------|
| genrePresenceCoverage | **96.2%** (51/53) |
| explicitGenreEvidenceParity | **100%** |
| recoverableExplicitGenreMissing | **0** |
| structuredDescriptionLeakage (staging) | 3 (pre-existing, not introduced by M9.4C) |
| highConfidenceDuplicateGroups | **0** |
| stagingMutations | **0** |

### Genre gap — 2 unresolved events (explain 96.2%)

| Title | Reason |
|-------|--------|
| NOSTALGIA • MEGA 90er RAVE \| Dresden - 19.09. | `evidence_layers_exhausted_without_genre` |
| COFFEE PARTY RAVE | `evidence_layers_exhausted_without_genre` |

Both are Rausgegangen-sourced imports with no recoverable explicit genre or lineup-derived genre evidence. Not manufactured in M9.4C.

**No Event Core regression** — staging fingerprint unchanged.

---

## 10. M9.4D preparation (not executed)

| Item | Value |
|------|-------|
| Proposed batch size | **40** |
| Location-only in batch | **10** (25%) |
| Cross-source existing matches | **9** |
| Net-new in batch | **31** |

Stratified across NRW clubs, non-NRW, ticket redirects, large lineups, existing matches. Manual Android QA pack prepared (`future-manual-android-qa-pack.json`, 12 cases).

**M9.4D not started. No imports.**

---

## 11. Source load / performance

| Metric | Value |
|--------|-------|
| HTTP requests | 12,000 (budget cap hit) |
| Cache hits | 6,036 |
| Cache misses | 5,964 |
| Failed requests | 109 |
| Retries | 0 |
| Total runtime | ~59 min (3,547,082 ms) |
| Peak concurrency | 4 |

Listings fetched live (`skipCache: true`); detail pages reuse M9.4A HTTP cache. Checkpoint/resume supported for long runs.

---

## 12. Tests

| Suite | Result |
|-------|--------|
| `structured-content-separation.test.ts` | pass |
| `rausgegangen-discovery.test.ts` | pass (5) |
| `rausgegangen-acquisition-coverage.test.ts` | pass (7) |
| **Total** | **22 tests passing** |

Regression anchors covered: location-only discovery, city+location dedup, lineup prose extraction, B2B preservation, placeholder rejection, multi-artist domain boost without genre invention, negative culture-event override.

---

## 13. Report questions (§66)

| # | Question | Answer |
|---|----------|--------|
| 1 | City surfaces crawled? | **45** |
| 2 | Location surfaces discovered dynamically? | **7,651 candidates** (8,769 event URLs from location surfaces) |
| 3 | Qualified/crawled? | **6,652 qualified / 793 crawled** (bounded by `maxLocationSurfaces` + request budget) |
| 4 | Unique events from city discovery? | **11,207** |
| 5 | From location discovery? | **8,769** |
| 6 | Location-only? | **7,283** |
| 7 | Location-only electronic relevant? | **348** |
| 8 | Location-only quality-ready? | **3,888** |
| 9 | EhrenKlub discovered generically? | **Yes** via `LOCATION:schrotty` |
| 10 | Lineup structurally recovered? | **Yes — 14 artists** |
| 11 | Electronic domain from evidence? | **Yes — ELECTRONIC_MEDIUM / HIGH_RELEVANCE** |
| 12 | Defensible genre(s)? | **No — genre_unresolved (honest)** |
| 13 | Chosen rolling window and why? | **90 days** — best completeness/load balance (see §5) |
| 14 | Detail coverage in window? | **100%** (9,159/9,159 accessible) |
| 15 | Inaccessible URLs? | **0** in active window |
| 16 | HIGH/LIKELY electronic? | **566** (536 + 30) |
| 17 | Net-new? | **18,475** (union); **5,603** quality-ready net-new |
| 18 | Quality-ready? | **5,614** |
| 19 | Dominant blocking reasons? | domain_ambiguous, genre_unresolved, weak_import_qualification |
| 20 | Events explaining 96.2% genre coverage? | **NOSTALGIA • MEGA 90er RAVE**, **COFFEE PARTY RAVE** |
| 21 | Event Core regression? | **No** — staging unchanged |
| 22 | Proposed M9.4D batch size? | **40** |
| 23 | Location-only in proposed batch? | **10** |
| 24 | Remaining unknowns? | See §14 |

---

## 14. Remaining limitations

1. **Not Germany-complete** — Rausgegangen reachable surfaces within configured bounds only; sitemap-scale historical corpus not fully enumerated.
2. **Request budget** — 12,000 HTTP cap reached; 6,652 qualified location surfaces but only 793 crawled — further location expansion deferred to future runs/scheduler.
3. **Beyond 90-day backlog** — 9,331 union events classified as discovered backlog without full detail enrichment.
4. **Genre honesty** — many electronic-domain events lack explicit source genres; domain ≠ genre distinction preserved.
5. **EhrenKlub ticket** — no paid ticket CTA on source; correctly `MISSING`, not invented.
6. **Rausgegangen ≠ total market** — one acquisition adapter among future sources.

---

## 15. Stop confirmation

- No quality-ready pool imported
- M9.4D not started
- Scheduler not enabled
- Production not touched
- No bulk apply

**M9.4C complete.**
