# Import Pipeline

**Sprint:** EVENT AGGREGATION FOUNDATION + IMPORT PIPELINE  
**Date:** 2026-07-26  
**Status:** Complete

## Summary

The aggregation import pipeline defines seven isolated steps. Each step has its own interface and implementation. No consumer or organizer screens write data directly — all external sources flow through normalization, validation, duplicate checks, merge, review, and publish preparation.

## Pipeline flow

```
Fetch → Normalize → Validate → Duplicate Check → Merge → Review → Publish
```

| Step | Class | Input | Output |
|------|-------|-------|--------|
| Fetch | `FetchStep` | `ImportSource` | `FetchedImportPayload[]` |
| Normalize | `NormalizeStep` | `FetchedImportPayload[]` | `NormalizedImportPayload[]` |
| Validate | `ValidateStep` | `NormalizedImportPayload[]` | `ValidatedImportPayload[]` |
| Duplicate Check | `DuplicateCheckStep` | `ValidatedImportPayload[]` | `DuplicateCheckedPayload[]` |
| Merge | `MergeStep` | `DuplicateCheckedPayload[]` | `MergedPipelinePayload[]` |
| Review | `ReviewStep` | `MergedPipelinePayload[]` | `ReviewQueuedPayload[]` |
| Publish | `PublishStep` | `ReviewQueuedPayload[]` | `PublishedPipelinePayload[]` |

## Orchestrator

- `AggregationPipeline` — runs all steps sequentially
- `createAdapterFetchProvider()` — bridges existing import adapters into Fetch step
- `createAggregationPipelineFromSource()` — factory from `SourceRecord`

## Import status lifecycle

Aggregation statuses (`AGGREGATION_PIPELINE_STATUSES`):

- `discovered`
- `imported`
- `normalized`
- `validated`
- `duplicate`
- `pending_review`
- `approved`
- `published`
- `rejected`
- `archived`

Mapped to legacy `ImportRecordStatus` via `status-mapper.ts` for compatibility with existing admin review.

## Review behavior

- `reviewRequired: true` (default) → status `pending_review`
- Invalid records → `rejected`
- Duplicate score above threshold → `duplicate`
- Auto-publish is **prepared only** — `PublishStep` does not write to consumer events

## Implementation

```
src/features/aggregation/pipeline/
  aggregation-pipeline.ts
  types.ts
  steps/
    fetch-step.ts
    normalize-step.ts
    validate-step.ts
    duplicate-check-step.ts
    merge-step.ts
    review-step.ts
    publish-step.ts
```

## Tests

- `aggregation-pipeline.test.ts`
- `normalize-step.test.ts`
- `validate-step.test.ts`
- `status-mapper.test.ts`

## Out of scope

- Real crawlers / APIs
- Cronjobs / webhooks
- Cloud sync
- Consumer screen changes
