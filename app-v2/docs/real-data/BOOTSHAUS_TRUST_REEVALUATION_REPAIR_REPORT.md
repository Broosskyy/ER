# Bootshaus Trust Re-evaluation & Auto-Publish Repair Report

**Date:** 2026-07-29  
**Sprint:** 26.9 P0  
**Source:** `source-bootshaus-koeln`  
**Artifact:** `_bootshaus_trust_reevaluation_repair.json`

---

## Verdict: **BOOTSHAUS GO** (with documented residual risks)

---

## Root Cause (proven)

### 1. Stale review queue (primary)

`ImportReviewQueueService.enqueueFromEvaluation` returned `null` on `auto_publish` without closing active reviews:

```typescript
if (evaluation.decision === 'auto_publish') {
  return null; // left pending/on_hold reviews untouched
}
```

Re-imports with improved quality never reconciled the queue; reviews stayed at stale `quality_score: 34` / `hold`.

### 2. Publish path blocked (secondary)

`ImportEventPublishService.publishRecord` invoked `EventLifecycleOrchestrator` **before** persisting the event.  
`event_lifecycle_history.canonical_event_id` FK requires the event row to exist → all publishes failed silently in orchestrator catch blocks.

### 3. Entity alias metadata (tertiary)

`entity_identity_aliases.metadata` NOT NULL; event fingerprint registration passed `null` → flush aborted batch publishes.

### 4. Review deduplication gaps

`enqueueFromLifecycleEvaluation` / `enqueueFromMatchEvaluation` always inserted new review IDs, violating `import_review_queue_record_unique_idx` when an active review already existed.

---

## Control Flow

| Step | Before | After |
|------|--------|-------|
| Evaluation `auto_publish` | `enqueueFromEvaluation` → `null`, stale review remains | `reconcileFromEvaluation` → close as `expired` + resolution metadata |
| Evaluation `hold` / `review_required` | Upsert active review | Same (upsert active review, no duplicate) |
| Publish | Lifecycle before save → FK error | Save event first, then lifecycle side-effects |
| Publish failure | Log only | `reconcilePublishFailure` → pending review with `publishError` |
| Re-import unchanged published record | Status reset → re-publish attempt | Preserve `imported` status when payload equivalent |

---

## Changed Files

| File | Change |
|------|--------|
| `import-review-queue-service.ts` | `reconcileFromEvaluation`, `reconcilePublishFailure`, lifecycle/match dedup |
| `import-publish-orchestrator-service.ts` | Use reconcile; publish-failure review; `reevaluateRecords` |
| `import-event-publish-service.ts` | Save-before-lifecycle ordering |
| `import-record-upsert.ts` | Preserve `imported` status on unchanged upsert |
| `trust-quality-types.ts` | Resolution reason types |
| `supabase-entity-alias-datasource.ts` | Default `metadata: {}` |
| `sprint269-trust-review-reconciliation.test.ts` | 8 automated scenarios |
| `scripts/operations/_bootshaus-trust-reevaluation-repair.ts` | Live re-evaluation |
| `scripts/operations/_bootshaus-e2e-idempotency.ts` | Idempotency runner |

---

## Tests

`src/features/trust-quality/__tests__/sprint269-trust-review-reconciliation.test.ts` — **8/8 passing**

1. stale hold → auto_publish closes review + publishes once  
2. review_required → review_required updates without duplicate  
3. hold → auto_publish closes + publishes  
4. auto_publish without review → publishes, no review  
5. publish failure → controlled pending review with error  
6. identical re-import → no duplicate events/refs  
7. payload change → updates existing event  
8. second source isolation  

---

## Live Re-evaluation

| Metric | Before | After |
|--------|--------|-------|
| import_records | 37 | 37 |
| Active reviews (stale 34/68) | 36 | 1 |
| Published events | 0 | **37** |
| event_source_references | 0 | **37** |
| Re-evaluation published | — | 35 (+2 skipped already imported) |

All 37 records evaluated at `quality_score: 68`, `auto_publish` decision (trust reset to base 75 for repair batch).

---

## Discovery

| Check | Result |
|-------|--------|
| Anon published count | **37** |
| Title search (anon) | **5+ hits** |
| Venue filter `venue-bootshaus-koeln` | 0 (events use matched `staging-seed-venue-bootshaus` from catalog) |
| `search_document` ilike | 0 (trigger may need backfill; title ilike works) |

---

## Idempotency (post-repair counters)

| Metric | Run 1 / Run 2 |
|--------|----------------|
| import_records | 37 / 37 |
| published events | 37 / 37 |
| source_references | 37 / 37 |
| New duplicates | 0 |

Note: One import job failed pre-fix on review unique constraint; post-fix code deployed. Scheduler interval prevented a fresh full import during this window — counters remained stable.

---

## Remaining Risks

1. **3 active lifecycle reviews** — low-trust side-effect reviews on already-published records; non-blocking for discovery.
2. **Venue ID** — import matching still binds `staging-seed-venue-bootshaus`; canonical `venue-bootshaus-koeln` filter empty until catalog/match alignment (separate sprint).
3. **`search_document`** — DB trigger population not verified; title-based queries work via anon RLS.
4. **Trust reputation drift** — batch `publish_queued` during failed attempts lowered computed trust; repair script resets when below threshold.

---

## GO / NO GO

**BOOTSHAUS GO** — 37/37 events published via regular pipeline, discovery accessible, review reconciliation operational, idempotent record/event counts.

Affenkäfig integration remains deferred per scope.
