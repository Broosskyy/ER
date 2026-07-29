# Frontend Abnahme Sprint — Bootshaus Referenz-Connector

**Datum:** 2026-07-29  
**Scope:** Expo/React Native App (`app-v2/`)  
**Referenz-Datenquelle:** Bootshaus (37 Events live)

---

## Executive Summary

Der Sprint schließt die erste vollständige Frontend-Abnahme für reale Bootshaus-Events ab. Hauptursache für einheitliche Fallback-Bilder war ein Frontend-Mapping-Fehler — die Backend-Pipeline lieferte korrekte `image_url`-Werte. Home, Saved, Event Detail, Organizer, Line-up und Timetable wurden auf produktionsreife Architektur gebracht, ohne neue UI-Konzepte einzuführen.

---

## 1. Bildpipeline

### Ursache

`toEventDisplayModel()` in `src/features/events/formatting/display-event.ts` nutzte `getEventImageAsset(event.id)` statt `event.imageUrl`. Bootshaus-Events haben zufällige IDs (`evt-*`), die nicht in `EVENT_IMAGE_ASSETS` existieren → alle Events erhielten `poster-void.jpg`.

**Backend-Pipeline war korrekt:** Parser → `normalized_payload.imageUrl` → `events.image_url` → `Event.imageUrl`.

### Fix

| Datei | Änderung |
|-------|----------|
| `src/features/events/data/event-image-resolver.ts` | Neue `resolveEventImageSource()` — bevorzugt `{ uri: imageUrl }`, Fallback nur bei fehlender URL |
| `src/features/events/data/demo-images.ts` | Re-Export der Resolver-Funktion |
| `src/features/events/formatting/display-event.ts` | `image: resolveEventImageSource(event)` |
| `src/features/events/data/__tests__/demo-images.test.ts` | Unit-Tests für URL-Priorität und Fallback |

### Ergebnis

Jedes Event mit `imageUrl` zeigt seinen individuellen Flyer in EventCard, EventDetail, Saved, Search und Home. Fallback nur wenn keine URL vorhanden.

---

## 2. Home Screen

### Problem

Abweichung von der vereinbarten Produktstruktur — fehlende Zeitfenster-Sections, keine getrennten Venue-Rails.

### Fix

`src/features/home/feed/home-feed-section-config.ts` — 9 Sections mit interleaved Layout:

| Typ | Sections |
|-----|----------|
| **Große Rails** | Trending, Featured, Kommende Highlights |
| **Kompakte Listen** | Heute, Diese Woche, Dieses Wochenende, Nächste Woche, Neu hinzugefügt, In deiner Nähe |
| **Venue-Rails** (separat) | Clubs, Venues via `HomeVenueRailsSection` |

Neue Discovery-Presets: `this-week`, `next-week` in Types, Query-Presets und `DiscoveryQueryPlatform`.

**Keine gestapelten Hero-Carousels** — Rails und Listen alternieren.

---

## 3. Organizer-Bereich

### Problem

Follow-Button überlagerte Avatar/Name im Event Detail (`InteractiveCard` mit `actionsPlacement="trailing"`).

### Fix

`src/components/profiles/OrganizerComponents.tsx`:

- Follow-Button inline in Header-Zeile (`followInline`, `flexShrink: 0`)
- Doppelter Follow-Button am Kartenende entfernt
- `copy`-Spalte mit `minWidth: 0` für sauberes Text-Truncating

---

## 4. Saved Screen

### Problem

Filter-Tabs wirkten wie große Karten-Chips, inkonsistentes Spacing.

### Fix

| Datei | Änderung |
|-------|----------|
| `src/components/saved/SavedFilterBar.tsx` | Segment-Control (ProfileTabs-Pattern): kompakte Tabs, 44px Höhe, Unterstreichung |
| `app/(tabs)/saved.tsx` | `spacing`/`spacingRoles`-Tokens, Listen-Padding, Filter-Bar-Margin |

Karten bleiben kompakt (`variant="compactPremium"` via `SavedEventCard`).

---

## 5. Event Detail Production Polish

| Bereich | Änderung |
|---------|----------|
| Content-Gap | `spacing.lg` → `spacing.xl` zwischen Sections |
| Line-up | Immer sichtbar (auch Placeholder) |
| Timetable | Eigene Section unterhalb Line-up |
| Organizer/Venue | Bestehende Cards, Overlap-Fix |

Keine neue Seitenstruktur — nur Spacing und Section-Wiring.

---

## 6. Line-up Foundation

| Komponente | Beschreibung |
|------------|--------------|
| `LineupSection.tsx` | Zeigt Artist-Cards oder Placeholder-Card |
| `ArtistLineupCard.tsx` | Einzelne Artist-Card mit Avatar, Headliner-Badge, Verifizierung |
| `toLineupSectionViewModel()` | Gibt immer ein ViewModel zurück (`tba: true` bei leerem Line-up) |

Vorbereitet für: Artist-Profil, Follow, Claim, Verifizierung.

---

## 7. Timetable Foundation

| Komponente | Beschreibung |
|------------|--------------|
| `TimetableSection.tsx` | Section „LINE-UP & TIMETABLE" |
| `TimetableSectionViewModel` | `slots[]` mit Stage, Artist, Start, Ende |
| `toTimetableSectionViewModel()` | Placeholder: „Timetable noch nicht veröffentlicht" |

Keine Festival-Planungslogik — nur saubere UI-Architektur.

---

## 8. Artist Foundation

| Bereich | Status |
|---------|--------|
| `app/artist/[id].tsx` | Public Artist Profile via `PublicEntityProfileScreen` |
| `artistProfileRoute()` | Navigation aus Event Detail Line-up |
| `ArtistLineupCard` | `profileNavigable`, `VerificationBadge` für Unclaimed |
| `useEntityFollow` | Follow-Hook für Artists vorbereitet |

Keine Dummy-Businesslogik — produktionsfähige Routing- und UI-Architektur.

---

## 9. Mobile UI Polish

Behoben in diesem Sprint:

- Organizer Textüberlauf und Button-Overlap
- Saved Filter-Höhe und Segment-Control
- Event Detail Section-Abstände
- Home Venue-Rails getrennt von Event-Carousels
- Artist/Lineup Cards mit `numberOfLines` und `minWidth: 0`

---

## 10. Theme Audit

Alle Änderungen nutzen ausschließlich Theme-Tokens:

- `theme.colors.*` für Farben
- `spacing` / `spacingRoles` für Abstände
- `componentSize` für feste Dimensionen
- Keine hardcodierten Hex-Werte in neuen Komponenten

Layout, Komponenten und Animationen identisch in Dark und Premium Light.

---

## 11. Getestete Screens & Tests

### Manuell zu verifizieren (Expo)

- Home (alle 9 Sections + Venue-Rails)
- Event Detail (Bootshaus-Event mit individuellem Flyer)
- Saved (alle 4 Filter-Tabs)
- Search
- Organizer-Profil aus Event Detail
- Artist-Profil aus Line-up (wenn `artistId` vorhanden)

### Automatisierte Tests (bestanden)

- `demo-images.test.ts` — Image-Resolver
- `sprint23-home-feed.test.ts` — 9 Sections, Rail/List-Verteilung
- `phase-2e-profile-ui-integration.test.ts` — Profile/Lineup-Links
- `phase-2f-event-detail-saved.test.ts` — ViewModel-Kontrakte

**Hinweis:** 3 vorbestehende Test-Suites schlagen fehl (Backend Sprint 26.9.1, Supabase Env) — nicht durch diesen Sprint verursacht.

---

## 12. Bekannte Restpunkte

| Punkt | Beschreibung |
|-------|--------------|
| Timetable-Daten | Keine Stage/Slot-API — Placeholder bis Festival-Domain angebunden |
| Artist-Bilder | Remote Artist-Avatare abhängig von `ArtistRecord.imageUrl` |
| Home Featured | `featured` und `upcoming-highlights` teilen Preset — Inhalte können überlappen |
| Venue-Rails | Noch Fixture-Daten (`HOME_CLUB_FIXTURES`), keine Live-Venue-Discovery |
| Affenkäfig | Nicht integriert — Bootshaus bleibt Referenz-Connector |

---

## Geänderte Dateien (Auswahl)

```
app-v2/
├── app/(tabs)/saved.tsx
├── app/event/[id].tsx
├── src/components/discovery/ArtistLineupCard.tsx          (neu)
├── src/components/event-detail/LineupSection.tsx
├── src/components/event-detail/TimetableSection.tsx     (neu)
├── src/components/event-detail/view-models.ts
├── src/components/profiles/OrganizerComponents.tsx
├── src/components/saved/SavedFilterBar.tsx
├── src/features/events/data/demo-images.ts
├── src/features/events/data/event-image-resolver.ts       (neu)
├── src/features/events/formatting/display-event.ts
├── src/features/event-detail/utils/event-detail-view-model.ts
├── src/features/home/feed/home-feed-section-config.ts
├── src/features/home/feed/discovery-feed-client.ts
├── src/features/home/components/HomeVenueRailsSection.tsx (neu)
└── src/features/home/components/HomeFeedContent.tsx
```

---

## Qualitäts-Checkliste

- [x] Keine Hardcodes (Farben/Spacing via Tokens)
- [x] Keine Bootshaus-spezifischen Hacks in generischen Services
- [x] Bestehende Architektur respektiert
- [x] Dark + Premium Light kompatibel
- [x] Keine neuen UI-Konzepte
- [x] Unit-Tests für kritische Fixes
