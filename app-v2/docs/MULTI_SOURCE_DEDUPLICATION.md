# Multi-Source Deduplication

## Pipeline stages

1. **Candidate generation** — `BlockingKeyDuplicateCandidateGenerator` (URL, external ID, day-city, day-venue, title-city)
2. **Scoring** — `ScoreBasedDuplicateStrategy` (existing)
3. **Decision** — `DuplicateDecisionService` persists to `duplicate_decisions`
4. **Merge** — `MergeProvenanceService` after `merged` decision

## Decisions

| Decision | Effect |
|----------|--------|
| `merged` | Triggers provenance merge; establishes canonical ID |
| `kept_separate` | Blocks automatic merge |
| `deferred` | No merge; audit only |
| `related_series` / `false_positive` / `false_negative_correction` | Prepared enum values |

## Admin

`DuplicateReviewContent` uses `AdminMultiSourceService.decideDuplicate()` with real persistence.

## Thresholds

Central duplicate thresholds remain in `duplicate-strategy` configuration; no per-source magic numbers in UI.
