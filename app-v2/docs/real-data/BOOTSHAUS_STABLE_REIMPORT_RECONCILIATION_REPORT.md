# Bootshaus Stable Published Reimport Reconciliation Report

**Sprint:** 26.9.2 P0  
**Date:** 2026-07-29  
**Source:** `source-bootshaus-koeln`  
**Verdict:** **STABLE PUBLISHED REIMPORT GO**

---

## Live baseline (Phase 1)

| Metric | Value |
|--------|------:|
| import_records | 37 |
| published events | 37 |
| active event_source_references | 37 |
| active reviews (before fix) | **37** |
| reviews from latest cron job | 37 (job `0ca2c0c6-bbde-4b70-a575-4b11847407b2`) |

### Review profile (all 37)

- **Type:** trust (not match/lifecycle)
- **Decision:** `review_required`
- **Quality score:** 58
- **Reasons:** `Potential duplicate detected.` + `quality_score_below_auto_publish_threshold` (35); + `source_trust_below_publish_threshold` (2)
- **Record state:** `needs_review` with `resulting_event_id` set; linked events **published**

### Sample traces

Three representative records confirmed:

1. **Stable published, no semantic change** — published event exists, source reference active, review stale
2. **Technical-only delta** — `startDate` string format differed between event row and normalized payload (false positive before date normalization fix)
3. **No material field change** — duplicate/quality reasons only; no blocking violation

Artifact: `docs/real-data/_bootshaus_stable_reimport_reconciliation.json`

---

## Root cause (Phase 3)

### Primary chain

1. Cron reimport upserted records with pipeline status `needs_review`, **not** preserving terminal `imported` status.
2. `TrustPublishDecisionEngine` only returns `reject` (skip) for `imported`/`rejected` — with `needs_review`, full evaluation runs.
3. Published records match themselves as duplicates → `review_required` with benign reasons.
4. `reconcileFromEvaluation` / stable-close logic required `recordHasPublishedOutcome()` tied to **status** `imported|approved|duplicate`, not merely a published `resulting_event_id`.
5. `reconcileFromEvaluation` was **not called** on the publish skip path for `reject` decisions.
6. Result: **37 new active trust reviews** for unchanged published data.

### Secondary factors

- Per-record reputation decay during batch lowered trust scores (78.5 → 69.5), amplifying duplicate/quality review reasons.
- `startDate` compared as raw strings (ISO format mismatch) caused false semantic deltas in ops reconciliation until normalized.
- Match orchestrator had a `jobId is not defined` bug in `applyEvaluation` (fixed; blocked one post-fix worker run).

### Why all 37?

Every record was reset to `needs_review` on reimport; every record has a published duplicate target (its own event); trust evaluation is deterministic for the same quality score → identical review wave.

---

## Semantic change detection (Phase 5)

Compared fields (`IMPORT_CHANGE_FIELDS`):

- `title`, `description`, `startDate`, `endDate`, `venueName`, `ticketUrl`, `artistNames`, `organizerName`, `imageUrl`, `status`

Identity equivalence (`recordCandidateEquivalent`):

- `title`, `startDate`, `venueName`, `cityName`, `eventUrl`/`originalLink`

**Excluded (non-semantic):** `fetched_at`, `retrievedAt`, `imported_at`, worker timestamps, run IDs, raw metadata blobs, reputation side-effects.

**Date normalization:** `startDate`/`endDate` compared via `Date.toISOString()` to avoid format-only diffs.

---

## Fix summary (Phase 4)

### New module

- `src/features/import/services/published-reimport-reconciliation.ts` — generic stable-reimport predicates

### Behaviour

| Scenario | Behaviour |
|----------|-----------|
| Published + identical payload | Skip publish; close/suppress review; restore `imported` |
| Published + technical-only delta | Treated as unchanged |
| Published + quality/trust improvement | Publish update if semantic delta; no review |
| Published + relevant field change | Controlled publish update |
| Published + venue/conflict/blocking | Active review created/updated |
| Trust + match + lifecycle paths | Converge on same review lifecycle |

### Resolution reason

`stable_published_record_reimport` (`IMPORT_REVIEW_RESOLUTION_REASONS.stablePublishedRecordReimport`)

---

## Changed files

- `src/features/import/services/published-reimport-reconciliation.ts` (new)
- `src/features/trust-quality/services/import-review-queue-service.ts`
- `src/features/import/services/import-publish-orchestrator-service.ts`
- `src/data/datasources/import-record-upsert.ts`
- `src/features/aggregation/services/import-update-service.ts`
- `src/features/aggregation/services/import-aggregation-service.ts`
- `src/features/multi-source-matching/services/multi-source-match-orchestrator.ts`
- `src/features/event-lifecycle/services/event-lifecycle-orchestrator.ts`
- `src/data/repositories/registry.ts`
- `src/features/trust-quality/__tests__/sprint2692-stable-reimport-reconciliation.test.ts` (new)
- `src/features/trust-quality/__tests__/sprint269-trust-review-reconciliation.test.ts`
- `scripts/operations/_bootshaus-stable-reimport-baseline.ts` (new)
- `scripts/operations/_bootshaus-stable-reimport-reconcile.ts` (new)

---

## Tests (Phase 6)

| Suite | Result |
|-------|--------|
| `sprint2692-stable-reimport-reconciliation.test.ts` | 11/11 pass |
| `sprint269-trust-review-reconciliation.test.ts` | 9/9 pass |
| `import-update-service.test.ts` | 4/4 pass |
| `sprint17-multi-source-matching.test.ts` | 5/5 pass |

Scenarios covered: identical payload, technical delta, quality/trust improvement, date change, venue conflict, blocking violation, publish failure, deduped enqueue paths, multi-run idempotency, second generic source.

---

## Live review reconciliation (Phase 7)

| | Before | After |
|---|------:|------:|
| Active reviews | 37 | **0** |
| Closed via lifecycle | — | 23 explicit `closed` |
| Remaining | 37 | **0** |

All 37 stale trust reviews closed with `stable_published_record_reimport`. No reviews kept active (no fachlich berechtigte Ausnahmen).

---

## Cron validation (Phase 8)

| Cycle | Result |
|-------|--------|
| Pre-fix e2e | 37 reviews created |
| Post-reconcile baseline | 0 active reviews; 37/37/37 stable |
| Post-fix worker run 1 | Failed (`jobId is not defined` — fixed in match orchestrator) |
| Post-fix e2e runs | 0 new reviews; counts stable at 37/37/37 |

**Note:** Full reimport cron with fixed worker code should be re-run once after deploy to confirm 0 new reviews on cycle 1+2 and `imported` status restoration on records currently at `needs_review`.

---

## Regression safety (Phase 9)

Published status does **not** suppress future controls. Reviews still created for:

- Venue conflicts (critical match field differences)
- Trust/hold/reject degradation
- Blocking violations
- Semantic field changes (title, dates, venue, etc.)
- Publish failures

---

## Remaining risks

1. Records still show `needs_review` until next successful cron publish-skip path restores `imported` (cosmetic; no active reviews).
2. Deploy required for worker fix (`jobId` in match orchestrator).
3. Trust batch decay during large imports may still produce transient review reasons — now reconciled when stable.

---

## GO / NO GO

**STABLE PUBLISHED REIMPORT GO**
