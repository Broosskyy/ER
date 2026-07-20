# Event Data Architecture

> **Hinweis (ER-005.4):** Für Ist-vs.-Ziel-Architektur, Schema-Gaps und Migrationsstrategie siehe `app-v2/docs/PLATFORM_ARCHITECTURE_FOUNDATION.md`. Dieses Dokument beschreibt primär die **Pipeline-/Demo-Schicht**; Teile der Status-Beschreibung können gegenüber der DB veraltet sein.

**Sprint 7 — Eternal Rave app-v2**

## Overview

Event data flows through a local, testable pipeline before reaching any UI screen. Screens never import raw demo files directly; they read from `eventRepository`, which exposes only **published** events.

```
RawEvent[]
  → EventSourceAdapter(s)
  → normalizeRawEvent()
  → validateEvent()
  → deduplicateEvents()
  → decideEventStatus()
  → publishedEvents[]
  → EventRepository
  → UI (Home, Search, Saved, Map, Detail)
```

## Core models

### `Event` (`src/features/events/types/event.ts`)

Canonical normalized model with required fields: `id`, `slug`, `title`, `description`, `startDateTime`, `timezone`, `venue`, `city`, `country`, `genres`, `artists`, `source`, `sourceEventId`, `status`, `createdAt`, `updatedAt`.

Optional fields: `endDateTime`, `imageUrl`, `imageAssetKey`, `address`, `latitude`, `longitude`, `lineup`, `organizer`, `ageRestriction`, `priceText`, `ticketUrl`, `sourceUrl`.

### `RawEvent` (`src/features/events/types/raw-event.ts`)

Unprocessed source payload (`rawTitle`, `rawDate`, `rawVenue`, …). **Never used in UI components.**

### `EventDisplayModel` (`src/features/events/formatting/display-event.ts`)

UI-facing projection with local `image` asset, formatted `date` / `startTime`, and `sourceLabel`. Created via `toEventDisplayModel(event)`.

## Status pipeline

| Status | Meaning |
|--------|---------|
| `imported` | Initial normalized state |
| `needs_review` | Invalid, duplicate candidate, or excluded test fixture |
| `published` | Visible in the app |
| `rejected` | Confirmed duplicate |
| `cancelled` | Explicitly cancelled |

Only `published` events are returned by `EventRepository`.

## Normalization (`pipeline/normalize.ts`)

- Trims whitespace, rejects `"undefined"` strings
- Parses ISO and `YYYY-MM-DDTHH:mm:ss` dates
- Normalizes genres/artists arrays (deduped, non-empty entries)
- Validates optional URLs and coordinates
- Missing required data → normalization errors → `needs_review`

## Validation (`pipeline/validate.ts`)

Returns `{ valid, errors, warnings }`. Checks id, title, dates, city/venue, URLs, coordinates, genres/artists arrays, status, and source fields.

## Deduplication (`pipeline/deduplicate.ts`)

Priority order:

1. Same `source` + `sourceEventId` → **confirmed duplicate**
2. Normalized title + date + venue → **possible duplicate**
3. Normalized title + date + city → **possible duplicate**

Confirmed duplicates → `rejected`. Possible duplicates → `needs_review`.

## EventRepository (`repository/event-repository.ts`)

Singleton: `eventRepository`

| Method | Purpose |
|--------|---------|
| `getPublishedEvents()` | All published events |
| `getEventById(id)` | Single published event |
| `getFeaturedEvents()` | Home carousel |
| `getSecondaryHomeEvents()` | Home list section |
| `searchEvents(filters)` | Query, genre, time filters |
| `getEventsForMap()` | Published events with valid coordinates |
| `getUpcomingEvents()` | From reference date |
| `getEventsThisWeek()` | Reference week window |
| `getEventsThisMonth()` | Reference month window |

## Date & time (`formatting/date-time.ts`)

- Internal storage: ISO 8601 (`startDateTime`)
- Default timezone: `Europe/Berlin`
- UI formatting centralized: `formatDateLabel`, `formatTimeInTimezone`, `formatEventDateTime`
- Reference date for demo filters: `2026-05-24T12:00:00`

## Screen integration

| Screen | Data access |
|--------|-------------|
| Home | `eventRepository.getFeaturedEvents()` / `getSecondaryHomeEvents()` |
| Search | `eventRepository.getPublishedEvents()` + `filterSearchEvents()` |
| Saved | `FavoritesContext` resolves via `eventRepository` |
| Map | `eventRepository.getEventsForMap()` |
| Event Detail | `eventRepository.getEventById()` |

## Boundaries for future work

- Add new `EventSourceAdapter` implementations without changing screens
- Replace in-memory pipeline with server import + database
- Add moderation UI on top of `needs_review` status
- Persist favorites separately from event catalog
