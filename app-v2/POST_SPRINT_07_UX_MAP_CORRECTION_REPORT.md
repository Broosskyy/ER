# Post Sprint 7 — UX & Map Correction Pass Report

**Date:** 2026-07-17  
**Branch:** `cursor/post-sprint7-ux-map-correction-6b06`  
**Scope:** UX correction pass after Sprint 7 + Stability Fix (no new feature sprint)

## Summary

This pass removes redundant Home search, restructures Home and Events/Search UX, separates time vs genre filters, adds an Instagram-inspired Explore poster grid, improves Köln demo posters, and fixes the Map tab to show real interactive tiles via an OpenStreetMap fallback when no Google Maps API key is configured.

---

## 1. Removed Home search

**Removed:**
- `SearchBar.tsx` component (deleted)
- Home-specific search UI, handlers, and navigation via Home search field
- Redundant spacing from the old search row

**Preserved:**
- Search remains exclusively on the Events tab (`/(tabs)/search`)
- `SearchProvider` still wraps tabs for shared filter state and `requestSearchFocus()` from other flows

---

## 2. New Home structure

**Order (top → bottom):**
1. Compact `HomeHeader`
2. `LocationSelector` (Köln)
3. Optional filter icon button (placeholder, no sheet yet)
4. **Highlights** — horizontal featured cards
5. **Heute Abend** — tonight events
6. **Dieses Wochenende** — weekend events
7. **Kommende Events** — remaining upcoming events

**Utilities:** `src/features/home/utils/home-sections.ts` — `getTonightEvents`, `getWeekendEvents`, `getMoreUpcomingEvents`

No search bar. Content starts earlier. Vertically scrollable with bottom-nav safe padding.

---

## 3. Filter grouping (Events tab)

**Time / discovery filters** (row 1):
- Explore, Today, This Weekend, Upcoming

**Genre filters** (row 2, horizontal scroll):
- All Genres, Techno, Hard Techno, House, Trance, Psy, Industrial, Drum & Bass

Implemented in `ExploreTimeFilterRow` + `SearchGenreChipRow` with extra right padding so chips are not clipped.

`SearchContext` now uses `timeFilter` instead of the old `sort` segment.

---

## 4. Events tab — Explore + Search

### State A: Explore (empty query)
- Search field at top
- Compact time + genre filter rows
- `ExploreFeed` with curated sections (Trending in Köln, Tonight, This Weekend, Techno, Hard Techno)
- `ExplorePosterGrid` — 2-column poster grid, 3:4 aspect ratio, tappable posters → event detail

### State B: Active search (query entered)
- Explore grid hidden
- Compact `EventCard` result list
- Real-time filtering via `filterSearchEvents()` (title, artists, venue, city, genres)
- Clear button returns to Explore

---

## 5. Search field

- Placeholder: `Search events, artists or venues...`
- Search icon, clear button on input
- No extra menus beside the field
- `keyboardShouldPersistTaps="handled"`, dismiss on scroll

---

## 6. Köln demo posters

| Event | Poster asset | Size |
|-------|-------------|------|
| VOID: Techno Saturday | `poster-void.png` | 600×800 |
| Klangkuenstler | `poster-klang.png` | 600×800 |
| FCKNG SERIOUS | `poster-fckng.png` | 600×800 |
| Rhein Nights | `poster-rhein.png` | 600×800 |
| Gebäude 9 Open Air | `poster-gebaeude.png` | 600×800 |

- **Published Köln demo events:** 5
- **Distinct posters:** 5
- Abstract generated demo art — no copyrighted real event posters
- Mapped in `demo-images.ts` via `getEventImageAsset()`

---

## 7. Map — root cause & solution

### Verified root cause

1. **`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is empty** in the build environment.
2. **`AndroidManifest.xml` has no `com.google.android.geo.API_KEY` meta-data** when the key is empty (confirmed before and after `expo prebuild`).
3. **Previous stability fix blocked `MapView` entirely** when `isAndroidMapConfigured()` was false → users saw only `MapErrorState`, never real tiles.
4. Mounting `MapView` with `PROVIDER_GOOGLE` and no native API key previously caused **native crashes** on Android.

### Solution implemented

| Mode | When | Behavior |
|------|------|----------|
| **Google Maps** | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` set at build | `PROVIDER_GOOGLE` + dark custom style |
| **OSM fallback** | Android, no API key | `mapType="none"` + `UrlTile` (OpenStreetMap raster tiles) |

**Map load states:**
- `loading` — `MapLoadingOverlay` (deferred error, 15s timeout)
- `loaded` — map + markers + header/preview
- `error` — `MapErrorState` with **Retry** (re-mounts map) and **Go to Events**

**No crash without API key.** Real street tiles via OSM when Google key is absent.

### Manual configuration (Google Maps on Android)

Set before `expo prebuild` + Gradle release build:

```bash
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Also documented in `.env.example`.

After setting the key, run:

```bash
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
```

The `react-native-maps` plugin injects `com.google.android.geo.API_KEY` into `AndroidManifest.xml` when the key is non-empty.

---

## Changed files

| Area | Files |
|------|-------|
| Home | `app/(tabs)/index.tsx`, `home/components/index.ts`, `home/utils/home-sections.ts`, deleted `SearchBar.tsx` |
| Events/Search | `app/(tabs)/search.tsx`, `search/constants.ts`, `SearchContext.tsx`, `filter-events.ts`, `ExploreFeed.tsx`, `ExplorePosterGrid.tsx`, `ExploreTimeFilterRow.tsx`, `SearchInput.tsx`, `SearchGenreChipRow.tsx`, deleted `SortSegmentControl.tsx` |
| Demo assets | `assets/demo/posters/*.png`, `demo-images.ts` |
| Map | `app/(tabs)/map.tsx`, `map-tiles.ts`, `MapLoadingOverlay.tsx`, `MapEmptyState.tsx` |
| Config | `.env.example` |

---

## Tests

| Suite | Result |
|-------|--------|
| `npm test` | **17/17 passed** |
| `npm run lint` | **Pass** (3 warnings: import order, exhaustive-deps) |
| `npm run typecheck` | **Pass** |
| `npx expo-doctor` | **19/20** (expected CNG/prebuild sync warning) |

### Expo Doctor note

Native `android/` folder exists alongside `app.config.ts`. Release builds must run `npx expo prebuild` when native config changes. Does not block `assembleRelease`.

---

## APK build

| Field | Value |
|-------|-------|
| **Filename** | `eternal-rave-0.1.0-post-sprint7-ux-map-correction-preview.apk` |
| **Size** | ~99 MB |
| **Profile** | Android Gradle `assembleRelease` (after `expo prebuild --platform android`) |
| **Package** | `com.eternalrave.app` |
| **Version** | `0.1.0` |

---

## Known limitations

- OSM tiles require network; tile server rate limits may apply under heavy use
- Google Maps dark custom style only applies when API key is configured
- Home filter icon is visual-only (no bottom sheet in this pass)
- Favorites remain local-only (AsyncStorage)
- Demo events are fictional Köln listings
- Profile tab unchanged (minimal)

---

## Preserved (unchanged scope)

- Event data pipeline (`eventRepository`)
- Favorites persistence (`@eternal_rave/favorite_event_ids_v1`)
- Event detail navigation and Show more/less
- Bottom navigation structure
- No backend, login, live API, or scrapers
