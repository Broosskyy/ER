# Sprint 8 — Discovery Collections Report

**Date:** 2026-07-18  
**Branch:** `cursor/sprint-08-10-v1-6b06`

## Pre-Sprint Fix — Home "See all"

**Issue:** `SectionHeader` actions on Home had no `onActionPress` handlers.

**Fix:** Every Home section now navigates to `/collection/[type]` via `router.push()`.

## Collection types

| Type | Title | Home preview |
|------|-------|--------------|
| `highlights` | Highlights | Yes (carousel) |
| `tonight` | Tonight | Yes |
| `weekend` | This Weekend | Yes |
| `upcoming` | Upcoming | Yes |
| `techno` | Techno | Yes |
| `house` | House | Yes |
| `hard-techno` | Hard Techno | No |
| `trance` | Trance | No |
| `psy` | Psy | No |
| `industrial` | Industrial | No |
| `drum-and-bass` | Drum & Bass | No |

## Architecture

- **Config:** `src/features/collections/event-collection-config.ts`
- **Resolver:** `src/features/collections/event-collections.ts`
- **Route:** `app/collection/[type].tsx`
- **Screen:** `src/features/collections/components/CollectionScreen.tsx`

All collections use `eventRepository.getPublishedEvents()` + centralized `selectEvents` filter functions. No duplicated static lists.

## Navigation

- Home → Collection → Event Detail → back
- Android back supported via Expo Router stack
- Unknown collection type shows `CollectionUnknownState`

## Empty states

Per-collection `emptyTitle` / `emptyDescription` (e.g. "No events tonight").

## Tests

- `src/features/collections/__tests__/collections.test.ts` — 3 tests

## Changed files

- `app/(tabs)/index.tsx`
- `app/collection/[type].tsx`
- `app/_layout.tsx`
- `src/features/collections/**`
- `src/features/home/utils/home-sections.ts` (import cleanup)

## Known limitations

- Home filter icon navigates to Events tab (full filter sheet there)
- Genre collections without published demo events are hidden on Home
