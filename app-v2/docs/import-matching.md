# Import Matching (Sprint 12C)

Entity matching and duplicate detection for import records. Runs after normalization and validation, before records are stored as `needs_review`.

## Pipeline Position

```
ImportRecord
  → Normalizer (12B)
  → ImportCandidateValidator (12B)
  → ImportMatchingService (12C)
  → DuplicateDetectionService (12C)
  → needs_review (no auto-publish)
```

Integration point: `ImportOrchestrator` loads a `MatchingCatalog` once per job and enriches each valid record.

## Services

| Service | Responsibility |
|---|---|
| `CityMatchingService` | Name, slug, aliases (Köln/Cologne, München/Munich), postal hints |
| `VenueMatchingService` | Name, address, city, coordinates |
| `ArtistMatchingService` | Case, whitespace, known aliases |
| `GenreMatchingService` | Synonyms (Tech House / Techhouse / tech-house) |
| `DuplicateDetectionService` | Score against known events |
| `ImportMatchingService` | Orchestrates all matchers, produces `MatchResult` |

## MatchResult

Stored on `ImportRecord` via:

- `matchedCityId`, `matchedVenueId`
- `matchedArtistIds[]`, `matchedGenreIds[]`
- `duplicateEventId`, `duplicateScore`
- `matchingWarnings[]`
- `confidence` (in match metadata / logs)

## Confidence Scores

Each entity match returns `confidenceScore` 0–100:

| Range | Meaning |
|---|---|
| 95–100 | Exact match |
| 70–94 | Probable match |
| < 70 | No match (warning logged) |

Overall `confidence` = average of successful entity match scores.

## Duplicate Rules

Configured in `matchingConfig` (`src/features/import/matching/matching-config.ts`):

| Score | Rule |
|---|---|
| 100 | Same `externalId` |
| 95+ | Same title + date + venue |
| 90+ | Same title + date + coordinates (≤ 0.5 km) |
| 80+ | Same title + date + artist |
| < 70 | Not a duplicate |

Threshold: `duplicateThreshold = 70` — scores at or above are flagged.

## Logging

Structured log codes (no PII):

- `CITY_MATCHED` / `CITY_MATCH_FAILED`
- `VENUE_MATCHED` / `VENUE_MATCH_FAILED`
- `ARTIST_MATCHED` / `ARTIST_MATCH_FAILED`
- `GENRE_MATCHED` / `GENRE_MATCH_FAILED`
- `DUPLICATE_DETECTED`
- `MATCH_CONFIDENCE`

## Edge Cases

| Case | Behavior |
|---|---|
| Unknown city | Warning, no `matchedCityId` |
| Venue in wrong city | Skipped when city filter active |
| Artist not in catalog | Warning per artist |
| Genre synonym | Normalized before compare |
| Recurring event duplicate | Compared by calendar day + title |
| Invalid record | Matching skipped entirely |

## Database

Migration: `20260722000000_import_matching.sql`

Adds matching columns to `import_records` with FK references to `cities`, `venues`, `events`.

## Out of Scope (Sprint 12D+)

Approve/reject workflow, admin review UI, event publication, scheduler, AI matching.
