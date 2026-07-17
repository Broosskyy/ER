# Fixed Issues — Sprint 5.8.1

| ID | Issue | Fix | File(s) |
|----|-------|-----|---------|
| F1 | Blank screen / ANR window during font load | expo-splash-screen + solid shell | `app/_layout.tsx` |
| F2 | Unused MaterialCommunityIcons font load | Removed second font family | `app/_layout.tsx` |
| F3 | Mass PNG decode in event lists | Gradient-only EventImageFallback | `src/components/EventImageFallback.tsx` |
| F4 | Triple feed refresh on auth | Split public/remote refresh effects | `src/hooks/useEventStore.tsx` |
| F5 | Duplicate loadProfile calls | loadProfileIfNeeded + event filter | `src/hooks/useAuth.tsx` |
| F6 | Events tab jank (no virtualization) | EventFeedList FlatList | `app/(tabs)/search.tsx` |
| F7 | Card re-renders on feed update | Split favorites context | `src/hooks/useFavorites.tsx`, cards |
| F8 | Onboarding decode on UI thread | expo-image cached | `app/onboarding.tsx` |
| F9 | Splash JS animation thread load | Static progress bar + cleanup | `app/splash.tsx` |
| F10 | Map nested ScrollViews | Flat View layout | `app/(tabs)/map.tsx` |
| F11 | Tab bar re-created each render | useCallback | `app/(tabs)/_layout.tsx` |
| F12 | Leaked setTimeout | Ref + cleanup | `app/organizer/edit/[id].tsx` |
| F13 | Repeated account dialog effect | One-shot ref guard | `app/add-event.tsx` |
| F14 | FavoritesProvider prop churn | Internal useEventStore | `app/_layout.tsx`, `useFavorites.tsx` |
