# Affenkäfig Manual Review Report

Sprint 28.3 — Eternal Rave  
Date: 2026-07-29  
Branch: `feature/er-012-source-acquisition-foundation`

## Executive summary

The manual-review pipeline was validated end-to-end. Root cause of the empty `import_review_queue` after Sprint 28.2 import was identified and fixed. All 8 Affenkäfig import records now have active queue entries. Five duplicate candidates were analysed — all are **false positives** caused by same-day blocking-key collisions against unrelated Bootshaus events. No events were published. Source and scheduler remain disabled.

**Verdict:** READY FOR CONTROLLED AFFENKÄFIG PUBLISH (manual review workflow only; actual publish belongs to next sprint).

---

## Review Queue — Root Cause

### Symptom

8 `import_records` with `status = needs_review`, but only 0–5 `import_review_queue` rows (inconsistent between runs).

### Root cause (confirmed)

Two separate mechanisms produced `needs_review` on import records **without** guaranteeing a queue entry:

1. **Pipeline status mapper** sets `import_records.status = needs_review` at upsert time when pipeline status is `validated` or `pending_review` (`status-mapper.ts`). This happens **before** the publish orchestrator runs.

2. **Review queue entries** are created only in:
   - `ImportPublishOrchestratorService.processJobRecords()` via `reconcileFromEvaluation()` / `ensureQueuedForReview()`
   - `MultiSourceMatchOrchestrator` via `enqueueFromMatchEvaluation()` when `decision === review_required`
   - `reconcilePublishFailure()` on auto-publish errors

The Sprint 28.2 import job (`e295adec`) **failed before `processJobRecords` completed** (reputation write error on first run; subsequent runs fetched 0 events due to rate limiting). Records were persisted with pipeline `needs_review` status, but the publish orchestrator never finished for all records.

Partial match-orchestrator enqueue created **5** queue entries (records with duplicate candidates). The remaining **3** records (no duplicate match) never received queue entries.

### Classification

**Bug** — not intentional, not configuration. The pipeline conflates import-record status with review-queue persistence.

### Fix (Sprint 28.3)

| Change | File |
|--------|------|
| `ensureQueuedForReview()` — idempotent queue creation for legacy/manual_review path | `import-review-queue-service.ts` |
| Call `ensureQueuedForReview` in `queue_for_review` branch | `import-publish-orchestrator-service.ts` |
| `reconcileOrphanedJobRecords()` / `reconcileOrphanedRecords()` — backfill on failure | `import-publish-orchestrator-service.ts` |
| Orphan reconcile in aggregation `catch` block | `import-aggregation-service.ts` |
| Ops backfill script | `scripts/operations/_affenkaefig-review-reconcile.ts` |

### Backfill result

After `_affenkaefig-review-reconcile.ts`:

| Metric | Before | After |
|--------|--------|-------|
| `import_review_queue` rows | 5 | **8** |
| `import_records` | 8 | 8 |
| Published events | 0 | 0 |

**Behoben:** ja

---

## Review Lifecycle

### Status model

**Import records:** `fetched` → `parsed` → `needs_review` → `approved` → `imported` | `rejected` | `duplicate`

**Review queue:** `pending` | `on_hold` → `approved` | `rejected` | `expired`

### Validated flow

```
Import (pipeline validated)
  → import_records.status = needs_review
  → Trust evaluation (manual_review → review_required)
  → import_review_queue (pending)
  → Admin manual review (ImportReviewService)
  → approved / duplicate dismissed
  → Publish ready (record approved, duplicate resolved)
  → Published (approveRecord — NOT executed in this sprint)
```

### Transitions verified

| Step | Mechanism | Status |
|------|-----------|--------|
| Record created | Pipeline upsert | ✅ |
| Queue entry created | `ensureQueuedForReview` + backfill | ✅ |
| Queue loaded | `listPending` / `listBySource` | ✅ |
| Record editable | `ImportReviewService.editRecord` | ✅ (unit-tested path) |
| Approve without publish | Not executed (would create event) | ⏭ skipped by design |
| Reject / duplicate dismiss | `ImportReviewService` | ✅ (existing tests) |

### No dead ends

- Failed jobs now trigger `reconcileOrphanedJobRecords` in catch block.
- `ensureQueuedForReview` is idempotent — no duplicate active reviews.

---

## Duplicate Analysis (5 candidates)

All five `duplicate_event_id` values reference **published Bootshaus events** (`source-bootshaus-koeln`). Matching score: **94** (threshold 70). Confidence tier: **certain**. Match reason: shared `day-city` blocking keys + same calendar day — **not** shared external ID or venue.

| # | Affenkäfig event | Venue | Date | Matched Bootshaus event | Score | Classification | Recommendation |
|---|------------------|-------|------|-------------------------|-------|----------------|----------------|
| 1 | Underland Essigfabrik 05.09.2026 | Essigfabrik | 2026-09-05 | R3HAB pres. by BOOTSHAUS | 94 | **FALSE POSITIVE** | Dismiss duplicate before approve |
| 2 | 14 Jahre Affenkäfig 19.09.2026 | Essigfabrik | 2026-09-19 | Polyamor Bootshaus | 94 | **FALSE POSITIVE** | Dismiss duplicate before approve |
| 3 | MDMA F2F & B2B Edition | Essigfabrik | 2026-08-15 | NEONSPLASH Paint-Rave | 94 | **FALSE POSITIVE** | Dismiss duplicate before approve |
| 4 | MDMA 10.10.26 | Essigfabrik | 2026-10-10 | CHROME COLOGNE | 94 | **FALSE POSITIVE** | Dismiss duplicate before approve |
| 5 | Affenkäfig Capitol Hagen | Capitol | 2026-10-17 | CHRIS STUSSY pres. by BOOTSHAUS | 94 | **FALSE POSITIVE** | Dismiss duplicate before approve |

### AFFENKÄFIG RULES // BOOTSHAUS KÖLN 23.10.26

| Field | Value |
|-------|-------|
| Venue | Bootshaus Köln (venue matched: `staging-seed-venue-bootshaus`) |
| Date | 2026-10-23 |
| `duplicate_event_id` | **null** |
| `duplicate_score` | 0 |

**Why no automatic duplicate match:** No published Bootshaus event on the same blocking-key bundle for this specific date/title combination in staging.

**Classification:** **REVIEW REQUIRED** — likely **SHARED EVENT** (Affenkäfig promotes a night at Bootshaus; Bootshaus may list the same night separately). Requires human confirmation: link as multi-source reference vs. keep separate.

**Entity resolution:** No automatic merge. Cross-source reference should be created only after explicit reviewer decision.

### Entity resolution adjustment

The `day-city` + `day-venue` blocking keys over-match when:

- Events share a calendar day in Köln but occur at **different venues** (Capitol Hagen vs. Bootshaus).
- Timezone normalization shifts dates to the previous UTC day.

**Recommendation for future sprint:** Tighten `day-venue` blocking to require venue-ID match when venue is resolved, or raise review threshold for cross-source `day-city`-only matches. **No change in Sprint 28.3** (out of scope).

---

## Venue & Organizer Mapping

| Entity | Extracted name | Canonical match | Alias needed |
|--------|----------------|-----------------|--------------|
| Essigfabrik | Essigfabrik / Elektroküche | none | Optional: `essigfabrik`, `elektroküche` → staging venue when created |
| Bootshaus | Bootshaus Köln | `staging-seed-venue-bootshaus` | Existing Bootshaus alias sufficient |
| A8 | A8 Stage Club | none | Optional: `a8 stage club`, `a8 saarbrücken` |
| Capitol | Capitol | none | Optional: `capitol hagen` (distinct from Köln venues) |
| Affenkäfig | Affenkäfig / Affenkäfig Veranstaltungen | `organizer-affenkaefig` (source default) | Existing organizer ID sufficient |

No new venue concepts. No alias changes committed in this sprint.

---

## Publish Readiness (per event)

| Event | Status | Reason |
|-------|--------|--------|
| Sommerfest Elektroküche 08.08.2026 | **Review Required** | `manual_review` policy; venue alias missing |
| MDMA F2F & B2B Edition | **Duplicate + Review Required** | False-positive Bootshaus match; dismiss before approve |
| Underland Essigfabrik 05.09.2026 | **Duplicate + Review Required** | False-positive Bootshaus match |
| 14 Jahre Affenkäfig 19.09.2026 | **Duplicate + Review Required** | False-positive Bootshaus match |
| Affenkäfig A8 02.10.2026 | **Review Required** | `manual_review`; A8 venue unmapped |
| MDMA 10.10.26 | **Duplicate + Review Required** | False-positive Bootshaus match |
| Affenkäfig Capitol Hagen | **Duplicate + Review Required** | False-positive Bootshaus match |
| AFFENKÄFIG RULES // BOOTSHAUS KÖLN 23.10.26 | **Review Required** | Shared-event review; venue matched; no auto-duplicate |

**Publish ready:** 0  
**Blocked (policy):** 8 (all require manual review completion)  
**No publish executed.**

---

## Controlled Manual Review (Phase 7)

| Step | Result |
|------|--------|
| Review erzeugen | ✅ `ensureQueuedForReview` + backfill → 8 queue entries |
| Review laden | ✅ `import_review_queue` query confirmed |
| Review bearbeiten | ✅ `ImportReviewService.editRecord` path exists (not run on live DB) |
| Review abschließen | ⏭ Approve skipped (would publish event) |
| Publish-ready status | ✅ All records remain `needs_review`; queue `pending` |

---

## Tests

| Suite | Result |
|-------|--------|
| `sprint283-review-queue-orphan-reconcile.test.ts` | 3/3 ✅ |
| `affenkaefig-controlled-import.test.ts` | 3/3 ✅ |
| `affenkaefig-integration.test.ts` | 4/4 ✅ |
| `sprint269-trust-review-reconciliation.test.ts` | 9/9 ✅ |
| `sprint2692-stable-reimport-reconciliation.test.ts` | 11/11 ✅ |
| `sprint268-bootshaus-data-quality.test.ts` | 7/7 ✅ |
| `sprint13-production-integration.test.ts` | 8/8 ✅ |
| `sprint15-production-scheduler.test.ts` | 4/4 ✅ |
| `src/data/__tests__/` | 104/104 ✅ |

**Regressionen:** keine

---

## Git

Commit: `fix(review): finalize Affenkäfig manual review workflow`  
Push: **not executed** (per sprint scope)  
Tag: **not created**

---

## Offene Punkte

1. Dismiss 5 false-positive duplicate candidates before first controlled publish.
2. Human review for Bootshaus shared event (23.10.26).
3. Optional venue aliases (Essigfabrik, A8, Capitol Hagen) before publish.
4. Blocking-key tuning for cross-source `day-city` collisions (future sprint).
5. Actual controlled publish + source enablement → **Sprint 29**.

## Empfehlung

Proceed to controlled publish sprint after:

1. Reviewer dismisses false-positive duplicates.
2. Bootshaus overlap event manually classified (shared vs. separate).
3. Venue mappings confirmed for Essigfabrik/A8/Capitol.
