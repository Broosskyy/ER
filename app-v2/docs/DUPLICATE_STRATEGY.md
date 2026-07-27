# Duplicate Strategy

**Sprint:** EVENT AGGREGATION FOUNDATION + IMPORT PIPELINE  
**Date:** 2026-07-26  
**Status:** Complete (architecture)

## Summary

Central duplicate detection is prepared as a pluggable strategy. The default implementation reuses the existing score-based `DuplicateDetectionService` from the import matching layer.

## Compared signals

| Signal | Implementation |
|--------|----------------|
| Title | Token similarity (≥ 70%) |
| Date | Same calendar day required |
| Venue | Matched venue ID or name similarity |
| Organizer | Artist/organizer name overlap |
| Images | Prepared in signal list (URL comparison via event/ticket URLs) |

## Interface

```typescript
interface DuplicateStrategy {
  compare(
    candidate: CanonicalImportEvent,
    catalog: MatchingCatalog,
    context?: { matchedVenueId?: string; matchedArtistIds?: string[] },
  ): DuplicateStrategyResult;
}
```

## Default implementation

`ScoreBasedDuplicateStrategy` wraps `DuplicateDetectionService`:

- Threshold: `matchingConfig.duplicateThreshold` (70)
- Returns `duplicateScore`, `duplicateEventId`, `isDuplicate`
- No AI / ML detection

## Pipeline integration

`DuplicateCheckStep` runs after validation:

- Valid records → duplicate check against `MatchingCatalog`
- Invalid records → skip duplicate check
- High score → pipeline status `duplicate`

## Admin review connection

Maps to existing admin duplicate review flow:

- Import review blocks approval when `duplicateScore >= 70`
- Admin moderation duplicate review remains manual

## Tests

- `duplicate-strategy.test.ts`

## Out of scope

- Automatic merge on duplicate detection
- ML / fuzzy image matching
- Cross-source real-time deduplication at ingest
