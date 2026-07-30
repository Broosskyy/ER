# Sprint 29 — Home & Search Regression Report

**Date:** 2026-07-30  
**Branch:** `feature/er-012-source-acquisition-foundation`  
**Scope:** Frontend only (Search + Home). No connector, ingestion, scheduler, review, matching, publish, or data-model changes.

---

## Executive Summary

Two frontend regressions appeared after Affenkäfig and Bootshaus went to production. Both share a single root cause: **offset-style timezone strings** (`UTC+02:00`) from published Affenkäfig events are not valid IANA identifiers for `Intl.DateTimeFormat`. Search surfaced the error visibly; Home hid failing hero rails silently.

**Status:** Fixed via `normalizeIanaTimezone()` in the event date/time formatting layer.

---

## Regression A — Search

### Symptom

- Search completely failed with: `Invalid time zone specified: UTC+02:00`
- No initial search results
- Discovery search unusable

### Root Cause

Affenkäfig published events store `timezone: "UTC+02:00"` (from JSON-LD ingestion). The search flow maps discovery results through `toEventDisplayModel()` → `formatDateLabel()` / `formatTimeInTimezone()`, which pass `timeZone` directly to `Intl.DateTimeFormat`. `UTC+02:00` is **not** a valid IANA timezone (expected: `Europe/Berlin`).

**Failure chain:**

```
discovery-search-client
  → DiscoveryQueryPlatform.queryDisplayModels()
  → DiscoveryEngine.mapToDisplayModels()
  → toEventDisplayModel()
  → formatDateLabel / formatTimeInTimezone (Intl.DateTimeFormat)
  → RangeError: Invalid time zone specified: UTC+02:00
```

`event-mapper.ts` only fell back to `Europe/Berlin` when timezone was **empty**, not when invalid.

### Fix

Added `normalizeIanaTimezone()` in `app-v2/src/features/events/formatting/date-time.ts`:

- Maps `UTC+02:00`, `UTC+01:00`, `+02:00`, etc. → `Europe/Berlin`
- Keeps valid IANA zones unchanged (`Europe/Berlin`, `America/New_York`, …)
- Falls back to `Europe/Berlin` for unknown values
- Applied in all Intl formatters: `formatTimeInTimezone`, `formatDateLabel`, `formatWeekdayLabel`
- Applied at DB mapping boundary in `event-mapper.ts`
- Normalized timezone on `EventDisplayModel` output in `display-event.ts`

### Validation

| Scenario | Result |
|----------|--------|
| Initial load | Pass — no runtime error |
| Text search | Pass — results map without throw |
| Empty search | Pass |
| Date filters | Pass |
| Location filters | Pass |
| Affenkäfig events (`UTC+02:00`) | Pass — formatted as Europe/Berlin |
| Bootshaus events (`Europe/Berlin`) | Pass — unchanged |

**Tests:** `src/features/events/__tests__/date-time-timezone.test.ts` (7 tests)

---

## Regression B — Home Featured/Hero

### Symptom

Home loaded list sections (Heute, Diese Woche, Dieses Wochenende, In deiner Nähe) but the **Trending/Featured hero rails** above "Heute" were missing.

### Root Cause

Home uses section-based feed architecture (`home-feed-section-config.ts`). The intended hero hierarchy is:

1. **Trending** (rail) — hero
2. Heute (list)
3. **Featured** (rail)
4. Diese Woche, Wochenende, …

`HomeFeedSectionView` returns `null` when `state.events.length === 0`. `loadHomeFeedSectionsParallel()` **swallows errors** per section and returns empty arrays.

When trending/featured queries returned Affenkäfig events, `toEventDisplayModel()` threw on `UTC+02:00` → section failed silently → hero rails hidden. List sections with Bootshaus-only or fewer affected events could still render, so the page appeared to start at "Heute".

This is the **same timezone root cause** as Search, not a separate feature-flag or routing issue.

### Fix

No architectural change required. Restoring timezone normalization re-enables trending/featured query mapping. Hero rails render above "Heute" per existing `HOME_FEED_SECTIONS` order.

### Validation

| Section | Expected | Result |
|---------|----------|--------|
| Trending (hero rail) | Above Heute | Restored |
| Heute | List | OK |
| Featured | Rail | Restored |
| Diese Woche | List | OK |
| Dieses Wochenende | List | OK |
| In deiner Nähe | List (with location) | OK |
| Top Clubs / Venues | Rails | OK |

---

## Affenkäfig Visibility

| Surface | Visible | Notes |
|---------|---------|-------|
| Home (trending/featured) | Yes | After timezone fix |
| Search | Yes | Filterable, no Intl error |
| Discovery | Yes | Display mapping succeeds |

Published Affenkäfig events retain `UTC+02:00` in the database (no pipeline change). Frontend normalizes at display time.

---

## Bootshaus Regression

No Bootshaus-specific regression identified. Bootshaus events use `Europe/Berlin` and were unaffected. Search/Home failures were triggered when result sets included Affenkäfig offset timezones.

---

## Tests

### New

- `src/features/events/__tests__/date-time-timezone.test.ts` — 7 passed

### Regression suites (targeted)

- `sprint23-home-feed.test.ts` — 4 passed
- `sprint24-search-experience.test.ts` — 4 passed
- `sprint21-discovery-engine.test.ts` — 6 passed
- `sprint22-discovery-api.test.ts` — 9 passed

### Full suite (`npx vitest run`)

- **1155 tests:** 1153 passed, 2 failed (pre-existing, unrelated to this fix)
  - `client-auth-config.test.ts` — missing `SUPABASE_URL` in test env
  - `sprint268-pre-publish-idempotency.test.ts` — import job id assertion

---

## Screenshots

Screenshots before/after were not captured in the automated dev environment. Manual verification recommended on Web + Android for Trending rail above Heute and search results with Affenkäfig events.

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/events/formatting/date-time.ts` | `normalizeIanaTimezone`, formatter guards |
| `src/features/events/formatting/display-event.ts` | Normalized timezone on display model |
| `src/features/events/formatting/event-card-view-model.ts` | Shared `formatWeekdayLabel` |
| `src/data/mappers/event-mapper.ts` | Normalize at DB boundary |
| `src/features/events/__tests__/date-time-timezone.test.ts` | Regression tests |
| `docs/HOME_SEARCH_REGRESSION_REPORT.md` | This report |

---

## Git

- **Commit:** `fix(frontend): restore search and featured home experience`
- **Push:** `origin/feature/er-012-source-acquisition-foundation`
- **Production tag:** None (per sprint instructions)
