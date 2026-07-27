# Map Discovery + Location Filter Final

## Scope

This sprint delivers the full Map Discovery frontend on top of the existing component system. It reuses preview map controls, bottom sheets, location states, and shared search filters. Native `react-native-maps` remains gated (`ENABLE_NATIVE_MAP = false`) to avoid Android crashes without a configured Google Maps key.

## Changed files

- `app/(tabs)/map.tsx`
- `app/(tabs)/search.tsx`
- `src/features/map/index.ts`
- `src/features/map/components/index.ts`
- `src/features/map/components/MapDiscoveryScreen.tsx`
- `src/features/map/components/MapDiscoverySurface.tsx`
- `src/features/map/components/MapEventPreviewBottomSheet.tsx`
- `src/features/map/components/MapClubPreviewBottomSheet.tsx`
- `src/features/map/components/MapFilterSheet.tsx`
- `src/features/map/hooks/useMapDiscoveryController.ts`
- `src/features/map/utils/map-discovery-selectors.ts`
- `scripts/capture-map-discovery-screenshots.mjs`

## New files

- `src/features/map/types/discovery-models.ts`
- `src/features/map/data/map-club-fixtures.ts`
- `src/features/map/config/map-discovery-config.ts`
- `src/features/map/__tests__/map-discovery-selectors.test.ts`
- `src/features/map/__tests__/map-discovery-screen.test.ts`

## Map status

- **Events tab:** list ↔ map toggle added without changing bottom navigation (Home / Events / Saved / Profile).
- **Hidden map route:** `/(tabs)/map` now renders the full standalone map screen for deep links.
- **Map surface:** UI-only canvas with pan gesture, marker projection, layer badge (Standard / Satellite / Dark prepared).
- **Markers:** event, club, and festival marker types with featured / today / tomorrow / weekend status derivation from demo timing.
- **Preview:** event bottom sheet with hero, metadata, genres, save, share, tickets placeholder, and navigation to Event Detail.
- **Clubs:** club preview bottom sheet routes back into Events search with the club name — no separate club detail route exists yet.
- **Filters:** dedicated map filter bottom sheet with radius, date, genre, free, indoor/outdoor, and sort options. Shared `EventFilters` remain in `SearchContext`.
- **Location:** permission / unknown / denied messaging via existing location components and `UserLocationProvider`.
- **Search in area:** appears after map movement; uses mock refresh only.
- **States:** loading skeleton, empty, offline/error hooks, permission/disabled presentation overrides for QA.

## Navigation test

- Events list → map toggle → map surface
- Map marker → event preview sheet → Event Detail (`/event/[id]`)
- Club marker → club preview → Events search with club query
- Hidden route `/map` renders standalone map
- Back navigation from Event Detail unchanged

## Responsive test

- Mobile layout uses safe areas, bottom inset, and horizontal screen padding.
- Embedded map mode in Events avoids duplicate search input.
- Desktop/web keeps map inside the responsive shell; native map mounting remains disabled.

## Known open points

- Native Google Maps / OpenStreetMap provider is architecturally prepared but not enabled.
- Distance, indoor/outdoor, and popularity sorting are presentation-level only.
- “In deiner Nähe” and radius filtering depend on real location or backend contracts.
- Club detail is a preview fallback, not a dedicated route.
- Marker clustering, lazy loading, and viewport rendering configs exist but are not active.
- Satellite and dark layers are UI state only on the mock canvas.

## Prepared architecture

- `MapEvent`, `MapClub`, `MapBounds`, `MapFilter`, `MapViewport`, `MarkerType`, `MarkerStatus`
- `MAP_CLUSTERING_CONFIG`, `MAP_LAZY_LOADING_CONFIG`, `MAP_VIEWPORT_RENDERING_CONFIG`
- `NativeEventMap` retained for future gated native mounting
- Shared filter state via `SearchContext`
- Shared location state via `UserLocationProvider`

## Screenshots

Generated under `docs/visual-qa/map-discovery-location-filter-final/` when the dev server is running:

- Map via Events tab (`/search?view=map`)
- Standalone map route (`/map`)
- Desktop map view

## Verification

- `npm run typecheck` passed
- 11 focused map tests passed across 4 files

## Recommended next sprint

**SAVED + PROFILE FINAL**
