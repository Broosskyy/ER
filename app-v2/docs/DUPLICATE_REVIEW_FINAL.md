# Duplicate Review Final

**Sprint:** ADMIN EVENT REVIEW + MODERATION + SOURCES FINAL  
**Date:** 2026-07-26  
**Status:** Complete (prepared, manual)

## Summary

Duplicate review is prepared for manual moderation. No automatic duplicate detection or merge pipeline — admins compare candidate events side by side and record a decision locally.

## Route

| Route | Screen |
|-------|--------|
| `/admin/events/review/[id]/duplicates` | Duplicate review |

## Candidate discovery

`AdminEventModerationService.findPreparedDuplicateCandidates()` returns published events that match either:

- Same title (case-insensitive), or
- Same date + same city

No ML, crawlers, or fuzzy scoring.

## Comparison fields

- Titel
- Datum
- Venue
- Veranstalter
- Quelle

## Actions

| Button | Decision stored | German label |
|--------|-----------------|--------------|
| Gleiche Veranstaltung | `same_event` | Primary |
| Unterschiedliche Veranstaltung | `different_event` | Ghost |
| Später entscheiden | `deferred` | Secondary |

## Persistence

- Key: `app.adminDuplicateReview.v1` (AsyncStorage)
- Service: `AdminModerationStateService.saveDuplicateDecision()`

## Components reused

- `DuplicateCandidateCard`
- `DuplicateComparisonRow`
- `AdminEmptyState`

## Implementation

- Screen: `src/features/admin/components/DuplicateReviewContent.tsx`
- Route: `app/admin/events/review/[id]/duplicates.tsx`
- Mappers: `buildDuplicateCandidate()`, `buildDuplicateComparisons()`

## Known limits (by design)

- No automatic duplicate detection
- No event merge
- Decisions are local audit records only

## Tests

- `admin-review-mapper.test.ts` — comparison rows
- `admin-event-moderation-service.test.ts` — candidate finder
