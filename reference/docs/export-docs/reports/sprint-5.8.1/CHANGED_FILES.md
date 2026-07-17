# Changed Files — Sprint 5.8.1

| File | Change |
|------|--------|
| `app/_layout.tsx` | expo-splash-screen, Ionicons-only fonts, FavoritesProvider simplification |
| `app/splash.tsx` | expo-image logo, static progress, animation cleanup |
| `app/onboarding.tsx` | expo-image cache, invisible CTA, back handler |
| `app/(tabs)/search.tsx` | EventFeedList virtualization |
| `app/(tabs)/map.tsx` | Remove nested ScrollView |
| `app/(tabs)/_layout.tsx` | Stable tab bar callback |
| `app/add-event.tsx` | One-shot requireAccount guard |
| `app/organizer/edit/[id].tsx` | setTimeout cleanup |
| `app/event/[id].tsx` | useFavoriteActions |
| `src/hooks/useEventStore.tsx` | Split refresh effects |
| `src/hooks/useAuth.tsx` | Dedup profile load, mount guard |
| `src/hooks/useFavorites.tsx` | Split context, internal event store |
| `src/components/EventImageFallback.tsx` | Gradient-only list fallback |
| `src/components/EventCard.tsx` | useFavoriteActions |
| `src/components/FeaturedEventCard.tsx` | useFavoriteActions |
| `src/components/EventFeedList.tsx` | events variant type |
| `package.json` | v1.7.1, expo-splash-screen |
| `app.json` | v1.7.1, versionCode 8, splash plugin |
| `scripts/stability-soak-5.8.1.sh` | Stability test script |
