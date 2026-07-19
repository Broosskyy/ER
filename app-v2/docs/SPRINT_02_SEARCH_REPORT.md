# Sprint 2 — Search Screen Report

**Date:** 2026-07-17  
**Route:** `app/(tabs)/search.tsx`  
**Reference:** Mockup 10 / 13 (Search & Filter)

## Implemented

| Feature | Status |
|---------|--------|
| Search title + large input | ✅ |
| Real-time text search | ✅ |
| Multi-word, case-insensitive partial match | ✅ |
| Search fields: title, venue, city, artists, genres | ✅ |
| Genre chips (single select) | ✅ |
| Sort segment: Upcoming / This Week / This Month / All | ✅ |
| Results via `EventCard` (Home) | ✅ |
| `FlatList` + memoized rows | ✅ |
| Empty state + Clear Filters | ✅ |
| Favorites via `FavoritesProvider` | ✅ |

## Reusable components

- `SearchInput`
- `SearchGenreChipRow`
- `SortSegmentControl`
- `SearchEmptyState`
- `filterSearchEvents` utility

## Demo data extensions

- `artists[]` and `startsAt` on `DemoEvent` (Home unchanged visually)
- Sort windows use fixed demo reference date `2026-05-24`

## Known limitations

- Demo events only (5 events); genre chips like Trance/Psy may return empty
- Sort is demo-date based, not device calendar
- No API, persistence, or map integration
- Home screen untouched

## Next sprint candidates

- Event detail screen (Mockup 11)
- Profile screen (Mockup 15)
