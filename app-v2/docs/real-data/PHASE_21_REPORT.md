# Sprint 21 — Discovery Engine Foundation Abschlussbericht

## 1. Analyse der Plattformarchitektur (Sprints 9–20)

### Bestehende Datenquellen und Domänen

| Bereich | Vorhandene Daten | Relevanz für Discovery |
|---------|------------------|------------------------|
| **Events** | `Event` mit `status`, `startDateTime`, `city`, `genres`, `venueId`, `organizerId`, `latitude`/`longitude`, `priceText`, `canonicalEventId` | Kernobjekt aller Discovery-Queries |
| **Venues** | `venueId`, `venue`, `venueType` (club, warehouse, open_air, festival_ground, …) | Entity-Filter, Indoor/Outdoor |
| **Organizers** | `organizerId`, `organizer` | Entity-Filter, Diversity |
| **Festivals** | `festivalEditionId`, `festivalId` (neu gemappt) | Festival-/Edition-Filter |
| **Event Lifecycle** | `EventLifecycleResolver` (cancelled, ended, archived, postponed) | Eligibility vor Ranking |
| **Source Intelligence** | Source-Metriken, Snapshots (S19) | Vorbereitet für Trust-Ranking |
| **Trust** | `sourceTrust`, Review Queue (S16) | Teilweise in Ranking (hardcoded Fallback) |
| **Matching** | Canonical Events, Blocking Keys (S17) | `resolveCanonicalId` für Dedup |
| **Canonical Events** | `canonicalEventId` auf Events | Ranking + Diversity + Cursor |

### Bestehende Queries (vor Sprint 21)

| Pfad | Verhalten | Status nach S21 |
|------|-----------|-----------------|
| `discovery-feed-service.ts` | Feed mit Ranking/Diversity/Eligibility | **Delegiert an `DiscoveryEngine`** |
| `discovery-feed-helpers.ts` | `getPublishedEvents()` + Lifecycle/Eligibility | Bleibt Event-Source-Basis |
| `search/utils/discovery-events.ts` | Eventliste für Suche | **Delegiert an `DiscoveryApiService`** |
| `search/utils/filter-events.ts` | Clientseitige Filter | Legacy — Map nutzt noch direkt |
| `map/utils/map-discovery-selectors.ts` | Geo + Filter | Noch nicht migriert |
| `eventRepository.getPublishedEvents()` | Rohdaten aus Repo/Supabase | Nur über Discovery-Source |

### Optimierungsbedarf (identifiziert)

| Problem | Sprint-21-Lösung | Folge-Sprint |
|---------|------------------|--------------|
| Verstreute Filterlogik in UI/Utils | Generische `DiscoveryFilterEngine` | Map/Collections migrieren |
| Kein einheitliches Query-Modell | `DiscoveryQuery` Typ | HTTP-API Layer |
| Offset-basierte Listen implizit | Cursor Pagination (`DiscoveryCursor`) | Server-seitige Cursor-Queries |
| Volltext nur clientseitig | `search_document` tsvector + In-Memory Matcher | Supabase FTS-Queries |
| Fehlende Discovery-Indizes | Migration `20260752000000` | Query-Plan-Monitoring |
| In-Memory Full-Scan aller Events | `DiscoveryEventSource` Interface | `SupabaseDiscoveryEventSource` |

Keine Doppelimplementierungen: Ranking (`discoveryRankingService`), Diversity (`discoveryDiversityService`), Eligibility (`discoveryEligibilityResolver`) und Lifecycle (`eventLifecycleResolver`) wurden **wiederverwendet**, nicht ersetzt.

---

## 2. Architektur

```
Consumer (Feed, Search, später Map/Collections/API)
        │
        ▼
DiscoveryApiService
        │
        ▼
DiscoveryEngine
        │
        ├── DiscoveryEventSource.listDiscoverableEvents()
        │         └── getDiscoverablePublishedEvents() [Lifecycle + Eligibility]
        │
        ├── DiscoveryFilterEngine (generische Predicates)
        │         ├── Date Presets (today, tomorrow, weekend, week, month, custom)
        │         ├── Entity (city, venue, organizer, festival, genre)
        │         ├── Location (radiusKm)
        │         ├── Price (freeOnly)
        │         └── Venue Environment (indoor/outdoor)
        │
        ├── DiscoverySearchMatcher (exact / prefix / fuzzy + Synonyme)
        │
        ├── Lifecycle + Eligibility Gate → RankableEvent
        │
        ├── discoveryRankingService.rank() [Surface-aware]
        │
        ├── discoveryDiversityService.diversify() [optional]
        │
        ├── DiscoverySortEngine (distance, date, newest, popularity, freshness, relevance)
        │
        └── DiscoveryCursor Pagination → DiscoveryQueryResult
```

### Modulstruktur

```
src/features/discovery/
├── domain/
│   ├── discovery-query-types.ts      # DiscoveryQuery, Surfaces, Sort Fields
│   ├── discovery-filter-types.ts     # Predicate Interface
│   ├── discovery-pagination-types.ts # Cursor Payload, Page Size Limits
│   └── discovery-search-types.ts     # Search Modes, Locale
├── filters/
│   ├── discovery-filter-engine.ts    # Generische AND-Kombination
│   ├── discovery-filter-predicates.ts# Query → Predicates Builder
│   └── discovery-date-presets.ts     # Zeitfenster-Auflösung
├── search/
│   ├── discovery-search-normalizer.ts
│   ├── discovery-search-synonyms.ts  # DE/EN Synonyme
│   ├── discovery-search-matcher.ts
│   └── discovery-text-index.ts       # In-Memory Textindex aus Event
├── sorting/
│   └── discovery-sort-engine.ts
├── pagination/
│   └── discovery-cursor.ts           # base64url Cursor Encode/Decode
├── repository/
│   ├── discovery-event-source.ts     # Interface
│   └── in-memory-discovery-event-source.ts
├── services/
│   ├── discovery-engine.ts           # Zentrale Pipeline
│   └── discovery-api-service.ts      # Stabile API-Schicht
├── utils/
│   └── map-event-filters-to-discovery-query.ts  # Legacy EventFilters Bridge
├── discovery-runtime.ts              # Registry Binding (kein Zirkelimport)
└── index.ts
```

### Wiederverwendete Kernkomponenten

| Komponente | Pfad | Sprint-21-Rolle |
|------------|------|-----------------|
| `discoveryRankingService` | `events/discovery/discovery-ranking-service.ts` | Surface-aware Relevanz-Score |
| `discoveryDiversityService` | `events/discovery/discovery-diversity-service.ts` | Organizer/Venue-Diversität |
| `discoveryEligibilityResolver` | `events/discovery/discovery-eligibility-resolver.ts` | Sichtbarkeits-Gate |
| `eventLifecycleResolver` | `events/lifecycle/event-lifecycle-resolver.ts` | Status-Filter (cancelled/ended/…) |
| `getDiscoverablePublishedEvents` | `events/discovery/discovery-feed-helpers.ts` | Discoverable Event-Pool |
| `calculateDistanceKm` | `location/utils/geo-distance.ts` | Geo-Distanz (extrahiert gegen Zirkelimport) |

---

## 3. Query-Modell

`DiscoveryQuery` ist das einzige Eingabeformat für alle Eventlisten:

```typescript
interface DiscoveryQuery {
  surface: DiscoverySurface;           // home_nearby, search_events, map, …
  search?: { text, mode, locale, fuzzyThreshold };
  date?: { preset, startAt, endAt, includePast };
  entities?: { city, venueId, organizerId, festivalId, festivalEditionId, genres, genreIds };
  location?: { latitude, longitude, city, radiusKm };
  price?: { freeOnly, maxPriceEur };
  venueEnvironment?: { indoor, outdoor };
  sortBy?: DiscoverySortField;
  sortDirection?: 'asc' | 'desc';
  cursor?: DiscoveryCursor;
  limit?: number;
  diversify?: boolean;
}
```

### Unterstützte Query-Szenarien

| Szenario | Query-Konfiguration |
|----------|---------------------|
| Events in meiner Nähe | `location: { lat, lng, radiusKm }`, `sortBy: 'distance'` |
| Heute | `date: { preset: 'today' }` |
| Morgen | `date: { preset: 'tomorrow' }` |
| Dieses Wochenende | `date: { preset: 'this-weekend' }` |
| Diese Woche | `date: { preset: 'this-week' }` |
| Kommender Monat | `date: { preset: 'next-month' }` |
| Nach Datum | `date: { preset: 'custom', startAt, endAt }` |
| Nach Entfernung | `sortBy: 'distance'` + `location` |
| Nach Stadt | `entities: { city }` |
| Nach Venue | `entities: { venueId }` |
| Nach Organizer | `entities: { organizerId }` |
| Nach Festival | `entities: { festivalId }` / `festivalEditionId` |
| Nach Genre | `entities: { genres }` / `genreIds` |
| Kostenlos | `price: { freeOnly: true }` |
| Indoor | `venueEnvironment: { indoor: true }` |
| Outdoor | `venueEnvironment: { outdoor: true }` |

Surfaces steuern Ranking-Gewichtung (`home_featured`, `home_nearby`, `search_events`, `map`, …).

---

## 4. Filtermodell

### Generische Filter Engine

`DiscoveryFilterEngine<T>` wendet eine Liste von `DiscoveryFilterPredicate<T>` an — **alle Predicates müssen erfüllt sein (AND)**. Keine Spezialfälle pro Kombination.

```typescript
interface DiscoveryFilterPredicate<TItem> {
  id: string;
  applies: (item: TItem) => boolean;
}
```

`buildDiscoveryFilterPredicates(query, context)` übersetzt `DiscoveryQuery` in composable Predicates:

- **Date**: Preset-Auflösung via `resolveDiscoveryDateWindow()`; Default = nur zukünftige Events
- **Entity**: Gleichheitsprüfungen auf IDs und Labels
- **Location**: Haversine-Radius via `calculateDistanceKm`
- **Price**: `freeOnly` erkennt DE/EN Preistexte (kostenlos, free, gratis)
- **Venue Environment**: `venueType`-Mapping auf Indoor/Outdoor-Sets

Neue Filter = neues Predicate hinzufügen, keine Engine-Änderung.

### Legacy-Brücke

`mapEventFiltersToDiscoveryQuery()` mappt bestehende `EventFilters` (Search-UI) auf `DiscoveryQuery` — ermöglicht schrittweise Migration ohne UI-Änderung.

---

## 5. Suchmodell

Vorbereitung für Volltext, Fuzzy, Synonyme und Mehrsprachigkeit — **ohne KI**.

### Komponenten

| Komponente | Funktion |
|------------|----------|
| `discovery-search-normalizer` | Lowercase, Diakritika, Tokenisierung (locale-aware) |
| `discovery-search-synonyms` | DE/EN Synonym-Expansion (techno↔tekno, festival↔fest, …) |
| `discovery-text-index` | Haystack aus title, description, venue, city, genres, artists, organizer |
| `discovery-search-matcher` | Modi: `exact`, `prefix`, `fuzzy` (Levenshtein-Schwelle) |

### Datenbank-Vorbereitung

Migration fügt `events.search_document tsvector` mit GIN-Index und Trigger hinzu:

- Gewicht A: `title`
- Gewicht B: `description`
- Gewicht C: `venue_name`

Runtime nutzt aktuell den In-Memory-Matcher; FTS-Queries können in Sprint 22+ den gleichen Index nutzen.

---

## 6. Sortierung

`DiscoverySortEngine` unterstützt:

| Feld | Verhalten |
|------|-----------|
| `relevance` | Ranking-Score, Tie-Breaker Datum |
| `distance` | Haversine-Distanz (fehlende Koordinaten → MAX) |
| `date` | `startDateTime` aufsteigend |
| `newest` | `publishedAt` / `createdAt` |
| `popularity` | Heuristik (Bild, Tickets, Artists) |
| `freshness` | Recently-Added-Resolver |
| `alphabetical` | Titel localeCompare `de` |

Bei `sortBy: 'relevance'` oder `'date'` mit `diversify: true` (Default für Recommended) greift `discoveryDiversityService` vor finalem Sort.

---

## 7. Pagination

### Cursor Pagination (Standard)

- **Kein Offset** als Standard
- Cursor = base64url-kodiertes `DiscoveryCursorPayload`:
  - `sortField`, `sortValue`, `eventId`, `canonicalEventId`
- `sliceAfterCursor()` findet Position und liefert `nextCursor` + `hasMore`
- Default Page Size: 24, Max: 100

Geeignet für Infinite Scroll: Client sendet `cursor` aus vorheriger Response.

---

## 8. API

### DiscoveryApiService

Stabile Backend-Schnittstelle für alle Consumer:

```typescript
class DiscoveryApiService {
  searchEvents(query: DiscoveryQuery): Promise<DiscoveryQueryResult>
  searchDisplayEvents(query): Promise<DiscoveryQueryResult<EventDisplayModel>>
  searchWithLegacyFilters(filters: EventFilters, options?): Promise<...>
  searchWithLegacyFiltersSync(filters, options?): DiscoveryQueryResult<EventDisplayModel>
}
```

### Registry-Wiring

```typescript
// registry.ts
discoveryEngine = new DiscoveryEngine({
  eventSource: new InMemoryDiscoveryEventSource(),
  resolveCanonicalId: (id) => eventRepository.resolveCanonicalId(id),
});
discoveryApiService = new DiscoveryApiService(discoveryEngine);
bindDiscoveryServices(discoveryEngine, discoveryApiService);
bindDiscoverableEventRepository(eventRepository);
```

`discovery-runtime.ts` vermeidet Zirkelimporte — Consumer importieren `getDiscoveryEngine()` / `getDiscoveryApiService()`.

### Migrierte Consumer

| Consumer | Integration |
|----------|-------------|
| `getDiscoveryFeedEvents()` | `DiscoveryEngine.queryDisplayModelsSync()` |
| `getDiscoveryEvents()` (Search) | `DiscoveryApiService.searchWithLegacyFiltersSync()` |

### Noch nicht migriert (bewusst, Sprint 22+)

- Map (`map-discovery-selectors.ts` → noch `applyEventFilters`)
- Collections
- HTTP/Edge REST-Endpunkte

---

## 9. Migration

`20260752000000_sprint21_discovery_engine_foundation.sql`:

| Objekt | Zweck |
|--------|-------|
| `events_discovery_published_start_idx` | Status + Startdatum (published) |
| `events_discovery_city_start_idx` | Stadt + Startdatum |
| `events_discovery_venue_start_idx` | Venue + Startdatum |
| `events_discovery_organizer_start_idx` | Organizer + Startdatum |
| `events_discovery_festival_edition_idx` | Festival Edition + Startdatum |
| `events.search_document` + GIN | FTS-Vorbereitung |
| `events_search_document_trigger` | Automatische Index-Pflege |

Alle Indizes mit `WHERE status = 'published'` — keine Full-Table-Scans auf Draft/Archived.

---

## 10. Performance & Skalierbarkeit

### Aktueller Stand (Sprint 21)

| Aspekt | Umsetzung |
|--------|-----------|
| Filter-Predicates | O(n) In-Memory — akzeptabel für Beta/MVP |
| DB-Indizes | Vorbereitet für server-seitige Queries |
| Cursor Pagination | Stabil bei wachsenden Listen (kein OFFSET-Drift) |
| Canonical Dedup | Via `resolveCanonicalId` vor Ranking |
| Cachebarkeit | `DiscoveryQuery` ist serialisierbar → Edge/CDN-Cache möglich |
| FTS | DB-Trigger aktiv; Runtime noch In-Memory |

### Skalierungspfad (Millionen Events)

1. **`SupabaseDiscoveryEventSource`**: SQL mit Index-Nutzung statt Full-Load
2. **Predicate Pushdown**: Date/Entity/Location-Filter in SQL WHERE
3. **FTS**: `search_document @@ plainto_tsquery()` statt In-Memory-Matcher
4. **Materialized Views**: Pre-aggregierte Discoverable-Events (status + lifecycle)
5. **Trust Scores**: `sourceTrust` aus Trust-Engine statt Hardcoded-Werten

### Vermiedene Anti-Patterns

- Keine Offset-Pagination als Standard
- Keine parallelen Filter-Implementierungen in UI-Utils (Legacy bleibt markiert)
- Keine Zirkelimporte Registry ↔ Discovery (Runtime-Binding + lazy Display-Mapper)

---

## 11. Architekturprüfung

### Doppelte Services — keine gefunden

| Prüfung | Ergebnis |
|---------|----------|
| DiscoveryEngine vs. discovery-feed-service | Feed delegiert — keine parallele Pipeline |
| Filter Engine vs. filter-events.ts | Legacy bleibt für Map; Search/Feed migriert |
| Search Matcher vs. FTS Trigger | Komplementär: Runtime + DB-Vorbereitung |
| Ranking vs. Sort Engine | Ranking = Relevanz-Score; Sort = finale Ordnung |

### Technische Schulden (verbleibend)

1. **In-Memory Event Source** — alle Events werden geladen; Supabase-Source fehlt
2. **Trust/Quality Scores** — hardcoded in `toRankableEvent()`; Trust-Engine nicht verdrahtet
3. **Map/Collections** — nutzen noch `applyEventFilters` direkt
4. **HTTP API** — `DiscoveryApiService` ist TypeScript-intern; kein REST/Edge Layer
5. **`maxPriceEur`** — im Query-Modell, Predicate noch nicht implementiert
6. **Multilingual FTS** — Trigger nutzt `simple` Dictionary; `german`/`english` Konfiguration offen

---

## 12. Neue und geänderte Dateien

### Neu

```
src/features/discovery/                          # Gesamtes Discovery-Modul
src/features/discovery/__tests__/sprint21-discovery-engine.test.ts
src/features/location/utils/geo-distance.ts      # Extrahiert aus map-discovery-selectors
src/data/__tests__/sprint21-discovery-engine-migration.test.ts
supabase/migrations/20260752000000_sprint21_discovery_engine_foundation.sql
docs/real-data/PHASE_21_REPORT.md
```

### Geändert

- `discovery-feed-service.ts` — Delegation an DiscoveryEngine
- `discovery-feed-helpers.ts` — `bindDiscoverableEventRepository()`
- `search/utils/discovery-events.ts` — DiscoveryApiService
- `data/repositories/registry.ts` — Discovery Wiring
- `features/events/types/event.ts` — `festivalEditionId`, `festivalId`, `venueType`
- `data/mappers/event-mapper.ts` — neue Felder
- `data/datasources/supabase/supabase-datasource.ts` — Select-Mapping
- `features/map/utils/map-discovery-selectors.ts` — Geo-Re-Export

---

## 13. Tests & Qualität

| Check | Ergebnis |
|-------|----------|
| Tests | **1003 passed** (194 Dateien) |
| Typecheck | **green** |
| Lint | **green** |

Neue Tests:
- `sprint21-discovery-engine.test.ts` (6 Tests: Filter, Cursor, Nearby, Fuzzy, Free, Cursor-Encoding)
- `sprint21-discovery-engine-migration.test.ts` (2 Tests: Indizes + FTS)

---

## 14. Erfolgskriterien

| Kriterium | Status |
|-----------|--------|
| Zentrale Discovery Engine vorhanden | ✓ |
| Generische Filter Engine vorhanden | ✓ |
| Sucharchitektur vorbereitet | ✓ |
| Cursor Pagination | ✓ |
| Performante Queries (Indizes + Pipeline) | ✓ (DB); In-Memory Source folgt |
| Stabile API (`DiscoveryApiService`) | ✓ |
| Tests grün | ✓ |
| Typecheck grün | ✓ |
| Lint grün | ✓ |

---

## 15. Verbleibende Punkte (post Sprint 21)

1. `SupabaseDiscoveryEventSource` mit SQL Predicate Pushdown
2. Map und Collections auf DiscoveryEngine migrieren
3. Trust/Quality Scores aus Trust-Engine in Ranking verdrahten
4. REST/Edge Discovery-Endpunkte
5. `maxPriceEur`-Filter implementieren
6. FTS-Runtime auf `search_document` umstellen

---

## 16. Zusammenfassung

Sprint 21 legt die **zentrale Discovery-Schicht** als einzigen Backend-Einstiegspunkt für Eventlisten, Suche und Filter. Die Architektur erweitert Sprints 9–20 additiv: bestehendes Ranking, Diversity, Lifecycle und Eligibility bleiben die fachliche Instanz; neue Bausteine (Query-Modell, Filter Engine, Search Prep, Cursor Pagination, DB-Indizes) bilden die generische Schicht darüber.

Feed und Search sind angebunden. Die Plattform ist bereit für Sprint 22+: server-seitige Queries, vollständige Surface-Migration und HTTP-API — ohne erneute Filter- oder Such-Duplikate.
