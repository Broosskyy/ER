# Import Logging

**Sprint:** FIRST REAL SOURCES + IMPORT VALIDATION  
**Date:** 2026-07-26

## Overview

Import logging spans two services:

1. **`AggregationLogService`** — pipeline step telemetry (in-memory + optional bridge)
2. **`ImportLoggingService`** — persistent job logs via `ImportLogRepository`

Both are active during aggregation imports via `ImportAggregationService`.

## Aggregation run log

`AggregationRunLog` structure:

| Field | Description |
|-------|-------------|
| `runId` | Unique pipeline run identifier |
| `sourceId` | Source being imported |
| `sourceName` | Display name |
| `triggerType` | `manual`, `scheduled`, etc. |
| `startedAt` / `finishedAt` | Run timestamps |
| `durationMs` | Total pipeline duration |
| `eventCount` | Events processed |
| `errorCount` | Validation/rejection errors |
| `warningCount` | Non-fatal warnings |
| `stepDurations` | Per-step timing map |
| `entries` | Detailed log entries |

## Step logging

Each pipeline step logs via `logStep()`:

```
AGGREGATION_STEP_FETCH
AGGREGATION_STEP_NORMALIZE
AGGREGATION_STEP_VALIDATE
AGGREGATION_STEP_DUPLICATE_CHECK
AGGREGATION_STEP_MERGE
AGGREGATION_STEP_REVIEW
AGGREGATION_STEP_PUBLISH
```

Each entry includes duration, event count, error count, warning count.

## Job-level codes (`ImportLoggingService`)

| Code | Level | When |
|------|-------|------|
| `AGGREGATION_IMPORT_START` | info | Job created, pipeline starting |
| `AGGREGATION_IMPORT_COMPLETE` | info | Job finished successfully |
| `AGGREGATION_IMPORT_FAILED` | error | Pipeline or persistence error |
| `AGGREGATION_EVENT_ARCHIVED` | warning | Event removed from source, archived |
| `AGGREGATION_RUN_START` | info | Pipeline run initiated |
| `AGGREGATION_RUN_FINISH` | info | Pipeline run completed |
| `AGGREGATION_RUN_ERROR` | error | Step-level failure |

## Job metrics

`ImportJob.metrics` populated after aggregation:

| Metric | Meaning |
|--------|---------|
| `fetchedCount` | Raw events from connector |
| `parsedCount` | Events passing validation |
| `invalidCount` | Rejected / invalid |
| `duplicateCount` | Duplicate detections |
| `createdCount` | New events (change detection) |
| `updatedCount` | Changed events |
| `warningCount` | Warnings including archival |

## Source status updates

After each job, `SourceService.recordImportRun()` stores:

- `lastImportAt` — job finish timestamp
- `lastJobStatus` — `completed`, `completed_with_warnings`, `failed`

Admin source list displays last import time and status badge.

## Admin UI

- `/admin/imports` — job list with source name, status, metrics summary
- `/admin/imports/review` — record queue with source and warning counts
- `/admin/imports/review/[id]` — record detail with provenance and validation output

## Audit trail

`ImportAuditService` logs admin actions separately:

- `record_approved`
- `record_rejected`
- `record_edited`
- `import_started`

Stored in `import_audit_logs` table / local store.

## Performance notes

- Logging is async and does not block pipeline steps
- `AggregationLogService` keeps in-memory entries per run (testable via `listEntries()`)
- Production persistence via `ImportLogRepository` → Supabase `import_logs`

## Implementation

```
src/features/aggregation/logging/
  aggregation-log-types.ts
  aggregation-log-service.ts

src/features/import/services/
  import-logging-service.ts

src/features/aggregation/services/
  import-aggregation-service.ts   # bridges both services
```
