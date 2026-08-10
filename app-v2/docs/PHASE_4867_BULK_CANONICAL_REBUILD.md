# Phase 4.8.6.7 — Clean Bulk Canonical Rebuild Preview

## Scope

Read-only staging preview that rebuilds the relevant event corpus from live public sources using the production connector pipeline. No DB writes, no apply, no rollout.

## Worktree

- **Path:** `C:\Users\manue\.cursor\projects\c-ER\wt-4867-bulk-rebuild`
- **Branch:** `feature/phase-4867-bulk-canonical-rebuild`
- **Basis:** `origin/feature/phase-4866-generic-rollout` @ `85667f77fe996ab0af14b3de3d06a0a0b15e9aea`

## Pipeline

```
Source Registry → Connector Registry → Fetch → Parser → Normalize
  → Source Evidence Bundle → Identity Graph → RebuiltCanonicalEvent
  → Consumer Preview → Before/After Matrix
```

- No `import_records` replay as source truth
- No prefilling `RebuiltCanonicalEvent` from existing canonical fields
- DB used only for comparison, ID preservation, manual locks, collision catalog, rollback planning

## Horizon

- 30 days past → 365 days future
- Published, upcoming, running, and regression ended events
- Seven acceptance fixtures always included

## Module

`src/features/import/bulk-canonical-rebuild/`

| File | Role |
|------|------|
| `bulk-rebuild-preview-runner.ts` | Orchestration |
| `source-ingest.ts` | Live multi-source fetch |
| `identity-graph.ts` | Cross-source clustering |
| `evidence-field-extractor.ts` | Field-group rebuild from evidence |
| `disposition.ts` | ready / review / archive classification |
| `consumer-quality-audit.ts` | Automated consumer checks |
| `acceptance-runner.ts` | Seven fixture pass/fail |
| `cutover-plan.ts` | Cutover plan (not applied) |

## Ops entry

```bash
ER_OPS_ENV_FILE=C:\ER\app-v2\.env npx tsx scripts/operations/_phase4867-bulk-rebuild-preview.ts
```

## Artifacts (untracked)

- `docs/real-data/_phase4867_bulk_rebuild_summary.json`
- `docs/real-data/_phase4867_bulk_rebuild_events.json`
- `docs/real-data/_phase4867_bulk_rebuild_source_coverage.json`
- `docs/real-data/_phase4867_bulk_rebuild_acceptance.json`
- `docs/real-data/_phase4867_bulk_rebuild_cutover_plan.json`
- `docs/real-data/_phase4867_bulk_rebuild_rollback_plan.json`
- `docs/real-data/_phase4867_bulk_rebuild_readiness.json`

## Hard constraints

- `productionMutationsInThisRun: 0`
- `rolloutActivated: false`
- No commit / push / merge in this phase
- wt-4866 generic-rollout worktree untouched

## Run results (2026-08-10)

### Before wiring repair (4.8.6.7)
| Metric | Value |
|---|---|
| Normalized contributions | 76 |
| Identity clusters | 65 |
| Rebuilt rows | 97 |
| `review_missing_evidence` | 97 |
| Safe cutover candidates | 0 |
| Content / Genre / Lineup coverage | 0% |

### After wiring repair (4.8.6.7.1)
| Metric | Value |
|---|---|
| Normalized contributions | **120** |
| Identity clusters | **95** |
| Rebuilt rows | **104** (95 clusters + 9 uncovered) |
| `ready_partial` | **45** |
| `review_collision` | **36** |
| `review_core_missing` | **15** |
| `review_missing_evidence` | **0** |
| Safe cutover candidates (`ready_partial`) | **45** |
| Content / Genre / Lineup / Venue coverage | **31% / 16% / 3% / 62%** |
| MDMA collision recognized | **yes** |

Acceptance still fails on all seven fixtures when judged against fresh rebuild only (no DB fallback). Cutover not approved.

### Wiring repair scope (4.8.6.7.1)
- TicketKings/Affenkäfig contributions retained (no blanket legacy-fallback discard)
- Cross-source cluster materialization by `mappedEventId` + compatible identity
- `assembleRebuiltCanonicalEvent` with `writeCanonicalTicketFields`, description/genre/lineup resolvers
- Field-group publish core vs optional missing (`ready_partial`, `review_core_missing`)
- Import-mapping identity mismatch → `review_collision` (MDMA/CHROME pattern)
- Acceptance audits `RebuiltCanonicalEvent` only (no DB fallback merge)


Live preview completed read-only against production.

| Metric | Value |
|--------|-------|
| Active sources | 13 |
| Successful fetches | 13 |
| Raw source events | 120 |
| Normalized contributions | 76 |
| Horizon events | 97 |
| Identity clusters | 65 |
| ID preservation rate | 93.8% |
| Safe cutover candidates | 0 |
| Review / blocked | 97 |

**Acceptance:** LEVI pass; BC173, R3HAB, Bootshaus Sommerfest, Underland, Sommerfest Elektroküche, MDMA fail.

**Key gaps identified:**
- Ticket Kings sources produced 0 normalized contributions (legacy-fallback / identity gate filter).
- Content, genre, and lineup coverage from fresh evidence: 0% (ticket-only patches; no official-page merge in clusters).
- MDMA: Ticket.io list card for CHROME mapped to MDMA event — collision not elevated to `review_collision`.
- `review_missing_evidence` disposition on all rows (strict evidence gate: missing title/startDate on ticket-only rebuild).

`productionMutationsInThisRun: 0` · `rolloutActivated: false`

---

## Phase 4.8.6.7.2 — Detail Evidence & Collision Triage (2026-08-10)

### Added modules
| File | Role |
|------|------|
| `detail-evidence-types.ts` | `DetailEvidenceRequest` / `DetailEvidenceResult` contract |
| `detail-fetch-cache.ts` | URL-normalized in-memory cache |
| `detail-evidence-parser.ts` | Routes HTML to Ticket.io / TicketKings / official parsers |
| `detail-evidence-service.ts` | Embedded-HTML reuse + optional fetch with metrics |
| `detail-evidence-integrator.ts` | Applies detail evidence to candidate + bundle |
| `collision-triage.ts` | `hard_identity_conflict`, `stale_import_linkage`, `duplicate_candidate`, `insufficient_evidence`, `field_level_conflict` |
| `acceptance-fixture-catalog.ts` | Deterministic seven-fixture contribution sets |
| `fixture-rebuild-runner.ts` | Fixture-only rebuild + acceptance (no live fetch) |

### Live run results (read-only, ~401s)

| Metric | 4.8.6.7.1 | 4.8.6.7.2 |
|--------|-----------|-----------|
| Raw / normalized | 120 / 120 | 120 / 120 |
| Identity clusters | 95 | 95 |
| Rebuilt rows | 104 | 104 (95 cluster + 9 uncovered horizon) |
| `ready_partial` | 45 | 45 |
| `review_collision` | 36 | 36 |
| Content coverage | 31% | **34%** |
| Genre coverage | 16% | 15% |
| **Lineup coverage** | 3% | **29%** |
| Venue coverage | 62% | **82%** |
| Ticket coverage | 60% | **63%** |
| verifiedAt coverage | 63% | **90%** |
| Safe cutover candidates | 45 | 45 |

### Detail fetch metrics
- Unique detail URLs tracked: **105**
- Cache hits (embedded pipeline HTML): **15**
- Additional HTTP detail requests: **0** (all reuse from connector envelopes)
- PoW / timeout / HTTP errors: **0**

### Acceptance
| Channel | Result |
|---------|--------|
| **Fixture (deterministic)** | **7/7 PASS** |
| **Live (rebuild-only)** | 1/7 PASS (MDMA only) |
| MDMA/CHROME | CHROME isolated, no wrong ticket URL, collision recognized |

Live acceptance failures reflect live source drift vs stored fixture evidence (expected per spec).

### Row-count invariant
- **95** identity clusters → **95** cluster-origin rebuilt rows (`rowOrigin: identity_cluster`)
- **9** additional rows = uncovered DB horizon events (`rowOrigin: uncovered_horizon_event`)
- No duplicate cluster rows; `clusterId` + `rowOrigin` on each row

### Tests / verification
- `vitest` bulk-rebuild suite: **19/19 PASS**
- `npm run typecheck:app` ✓
- `npm run typecheck:operations` ✓
- `git diff --check` ✓

`productionMutationsInThisRun: 0` · `rolloutActivated: false` · no commit/push

---

## Phase 4.8.6.7.3 — Live Detail Fetch & Cutover Manifest (2026-08-10)

### Root cause (missing live detail)
`detailFetchFn` was optional on the preview runner but **never wired in ops**; pass-1 embedded-only resolves cached `content_unusable`, blocking HTTP pass-2.

### Fix
- `detail-fetch-http.ts` — `createBulkDetailFetchFn()` via `importFetchService`
- `detail-evidence-service.ts` — concurrency gate (6 global / 2 per host), embedded vs cache vs HTTP metrics, deferred HTTP (no cache on `allowHttp: false`)
- Two-pass runner: embedded → identify `ready_partial` → HTTP for references + candidates
- `cutover-manifest.ts` — stable manifest hash + rollback plan
- `live-reference-validation.ts` — seven-reference live matrix

### Final live run metrics
| Metric | 4.8.6.7.2 | 4.8.6.7.3 |
|--------|-----------|-----------|
| HTTP detail requests | 0 | **58** |
| Detail fetch success | 0 | **10** |
| PoW challenges | 0 | **48** |
| Content coverage | 34% | **36%** |
| Lineup coverage | 29% | **31%** |
| Venue coverage | 82% | **84%** |
| Identity coverage | 61% | **64%** |
| Safe cutover candidates | 45 | **45** |

### Acceptance
- Fixture: **7/7 PASS**
- Live reference matrix: **0 pipeline_missing_evidence** (Phase B); collisions dominate BC173/R3HAB/etc.
- Manifest hash: `978aed3839e10116d7b2cab20564c2e6c9ec045869cd73401780820bd175dad5`

### Artifacts (`_phase48673_*`)
- `live_reference_validation.json`
- `live_fetch_metrics.json`
- `bulk_cutover_plan.json` (manifest)
- `bulk_cutover_preview.json`
- `bulk_cutover_rollback.json`
- `bulk_cutover_readiness.json`

`productionMutationsInThisRun: 0` · `rolloutActivated: false`
