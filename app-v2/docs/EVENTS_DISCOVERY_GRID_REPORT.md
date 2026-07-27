# Events Discovery Grid Restoration

## Scope

Restores the Events tab default state as a dense visual Explore Grid (3 columns on mobile) with integrated Grid/Map switching. List presentation remains for active search queries only.

## Key changes

### New components

- `src/components/discovery/EventDiscoveryTile.tsx` — image-first discovery tile with date pill, primary status badge, optional save, featured variants (`standard`, `wide`, `tall`)
- `src/components/discovery/discovery-tile-styles.ts` — tile metrics and gap tokens
- `src/features/search/components/EventDiscoveryGrid.tsx` — virtualized row-based grid with pagination and empty/loading states
- `src/features/search/utils/discovery-grid-layout.ts` — deterministic featured rhythm (wide @10, tall @16)
- `src/features/search/utils/discovery-events.ts` — shared filtered event query for grid and map
- `src/features/search/utils/discovery-tile-view-model.ts` — maps `EventDisplayModel` to presentation VM

### Events tab wiring

- `app/(tabs)/search.tsx` — default view is `grid`; `DiscoveryGridMapToggle` integrated in toolbar; `compactPremium` list only when `hasDiscoverySearchQuery`
- Filters update grid content and reset scroll via `gridResetKey`
- Map view shares the same filter state and discovery event set

### Design preview

- `src/components/preview/Phase2AExploreGridPreview.tsx` — standard, featured, cancelled, sold out, today, loading, fallback (light/dark)

## Architecture decisions

| Topic | Decision |
|-------|----------|
| Default view | Explore Grid, not vertical card list |
| View modes | `grid` \| `map` only (no list toggle in header) |
| List mode | Active search query (`filters.query` non-empty) |
| Filtered browse | Grid remains; filters change content |
| Status badges | Central `event-status-resolver` via tile view-model mapper |
| Component boundary | `EventDiscoveryTile` uses `EventDiscoveryTileViewModel`; feature layer resolves status |
| Mobile columns | 3 (`getExploreGridColumns`) |
| Pagination | Local batch size 18, `onEndReached` loading |

## Verification

- `npm run typecheck` — passed
- `npm test` — 679 tests passed
- New tests: `discovery-grid.test.ts`, updated filter/restoration/map/search layout tests

## Remaining gaps (data layer)

- Backend/cursor pagination not connected (batch structure prepared)
- Global multi-entity search results (clubs/artists) not in grid
- Offline empty state is prepared structurally, not fully productized
- Video/motion tile indicator reserved for later

## Screenshots

Capture with dev server on port 8091:

```bash
node scripts/capture-events-discovery-grid-screenshots.mjs
```

Output: `docs/visual-qa/events-discovery-grid/`
