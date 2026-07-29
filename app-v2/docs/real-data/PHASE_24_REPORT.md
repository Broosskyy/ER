# Sprint 24 — Search Experience & Advanced Filters Abschlussbericht

## 1. Analyse der Discovery-Plattform

### Ausgangslage (vor Sprint 24)

| Komponente | Status | Bewertung |
|------------|--------|-----------|
| Discovery Engine | ✓ Fuzzy, Synonyme, Filter-Predicates | Unverändert |
| Discovery API / Query Platform | ✓ `searchEvents`, `filterEvents`, Cursor | **Vollständig an UI angebunden** |
| Home Feed (Sprint 23) | ✓ Discovery-only | Wiederverwendet als Muster |
| Search Tab | ✗ Hybrid | Text-Suche via `applyEventFilters` + Repo |
| Map | ✗ Legacy | `eventRepository.getPublishedEvents()` |
| Filter UI | ✓ FilterSheet, QuickFilterRow | Nur Basis-Filter (Datum, Genre, Stadt, Sort) |
| Event Cards | ✓ `EventDiscoveryCard` / `EventDiscoveryTile` | Wiederverwendet |
| Recent/Trending UI | ✓ Komponenten vorhanden | Keine Daten-Schicht |

### Vermiedene Doppelimplementierungen

- Kein neuer Such-Engine-Code — `discovery-search-client.ts` delegiert an `getDiscoveryQueryPlatform().filterEvents()`
- `mapEventFiltersToDiscoveryQuery` erweitert statt neuer Mapper
- Bestehende `SearchSuggestionItem`, `RecentSearchItem`, `TrendingSearchItem` wiederverwendet
- `useDiscoverySearch` modelliert nach `useDiscoveryCollectionFeed` (Sprint 23)

---

## 2. Sucharchitektur

### Schichtenmodell

```
SearchScreen (app/(tabs)/search.tsx)
        │
        ├── SearchExplorePanel        ← Leere Suche: Recent, Trending, Vorschläge
        ├── useSearchSuggestions()    ← Live-Vorschläge (debounced)
        │
        ▼
useDiscoverySearch(filters)           ← Debounce 300ms, Cursor-Pagination
        │
        ▼
discovery-search-client.ts            ← Request-Deduplizierung, Telemetry
        │
        ▼
getDiscoveryQueryPlatform().filterEvents(mapEventFiltersToDiscoveryQuery(...))
        │
        ▼
DiscoveryApiService → DiscoveryEngine
```

### Suchmodi

| Modus | Bedingung | UI |
|-------|-----------|-----|
| Explore | Fokus, keine Query, keine Filter | `SearchExplorePanel` |
| Live Search | Query eingegeben | Debounced Discovery-Query → Ergebnisliste |
| Browse Grid | Keine Query, Filter aktiv oder kein Fokus | `EventDiscoveryGrid` mit API-Pagination |
| Text Results | Query vorhanden | `FlatList` + `EventDiscoveryCard` (wie Home Feed) |
| Map | Map-Toggle | `MapDiscoveryScreen` via `useDiscoverySearch` |

### Neue Module

```
src/features/search/
├── feed/
│   ├── discovery-search-client.ts    # Discovery API Client
│   ├── search-feed-types.ts          # LoadResult, Suggestions
│   └── search-telemetry.ts           # Interne Messpunkte
├── hooks/
│   ├── use-discovery-search.ts       # Haupt-Hook
│   ├── use-search-suggestions.ts     # Live-Vorschläge
│   ├── use-recent-searches.ts        # Recent-Search UI-State
│   └── use-debounced-value.ts        # Generisches Debounce
├── services/
│   └── recent-search-storage.ts      # AsyncStorage-Persistenz
├── config/
│   └── trending-searches.ts          # Trending-Katalog
└── components/
    └── SearchExplorePanel.tsx        # Leere-Suche-Oberfläche
```

---

## 3. Filtermodell

### Erweiterte `EventFilters`

| Feld | Typ | Discovery-Mapping |
|------|-----|-------------------|
| `query` | string | `search.text` (fuzzy, de) |
| `dateRange` | preset | `date.preset` |
| `dateStartAt` / `dateEndAt` | ISO | `date.preset: custom` |
| `genres` | GenreFilterId[] | `entities.genres` |
| `city` | string | `entities.city` |
| `distance` | 5–100 km / any | `location.radiusKm` |
| `price` | free / under-20 / under-50 | `price.freeOnly`, `price.maxPriceEur` |
| `venueEnvironment` | indoor / outdoor | `venueEnvironment` |
| `venueId` | option id | `entities.venueId` |
| `organizerId` | option id | `entities.organizerId` |
| `festivalId` | option id | `entities.festivalId` |
| `sortBy` | siehe unten | `sortBy` |

### Sortierung

| UI (`sortBy`) | Discovery (`sortBy`) |
|---------------|----------------------|
| `recommended` | `relevance` |
| `distance` | `distance` |
| `date` | `date` |
| `newest` | `newest` |
| `trending` | `popularity` |
| `alphabetical` | `alphabetical` |

Alle Filter sind beliebig kombinierbar — ein einziger `filterEvents`-Call mit vollständigem `DiscoveryQuery`.

### FilterSheet

Erweitert um: Entfernung, Preis, Venue, Organizer, Festival, Indoor/Outdoor — alle aus `filter-config.ts` (CMS-ready).

---

## 4. Discovery-Anbindung

- **Keine** direkten Repository- oder DB-Zugriffe aus Search-UI
- Text-Suche nutzt Discovery Fuzzy + Synonyme (über `mapEventFiltersToDiscoveryQuery`)
- Map-Migration: `buildMapEvents(discoveryEvents, ...)` statt `applyEventFilters(eventRepository...)`
- `useMapDiscoveryController` lädt Events via `useDiscoverySearch(filters)`

---

## 5. Performance

| Maßnahme | Implementierung |
|----------|-----------------|
| Debouncing | `useDebouncedValue` (300ms) in `useDiscoverySearch` |
| Suggestion-Debounce | 200ms in `useSearchSuggestions` |
| Request-Deduplizierung | `inflightRequests` Map in `discovery-search-client.ts` |
| Cursor Pagination | `loadMoreDiscoverySearchResults` mit `nextCursor` |
| Lazy Loading | Grid/List `onEndReached` → `loadMore()` |
| Parallele Map+Search | Shared Discovery Platform, deduplizierte Keys |

---

## 6. Fehlerbehandlung

| Zustand | Verhalten |
|---------|-----------|
| Loading | Skeleton (Grid) / ActivityIndicator (Liste) |
| Empty | `SearchEmptyState` |
| Error | `EmptyState` + Retry |
| Offline | Offline-Hinweis in Error-State |
| Ungültige Parameter | Discovery API Validator → strukturierter Fehler |

---

## 7. Telemetrie (intern)

`search-telemetry.ts` — kein externer Analytics-Dienst:

| Event | Zweck |
|-------|-------|
| `search_start` / `search_complete` | Suchdauer, Trefferanzahl |
| `search_error` | Fehler |
| `search_abandon` | Suchabbruch (Query gelöscht) |
| `search_suggestions` | Vorschlags-Nutzung |
| `search_filter_apply` | Filter-Nutzung (vorbereitet) |
| `search_pagination` | Cursor-Nachladen |

API-Response-Zeit zusätzlich aus `response.meta.performance.durationMs`.

---

## 8. Tests

| Datei | Tests | Abdeckung |
|-------|-------|-----------|
| `sprint24-search-experience.test.ts` | 4 | Filter-Mapping, Discovery-Load, Trending, Telemetry |
| Bestehende Tests | aktualisiert | `filter-events`, `staging-seed` |

**Ergebnis:** 1020 Tests grün, Typecheck grün, Lint 0 Errors.

---

## 9. Erfolgskriterien

| Kriterium | Status |
|-----------|--------|
| Vollständige Suchoberfläche | ✓ |
| Live Search | ✓ (debounced) |
| Suchvorschläge | ✓ |
| Kombinierbare Filter | ✓ |
| Cursor Pagination | ✓ |
| Performante Suche | ✓ |
| Discovery API vollständig genutzt | ✓ |
| Tests grün | ✓ (1020) |
| Typecheck grün | ✓ |
| Lint grün | ✓ (0 Errors) |

---

## 10. Verbleibende Punkte für Sprint 25

1. **ExploreFeed** — Legacy `applyEventFilters` in `ExploreFeed.tsx` (nicht im Tab gemountet); durch Discovery-Sections ersetzen
2. **Collection-Filter serverseitig** — `filterDisplayEvents()` noch client-seitig auf Discovery-Ergebnissen
3. **Custom Date Range UI** — `dateStartAt`/`dateEndAt` im Filtermodell, noch ohne Date-Picker UI
4. **Entity-Filter dynamisch** — Venue/Organizer/Festival aus Discovery Entity Readers statt statischem Katalog
5. **Grouped Search Results** — `SearchResultGroup` für Events/Venues/Organizers
6. **Cache-Schicht aktivieren** — Sprint-22 Cache-Interfaces produktiv nutzen
7. **Search Analytics Export** — optionaler Debug-Screen für Telemetrie
8. **Clubs auf Map** — weiterhin `MAP_CLUB_FIXTURES` (statisch)

### Nicht in Scope (wie spezifiziert)

Profile, Community, Ticketing, Chat, Push Notifications, KI-Empfehlungen

---

## 11. Zusammenfassung

Sprint 24 liefert die vollständige Search Experience als zentralen Einstiegspunkt für die Eventsuche. Alle Suchvorgänge laufen über die Discovery API — inklusive Live Search, Vorschläge, Recent/Trending Searches, erweiterte kombinierbare Filter und Cursor-Pagination. Die Map nutzt dieselbe Discovery-Schicht. Die bestehende Discovery-Architektur (Engine, API, Filter, Ranking, Trust) bleibt vollständig erhalten.
