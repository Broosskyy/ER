# Sprint 2A.5 – Visual Direction Lock

**Status:** Verbindlich für alle Screen-Migrationen ab Sprint 2B  
**Datum:** Juli 2026  
**Scope:** Consumer Light als Primärreferenz · Dark als gleichwertige zweite Variante · Responsive Produktarchitektur  
**Implementierung:** `/design-preview` → Sektion „Sprint 2A.5 – Visual Direction Lock“

---

## 1. Markenwirkung

### So soll Eternal Rave wirken

| Dimension | Konkrete Wirkung | Umsetzungskonsequenz |
|-----------|------------------|----------------------|
| Leicht | Warme Off-White-Flächen (`background` #FAFAF8), keine Vollflächen-Lila | App-Hintergrund nie reinweiß; Sektionen über Weißraum trennen |
| Modern | Klare Typo-Hierarchie, reduzierte Chrome-Elemente | Max. 3 sichtbare Schriftstufen pro Viewport-Ausschnitt |
| Hochwertig | Bildstark, großzügiger Weißraum, sparsame Schatten | Featured Events mindestens 16:9, Cards nur bei echtem Container-Bedarf |
| Ruhig | Wenige konkurrierende CTAs, dezente Borders | Max. 1 Primary Button pro sichtbarem Bereich |
| Club-/Rave-kompatibel | Dunkle Akzente auf Bildern, Genre als leiser Text — nicht Neon | Genre-Labels in `accent`, nicht in Vollflächen-Chips |
| Mobile-first | Einspaltig, Touch-Targets ≥ 44px, horizontale Filter nur wo nötig | Desktop erweitert — ersetzt nicht Mobile |

### So soll Eternal Rave nicht wirken

- Generisches SaaS-Dashboard (graue Metric-Cards, überall gleiche Buttons)
- Standard-Eventportal (überladene Filterleisten, Card-in-Card)
- Theme-Demo (Lila als Hintergrund, zu viele Chips)
- Billig-Neon (grelle Verläufe, Glow-Effekte)
- Steriles Weiß (reines #FFFFFF als App-Hintergrund)
- „Dark Theme in hell“ (nur invertierte Farben ohne warme Surfaces)

### Consumer · Organizer · Admin

| Bereich | Gemeinsam | Unterschied |
|---------|-----------|-------------|
| **Consumer** | Gleiche Tokens, Typo, Radien, Akzentfarbe | Bildstark, wenig Chrome, Bottom Nav (Mobile) |
| **Organizer** | Gleiche Foundation | Mehr Formularflächen, Stepper, Status-Badges — kompakter |
| **Admin** | Gleiche Foundation | Sidebar/Topbar, Review-Panels, Tabellen — informationsdichter |

Alle drei Bereiche nutzen **dieselbe** Token-Schicht. Unterschiede sind Komposition und Dichte — keine parallele Farbwelt.

### Rolle der Eventbilder

- Primärer emotionaler Anker — mindestens 40 % der visuellen Aufmerksamkeit auf Home/Detail
- Featured: Hero-Format (16:9), volle Card-Breite mit Date-Badge auf Bild
- Listen: quadratisches oder 4:3-Thumbnail — nie zu klein (< 64px)
- Fallback: abstrakte Demo-Poster — nie leere graue Flächen

### Rolle von Lila (`accent` #6D5DF6)

- **Ja:** aktive Navigation, Selected Chips, Links, „Mehr anzeigen“, Primary CTA, Genre-Label (uppercase caption)
- **Nein:** Section-Hintergründe, Card-Fills, permanente Header-Bänder
- Max. **ein** violetter Primary CTA pro sichtbarem Viewport-Bereich

### Rolle des Weißraums

- Trennt Sektionen statt zusätzlicher Borders
- `sectionGap` (16px Basis, Ziel 24–32px bei Migration) zwischen Hauptblöcken
- Card-Padding nur innerhalb echter Container — nicht als Ersatz für Screen-Padding

---

## 2. Farbrollen

Alle Rollen über bestehende `ThemeColors`-Tokens. Keine Hex-Werte in Komponenten.

| Rolle | Token | Light | Verwendung |
|-------|-------|-------|------------|
| App Background | `background` | #FAFAF8 | Screen-Hintergrund, Scroll-Bereich |
| Primary Surface | `surface` | #FFFFFF | Cards, Inputs, Bottom Nav, Sheets |
| Secondary Surface | `surfaceSubtle` | #F3F3F0 | TOC, dezente Sektionshintergründe, Hover |
| Elevated Surface | `surfaceElevated` | #F5F5F5 | Badges auf Bildern, leichte Erhebung |
| Subtle Surface | `surfaceSubtle` | #F3F3F0 | Filterleisten-Hintergrund (optional) |
| Primary Text | `textPrimary` | #111111 | Titel, Body |
| Secondary Text | `textSecondary` | #6B7280 | Meta, Venue, Datum |
| Muted Text | `textMuted` | #9CA3AF | Placeholder, deaktiviert |
| Border Subtle | `borderSubtle` | #E5E7EB | Card-Ränder (sparsam), Input-Rahmen |
| Border Strong | `borderStrong` | #D1D5DB | Fokus, Trennlinien wenn nötig |
| Accent Primary | `accent` | #6D5DF6 | CTAs, aktiv, Links |
| Accent Soft | `accentMuted` | rgba(109,93,246,0.12) | Selected Chip BG, Mode-Toggle |
| Success | `success` / `successMuted` | — | Verifiziert, Ticket verfügbar |
| Warning | `warning` / `warningMuted` | — | Limited tickets, Hinweise |
| Destructive | `destructive` / `destructiveMuted` | — | Löschen, Abmelden |
| Overlay | `overlay` | rgba(17,18,20,0.48) | Modals, Bild-Overlays |
| Skeleton | `skeletonBase` / `skeletonHighlight` | — | Loading States |

### Token-Anpassungsvorschläge (noch nicht umgesetzt)

| Vorschlag | Begründung | Risiko |
|-----------|------------|--------|
| `sectionGap` von 16px auf 24px erhöhen | Mehr Premium-Ruhe auf Home | Global — erst bei erster Migration testen |
| `surfaceSubtle` als explizite `divider`-Fläche ohne Border | Weniger sichtbare Linien | Gering |
| Legacy `primary`/`border` Keys deprecaten | Konsolidierung auf `accent`/`borderSubtle` | Mittel — Feature-Code nutzt noch Legacy |

**Entscheidung Sprint 2A.5:** Keine globalen Token-Änderungen. Dokumentation verbindlich; Anpassung bei Sprint 2B Screen-Migration.

> **Ergänzend (non-breaking):** Für operative Verfeinerungsentscheidungen bei Migrationen siehe `ER_CONSUMER_VISUAL_POLISH.md`.

---

## 3. Typografie-Hierarchie

Basierend auf `AppText`-Rollen (`createTheme.ts`).

| Ebene | Rolle | Größe (ca.) | Gewicht | Zeilenhöhe | Max. pro Screen |
|-------|-------|-------------|---------|------------|-----------------|
| Display | `titleLarge` | 24px | bold | tight | 0–1 (Hero) |
| Screen Title | `titleLarge` / `screenTitle` | 24px | bold | tight | 1 |
| Section Title | `titleMedium` | 20px | semibold | tight | 3–5 |
| Card Title | `cardTitle` | 16px | semibold | tight | unbegrenzt (Content) |
| Body | `body` | 16px | regular | normal | — |
| Secondary Body | `bodyMuted` | 16px | regular | normal | — |
| Meta | `metadata` / `caption` | 14px / 12px | regular | normal | — |
| Label | `label` | 12px | medium | tight | Formulare, Chips |
| Button Label | `button` | 16px | semibold | tight | pro Button |
| Badge Label | `caption` + uppercase | 12px | medium | tight | max. 2 pro Card |

### Regeln

- All-Caps nur für Genre-Caption auf Cards — nicht für Section Titles
- `titleMedium` für Sektionsüberschriften (nicht `titleLarge`)
- Markenzeile „ETERNAL RAVE“ als `label` in `accent` — nicht als Screen Title
- Location-Zeile als `bodyStrong`

---

## 4. Spacing und Dichte

| Kontext | Token / Wert | Mobile | Tablet | Desktop |
|---------|--------------|--------|--------|---------|
| Screen Horizontal Padding | `spacingRoles.screenHorizontal` | 16px | 20px (`xl`) | 20–24px |
| Max Content Width | `layout.maxContentWidth*` | — | 720px | 960px |
| Hauptsektionen | `spacingRoles.sectionGap` | 16px | 16px | 20px |
| Cards untereinander | `spacingRoles.listItemGap` | 12px | 12px | 12–16px |
| Card Innenabstand | `spacingRoles.cardPadding` | 16px | 16px | 16px |
| Chip-Abstände | `spacingRoles.chipGap` | 8px | 8px | 8px |
| Header → Content | `spacing.md` | 12px | 12px | 12px |
| Bild → Text (in Card) | `spacingRoles.cardContentGap` | 8px | 8px | 8px |

Keine willkürlichen Einzelwerte pro Screen. Preview-Master nutzen ausschließlich diese Tokens.

---

## 5. Cards und Surfaces

### Wann Card

- Event mit Bild und Metadaten (`EventCard`, `EventListItem` mit `InteractiveCard`)
- Ticket, Organizer-Profil, Admin-Review-Panel
- Formular-Gruppierung in Organizer/Admin

### Wann nur Weißraum + Divider

- Sektionswechsel auf Home (Featured → Highlights)
- Event-Detail-Beschreibungstext
- Settings-Listen ohne Bild

### Wann Elevated Surface

- Featured Event Card (`elevated={true}`)
- Bottom Sheets, Modals
- Floating Filter-Bar (Desktop)

### Borders

- Standard-Cards: `borderSubtle` 1px — bei Light sparsam; Ziel: Featured ohne sichtbare Border
- Keine doppelten Borders (Card-in-Card)
- Dividers statt Box um jede Info-Zeile

### Schatten

- Nur `elevated` Featured Cards und Sheets
- Kein Schatten auf Listenzeilen

### Radien

- Cards: `theme.radiusRoles.card`
- Chips: `theme.radiusRoles.chip`
- Bilder: `theme.radiusRoles.image` / Card-inherit

### Card-Familie

| Typ | Variante | Bild | Dichte |
|-----|----------|------|--------|
| EventCard | standard / featured / compact | ja | standard |
| EventListItem | compact row | ja | hoch |
| TicketCard | Phase 2B | ja | mittel |
| OrganizerCard | Phase 2H | Logo | mittel |
| AdminCard | Phase 2H | optional | hoch |

---

## 6. Bilder

| Kontext | Verhältnis | Token |
|---------|------------|-------|
| Event Hero (Detail) | 16:9 | `componentSize.eventDetailHeroAspectRatio` |
| Featured Event (Home) | 16:9 | `componentSize.featuredHeroAspectRatio` |
| EventCard Standard | Card-layout | `EventImage` standard |
| EventListItem | 1:1 compact | `discoveryCompactThumbnailSize` 64px |
| Bildradius | Card-aligned | `radiusRoles.image` |

- **Fallback:** Demo-Poster aus `demo-images.ts`
- **Overlay:** nur für Status auf Hero — nicht für Standard-Listen
- **Text auf Bildern:** Date-Badge (surface), kein Titel auf Bild außer Hero
- **Mobile Crop:** center-cover
- **Desktop Crop:** gleiches Asset, breiterer Container — kein separates Asset

---

## 7. Buttons und Aktionen

| Variante | Einsatz | Max. sichtbar |
|----------|---------|---------------|
| Primary | Kaufen, Speichern, Einloggen | 1 pro Bereich |
| Secondary | Alternative Aktion | 1 neben Primary |
| Ghost | Filter, Abbrechen | 2–3 |
| Text / Link | „Mehr anzeigen“ | pro Sektion 1 |
| Icon-only | Header-Aktionen, Favorite | 2–3 im Header |
| Destructive | Löschen, Abmelden | isoliert |

Home Master: keine sichtbaren Primary Buttons — Suche und Cards sind Einstieg. Favorite nur als Icon auf Cards.

---

## 8. Chips und Filter

- **Wann:** Quick-Filter auf Home/Events (Heute, Wochenende, Genre)
- **Selected:** `accent` Text/Border + `accentMuted` Background
- **Unselected:** `surface` + `borderSubtle`
- **Mobile:** horizontales Scrollen, max. 1 Zeile sichtbar
- **Tablet/Desktop:** Wrap erlaubt ab 768px
- **Max. Dichte:** 5–7 Chips sichtbar; Rest in „Filter“-Sheet (Bottom Sheet Mobile, Sidebar Desktop)
- **Keine** Genre-Chips als permanente zweite Reihe unter Quick-Filtern

---

## 9. Responsive Produktarchitektur

### Mobile (360 / 390 / 430 px)

- Bottom Navigation (5 Tabs: Home, Events, Map, Saved, Profile)
- Einspaltiger Content, volle Breite Cards
- Horizontale Featured-Carousel mit Peek (`featuredCardPeek` 40px)
- Keine Sidebars
- Touch Targets ≥ 44px

### Tablet (768–1023 px)

- Größere horizontal Padding (`xl` 20px)
- 2-Spalten Event-Grid möglich
- Filter dauerhaft sichtbar (Wrap)
- Detail: Content + CTA-Spalte optional
- Navigation: bestehende App-Shell (Bottom Nav oder Web Top Nav je nach Breakpoint)

### Desktop (≥ 1024 px, Content max 960 px)

**Consumer:**

- Top Navigation (slim) — kein Bottom Nav
- Featured + „Heute Abend“ zweispaltig
- Event-Grid 3 Spalten
- Filterleiste oben oder links
- Event Detail: Hero + Info links, Ticket-CTA rechts (sticky)
- Map/Liste nebeneinander

**Organizer/Admin:**

- Sticky Sidebar + Topbar
- Metric Grid, Review + Decision Panel nebeneinander
- Wizard: horizontaler Stepper

Desktop ist **keine** vergrößerte Mobile-App — eigenständige Komposition mit gleichen Tokens.

---

## 10. Bestandsmatrix (Komponenten-Audit)

| Bereich | Aktueller Eindruck | Problem | Empfehlung | Änderung jetzt? |
|---------|-------------------|---------|------------|-----------------|
| EventCard standard | Technisch stark, leicht generisch | Border auf jeder Card | Featured elevated, Standard borderSubtle reduzieren bei Migration | SPÄTER |
| EventCard featured | Bildstark, premium | — | Als Home-Referenz beibehalten | NEIN |
| EventCard compact | Gut für „In deiner Nähe“ | — | Beibehalten | NEIN |
| EventListItem | Klar, kompakt | Genre All-Caps konkurriert | Beibehalten; Dichte auf Home begrenzen | NEIN |
| FilterChip | Funktional | Zu viele Chips wirken überladen | Max 5–7 sichtbar; Rest in Sheet | SPÄTER |
| CategoryChip | Gut für Kategorien | Auf Home redundant zu Filter | Nur wo Kategorie-Navigation | SPÄTER |
| SearchBar | Mockup-konform | — | Beibehalten | NEIN |
| Section (layout) | Sauber, ohne Card-Chrome | titleMedium statt sectionTitle | Beibehalten | NEIN |
| CardFoundation | Solide Basis | Borders default sichtbar | `elevated` nur featured | SPÄTER |
| Buttons | Vollständig | — | Beibehalten | NEIN |
| HomeHeader (Feature) | Legacy colors/typography | Nicht design-system-konform | Bei Migration durch Preview-Header-Pattern ersetzen | SPÄTER |
| FeaturedEventCard (Feature) | Legacy, Router-gekoppelt | Duplikat zu EventCard featured | Migration auf EventCard | SPÄTER |
| SectionHeader (Feature) | `colors.primary` Legacy | Inkonsistent | HomeSectionHeader-Pattern aus Preview | SPÄTER |
| Preview Phase 2A–2H | Vollständiger Katalog | Zu dicht für Premium-Light | Master zeigt Zielzustand | NEIN (Preview) |
| Organizer/Admin 2H | Funktional, dichter | Korrekt für Pro-Bereich | Eigene Desktop-Master später | SPÄTER |
| Theme Light | Warm, funktional | sectionGap noch kompakt | Dokumentiert; Token-Update bei 2B | SPÄTER |
| Theme Dark | Kohärent | — | Gleiche IA wie Light | NEIN |

---

## 11. Mockup-Gap-Audit

### Ausreichend belegt (vorhandene Mockups + Preview)

| Screen | Quelle |
|--------|--------|
| Event Detail Mobile | Mockup 11 + Phase 2F |
| Saved Mobile | Mockup 12 + Phase 2F |
| Search/Filter Mobile | Mockup 13 + Phase 2E |
| Map Mobile | Mockup 14 + Phase 2D |
| Profile Mobile | Mockup 15 + Phase 2B |
| Organizer Wizard | Mockup 54 + Phase 2H |
| Admin Review | Mockup 58 + Phase 2H |
| Auth/Onboarding | Phase 2G |

### Noch nicht ausreichend belegt

| Screen | Lücke | Priorität |
|--------|-------|-----------|
| Home Header Light Final | Kompakter Header mit Location | P0 — **in 2A.5 Master** |
| Featured Event Light | Große Hero-Card | P0 — **in 2A.5 Master** |
| Consumer Desktop Navigation | Top Nav ohne Bottom Nav | P0 — **in 2A.5 Master** |
| Desktop Home | Grid + Featured-Split | P0 — **in 2A.5 Master** |
| Desktop Event Detail | 2-Spalten CTA | P1 |
| Desktop Map/List | Split View | P1 |
| Desktop Saved | Grid/List | P1 |
| Desktop Organizer Dashboard | Sidebar-Layout | P1 |
| Desktop Admin Review | Panel-Split | P1 |
| Notification Center | Kein Mockup | P2 |
| Splash + Progress | Kein finales Mockup | P2 |
| Profile Light Final | Phase 2B zeigt Struktur, nicht finales Light | P2 |

### Master-Mockup-Plan

| Master | Zweck | Vor Migration? | Priorität |
|--------|-------|----------------|-----------|
| Mobile Home Light | Globale Consumer-Richtung | JA | P0 ✅ |
| Mobile Home Dark | Theme-Parität | JA | P0 ✅ |
| Desktop Home Light | Desktop-Richtung | JA | P0 ✅ |
| Events/Search Light | Filter + Liste | JA | P1 |
| Event Detail Light | CTA-Platzierung | JA | P1 |
| Saved Light | Grid/List Saved | JA | P1 |
| Login/Onboarding Light | Auth-Flow | Nein (2G ausreichend) | P2 |
| Profile/Tickets Light | Account | Nein | P2 |
| Organizer Dashboard Desktop | Pro | Vor Organizer-Migration | P1 |
| Admin Review Desktop | Pro | Vor Admin-Migration | P1 |

---

## 12. Migrationsfolgen

### Bleibt unverändert

- View Models (`discovery/view-models.ts`, etc.)
- Accessibility-Patterns (Roles, Labels)
- Status Resolver
- Businesslogik, Hooks, Supabase, APIs
- Theme-Mechanik (`ThemeProvider`, `useTheme`)
- Teststruktur und Boundary Audit
- Router und Navigation

### Wird später global angepasst

- `sectionGap` Erhöhung (optional)
- Card-Border-Reduktion auf Light
- Legacy `colors.primary` → `accent` in Features
- Typografie-Feinjustierung (weniger Bold)
- Schatten nur auf `elevated`

### Wird pro Screen angepasst

- Home: Header, Featured, Sektionsabstände
- Saved: List/Grid-Dichte
- Event Detail: Hero, CTA-Spalte Desktop
- Search: Filter-Platzierung Desktop
- Profile: Card-Reduktion

**Kein Neustart nötig:** Komponentensystem ist migrationsbereit. Sprint 2A.5 legt die visuelle Zielkomposition fest — Migrationen wenden bestehende Komponenten mit neuen Layout-Regeln an.

---

## 13. Sprint 2B-Entscheidung

| Frage | Antwort |
|-------|---------|
| Saved als erster Screen? | **Ja, weiterhin empfohlen** — isoliert, klare View Models, Phase 2F Preview vorhanden |
| Saved vorher neuer Light-Master? | **Optional P1** — Saved Light Master vor Migration sinnvoll, aber nicht blockierend |
| Theme-Anpassungen vor Saved? | **Nein** — dokumentierte Regeln reichen; Token-Tuning parallel möglich |
| Home zuerst als Referenz? | **Visuell ja** — 2A.5 Home Master ist jetzt Referenz; produktive Home-Migration kann nach Saved folgen |

### Empfohlener nächster Schritt

**Sprint 2B: Saved-Screen migrieren** auf `EventListItem` / `EventCard` mit Light-Regeln aus diesem Dokument. Home produktiv als Sprint 2B.2 oder 2C nach Saved.

---

## 14. Referenz-Implementierung

| Datei | Zweck |
|-------|-------|
| `Phase2A5VisualDirectionPreview.tsx` | Preview-Sektion |
| `HomePreviewChrome.tsx` | Preview-only Header, Nav, Section Header |
| `home-visual-direction-fixtures.ts` | Köln/Berlin Fixtures |
| `home-master-layout.ts` | Responsive Layout Resolver |

QA-Frames: Mobile 390px Light/Dark, Desktop 1280px Light. Zusätzlich manuell prüfen: 360, 430, 768, 1024, 1440px.

---

## Verwandte Dokumente

| Dokument | Rolle |
|----------|-------|
| `ER_CONSUMER_VISUAL_POLISH.md` | Non-breaking Verfeinerungsregeln bei Consumer-Migrationen |
| `ER_DO_AND_DONT.md` | Schnelle Do/Don't-Referenz |
| `ER_UI_REVIEW_CHECKLIST.md` | Review vor Merge |
