# Performance Report — Sprint 5.8.1

## Before vs After (Expected)

| Metric | Before (5.8) | After (5.8.1) |
|--------|--------------|---------------|
| Font families at boot | 2 (Ionicons + MaterialCommunityIcons) | 1 (Ionicons) |
| Root render while loading fonts | `null` (black frame) | Native splash + `#0B0B0F` shell |
| Event card fallback decode | Full-screen PNG × N cards | Gradient only |
| Events list virtualization | ❌ ScrollView.map | ✅ FlatList (windowSize 7) |
| Feed refresh on profile tick | Public + remote every time | Public once; remote on role/user change |
| EventCard re-render on feed update | All cards (favorites context) | Only on favorite toggle |
| Onboarding image | RN Image decode | expo-image memory-disk cache |

## FlatList / List Tuning

`EventFeedList` settings (unchanged, now used on Events tab):

- `initialNumToRender={8}`
- `maxToRenderPerBatch={10}`
- `windowSize={7}`
- `removeClippedSubviews`

## Memoization Changes

| Component / Hook | Change |
|------------------|--------|
| `EventCard` / `FeaturedEventCard` | `useFavoriteActions()` — decoupled from `favoriteEvents` |
| `FavoritesProvider` | Split `FavoritesActionsContext` / `FavoritesDataContext` |
| `TabsLayout` | `useCallback` for tab bar |
| `SearchScreen` | `useMemo` for list header |

## Image Loading

- **Onboarding:** expo-image with disk cache
- **Splash logo:** expo-image with cache
- **Event covers:** expo-image for remote URIs; gradient for missing
- **Removed:** Per-card bundled PNG fallback in lists

## Not Changed (Out of Scope)

- FlashList migration
- Home screen nested horizontal ScrollViews (deferred — lower ANR risk than Events tab)
- Seed data lazy loading
- EventStore context split (future optimization)
