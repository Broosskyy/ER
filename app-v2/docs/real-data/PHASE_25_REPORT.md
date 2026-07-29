# Sprint 25 — Event Detail Experience Abschlussbericht

## 1. Ausgangslage

### Vor Sprint 25

| Bereich | Status | Problem |
|---------|--------|---------|
| Phase-2F UI-Komponenten | ✓ Vollständig | EventHero, Info, Lineup, Venue, Organizer, Tickets, Notice, Similar |
| Live Route `app/event/[id].tsx` | ✗ Legacy | `eventRepository.getEventById()` direkt aus UI |
| Discovery API `getEventDetail` | ✓ Backend-ready | Keine UI-Anbindung |
| Ähnliche Events | ✗ Client-seitig | Genre-Filter auf `getPublishedEvents()` |
| Loading/Error States | ✗ Teilweise | `EventDetailSkeleton` nur in Preview |
| Lifecycle Notices | △ Teilweise | `venue_changed` / `time_changed` nicht aufgelöst |
| Favoriten / Share | ✓ Vorhanden | Bereits an EventHero angebunden |
| EventActionBar | ✗ Nicht gemountet | Nur in Design-Preview |

### Analyse-Ergebnis

| Kategorie | Befund |
|-----------|--------|
| Bereits vorhanden | Phase-2F Komponenten, View-Model-Mapper, Entity-Loader, Favorites, Share, SEO |
| Teilweise vorhanden | Lifecycle-Darstellung, Similar Events, Loading UX |
| Fehlerhaft/doppelt | Direkter Repo-Zugriff im Screen parallel zur Discovery API |
| Fehlend | Discovery Client/Hook, Cache, Telemetrie, Similar via Discovery |

---

## 2. Wiederverwendete Komponenten

Alle Phase-2F-Komponenten unverändert im Layout — nur Datenanbindung migriert:

| Komponente | Datei |
|------------|-------|
| EventHero | `components/event-detail/EventHero.tsx` |
| EventActionBar | `components/event-detail/EventActionBar.tsx` |
| EventInfoSection + ExpandableText | `EventInfoSection.tsx`, `ExpandableText.tsx` |
| LineupSection | `LineupSection.tsx` |
| VenueDetailCard | `VenueDetailCard.tsx` |
| OrganizerDetailCard | `OrganizerDetailCard.tsx` |
| EventTicketSection | `EventTicketSection.tsx` |
| EventNoticeBanner | `EventNoticeBanner.tsx` |
| SimilarEventsSection | `SimilarEventsSection.tsx` |
| EventDetailSkeleton / Error | `EventDetailStates.tsx` |

View-Model-Mapper in `event-detail-view-model.ts` erweitert, nicht ersetzt.

---

## 3. Event-Detail-Architektur

```
app/event/[id].tsx
        │
        ├── useEventDetail(eventId)          ← Discovery Load + Cache + Similar
        │     └── discovery-event-detail-client.ts
        │           └── getDiscoveryQueryPlatform().getEventDetail(id)
        │
        ├── useEventDetailEntities(event)    ← Organizer/Venue/Artists (Service-Layer)
        │
        ├── useFavoriteToggle()              ← Bestehende Favorites-Pipeline
        │
        └── Phase-2F View-Model Mapper
              └── toEventHeroViewModel, toEventInfoViewModel, ...
```

### Neue Module

```
src/features/event-detail/
├── feed/
│   ├── discovery-event-detail-client.ts   # Discovery API + Cache + Dedup
│   └── event-detail-telemetry.ts          # Interne Messpunkte
└── hooks/
    └── useEventDetail.ts                  # Screen-State (loading/error/retry)
```

---

## 4. Discovery-API-Anbindung

| Operation | API |
|-----------|-----|
| Event laden | `GET /v1/discovery/events/:id` → `platform.getEventDetail(id)` |
| Ähnliche Events | `platform.filterEvents(buildSimilarEventsQuery(...))` |

**Keine** direkten Supabase- oder Repository-Zugriffe aus dem Screen.

Entity-Loader (`loadEventDetailEntities`) bleibt im Service-Layer für Organizer/Venue/Artist-Auflösung — UI konsumiert nur das Ergebnis via Hook.

### Response-Felder (über EventDisplayModel)

Kanonische ID, Titel, Beschreibung, Bild, Datum/Zeit/Zeitzone, Venue, Stadt, Adresse, Geo, Organizer, Festival, Genres, Line-up, Altersbeschränkung, Indoor/Outdoor (via `venueType`), Ticketstatus, Preis, Ticket-Link, Lifecycle-Status, Lifecycle-Hinweise, Aktualisierungszeitpunkt.

Fehlende Felder brechen die Seite nicht — Sections werden conditional gerendert.

---

## 5. Lifecycle-Darstellung

| Status | Darstellung |
|--------|-------------|
| cancelled | Notice Banner + Ticket deaktiviert |
| postponed | Notice Banner + Ticket-Hinweis |
| venue_changed | Notice Banner + optional vorheriger Ort |
| time_changed | Notice Banner + optional vorherige Zeit |
| sold_out | Ticket-Section Mode `sold_out` |
| archived | Error-State „nicht mehr verfügbar" |

`resolveEventNoticeType` erweitert um `lifecycleNotices` aus dem Domain-Modell — keine UI-seitige Lifecycle-Logik.

---

## 6. Venue-, Organizer- und Festival-Integration

| Entität | Integration |
|---------|-------------|
| Venue | `VenueDetailCard` + Entity-Loader + Profil-Navigation wenn FK aufgelöst |
| Organizer | `OrganizerDetailCard` + Follow + Profil-Navigation vorbereitet |
| Festival | `festivalId` / `festivalEditionId` in Info-Section, Navigation vorbereitet |

Indoor/Outdoor aus `venueType` (open_air, club, warehouse, hybrid, …).

---

## 7. Ticketzustände

| Zustand | Mode | CTA |
|---------|------|-----|
| Kostenlos | `free_rsvp` | „Kostenlos teilnehmen" |
| Verfügbar + URL | `external` | „Tickets ansehen" |
| Ausverkauft | `sold_out` | Deaktiviert |
| Abgesagt | `sold_out` | Deaktiviert + Hinweis |
| Verschoben | `external` | „Ticketinformationen" |
| Kein Link | `unavailable` | Kein aktiver CTA |

CTA nur aktiv bei validem `ticketUrl` und nicht-disabled Lifecycle.

---

## 8. Favoriten und Teilen

| Feature | Implementierung |
|---------|-----------------|
| Speichern | `useFavoriteToggle` → `EventHero` + `EventActionBar` |
| Persistenz | Bestehende AsyncStorage-Pipeline |
| UI-Feedback | `isHydrated && isFavorite(id)` |
| Telemetrie | `detail_favorite_set` / `detail_favorite_remove` |
| Teilen | `shareEvent()` — Native Share + URL-Fallback (`eternalrave.app/event/:id`) |
| Copy-Fallback | Web Clipboard / Share.message |

---

## 9. Ähnliche Events

- Geladen via `buildSimilarEventsQuery` + `filterEvents` (Surface: `similar_events`)
- Unabhängiger Loading-State (`similarLoading`)
- Aktuelles Event ausgeschlossen
- Leere Sektion ausgeblendet (kein Empty-State-Block)
- Telemetrie: `detail_similar_opened`

---

## 10. Navigation und State-Erhalt

- Öffnen aus Home, Search, Saved, Similar Events über `/event/:id`
- Expo Router Stack — Zurücknavigation erhält Tab-State
- Kein unnötiges Neuladen dank Event-Detail-Cache (TTL 300s)
- Deep-Link-URL-Struktur vorbereitet (`/event/:id`)

---

## 11. Loading-, Error- und Offline-Verhalten

| Zustand | UI |
|---------|-----|
| Initial Loading | `EventDetailSkeleton` |
| API-Fehler | `EventDetailErrorState` + Retry |
| Nicht gefunden | `EventNotFoundState` |
| Archiviert | `EventNotFoundState` |
| Offline + Cache | Gecachtes Event anzeigen |
| Offline ohne Cache | Offline-Fehlermeldung + Retry |

---

## 12. Performance und Caching

| Maßnahme | Implementierung |
|----------|-----------------|
| Request-Deduplizierung | `inflightDetailRequests` Map |
| Cache nach Event-ID | In-Memory Cache, TTL aus `events.detail` Policy (300s) |
| Stale-while-revalidate | Cache + Hintergrund-Refresh bei Retry |
| Similar separat | Paralleles Nachladen nach Detail-Load |
| Bild-Lazy-Loading | Bestehendes `EventImage` |

---

## 13. Telemetrie (intern)

| Event | Zweck |
|-------|-------|
| `detail_load_start` / `detail_load_complete` | Detail Load Time |
| `detail_load_error` | Fehler |
| `detail_opened` | Event geöffnet |
| `detail_ticket_cta` | Ticket-CTA geklickt |
| `detail_favorite_set` / `detail_favorite_remove` | Favorit |
| `detail_share` | Teilen |
| `detail_similar_opened` | Ähnliches Event |
| `detail_retry` | Retry |

Kein externer Analytics-Dienst.

---

## 14. Tests und Verifikation

| Datei | Tests |
|-------|-------|
| `sprint25-event-detail.test.ts` | 7 — Discovery Load, Cache, Similar, Lifecycle, Telemetry |
| Bestehende Tests | Unverändert grün |

**Ergebnis:** 1027 Tests grün, Typecheck grün, Lint 0 Errors.

---

## 15. Bewusst offene Punkte (Sprint 26+)

1. **Native Calendar Integration** — EventActionBar `onCalendarPress` vorbereitet, nicht implementiert
2. **Festival-Detailseite** — Navigation vorbereitet, keine Seite
3. **Organizer-Profilseite** — Teilweise vorhanden, nicht Sprint-25-Scope
4. **Artist-Profile** — Lineup-Navigation vorbereitet
5. **Vollständige Deep-Link-Plattform** — URL-Struktur, kein Universal-Link-Setup
6. **Lifecycle previous values aus API** — `lifecycleHints` auf Domain-Event, noch nicht aus Import-Pipeline befüllt
7. **Persistenter Offline-Cache** — In-Memory only, kein AsyncStorage-Detail-Cache
8. **Report/Moderation Backend** — Dialog only
9. **Prefetch beim Scroll** — Cache-Architektur vorbereitet, kein Home-Feed-Prefetch

### Nicht in Scope (wie spezifiziert)

Kartenansicht, Community, Chat, Ticketing-Checkout, Zahlungen, Push, KI-Empfehlungen.

---

## 16. Zusammenfassung

Sprint 25 vervollständigt die Event-Detail-Erfahrung: Die bestehende Phase-2F-UI bleibt die visuelle Referenz, die Datenanbindung läuft vollständig über die Discovery API. Loading-, Error- und Offline-Zustände sind produktionsreif. Ähnliche Events, Lifecycle-Hinweise, Favoriten, Teilen und Tickets sind konsistent mit Home und Search integriert.
