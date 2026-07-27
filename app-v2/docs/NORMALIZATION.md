# Normalization

**Sprint:** EVENT AGGREGATION FOUNDATION + IMPORT PIPELINE  
**Date:** 2026-07-26  
**Status:** Complete

## Summary

All external sources are normalized into `CanonicalImportEvent` before validation or storage. Consumer screens never receive raw source payloads.

## Canonical fields

| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | Trimmed, length-limited |
| `startDate` | yes | ISO 8601 |
| `endDate` | no | ISO 8601 |
| `startTime` / `endTime` | derived | Extracted from ISO dates |
| `venueName` | recommended | Venue label |
| `cityName` | recommended | City label |
| `countryCode` | no | ISO country, fallback from source |
| `latitude` / `longitude` | prepared | Coordinate normalization |
| `genreNames` | no | String list |
| `artistNames` | no | String list |
| `description` | no | Plain text |
| `imageUrl` / `imageUrls` | no | Cover images |
| `organizerName` | no | Organizer label |
| `ticketUrl` | no | Normalized URL |
| `eventUrl` | no | Normalized URL |
| `priceAmount` / `priceCurrency` | no | Ticket price |
| `sourceId` / `sourceName` | yes | Source attribution |

## Normalization stack

1. **Fetch** — raw payload from adapter or connector
2. **EventNormalizer** — existing import normalizer (`event-normalizer.ts`)
3. **Canonical mapper** — `mapNormalizedCandidateToCanonical()`

Regional defaults applied during normalization:

- `countryCode` from source when missing on candidate
- `defaultTimezone` from source for date parsing

## Extended candidate fields

`NormalizedEventCandidate` extended with:

- `priceAmount`, `priceCurrency`
- `imageUrls[]`
- `sourceId`, `sourceName`

## Rule

No source writes directly to consumer screens. All paths go through:

```
Raw payload → NormalizedEventCandidate → CanonicalImportEvent → Pipeline
```

## Tests

- `canonical-event-mapper.test.ts`
- `normalize-step.test.ts`
