# Discovery Ranking Foundation

## Service

`DiscoveryRankingService` — `src/features/events/discovery/discovery-ranking-service.ts`

**Status:** Implemented in prior phase; not modified in final closure.

## Signals (real data only)

- Event quality score, source trust, freshness
- Time relevance, city/genre match
- Image/ticket presence, featured flag
- Conflict count, cancellation, duplicate confidence penalties

## Determinism

Stable sort with tie-breakers: score → start time → `canonicalEventId`.

## Companion

`DiscoveryDiversityService` limits organizer/series repetition and duplicate groups.

## Tests

`src/features/events/__tests__/discovery-foundations.test.ts`
