# Post Sprint 7 — Stability Fix Report

**Date:** 2026-07-17  
**Branch:** `cursor/post-sprint7-stability-fix-6b06`  
**Scope:** Bundled stability fixes after Sprint 7 (no new feature sprint)

## Root causes (verified in code)

### 1. Home search not working

**Cause:** `SearchBar` used `editable={false}` on the `TextInput` with no `onPress` handler — purely decorative.

**Fix:** Wrapped the field in a `Pressable` that navigates to the Search tab and calls `requestSearchFocus()`. Search state lives in a shared `SearchProvider` so query/filters persist across tabs and event detail navigation.

### 2. Map tab crash (Android)

**Cause:** `react-native-maps` on Android requires Google Maps native configuration (`com.google.android.geo.API_KEY` in `AndroidManifest.xml`). The manifest had **no** Maps API key meta-data. Mounting `MapView` with `PROVIDER_GOOGLE` triggers a native crash when the key is missing.

**Fix:**
- Added `app.config.ts` with `react-native-maps` plugin and `android.config.googleMaps.apiKey`
- Added `isAndroidMapConfigured()` guard — **does not mount** `MapView` on Android without a configured key
- Added `MapErrorState` fallback (“Map unavailable / Please try again later”)
- Added `MapErrorBoundary`, coordinate guards (`isRenderableCoordinate`), and `sanitizeMapRegion`
- Marker rendering skips invalid/NaN coordinates

**Note:** A real `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is required at build time for live map tiles on Android. Without it, the app shows the controlled fallback instead of crashing.

### 3. “Show more” not responding

**Cause:** The absolute-positioned `BottomTicketCTA` intercepted touches over the lower screen area. The `Pressable` toggle sat in the scroll content where the ticket bar overlapped it.

**Fix:**
- `pointerEvents="box-none"` on `BottomTicketCTA` container (only the button captures touches)
- Rewrote `ExpandableDescription` with `isDescriptionExpanded` state and `onTextLayout` truncation detection
- Added `zIndex` and `hitSlop` on the toggle button

### 4. Favorites lost after restart

**Cause:** `FavoritesProvider` stored IDs only in React `useState` (in-memory, session-only).

**Fix:** Persist favorite event IDs via `@react-native-async-storage/async-storage`.

**Storage key:** `@eternal_rave/favorite_event_ids_v1`

- Load on app start (hydration)
- Save on every change after hydration
- Invalid/unknown IDs filtered on load
- `isHydrated` flag prevents false empty states and favorite UI flicker

**Limits:** Local device storage only. No cloud sync. Data may be lost on app uninstall.

### 5. Demo region still Berlin

**Cause:** Raw demo events, `appConfig.defaultCity`, map regions, and `LocationSelector` all referenced Berlin.

**Fix:** Migrated all published demo events to **Köln** venues with consistent addresses and coordinates (Bootshaus, Odonien, Gewölbe, Artheater, Gebäude 9). Updated map center, home location label, profile default city, and pipeline test fixtures.

## Published Köln demo events: 5

1. VOID: Techno Saturday — Bootshaus  
2. Klangkuenstler — Odonien  
3. FCKNG SERIOUS — Gewölbe  
4. Rhein Nights — Artheater  
5. Gebäude 9 Open Air — Gebäude 9  

## Map library

- **react-native-maps** `1.27.2` (unchanged, Expo SDK 57 compatible)
- Android provider: `PROVIDER_GOOGLE`
- Crash prevention: conditional render + error fallback when API key missing

## Changed files (high level)

| Area | Files |
|------|-------|
| Home search | `SearchBar.tsx`, `index.tsx`, `SearchContext.tsx`, `(tabs)/_layout.tsx` |
| Map | `map.tsx`, `map-availability.ts`, `coordinates.ts`, `MapEventMarker.tsx`, `MapEmptyState.tsx` |
| Event detail | `ExpandableDescription.tsx`, `BottomTicketCTA.tsx` |
| Favorites | `FavoritesContext.tsx`, `favorites-storage.ts`, tests |
| Köln data | `raw-demo-events.ts`, `layout.ts`, `LocationSelector.tsx`, `map/constants.ts` |
| Profile | `profile.tsx` |
| Config | `app.config.ts` (replaces `app.json`) |

## Tests

| Suite | Result |
|-------|--------|
| `npm test` | 17/17 passed |
| Pipeline report | 5 published events |
| `npm run lint` | Pass (warnings only) |
| `npx tsc --noEmit` | Pass |
| `npx expo-doctor` | 18/20 |

### Expo Doctor notes

1. **app.json vs app.config.ts** — resolved by removing static `app.json`; `app.config.ts` is the single source of truth.
2. **CNG / native folders** — expected warning: `android/` exists alongside prebuild config. Release builds should run `npx expo prebuild` when native config changes. Does not block Gradle `assembleRelease`.

## Known limitations

- Android map tiles require a real Google Maps API key at build time
- Profile remains minimal (city + saved count) — no Sprint 5 full profile
- Favorites are local-only (no account sync)
- Demo events are fictional Köln listings, not real current events
