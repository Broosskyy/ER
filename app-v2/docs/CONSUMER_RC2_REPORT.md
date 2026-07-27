# Consumer RC2 — Consumer Card System Finalization

**Datum:** 2026-07-26

---

## Ziel

Drei Consumer-Eventkarten finalisieren (Featured, Compact, Vertical) als verbindliche Grundlage für Home, Events, Suche und Saved — ohne neue Features, APIs oder Architekturänderungen.

---

## Umgesetzt

### Card A — Featured Premium (`featuredHome`)
- Hero-Breite ~78 % Viewport (`getHomeFeaturedCardWidth`) mit Peek auf Slot 2/3
- UI auf **3 Featured-Slots** ausgelegt (`HOME_FEATURED_SLOT_COUNT`, `FEATURED_EVENT_IDS` × 3)
- Bilddominanz: Aspect **3:4**, Datum unten links auf dem Bild
- Favorit als **Overlay-Sibling** (kein Nested Button mehr)
- Kompakter Meta-Footer (Genre, Preis)

### Card B — Compact Premium (`compactPremium`)
- Einheitliche Surface-Card: Thumbnail, Titel, Location, Genres, Uhrzeit, Favorit
- Home „Heute Abend“ nutzt `compactPremium` statt Listenzeile

### Card C — Vertical Premium (`verticalPremium`)
- Vertikale Bild-first-Card: großes Poster, Datum auf dem Bild, Herz oben rechts
- Home „Dieses Wochenende“ / „Demnächst“ / Genre-Sektionen, Collection-Screens, Suchergebnisse

### Demo-Daten
- **3 Featured:** VOID, Klangkuenstler, Electric Avenue
- **6 Tonight-Events** (nicht-featured, 24.05.)
- **10 publizierte Demo-Events** insgesamt
- `EXPO_PUBLIC_USE_SUPABASE=false` für lokale Visual QA

### Bugfixes
- Nested-Button auf Featured-Cards behoben (`InteractiveCard` Overlay)
- DE-Strings: Suchfeld, Quick-Filter, Datumsfilter, Ergebniszähler
- Pipeline-/Repository-Tests auf 10 Demo-Events aktualisiert

---

## Screenshots

`docs/visual-qa/sprint-rc2/`

| Datei | Inhalt |
|-------|--------|
| `home-mobile-light.png` | Home — Featured Hero |
| `home-mobile-dark.png` | Home Dark |
| `home-featured-light.png` | Featured-Rail |
| `home-tonight-light.png` | Home (Scroll-Limit Web) |
| `home-weekend-light.png` | Home (Scroll-Limit Web) |
| `search-results-light.png` | Suche mit Vertical Card |
| `search-mobile-light.png` | Suche Explore (Poster-Grid) |
| `events-tonight-collection.png` | Collection (Static-Export leer) |
| `home-desktop-light.png` | Home Desktop |
| `search-desktop-light.png` | Suche Desktop |

---

## Ehrliche Bewertung

### Featured Card

**Stärken:** Deutlich breiterer Hero, Peek auf Folgekarte, Datum elegant auf dem Bild, Favorit optisch integriert, 3-Slot-Daten vorbereitet.

**Schwächen:** Meta-Block unter dem Bild wirkt noch etwas textlastig vs. Referenz; auf Desktop weiterhin nur eine volle Karte im Viewport; dritte Karte im Screenshot nicht sichtbar ohne Scroll.

**Note:** **Near Match** — Richtung stimmt, Referenz-Premium noch nicht voll erreicht.

---

### Compact Card

**Stärken:** Echte Card-Einheit mit Surface, Thumbnail + Meta + Zeit + Favorit; klar von Vertical/Featured unterscheidbar.

**Schwächen:** Visuell noch nüchtern gegenüber Referenz-„Premium Tonight“; Thumbnail 80 px könnte größer/emotionaler sein; auf Static-Web-Scroll schwer zu verifizieren.

**Note:** **Near Match**

---

### Vertical Card

**Stärken:** Bild dominiert, Datum auf dem Bild, Herz in der Card, einheitlich auf Home-Sektionen und Suchergebnissen.

**Schwächen:** Explore-Modus der Suche nutzt weiterhin **Poster-Grid**, nicht Vertical Card — inkonsistentes Card-System; Genre-Chips fehlen unter dem Titel.

**Note:** **Near Match** (Suchergebnisse gut, Explore-Lücke)

---

### Home-Komposition

**Stärken:** Drei Sektionen nutzen dasselbe Card-Fundament; Featured / Tonight / Weekend fühlen sich mehr wie ein System an als vor RC2.

**Schwächen:** Techno/House-Sektionen noch auf Home (viel Content); Featured vs. Listen-Sektionen unterschiedliche Dichte; Top Clubs unverändert.

**Note:** **Near Match**

---

### Responsive Verhalten

**Stärken:** Mobile Featured-Hero skaliert mit Ratio; Desktop-Layout nutzt `ResponsiveScreen`.

**Schwächen:** Desktop Featured wirkt wie Mobile hochskaliert (eine Karte, viel Leerraum); keine dedizierte Desktop-Hero-Anpassung.

**Note:** **Below Target** auf Desktop

---

## Kann das Consumer Card System jetzt als verbindliche Grundlage für alle weiteren Consumer-Screens verwendet werden?

**NEIN**

### Blocker (max. 5)

1. **Suche Explore-Modus** zeigt Poster-Grid statt `verticalPremium` — Card C nicht durchgängig.
2. **Desktop Featured-Rail** — eine Karte, viel Leerraum; kein Premium-Hero auf breiten Viewports.
3. **Filter-Sheet / Empty States** teils noch Englisch („Filters“, „Apply Filters“, „Adjust Filters“).
4. **Collection-Route** im Static-Web-Export liefert leere Seite (Routing/QA-Risiko für Events-Collections).
5. **Referenz-Abstand Featured** — Meta-Footer und Bild-/Text-Verhältnis noch nicht auf Mockup-Niveau.

---

## Tests

- `npm run typecheck` ✓
- `npm test` — **643/643** ✓

---

## Betroffene Kern-Dateien

- `src/components/discovery/EventCard.tsx`
- `src/components/discovery/event-card-styles.ts`
- `src/components/discovery/EventImage.tsx`
- `src/design/layout.ts`
- `src/features/home/components/featured-card-layout.ts`
- `app/(tabs)/index.tsx`
- `app/(tabs)/search.tsx`
- `src/features/events/data/raw-demo-events.ts`
- `src/features/events/data/home-config.ts`
- `src/features/collections/event-collection-config.ts`
- `.env` (`USE_SUPABASE=false`)
