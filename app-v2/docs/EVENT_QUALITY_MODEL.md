# Event Quality Model

## Resolver

`EventQualityResolver` — `src/features/events/quality/event-quality-resolver.ts`

## Dimensions

| Dimension | Weight role |
|-----------|-------------|
| Completeness | 55% — title, date, venue, city, coords, description, genres, lineup, image, ticket, organizer |
| Trust | 20% — source trust input |
| Freshness | 10% — from `publishedAt` |
| Media / ticket / location | 5% each |
| Critical conflicts | −25 per unresolved critical conflict |

## Tiers

| Score | Tier |
|-------|------|
| ≥ 85 | A |
| ≥ 70 | B |
| ≥ 50 | C |
| < 50 | D |

## Usage

Recalculated after `MergeProvenanceService.merge()` and `ConflictResolutionService.resolve()`.

No fake or random signals — all inputs from canonical event data and real conflict state.
