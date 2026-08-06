# Generic Source Platform — Phase 4.1 (Admin Truthfulness)

Phase 4.1 aligns Admin UI and source operational metadata with the real production import state.

## Delivered

| Task | Implementation |
|------|----------------|
| Source metrics semantics | `source-operational-metrics.ts` |
| Metrics service + backfill | `source-operational-metrics-service.ts` |
| Auto-update on every import | `import-aggregation-service.ts` → `finalizeImportJob()` |
| Review queue reconciliation | `import-review-queue-reconciliation-service.ts` |
| Admin source cards | `admin-source-display.ts`, `admin-review-mapper.ts` |
| Source detail events | `SourceEventsSection.tsx` |
| Admin events source filter | `AdminEventListParams.sourceId`, `SourceEventsAdminService` |
| Bootshaus test artifact | archived via `_sprint361-phase41-production-fix.ts` |

## Metric definitions

- **total_import_count** — count of latest import records per source (`listLatestBySourceId`)
- **total_valid_event_count** — active origins linked to non-archived canonical events
- **total_rejected_event_count** — import records with status `rejected`
- **last_import_at** — `finishedAt` of the newest terminal import job
- **last_job_status** — status of the newest terminal import job

## Ops scripts

```bash
# Backfill metrics, reconcile review queue, archive Bootshaus test source
npx tsx scripts/operations/_sprint361-phase41-production-fix.ts
```

## Production validation (2026-07-31)

All five expansion shops validated: 12 / 11 / 4 / 10 / 19 events.
Review queue pending: 56 → 7 (2 genuine technodampfer needs_review preserved).
Canonical events: 125 (unchanged). Discoverable: 102 (unchanged).
