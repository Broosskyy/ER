# Sprint 10 — V1 Release Hardening Report

**Date:** 2026-07-18  
**Branch:** `cursor/sprint-08-10-v1-6b06`  
**Version:** 0.1.1 (versionCode 2)

## Map status

- `ENABLE_NATIVE_MAP = false`
- Map tab shows `MapUnavailableState`:
  - Title: "Map is not available yet"
  - Action: "Explore events" → Events tab
- No `MapView` import or mount
- No native crash risk

## Loading states

- Saved tab: waits for `isHydrated` before showing empty/list
- Favorites: hydration guard on all favorite UI

## Error states

- `CollectionUnknownState` — invalid collection route
- `EventNotFoundState` — existing event detail (unchanged)
- `MapUnavailableState` — map tab

## Empty states

Unified via `EmptyState` component on collections; existing `SearchEmptyState`, `SavedEmptyState` preserved.

## Touch audit

- Home "See all" — wired
- Home filter icon — navigates to Events
- Map "Explore events" — wired
- Collection filter button — wired

## Navigation audit

| Path | Status |
|------|--------|
| Home → Collection → Detail → back | OK |
| Events → Search → Detail → back | OK |
| Saved → Detail → back | OK |
| Map → Explore events | OK |

## Performance

- Collection screen: FlatList
- Search results: FlatList
- Home previews: limited slice per section

## Favorites

- Persistent via AsyncStorage (`@eternal_rave/favorite_event_ids_v1`)
- Synced across Home, Events, Collections, Detail, Saved

## Release info

| Field | Value |
|-------|-------|
| App name | Eternal Rave |
| Package | com.eternalrave.app |
| Version | 0.1.1 |
| versionCode | 2 |
| Orientation | portrait |

## Validation

| Check | Result |
|-------|--------|
| `npm test` | 25/25 |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass (warnings only) |
| `npx expo-doctor` | 19/20 |

## Changed files

- `app/(tabs)/map.tsx`
- `src/features/map/map-config.ts`
- `src/features/map/components/MapUnavailableState.tsx`
- `app.config.ts` (version bump)
- `package.json` (version bump)
- `vitest.config.ts` (asset mock for tests)

## Known limitations

- Native map requires future Google Maps API key setup
- Demo events only (Köln)
- No login, backend, or live API
