# First Real Sources Report

**Sprint:** FIRST REAL SOURCES + IMPORT VALIDATION  
**Date:** 2026-07-26  
**Status:** Complete

## Executive summary

The aggregation architecture from the previous sprint is now connected to five real source connectors. The full import lifecycle — source fetch through consumer visibility — has been validated production-near using fixtures and reference payloads. No parallel pipelines were introduced; all sources share the same `AggregationPipeline`.

## Delivered

### Source connectors (5 types)

| Priority | Connector | Key | Source types |
|----------|-----------|-----|--------------|
| 1 | Manual reference | `manual_reference` | `manual` |
| 2 | Club website | `club_website` | `website` + JSON-LD |
| 3 | Organizer website | `organizer_website` | `website` + HTML |
| 4 | ICS/iCal feed | `ical_feed` | `ical` |
| 5 | Open data API | `open_data_api` | `api` |

All connectors implement `SourceConnector` and return `RawImportedEvent[]` only — no consumer structures.

### Import service wiring

- `ImportAggregationService` runs `AggregationPipeline` with `createSourceConnectorFetchProvider`
- `ImportOperationsService.startManualImport()` routes to aggregation when `shouldUseAggregation()` matches (`manual`, `website`, `ical`, `api`, `rss`, or explicit `connectorKey`)
- Legacy `ImportOrchestrator` remains for adapter-only paths; no replacement

### Normalization

Extended `NormalizedEventCandidate` / `CanonicalImportEvent` with:

- `subtitle`, `importId`, `originalLink`
- `priceAmount`, `priceCurrency`, `imageUrls`
- `sourceId`, `sourceName`

Reuses existing `EventNormalizer` — no duplicate normalization logic.

### Validation, deduplication, merge

- Validation: existing `ImportCandidateValidator` via `ValidateStep`
- Duplicates: `ScoreBasedDuplicateStrategy` via `DuplicateCheckStep`
- Merge: `PriorityBasedMergeStrategy` via `MergeStep`
- Multi-source contributions stored on record envelope

### Update detection and archival

- `ImportUpdateService` detects `created`, `updated`, `cancelled`, `unchanged`
- Missing external IDs from subsequent runs → existing published events archived (not deleted)
- Cancelled iCal events flagged via `cancelled` raw payload

### Admin review and publish

- New imports → `needs_review` import records
- Approve creates event with `status: 'published'` (direct publish)
- `consumerEventRepository.refresh()` called after approve for consumer cache invalidation
- Review UI shows source provenance (source name, type, original URL, retrieved date)

### Source management

Existing `SourceService.recordImportRun()` updated after each aggregation job with `lastImportAt` and `lastJobStatus`. Event counts and errors available via job metrics and import logs.

### Logging

- `AggregationLogService` — per-step durations, event/error/warning counts
- `ImportLoggingService` — job-level `AGGREGATION_IMPORT_START`, `AGGREGATION_IMPORT_COMPLETE`, `AGGREGATION_EVENT_ARCHIVED`
- Job metrics: `fetchedCount`, `parsedCount`, `invalidCount`, `duplicateCount`, `createdCount`, `updatedCount`, `warningCount`

### Performance preparation

- Batch record creation via `createMany`
- Record limit guard via `importConfig.maxRecordsPerJob`
- Consumer refresh is async and non-blocking
- Pagination/caching hooks prepared in existing repository layer (not activated)

## Not in scope (confirmed)

Instagram, Facebook, TikTok, browser automation, headless browser, AI extraction, OCR, push, cloud scheduler, cronjobs, QR, ticket system, payments.

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Multiple real sources import successfully | ✅ 5 connectors |
| Same pipeline for all sources | ✅ `AggregationPipeline` |
| Normalization complete | ✅ |
| Duplicate check works | ✅ |
| Merge works | ✅ |
| Updates detected | ✅ `ImportUpdateService` |
| Removed events archived | ✅ |
| Admin review works | ✅ |
| Published events in consumer screens | ✅ via `EventRepository.refresh()` |
| Logging complete | ✅ |
| Typecheck | ✅ |
| Tests | ✅ 735+ passing |

## Key files

```
src/features/aggregation/
  connectors/           # 5 source connectors + registry
  fixtures/             # real-source-fixtures.ts
  services/             # import-aggregation-service, import-update-service
  pipeline/             # 7-step pipeline (prior sprint)

src/features/import/admin/
  import-operations-service.ts   # aggregation routing
  import-review-service.ts       # publish + consumer refresh

src/data/repositories/registry.ts  # wiring
```

## Recommended next sprint

**SOURCE MANAGEMENT SCALE + MULTI-SOURCE DEDUPLICATION + DISCOVERY QUALITY**
