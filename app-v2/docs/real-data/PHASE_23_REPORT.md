# Sprint 23 — Home Feed & Discovery Experience Abschlussbericht

## 1. Analyse der bestehenden Discovery-Architektur

### Ausgangslage (vor Sprint 23)

| Komponente | Status | Bewertung |
|------------|--------|-----------|
| Discovery Engine (Sprint 21) | ✓ Pipeline vollständig | Unverändert, Basis für alle Feed-Queries |
| Discovery API / Query Platform (Sprint 22) | ✓ Produktionsreif | **Erste UI-Anbindung in Sprint 23** |
| Filter Engine | ✓ Generische Predicates | UI-Filter auf Collections noch client-seitig |
| Search Foundation | ✓ Fuzzy/Synonyme | Search-Tab noch nicht migriert |
| Ranking / Diversity / Lifecycle / Trust | ✓ Wiederverwendet | Über Presets angesprochen |
| Home Screen (`index.tsx`) | ✗ Legacy | Nutzte `getCollectionPreviewEvents()` → direkte Event-Selektion |
| Collection Screens | ✗ Legacy | Nutzten `event-collections.ts` / `discovery-feed-service` |
| Event Cards | ✓ `EventDiscoveryCard` | Wiederverwendet ohne Änderung |
| Location | ✓ `LocationSelector` + `UserLocationProvider` | Jetzt an Feed-Daten angebunden |
| Pagination | ✓ Cursor (Sprint 21/22) | Erst in Collection Screens aktiv |
| Saved Events | ✓ `useFavoriteToggle` | Unverändert, Favoriten-Toggle in Cards |
| Trending / Nearby | ✓ API-Presets | Über `DiscoveryQueryPlatform` exponiert |

### Identifizierte Doppelimplementierungen (vermieden)

- Kein neuer Event-Loader — `discovery-feed-client.ts` delegiert ausschließlich an `getDiscoveryQueryPlatform()`
- Keine neuen Ranking-/Filter-Engines — Presets aus `discovery-query-presets.ts` erweitert
- Bestehende `EventDiscoveryCard`, `SearchSectionHeader`, `EmptyState` wiederverwendet
- `CollectionScreen` migriert statt neuer Collection-Implementierung

### Noch nicht migriert (bewusst außerhalb Sprint 23)

| Surface | Mechanismus | Geplant |
|---------|-------------|---------|
| Search List | `applyEventFilters` | Sprint 24 |
| Map | `applyEventFilters` | Sprint 24 |
| Explore Feed | `applyEventFilters` | Sprint 24 |
| Clubs Rail | `HOME_CLUB_FIXTURES` (statisch) | Sprint 24+ |

---

## 2. Feed-Architektur

### Schichtenmodell

```
HomeScreen (app/(tabs)/index.tsx)
        │
        ▼
HomeFeedContent                    ← ScrollView, Pull-to-Refresh, Offline/Empty
        │
        ▼
useHomeFeed()                      ← Paralleles Section-Loading, Retry, Refresh
        │
        ▼
discovery-feed-client.ts           ← Request-Deduplizierung, Telemetry
        │
        ▼
getDiscoveryQueryPlatform()        ← Einziger Datenzugang (Sprint 22)
        │
        ▼
DiscoveryApiService → DiscoveryEngine
```

### Generische Feed Sections

Alle Bereiche werden über eine zentrale Registry definiert — keine fest codierten Spezialfälle in UI oder Hooks:

```
src/features/home/feed/
├── home-feed-types.ts              # SectionDefinition, SectionState, LoadResult
├── home-feed-section-config.ts     # HOME_FEED_SECTIONS Registry (6 Home + Genre-Fallback)
├── discovery-feed-client.ts        # Discovery API Client mit Deduplizierung
└── home-feed-telemetry.ts          # Interne Messpunkte
```

**Home-Sections (showOnHome: true):**

| ID | Preset | Layout | Preview | Collection |
|----|--------|--------|---------|------------|
| `trending` | trending | rail | 3 | highlights |
| `today` | today | list | 6 | tonight |
| `weekend` | weekend | rail | 3 | weekend |
| `nearby` | nearby | rail | 3 | — (requiresLocation) |
| `newly-added` | newly-added | list | 3 | upcoming |
| `upcoming-highlights` | upcoming-highlights | rail | 3 | upcoming |

Neue Sections werden durch einen Eintrag in `HOME_FEED_SECTIONS` ergänzt — `discovery-feed-client.ts` mappt Presets generisch über `switch (section.preset)`.

### UI-Komponenten

```
src/features/home/
├── components/
│   ├── HomeFeedContent.tsx         # Hauptcontainer
│   ├── HomeFeedSectionView.tsx     # Generischer Section-Renderer (rail/list)
│   └── HomeFeedSkeleton.tsx        # Initial Loading
└── hooks/
    ├── use-home-feed.ts            # Home Feed State
    └── use-discovery-collection-feed.ts  # Collection mit Cursor-Pagination
```

`HomeFeedSectionView` rendert jede Section anhand von `definition.layout` und `definition.preset` — kein Section-spezifischer Code in der Komponente.

---

## 3. Discovery-Anbindung

### Einziger Datenzugang

Alle Eventlisten im Home Feed und in Collection Screens laufen über:

```typescript
const platform = getDiscoveryQueryPlatform();
```

**Keine** direkten Datenbankabfragen, Repository-Zugriffe oder `selectEvents()` aus UI-Komponenten.

### Preset-Mapping (`discovery-feed-client.ts`)

| Preset | Platform-Methode |
|--------|------------------|
| `trending` | `platform.queryTrending()` |
| `today` | `platform.queryToday()` |
| `weekend` | `platform.queryWeekend()` |
| `nearby` | `platform.queryNearby()` (lat/lng + 50 km) |
| `newly-added` | `platform.queryNewlyAdded()` |
| `upcoming-highlights` | `platform.queryUpcomingHighlights()` |
| `genre` | `platform.filterEvents(buildGenreQuery())` |

### Sprint-23-Erweiterungen an Discovery API

Neue Presets in `discovery-query-presets.ts`:

- `buildNewlyAddedQuery()` — sortiert nach `publishedAt` absteigend
- `buildUpcomingHighlightsQuery()` — kommende Events mit Ranking-Boost
- `buildGenreQuery()` — Genre-Filter für Collection-Fallback

Neue Platform-Methoden in `DiscoveryQueryPlatform`:

- `queryNewlyAdded()`
- `queryUpcomingHighlights()`

### Location-Kontext

`useUserLocation()` liefert `city`, `latitude`, `longitude` an alle Section-Loads. Sections mit `requiresLocation: true` (nearby) liefern leere Ergebnisse ohne Koordinaten — kein API-Call.

---

## 4. Pagination

### Cursor-basiert (kein Offset)

- Discovery API liefert `pagination.nextCursor` und `pagination.hasMore`
- `HomeFeedSectionState` speichert `cursor` pro Section
- Home Screen: Preview-Limits (3–6 Events), „Alle anzeigen" → Collection Screen
- Collection Screen: `useDiscoveryCollectionFeed` mit `loadMore()` via `loadMoreHomeFeedSection()`

### Infinite Scroll (Collection Screens)

`CollectionScreen` nutzt `FlatList` mit:

- `onEndReached` → `loadMore()`
- `RefreshControl` → `refresh()` (Cursor-Reset)
- `loadingMore` Indicator am Listenende

### Pull to Refresh (Home)

`HomeFeedContent` → `RefreshControl` → `useHomeFeed().refresh()` mit `bypassCache: true`.

---

## 5. Performance

| Maßnahme | Implementierung |
|----------|-----------------|
| Paralleles Laden | `loadHomeFeedSectionsParallel()` — `Promise.all` über alle Sections |
| Request-Deduplizierung | `inflightRequests` Map in `discovery-feed-client.ts` |
| Lazy Loading | Sections rendern erst nach Load (`state.loading` → null) |
| Initial Skeleton | `HomeFeedSkeleton` während `initialLoading` |
| Hintergrund-Refresh | Pull-to-Refresh ohne Blockieren der UI |
| Keine unnötigen Requests | Nearby skipped ohne Location; Deduplizierung bei parallelen Calls |

---

## 6. Fehlerbehandlung

Einheitliches Verhalten auf Home und Collections:

| Zustand | Home | Collection |
|---------|------|------------|
| Loading | `HomeFeedSkeleton` / Section hidden | `ActivityIndicator` |
| Empty | Section hidden (kein leerer Block) | `EmptyState` |
| Error | `EmptyState` + Retry pro Section | `EmptyState` + Retry |
| Offline | Banner in `HomeFeedContent` | Offline-Hinweis |
| Retry | `retrySection(id)` / `refresh()` | `retry()` / `refresh()` |

Fehler in parallelen Section-Loads werden pro Section isoliert — ein fehlgeschlagener Bereich blockiert nicht die anderen.

---

## 7. Telemetrie (intern)

`home-feed-telemetry.ts` — kein externer Analytics-Dienst:

| Event | Zweck |
|-------|-------|
| `feed_load_start` / `feed_load_complete` | Gesamt-Feed-Ladezeit |
| `feed_refresh_start` / `feed_refresh_complete` | Pull-to-Refresh |
| `section_load_start` / `section_load_complete` | Section Performance + Item Count |
| `section_load_error` | Fehler pro Section |
| `section_pagination` | Cursor-Nachladen |

API-Response-Zeit kommt zusätzlich aus `response.meta.performance.durationMs` (Discovery Envelope).

In `__DEV__`: `console.debug('[HomeFeedTelemetry]', event)`.

---

## 8. Tests

| Datei | Tests | Abdeckung |
|-------|-------|-----------|
| `sprint23-home-feed.test.ts` | 4 | Section-Registry, Discovery-Load, Nearby-Skip, Telemetry |
| `sprint23-home-screen.test.ts` | 2 | Screen-Wiring ohne Legacy-Imports |
| `home-location-header.test.ts` | aktualisiert | Location-Header-Architektur |

**Ergebnis:** 1016 Tests grün, Typecheck grün, Lint 0 Errors.

---

## 9. Erfolgskriterien

| Kriterium | Status |
|-----------|--------|
| Home Feed vollständig über Discovery API | ✓ |
| Generische Feed Sections | ✓ |
| Cursor Pagination | ✓ (Collections) |
| Infinite Scroll | ✓ (Collections) |
| Pull to Refresh | ✓ (Home + Collections) |
| Loading / Empty / Error States | ✓ |
| Performance optimiert | ✓ |
| Tests grün | ✓ (1016) |
| Typecheck grün | ✓ |
| Lint grün | ✓ (0 Errors) |

---

## 10. Verbleibende Punkte für Sprint 24

### UI-Migration

1. **Search Tab** — `applyEventFilters` → Discovery API (`querySearch` / `filterEvents`)
2. **Map View** — Events über Discovery Nearby/Filter
3. **Explore Feed** — Legacy-Feed durch Discovery Sections ersetzen

### Feed-Erweiterungen

4. **Genre-Sections auf Home** — Registry-Einträge mit `preset: 'genre'` (Infrastruktur vorhanden, `showOnHome: false`)
5. **Clubs Rail** — statische `HOME_CLUB_FIXTURES` durch Venue-Discovery ersetzen
6. **Home Infinite Scroll** — optional Section-weises Nachladen auf Home (aktuell Preview + Collection-Deep-Link)

### Filter & Daten

7. **Collection-Filter serverseitig** — aktuell client-seitig via `filterDisplayEvents()` auf Discovery-Ergebnissen; Re-Query über Discovery API bei Filteränderung
8. **Cache-Schicht aktivieren** — Sprint-22 Cache-Interfaces (`discovery-cache-policy`) produktiv nutzen
9. **Hintergrund-Refresh** — stale-while-revalidate für Feed Sections

### Telemetrie & Observability

10. **Scroll Performance** — `onScroll`-Sampling vorbereiten (FPS / Section Visibility)
11. **Telemetry-Export** — optionaler Debug-Screen für interne Messpunkte

### Nicht in Scope (wie spezifiziert)

- Profile, Community, Ticketing, KI-Empfehlungen, Chat, Push Notifications

---

## 11. Dateiübersicht (neu/geändert)

### Neu

```
src/features/home/feed/home-feed-types.ts
src/features/home/feed/home-feed-section-config.ts
src/features/home/feed/discovery-feed-client.ts
src/features/home/feed/home-feed-telemetry.ts
src/features/home/hooks/use-home-feed.ts
src/features/home/hooks/use-discovery-collection-feed.ts
src/features/home/components/HomeFeedContent.tsx
src/features/home/components/HomeFeedSectionView.tsx
src/features/home/components/HomeFeedSkeleton.tsx
src/features/home/utils/filter-display-events.ts
src/features/home/__tests__/sprint23-home-feed.test.ts
src/features/home/__tests__/sprint23-home-screen.test.ts
```

### Geändert

```
app/(tabs)/index.tsx                          # HomeFeedContent statt Legacy-Loader
src/features/collections/components/CollectionScreen.tsx  # Discovery Feed Hook
src/features/discovery/api/discovery-query-presets.ts       # newly-added, upcoming-highlights, genre
src/features/discovery/api/services/discovery-query-platform.ts  # neue Query-Methoden
src/features/home/__tests__/home-location-header.test.ts
```

---

## 12. Zusammenfassung

Sprint 23 liefert die **erste produktive Oberfläche** der Eternal-Rave-App: den Home Feed. Alle sechs Feed-Bereiche (Trending, Heute, Wochenende, In deiner Nähe, Neu hinzugefügt, Kommende Highlights) laden unabhängig und parallel über die Discovery Query Platform. Die Architektur ist generisch — neue Sections erfordern nur einen Registry-Eintrag, keinen Code-Change in Hooks oder UI.

Collection Screens nutzen dieselbe Discovery-Schicht mit Cursor-Pagination und Infinite Scroll. Die bestehende Discovery-Engine, API, Filter-, Ranking- und Trust-Schichten bleiben vollständig erhalten.
