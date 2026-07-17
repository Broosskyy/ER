# Session Favorites Fix

**Date:** 2026-07-17  
**Scope:** App-wide in-memory favorites for V1 demo events

## Problem

Favorites lived only in `HomeScreen` local `useState`. State was lost on tab switch, detail navigation, and Saved had no list.

## Solution

- `FavoritesProvider` in `app/_layout.tsx` wraps the full app tree
- In-memory `Set<EventId>` with `toggleFavorite`, `addFavorite`, `removeFavorite`, `isFavorite`
- `favoriteEvents` derived from demo catalog by ID (no duplicates, unknown IDs ignored)
- `isFavorite` removed from `DemoEvent` — favorites are session state, not demo data

## Consumers

| Screen | Usage |
|--------|--------|
| Home | Featured + list cards via `useFavorites()` |
| Event detail | Header `FavoriteButton` |
| Saved | `favoriteEvents` list + empty state |

## Persistence

- Session only — cleared on full app restart
- No AsyncStorage, database, or auth

## Future extension

Replace `FavoritesProvider` internals with a user-scoped repository; keep `FavoritesStore` interface and `useFavorites()` hook stable.
