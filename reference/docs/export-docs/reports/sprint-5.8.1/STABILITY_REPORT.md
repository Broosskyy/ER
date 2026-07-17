# Stability Report — Sprint 5.8.1

**Version:** 1.7.1  
**Focus:** Android ANR / „System UI isn't responding“ Hotfix  
**Date:** 2026-07-03

## Problem Statement

After Sprint 5.8, runtime QA on Android showed intermittent **„System UI isn't responding“** dialogs during navigation and screenshot capture. Root causes were traced to main-thread pressure during cold start, feed refresh churn, and unvirtualized list rendering — not a single Java crash.

## Root Cause Analysis

| Category | Finding | Severity |
|----------|---------|----------|
| Cold start | Root layout returned `null` until **two icon font families** loaded | P0 |
| Memory / decode | Event list fallbacks decoded **full-screen onboarding PNGs** per card | P0 |
| Feed churn | `EventStore.refresh()` re-ran on every `profile` object change + always refetched public feed | P0 |
| Auth | Duplicate `loadProfile()` on auth events | P1 |
| Lists | Events tab rendered all cards in `ScrollView.map()` | P0 |
| Re-renders | `FavoritesProvider` prop `allEvents` caused card re-renders on every feed update | P1 |
| Onboarding | RN `Image` full-screen decode without disk cache | P1 |
| Splash | JS-thread progress animation (`useNativeDriver: false`) | P2 |
| Map | Nested vertical `ScrollView`s | P2 |

## Fixes Applied (5.8.1)

1. **expo-splash-screen** — native splash until fonts ready; solid background instead of `null`
2. **Ionicons only** — removed unused MaterialCommunityIcons font (~50% font load reduction)
3. **EventImageFallback** — gradient-only fallback (no bundled PNG decode in lists)
4. **EventStore** — split `refreshPublicFeed` (mount) vs `refreshRemoteData` (user/role); stable deps
5. **useAuth** — deduplicated profile fetch with `loadProfileIfNeeded` + mount guard
6. **Events tab** — `EventFeedList` FlatList virtualization + pagination
7. **Favorites** — split actions/data context; cards use `useFavoriteActions()`
8. **Onboarding** — `expo-image` with `cachePolicy="memory-disk"` + `recyclingKey`
9. **Splash** — removed JS-thread width animation; cleanup on unmount
10. **Map** — removed outer ScrollView wrapper
11. **Tabs** — stable `useCallback` tab bar renderer
12. **Timers** — `setTimeout` cleanup in organizer edit; one-shot account guard in add-event

## Expected Outcome

- Faster first paint (native splash visible immediately)
- Lower bitmap decode pressure on Home/Events
- Fewer redundant network/store refreshes on auth transitions
- Smoother scroll on Events tab (virtualized)
- Reduced React re-render cascade on feed updates

## Verification

See `TEST_RESULTS.md`, `LOGCAT_REPORT.md`, and `runtime_screenshots/`.
