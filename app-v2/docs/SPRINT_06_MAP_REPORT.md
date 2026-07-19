# Sprint 6 — Functional Event Map Report

**Date:** 2026-07-17  
**Route:** `app/(tabs)/map.tsx`  
**Mockup reference:** `12_Map.jpg`

## Map library

- **react-native-maps** (installed via `npx expo install react-native-maps`)
- Interactive `MapView` with Google Maps on Android
- Dark custom map style aligned with Eternal Rave surfaces

## Configuration changes

- `package.json` — added `react-native-maps`
- `android/` — regenerated via `npx expo prebuild --platform android`
- No `expo-location` / no mandatory location permission
- No My Location button in this sprint

## Event model

Optional demo fields on `DemoEvent`:

- `latitude?: number`
- `longitude?: number`

Helpers:

- `hasMapCoordinates(event)`
- `getMapDemoEvents()` — only events with valid finite coordinates

All 5 Berlin demo venues use realistic coordinates near their listed addresses (demo data).

Sisyphos Open Air uses a slight offset from VOID at the same venue so both markers remain tappable.

## Map screen features

| Feature | Status |
|---------|--------|
| Full-screen interactive map | ✅ |
| Header overlay (city + event count) | ✅ |
| Custom markers (selected state) | ✅ |
| Event preview card above tab bar | ✅ |
| Open event detail from preview | ✅ |
| Favorites via `FavoritesProvider` | ✅ |
| Tap map to close preview | ✅ |
| Empty state (no coordinates) | ✅ |
| Initial region centered on Berlin | ✅ |

## Navigation

- Marker tap → preview
- Preview tap → `/event/[id]`
- Empty state → Search tab
- Back navigation unchanged

## Favorites sync

Preview heart uses central `useFavorites()` — syncs with Home, Search, Saved, Detail.

## Location behavior

- No location permission requested
- No background tracking
- No My Location button

## Performance

- Memoized `MapEventMarker`
- `tracksViewChanges={false}` on markers
- Stable marker keys (`event.id`)
- `initialRegion` only (no camera update loops)

## Known limitations

- **Google Maps API key:** Android release builds may require `android.config.googleMaps.apiKey` in app config for production map tiles; internal APK may show limited tiles without a project key
- Demo coordinates only — not live geocoding
- No clustering (5 markers, slight Sisyphos offset documented)
- Sprint 5 preferred city not implemented — defaults to `appConfig.defaultCity` (Berlin)
- No routing, distance sort, or heatmaps

## Validation

| Check | Result |
|-------|--------|
| `npm run lint` | Pass |
| `npx tsc --noEmit` | Pass |
| `npx expo-doctor` | 19/20 (expected CNG notice) |
| Android Gradle release build | Pass |

## Manual tests

1. Map tab loads ✅
2. Pan/zoom ✅
3. Markers visible ✅
4. Marker → correct preview ✅
5. Preview → detail ✅
6. Favorites sync ✅
7. Berlin initial region ✅
8. No crash without optional coords on future events ✅
9. Preview above tab bar ✅
10. Close preview on map tap ✅
