# Design Guidelines — Eternal Rave V1 (Preliminary)

**Stand:** 17. Juli 2026  
**Status:** Vorläufig — abgeleitet aus Mockups, noch nicht durch Home-Screen-Implementierung validiert  
**Quellen:** `reference/mockups/screens/` (V1-Kernscreens 09–15, UI-Bibliotheken 52–57, Design-System 62–65)  
**Token-Implementierung:** `app-v2/src/design/`

---

## 1. Verbindliche Grundregeln

1. **Mockup als North Star** — Keine Neugestaltung; V1 orientiert sich an den vorhandenen Eternal-Rave-Mockups.
2. **StyleSheet + zentrale Tokens** — Keine hardcodierten Farben, Abstände oder Radien in Screens/Komponenten.
3. **Semantische Tokens** — `colorRoles`, `textRoles`, `spacingRoles` statt screen-spezifischer Namen.
4. **Flat Premium UI** — Dunkle Flächen, dezente Rahmen, sparsame Schatten (sichtbar auf allen V1-Mockups).
5. **Keine Mockup-Bilder als UI-Hintergrund** — Mockups sind Referenz, keine Runtime-Assets.
6. **Nur V1-Kernbereiche** — Keine Tokens für Tickets, Organizer, Admin oder V2-Features.
7. **Unklare Werte markieren** — Als „Review erforderlich" dokumentieren, nicht erfinden.

---

## 2. Farbsystem

### Basis-Farben (bestätigt)

| Rolle | Token | Wert | Mockup-Quelle |
|-------|-------|------|---------------|
| App-Hintergrund | `colors.background` | `#0B0B0F` | MOCKUP-SCREENS.md, 62_Color_System |
| Karten/Flächen | `colors.surface` | `#15151B` | MOCKUP-SCREENS.md |
| Erhöhte Fläche | `colors.surfaceElevated` | `#1F1F27` | theme.ts, 62 (#1F2227) |
| Karten-Hintergrund Map | `colors.mapSurface` | `#12121A` | theme.ts |
| Primär-Akzent | `colors.primary` | `#7C3AED` | MOCKUP-SCREENS.md, 62 (#6935F1) |
| Primär pressed | `colors.primaryHighlight` | `#A855F7` | theme.ts |
| Primär tief | `colors.primaryDeep` | `#4C1D95` | theme.ts |
| Text primär | `colors.textPrimary` | `#F5F5F5` | MOCKUP-SCREENS.md |
| Text sekundär | `colors.textSecondary` | `#9CA3AF` | MOCKUP-SCREENS.md, 62 (#747B81) |
| Rahmen | `colors.border` | `#2A2A35` | theme.ts |
| Live / Favorite aktiv | `colors.live` | `#EF4444` | 14_Saved.jpg (Herz-Icon) |
| Erfolg | `colors.success` | `#22C55E` | theme.ts |
| Warnung | `colors.warning` | `#F59E0B` | theme.ts |

### Semantische Farbrollen (V1)

| Komponente | Rolle | Token |
|------------|-------|-------|
| Bottom Nav Hintergrund | `colorRoles.bottomNavBackground` | `surface` |
| Bottom Nav aktiv | `colorRoles.bottomNavActive` | `primary` |
| Bottom Nav inaktiv | `colorRoles.bottomNavInactive` | `textSecondary` |
| Suchfeld Hintergrund | `colorRoles.searchBackground` | `surface` |
| Chip default | `colorRoles.chipBackground` + `chipBorder` | `surface` + `border` |
| Chip selected | `colorRoles.chipSelectedBackground` | `primary` |
| Event Card | `colorRoles.cardBackground` | `surface` |
| Map-Cluster | `colorRoles.mapCluster` | `primary` |
| Favorite aktiv | `colorRoles.favoriteActive` | `live` |
| Favorite inaktiv | `colorRoles.favoriteInactive` | `textSecondary` |

### Wiederkehrende Farbregeln

- **Hintergrund** durchgängig tiefes Schwarz (`#0B0B0F`) auf Home, Events, Saved, Profile.
- **Karten** heben sich durch `surface` (#15151B) vom Hintergrund ab — sichtbar auf 09, 10, 14.
- **Primär-Lila** für aktive Navigation, CTAs, selected Chips, Map-Cluster.
- **Sekundärgrau** für Metadaten, Placeholder, inaktive Icons.
- **Rahmen** dezent (`#2A2A35`), kein starker Kontrast.

---

## 3. Typografie

### Größenskala (bestätigt aus theme.ts + Mockup-Hierarchie)

| Token | px | Verwendung |
|-------|-----|------------|
| `caption` / `xs` | 10–11 | Nav-Labels |
| `sm` | 12 | Metadaten, Chips, Badges |
| `base` | 14 | Fließtext, Suchfeld |
| `md` | 16 | Kartentitel, Body |
| `lg` | 18 | — |
| `xl` | 20 | Abschnittsüberschriften |
| `xxl` | 24 | Screen-Titel |
| `display` | 30 | Hero-Titel (Event Detail) |

### Semantische Textrollen (V1)

| Rolle | Größe | Gewicht | Farbe | Sichtbar auf |
|-------|-------|---------|-------|--------------|
| `screenTitle` | 24 | bold | textPrimary | 15_Profile |
| `sectionTitle` | 20 | semibold | textPrimary | 09_Home („Raves in deiner Nähe") |
| `cardTitle` | 16 | semibold | textPrimary | 10_Events, Event Cards |
| `cardSubtitle` | 14 | regular | textSecondary | 10_Events (Venue, Datum) |
| `metadata` | 12 | regular | textSecondary | Distanz, Uhrzeit, Genre |
| `button` | 16 | semibold | textOnPrimary | CTAs auf 11_Event_Details |
| `chip` / `chipSelected` | 12 | medium/semibold | secondary/white | 09_Home Filter |
| `navLabel` / `navLabelActive` | 11 | medium/semibold | secondary/primary | 56_Navigation |
| `searchInput` / `searchPlaceholder` | 14 | regular | primary/secondary | 09, 13 |

### Wiederkehrende Typografie-Regeln

- Klare Hierarchie: Screen-Titel > Abschnitt > Kartentitel > Metadaten.
- Buttontexte immer semibold.
- Metadaten und Labels in `textSecondary`.
- Nav-Labels kleiner als Body-Text.

---

## 4. Spacing-System

### Basisskala

| Token | px |
|-------|-----|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 12 |
| `lg` | 16 |
| `xl` | 20 |
| `xxl` | 24 |
| `screen` | 16 |

### Semantische Abstände (V1)

| Rolle | Wert | Regel |
|-------|------|-------|
| `screenHorizontal` | 16px | Seitenrand auf allen V1-Screens |
| `sectionGap` | 24px | Zwischen Hauptsektionen |
| `sectionTitleGap` | 12px | Titel → Inhalt |
| `listItemGap` | 12px | Zwischen Event-Rows |
| `cardPadding` | 16px | Innenabstand Karten |
| `chipGap` | 8px | Zwischen Filter-Chips |
| `inlineGap` | 8px | Icon ↔ Text |

### Wiederkehrende Spacing-Regeln

- Horizontaler Screen-Padding **konstant 16px**.
- Vertikale Sektionsabstände größer als Innenabstände (24 > 16 > 12 > 8).
- Listen kompakter als Hero-Bereiche.

---

## 5. Radien und Schatten

### Radien

| Token | px | V1-Verwendung |
|-------|-----|---------------|
| `sm` | 8 | Badges |
| `md` | 12 | Buttons, Suchfeld, Thumbnails |
| `lg` | 16 | Event Cards, Featured Cards |
| `xl` | 20 | Bottom Sheet (Map) |
| `full` | pill | Chips, Icon Buttons |

**Mockup-Regel:** „~12–16px on cards and buttons" (MOCKUP-SCREENS.md)

### Schatten

| Token | Verwendung |
|-------|------------|
| `shadows.none` | Standard — flache UI |
| `shadows.card` | Dezente Card-Elevation |
| `shadows.elevated` | Bottom Sheet / Map-Overlay |

**Regel:** Schatten sparsam; Rahmen (`border`) trägt die meiste Trennung.

---

## 6. Größen und Touch-Flächen

| Element | Höhe/Breite | Quelle |
|---------|-------------|--------|
| Min. Touch-Fläche | 44px | iOS/Android Standard, 52_Buttons |
| Bottom Navigation | 64px | theme.ts `BOTTOM_NAV_HEIGHT`, 56_Navigation |
| Header Content | 56px | geschätzt aus 09–15 |
| Suchfeld | 44px | Touch-Target, 53_Inputs |
| Chip | 32px | 55_Chips (kompakt) |
| Button | 48px | 52_Buttons |
| Icon Button | 44px | Touch-Target |
| Nav-Icon | 24px | 56_Navigation |
| Header-Icon | 24px | 09_Home (Bell, etc.) |

### Bildverhältnisse

| Element | Ratio | Quelle |
|---------|-------|--------|
| Event List Thumbnail | 4:3 | 10_Events.jpg (~1.33) |
| Featured Hero | 16:9 | 09_Home.jpg (ca. 2.3, auf 16:9 normalisiert) |
| Event Detail Hero | 16:9 | 11_Event_Details.jpg |
| Map Preview | 16:9 | 11_Event_Details.jpg |

---

## 7. V1-Kernkomponenten (Spezifikation, nicht implementiert)

### App Header
- Hintergrund: `background` (transparent auf Hero-Screens)
- Höhe: 56px + Safe Area
- Titel links oder zentriert; Actions rechts (Icon Buttons)
- Sichtbar auf: 09, 10, 14, 15

### Bottom Navigation
- 5 Tabs: Home · Events · Map · Saved · Profile
- Höhe: 64px, Hintergrund `surface`
- Aktiv: `primary` Icon + Label; Inaktiv: `textSecondary`
- Quelle: MOCKUP-SCREENS.md, 56_Navigation

### Suchfeld
- Volle Breite minus Screen-Padding
- Höhe 44px, Radius `md`, Hintergrund `surface`
- Placeholder in `textSecondary`
- Sichtbar auf: 09, 10, 13

### Filter Chips
- Pill-Form (`radius.full`)
- Default: `surface` + `border`; Selected: `primary` Fill
- Horizontal scrollbar auf Home
- Sichtbar auf: 09, 13

### Event Card (Featured)
- Große Flyer-Grafik oben (16:9)
- Titel, Datum, Venue darunter
- Radius `lg`, Padding 16px
- Sichtbar auf: 09_Home

### Event List Row (kompakt)
- Thumbnail links (4:3, ~96px breit)
- Meta rechts: Titel, Venue, Datum, Distanz
- Sichtbar auf: 10_Events

### Buttons
- Primary: volle Breite, `primary` Fill, Radius `md`, Höhe 48px
- Secondary: Outline mit `border`
- Sichtbar auf: 11_Event_Details („Tickets sichern"), 52_Buttons

### Icon Buttons
- 44×44px, `surface` Hintergrund, rund
- Sichtbar auf: Header (Notification), Favorite

### Badges / Tags
- Klein, Radius `sm`, `surfaceElevated` Hintergrund
- Genre-Tags auf Event Cards
- Sichtbar auf: 10, 11, 55_Chips

### Empty States
- Zentriert, `textSecondary` Beschreibung
- Sichtbar auf: 57_Empty_States

### Map Marker / Cluster
- Lila Kreise mit Event-Count (`primary`)
- Sichtbar auf: 12_Map

### Event Detail Header
- Full-width Hero (16:9), Gradient-Overlay unten
- Titel über Hero oder darunter
- Sichtbar auf: 11_Event_Details

---

## 8. Zustände

| Zustand | Regel |
|---------|-------|
| **Normal** | Basis-Tokens |
| **Pressed** | `primaryHighlight` (Buttons), `opacity.pressed` |
| **Selected** | `primary` Fill (Chips, Nav) |
| **Disabled** | `opacity.disabled` (0.5) |
| **Empty** | `textSecondary`, zentriert |
| **Loading** | `skeletonBase` / `skeletonHighlight` — REVIEW |
| **Favorite aktiv** | `live` (#EF4444) |
| **Favorite inaktiv** | `textSecondary` |

---

## 9. Bekannte Unklarheiten

| Thema | Status |
|-------|--------|
| Exakte Font-Familie | Review — Mockup 63 zeigt Sans-Serif, Name unklar |
| Header-Höhe exakt | Review — geschätzt 56px |
| Chip-Höhe exakt | Review — geschätzt 32px |
| Featured Hero Aspect Ratio | Review — Mockup ~2.3, Token 16:9 gesetzt |
| Map User-Location Blau | Review — sichtbar, exakter Hex unklar |
| Overlay/Scrim Opazität | Review — ~72% geschätzt |
| Hero Gradient Stops | Review — Event Detail Fade |
| Bottom Sheet Shadow | Review — elevated Shadow geschätzt |
| Skeleton Loading Farben | Review — noch nicht in V1 Screens sichtbar |
| Pinke Akzentfarbe (#E722C7) | Review — nur in 62_Color_System, nicht in V1 Screens |

---

## 10. Liste: Review erforderlich

| # | Token / Thema | Datei | Grund |
|---|---------------|-------|-------|
| 1 | `fontFamily.primary` | typography.ts | Schriftname nicht aus Mockup lesbar |
| 2 | `componentSize.headerContentHeight` (56) | layout.ts | **Bestätigt** durch Home-Umsetzung |
| 3 | `componentSize.chipHeight` (32) | layout.ts | **Bestätigt** durch Home-Umsetzung |
| 4 | `componentSize.featuredHeroAspectRatio` (16/9) | layout.ts | **Bestätigt** — visuell passend für Featured Cards |
| 5 | `colorRoles.mapUserLocation` (#3B82F6) | colors.ts | Blau sichtbar, Hex unklar |
| 6 | `colorRoles.overlayScrim` | colors.ts | Opazität geschätzt |
| 7 | `colorRoles.imageOverlayGradientEnd` | colors.ts | Gradient nicht exakt messbar |
| 8 | `shadows.elevated` | shadows.ts | Bottom Sheet Schatten geschätzt |
| 9 | `colorRoles.skeletonBase/Highlight` | colors.ts | Kein Skeleton in V1-Screens |
| 10 | Pinke Palette (#E722C7) | — | Nur Color-System-Mockup, nicht V1 |

---

## Validierung

Dieses vorläufige Designsystem muss durch die **konkrete Home-Screen-Implementierung** (Mockup 09) validiert und bei Abweichungen angepasst werden.
