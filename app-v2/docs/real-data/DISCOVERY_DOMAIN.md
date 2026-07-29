# Discovery Domain Integration — Phase 2D

Discovery surfaces only **published** events that pass eligibility, lifecycle, ranking, and diversity rules. No demo-only bypass.

## Pipeline

```
getPublishedEvents()
  → applyEventFilters(filters)
  → toRankableEvent (per event)
      ├── DiscoveryEligibilityResolver
      └── EventLifecycleResolver (via toEventLifecycleInput)
  → discoveryRankingService.rank()
  → discoveryDiversityService.diversify()
  → toEventDisplayModel (includes lifecycleStatus)
```

## Lifecycle Exclusions

Events are **not** ranked when lifecycle status is:

- `cancelled`
- `postponed` (default; no include flag in feed)
- `ended`
- `archived`

Discoverable statuses: `scheduled`, `on_sale`, `sold_out`, `happening_now`.

Draft / needs_review never appear (`getPublishedEvents` editorial gate).

## Canonical IDs

- `canonicalEventId` resolved via `eventRepository.resolveCanonicalId`
- Diversity deduplication uses canonical event id and `organizerId ?? organizer` for organizer spread

## Components

| Piece | File |
|-------|------|
| Feed orchestration | `discovery-feed-service.ts` |
| Eligibility | `discovery-eligibility-resolver.ts` |
| Ranking | `discovery-ranking-service.ts` |
| Diversity | `discovery-diversity-service.ts` |
| Lifecycle input | `event-lifecycle-from-event.ts` |
| Display | `display-event.ts` (`lifecycleStatus`) |

## Options

`DiscoveryFeedOptions`: `surface`, `filters`, `city`, `selectedGenres`, `includePast`, `clock` (tests use `FixedClock`).

## Tests

- `discovery-foundations.test.ts` — ranking, diversity, canonical dedup
- `phase-2d-domain-integration.test.ts` — ended/archived exclusion via lifecycle resolver
