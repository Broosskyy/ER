# Sprint 7 — Event Data Foundation Report

**Date:** 2026-07-17  
**Branch:** `cursor/sprint-07-event-data-6b06`  
**Scope:** Central event data pipeline, repository layer, screen migration

## IST analysis (before)

| Problem | Detail |
|---------|--------|
| Single demo file | All data in `demo-events.ts` |
| No pipeline | No normalization, validation, or deduplication |
| Direct screen imports | Home, Search, Saved, Map, Detail imported demo helpers directly |
| Mixed date formats | UI strings (`24 MAI`, `23:00`) plus ISO `startsAt` |
| No status model | All events implicitly visible |
| No source transparency | `sourceName` only, no `source` / `sourceUrl` contract |
| Search-owned date logic | Duplicate time-window helpers in search utils |

## Solution

Replaced scattered demo data with:

- `Event` + `RawEvent` models
- `EventSourceAdapter` (Demo, ManualImport, LocalJson)
- Pipeline: normalize → validate → deduplicate → status
- `EventRepository` singleton for all screens
- Central date/time formatting
- Vitest tests + `npm run pipeline:report` dev tool

## Pipeline results

| Metric | Count |
|--------|------:|
| Raw events | 12 |
| Normalized | 12 |
| Valid | 11 |
| Warnings | 0 |
| Rejected | 1 |
| Possible duplicates | 1 |
| **Published (app)** | **5** |

### Published events

1. `void-techno-saturday`
2. `klangkuenstler-berghain`
3. `fckng-serious`
4. `watergate-nights`
5. `sisyphos-open-air`

### Test fixtures (not in app UI)

| Fixture | Expected outcome |
|---------|------------------|
| `minimal-warehouse` | needs_review (excluded) |
| `invalid-date-event` | needs_review (bad date) |
| `possible-dup-void` | needs_review (possible duplicate) |
| `confirmed-dup-void` | rejected (confirmed duplicate) |
| `no-coords-berlin` | needs_review (excluded; no map marker) |
| `past-event-berlin` | needs_review (excluded) |
| `cancelled-event-berlin` | cancelled |

## Screen integration

| Screen | Status |
|--------|--------|
| Home | ✅ `eventRepository` featured/secondary |
| Search | ✅ `getPublishedEvents()` + filters |
| Saved | ✅ Favorites via repository |
| Map | ✅ `getEventsForMap()` |
| Event Detail | ✅ `getEventById()` + source label |

## Tests

```
npm test — 11/11 passed
```

Coverage: normalization, validation, URLs, coordinates, deduplication, published filter, search, time filters, map coordinates, `getEventById`.

## Validation

| Check | Result |
|-------|--------|
| `npm run lint` | Pass |
| `npx tsc --noEmit` | Pass |
| `npx expo-doctor` | 19/20 (expected CNG notice) |
| `npm test` | 11 passed |
| `npm run pipeline:report` | Pass |

## Changed / new files (high level)

```
src/features/events/
  types/           event.ts, raw-event.ts, event-status.ts
  adapters/        demo, manual, local-json + types
  pipeline/        normalize, validate, deduplicate, status, run-pipeline
  repository/      event-repository.ts
  formatting/      date-time, text, urls, coordinates, display-event
  data/            raw-demo-events, demo-images, home-config
  dev/             run-pipeline-report.ts
  __tests__/       event-pipeline.test.ts
```

Migrated: Home, Search, Saved, Map, Detail, Favorites, search utils, map/home/detail components.

## Known limitations

- In-memory pipeline only (no database, no server)
- Demo reference date fixed at 2026-05-24 for time filters
- `demo-events.ts` kept as thin compatibility shim (deprecated)
- No moderation UI for `needs_review` events
- Pipeline test fixtures excluded from app via `publishInApp: false`

## Next steps (future sprints)

1. Server-side import producing `RawEvent` batches
2. Database persistence for events and dedup decisions
3. Real source adapters (with legal/API access only)
4. Moderation workflow for `needs_review`
5. Organizer submissions and user favorites persistence

## APK build

| Field | Value |
|-------|-------|
| File | `Eternal-Rave-Sprint07-event-data.apk` |
| Size | ~103 MB (107,201,116 bytes) |
| Profile | Android Gradle `assembleRelease` |
| Path | `/opt/cursor/artifacts/apk/Eternal-Rave-Sprint07-event-data.apk` |
