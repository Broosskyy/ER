# Import Architecture Report

**Sprint:** EVENT AGGREGATION FOUNDATION + IMPORT PIPELINE  
**Date:** 2026-07-26  
**Status:** Complete

## Executive summary

Eternal Rave now has a scalable event aggregation foundation. A seven-step import pipeline normalizes all external sources into a single canonical event model, validates data, checks duplicates, merges multi-source contributions, and queues records for admin review — without implementing real crawlers or changing consumer/organizer screens.

## Delivered

### Teil 1 — Source model

- `AggregationSource` view model from `SourceRecord`
- Regional config (`countryCode`, `languageCode`) via record + `sourceConfig.regional`
- Auth preparation via `SourceAuthConfig` (no secrets stored)
- Import strategy mapping from acquisition strategy

### Teil 2 — Import pipeline

Seven isolated steps with dedicated interfaces:

1. Fetch
2. Normalize
3. Validate
4. Duplicate Check
5. Merge
6. Review
7. Publish (prepared)

Orchestrated by `AggregationPipeline`.

### Teil 3 — Normalization

- `CanonicalImportEvent` as unified target model
- Reuses `EventNormalizer` from import layer
- Extended `NormalizedEventCandidate` with price, images, source attribution

### Teil 4 — Validation

- Reuses `ImportCandidateValidator`
- Required fields, dates, URLs, location, coordinates prepared
- Invalid events → `rejected` status

### Teil 5 — Duplicates

- `DuplicateStrategy` interface
- `ScoreBasedDuplicateStrategy` wrapping existing detection service
- Signals: title, date, venue, organizer, images (prepared)

### Teil 6 — Merge

- `MergeStrategy` interface
- `PriorityBasedMergeStrategy` with:
  - Primary dataset selection by source priority
  - Source contribution history
  - Change history for field updates
  - No duplicate storage for same event

### Teil 7 — Review

- New imports → `pending_review` when `reviewRequired`
- Auto-publish prepared but not executed
- Maps to existing admin import review

### Teil 8 — Import status

`AGGREGATION_PIPELINE_STATUSES` with mapper to legacy `ImportRecordStatus`.

### Teil 9 — Logging

`AggregationLogService` records:

- Run start / finish
- Per-step duration
- Source ID
- Error and warning counts
- Event counts

### Teil 10 — Tests

| Test file | Coverage |
|-----------|----------|
| `aggregation-source.test.ts` | Source model |
| `canonical-event-mapper.test.ts` | Normalization |
| `normalize-step.test.ts` | Normalize step |
| `validate-step.test.ts` | Validation |
| `duplicate-strategy.test.ts` | Duplicate detection |
| `merge-strategy.test.ts` | Merge strategy |
| `aggregation-pipeline.test.ts` | Full pipeline |
| `aggregation-logging.test.ts` | Logging |
| `status-mapper.test.ts` | Status mapping |

## Architecture diagram

```
External Source (RA, Shotgun, Website, CSV, …)
        │
        ▼
   FetchStep ──► Import Adapters / Connector bridge
        │
        ▼
  NormalizeStep ──► EventNormalizer → CanonicalImportEvent
        │
        ▼
   ValidateStep ──► ImportCandidateValidator
        │
        ▼
DuplicateCheckStep ──► ScoreBasedDuplicateStrategy
        │
        ▼
    MergeStep ──► PriorityBasedMergeStrategy
        │
        ▼
    ReviewStep ──► pending_review | duplicate | rejected
        │
        ▼
   PublishStep ──► prepared (no auto-publish)
        │
        ▼
  Admin Review → AdminEventRecord → Consumer Events
```

## Key files

```
src/features/aggregation/
  domain/
  pipeline/
  duplicate/
  merge/
  logging/
  mappers/
  index.ts
```

## Extension points for next sprint

1. `createAdapterFetchProvider()` — wire real adapters (RA, Eventbrite, websites)
2. Connector → Fetch bridge for `AcquisitionCandidate`
3. Endpoint admin UI → `sourceConfig.endpoints`
4. Scheduled execution via `acquisitionStrategy: scheduled`

## Verification

```bash
cd app-v2
npm run typecheck
npm test
```

## Out of scope (by design)

- Resident Advisor / Shotgun / Eventbrite APIs
- Instagram / Facebook
- Crawlers, cronjobs, backend, cloud sync
- Consumer / organizer screen changes

## Recommended next sprint

**FIRST REAL SOURCES (Resident Advisor + Club Websites + Eventbrite)**
