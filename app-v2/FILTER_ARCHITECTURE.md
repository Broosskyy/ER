# Filter Architecture — Eternal Rave

**Version:** 0.1.3  
**Branch:** `cursor/filter-ux-architecture-refactor-6b06`  
**Scope:** Events tab filter/search architecture only

## Overview

All filter options, labels, and defaults live in a single configuration layer. UI components read from `filterConfig` — never hardcode filter values. The same `EventFilters` model and `applyEventFilters()` pipeline power Search, Collections, and future CMS-driven admin.

## Filter Model

```typescript
interface EventFilters {
  query: string;              // free-text search
  dateRange: DateRangeFilter; // 'all-dates' | 'today' | 'this-weekend' | 'upcoming'
  genres: GenreFilterId[];    // multi-select; empty = all genres
  city: string;               // city value from filterConfig
  sortBy: SortByFilter;       // 'recommended' | 'date' | 'alphabetical'
}
```

**Defaults** (`DEFAULT_EVENT_FILTERS`):

| Field | Default |
|---|---|
| `query` | `''` |
| `dateRange` | `'all-dates'` |
| `genres` | `[]` |
| `city` | Köln (from `filterConfig.defaultCityId`) |
| `sortBy` | `'recommended'` |

## Explore Mode

Explore is **not** a filter value. It is the default Events tab state when:

- `query` is empty, and
- no active filters (`countActiveFilters === 0`)

`isExploreMode(filters)` returns `true` in that case and the curated `ExploreFeed` is shown.

## Central Configuration

**File:** `src/features/search/config/filter-config.ts`  
**Types:** `src/features/search/config/filter-config.types.ts`

```typescript
filterConfig = {
  defaultCityId: 'koeln',
  dateOptions: [...],   // All Dates, Today, This Weekend, Upcoming
  genreOptions: [...],  // Techno, Hard Techno, House, …
  cityOptions: [...],   // Köln (extensible)
  sortOptions: [...],  // Recommended, Date, Alphabetical
}
```

Each option has: `id`, `label`, `value`, `active`, `sortOrder`, optional `icon`.

Helper accessors:

- `getActiveDateOptions()`, `getActiveGenreOptions()`, `getActiveCityOptions()`, `getActiveSortOptions()`
- `getQuickDateOptions()` — Today + This Weekend for the quick filter row
- `getGenreLabel()`, `getDateLabel()`, `getSortLabel()`, `getDefaultCityValue()`

## Filter Pipeline

**File:** `src/features/search/utils/filter-events.ts`

Order of application:

1. Search query (`matchesSearchQuery`)
2. Date range (`matchesDateRange`) — skipped when `preserveCollectionScope: true`
3. Genres (`matchesSearchGenres`) — OR logic across selected genres
4. City (`matchesCity`)
5. Sort (`sortEvents`)

All screens use `applyEventFilters(events, filters, options?)`.

## Draft State (Filter Sheet)

```
onOpen  → draftFilters = appliedFilters
onEdit  → only draftFilters change
onApply → appliedFilters = draftFilters, sheet closes
onReset → draftFilters = DEFAULT (draft only, applied unchanged)
onClose → discard draft, applied unchanged
```

Android hardware back closes the sheet without applying.

## Quick Filters

Visible above the list:

- **Today** — toggles `dateRange: 'today'` (tap again resets to `all-dates`)
- **This Weekend** — toggles `dateRange: 'this-weekend'`
- **Filters** — opens full filter sheet; shows `Filters • N` when filters active

Genre quick filter removed. Genres are filter-sheet only (multi-select).

## Filter Summary

`getActiveFilterSummaries(filters)` returns compact labels:

- Single genre → `"Techno"`
- Multiple genres → `"3 Genres"`
- Non-default date, city, sort shown individually
- Default values (All Dates, Köln, Recommended) are **not** shown

`FilterSummaryBar` renders below the search field. **Clear All** appears only when `countActiveFilters > 0`.

## Active Filter Count

`countActiveFilters` counts categories (max 4):

| Category | Counts when |
|---|---|
| Date | `dateRange !== 'all-dates'` |
| Genres | `genres.length > 0` |
| City | `city !== defaultCity` |
| Sort | `sortBy !== 'recommended'` |

Query is separate and triggers results mode but is not included in the filter badge count.

## Admin / CMS Preparation

### Interfaces ready for Supabase

`filter-config.types.ts` defines `DateOption`, `GenreOption`, `CityOption`, `SortOption`, and `FilterConfig`. These map directly to future database tables:

| Future table | Maps to |
|---|---|
| `filter_genres` | `genreOptions` |
| `filter_cities` | `cityOptions` |
| `filter_sort_options` | `sortOptions` |
| `filter_date_options` | `dateOptions` |

### Future admin capabilities (no code changes needed in screens)

- Add/remove/reorder genres, cities, sort options
- Toggle `active` flag per option
- Set `sortOrder` for display order
- Add new cities without UI changes

### Migration path

1. Replace static `filterConfig` with `fetchFilterConfig()` at app bootstrap
2. Store in React Context or Zustand store
3. Screens continue reading via the same helper functions
4. Admin panel writes to Supabase; app refetches on focus or via realtime

### Also prepared for

- Venues, sources, event types (extend `FilterConfig` + model)
- Import sources and visibility flags (`active` field)
- CRM-driven city rollout

## Screen Integration

| Screen | Filter state | Notes |
|---|---|---|
| Events (`search.tsx`) | `SearchContext` | Full filter UX |
| Collections | Local `useState` | `preserveCollectionScope: true` |
| Home | None | Unchanged |
| Saved / Profile / Map | None | Unchanged |

## Changed Files

| File | Change |
|---|---|
| `config/filter-config.ts` | New central configuration |
| `config/filter-config.types.ts` | CMS-ready interfaces |
| `constants.ts` | Slim `EventFilters` model |
| `utils/filter-events.ts` | Multi-genre, explore mode, summaries |
| `SearchContext.tsx` | Simplified context (no `timeFilter`) |
| `components/FilterSheet.tsx` | Draft state, multi-genre, X close |
| `components/QuickFilterRow.tsx` | Removed genre chip |
| `components/FilterSummaryBar.tsx` | New summary bar |
| `components/SearchEmptyState.tsx` | New copy + two buttons |
| `components/ExploreFeed.tsx` | No filter props; explore-only |
| `app/(tabs)/search.tsx` | New filter flow |
| `collections/CollectionScreen.tsx` | Uses central count/sheet API |

## Validation

| Check | Result |
|---|---|
| `npm run lint` | Pass (0 errors; pre-existing import-order warnings only) |
| `npx tsc --noEmit` | Pass |
| `npx expo-doctor` | 19/20 (expected CNG warning) |
| `npm test` | 31/31 passed |

## APK

| Field | Value |
|---|---|
| **Filename** | `eternal-rave-0.1.3-filter-architecture-preview.apk` |
| **Version** | 0.1.3 (versionCode 4) |
| **Download** | https://github.com/Broosskyy/ER/releases/download/v1-android-0.1.3-filter-architecture/eternal-rave-0.1.3-filter-architecture-preview.apk |
| **Build** | `npx expo prebuild --platform android` + `./gradlew assembleRelease` |
