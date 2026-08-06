# Phase 4.2 — Universal Discovery Search

## Root cause

Search applied an implicit **Köln** city filter via `DEFAULT_EVENT_FILTERS.city = getDefaultCityValue()`.
Home and Search shared no explicit scope model, so events outside Köln (e.g. Leipzig Ticket.io imports)
were discoverable on Home (no location set) but hidden in Search.

## Architecture changes

### Location scope

| Scope | Home | Search default |
|-------|------|----------------|
| `global` | — | **yes** |
| `city` | yes (via `resolveDiscoveryCityLabel`) | explicit filter only |
| `nearby` | GPS + radius | explicit distance filter |
| `map_bounds` | future | explicit map filter |

### Key files

- `src/features/search/domain/location-scope.ts`
- `src/features/search/constants.ts` — `locationScope`, `entityTab`, global city default
- `src/features/discovery/utils/map-event-filters-to-discovery-query.ts`
- `src/features/search/services/universal-search-service.ts`
- `src/features/search/feed/universal-search-client.ts`
- `src/features/location/normalize-discovery-city.ts`

### Universal search result model

`EVENT | ARTIST | VENUE | ORGANIZER | CITY | GENRE` with relevance score, matched fields,
related event counts, and navigation routes.

### Cache separation

- Home cache keys include `city` + `radiusKm` (`home.feed.*`)
- Search cache keys include `locationScope` (`search.events`)

## Validation

```bash
npx tsx scripts/operations/_sprint42-phase42-discovery-audit.ts
npm test -- --run src/features/search/__tests__/sprint42-universal-search.test.ts
```

## Remaining limitations

- Artist profiles depend on published `artists` table; lineup names are used for relationship search regardless.
- `map_bounds` scope reserved for future map-search integration.
- Entity tabs reuse venue row UI for artists until dedicated artist row ships.
