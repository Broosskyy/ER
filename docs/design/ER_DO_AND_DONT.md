# ER Do & Don't

**Status:** Kanonisch · Sprint 1 Design DNA  
**Zweck:** Konkrete Verbote und Empfehlungen — schnelle Referenz für Design- und Implementierungsentscheidungen.

---

## 1. Content & Hierarchie

### ✅ Do

- Event-Flyer und Artist-Fotos als visuellen Anker nutzen
- Eine primäre Aktion pro Screen definieren
- Meta-Informationen (Datum, Venue, Distance) leise halten
- Empty States mit klarer Botschaft und einer CTA
- Skeleton Loading statt leerer Flächen oder Spinner
- Inhalt vor UI — die Oberfläche tritt zurück

### ❌ Don't

- Dekorative UI-Elemente ohne Informationswert
- Mehrere konkurrierende violette CTAs auf einem Screen
- Stock-Fotos oder generische Illustrationen statt echtem Content
- UI-Dekoration um Emotion zu erzeugen (Glow, Partikel, Neon)
- Leere Screens ohne Fallback oder Skeleton
- Content durch Chrome verdrängen (zu große Header, zu viele Bars)

---

## 2. Layout & Whitespace

### ✅ Do

- 8pt-Spacing-System konsequent nutzen
- Großzügige Abstände zwischen Sektionen (32px in V2)
- Sektionen durch Spacing und Typografie trennen
- Ein Scroll-Container pro Screen (besonders Admin Mobile)
- `screenHorizontal` (16px) auf allen Screens
- Safe Areas respektieren

### ❌ Don't

- Arbitrary Spacing (`margin: 13px`, `padding: 18px`)
- Box-in-Box (Card in Card in Panel)
- Header fix + FlatList (Scroll-Probleme auf Web)
- Jede Sektion in eine sichtbare Card packen
- Borders als primäres Trennmittel
- Zu wenig Abstand — gedrängte Layouts

---

## 3. Cards & Container

### ✅ Do

- Cards nur dort, wo Inhalte logisch gruppiert werden (Event in Feed)
- Event Cards mit Flyer als Held
- Leichte Rows statt schwerer Cards für Listen (Evolution V2)
- Surface-Wechsel sparsam und bewusst

### ❌ Don't

- Default-Card-Wrapper für jeden Content-Block
- Schwere Panels mit dicken Borders
- Verschachtelte SurfaceCards
- Stat-Cards im Admin (→ Inline Metrics)
- Card um Formular-Sektionen
- Sichtbare Container ohne inhaltlichen Grund

---

## 4. Farbe & Theme

### ✅ Do

- Design Tokens für alle Farben
- Light Mode als eigenständiges System designen
- Violett als Akzent — sparsam
- Semantische Farben nur für Status (success, warning, live)
- WCAG AA Kontrast einhalten

### ❌ Don't

- Hardcoded Hex-Werte in Screen-Dateien
- Light Mode als invertierten Dark Mode bauen
- Neon-Farben, Cyberpunk-Ästhetik
- Gradient Buttons (Standard-CTA)
- Violett als Section-Hintergrund
- Reines `#000000` / `#FFFFFF` in Light Mode

---

## 5. Typografie

### ✅ Do

- `AppText` mit semantischen Rollen (`textRoles`)
- Klare Hierarchie: Screen Title → Section → Card → Meta
- System-Font bis Custom Font entschieden
- 2 Text-Farben pro Abschnitt (primary + secondary)

### ❌ Don't

- Inline `fontSize` / `fontWeight` in Screens
- ALL CAPS Section Headers
- Mehr als 3 Gewichte pro Screen
- Unterstrichene UI-Links
- Zentrierter Body-Text
- Verschiedene Font-Familien mischen

---

## 6. Buttons & Actions

### ✅ Do

- Primary Button: eine pro Screen, full-width auf Mobile
- Secondary für alternative Aktionen
- Icon Buttons für Header-Actions (Share, Favorite)
- Destructive Actions klar getrennt und sekundär
- Touch Targets ≥ 44px

### ❌ Don't

- 3+ volle Buttons untereinander ohne Hierarchie
- Glow-Effekte auf Buttons
- Primary Fill für destruktive Aktionen
- Buttons als einzige Interaktion (Swipe, Tap auf Row bevorzugen)
- FAB außerhalb der Map
- Identische visuelle Gewichtung für alle Actions

---

## 7. Admin

### ✅ Do

- Dieselbe Designsprache wie Consumer App
- Light Mode als Admin-Standard (Evolution V2)
- Kompakte Data Rows statt schwerer Cards
- ScrollView mit allen Sektionen (Mobile)
- Linear/Notion-Qualität: klar, schnell, reduziert
- Form Labels über Inputs

### ❌ Don't

- Enterprise Dashboard Ästhetik (SAP, Material Dashboard)
- Stat-Card-Grids als Default
- Admin-spezifische Farbpalette
- Tabellen mit sichtbaren Grid-Lines
- Sidebar mit anderem Font/Spacing als Consumer
- „ADMIN" Banner oder schwere Header-Chrome
- Box-in-Box in Source/Endpoint Sektionen

---

## 8. Motion

### ✅ Do

- 200–300ms Standard-Übergänge
- Skeleton Pulse für Loading
- Bottom Sheet Slide für Filter/Forms (Mobile)
- `prefers-reduced-motion` respektieren
- Haptic Feedback bei Primary CTA (Mobile)

### ❌ Don't

- Dauerhaft animierte Elemente (außer Skeleton)
- Glow, Pulse, Bounce auf idle UI
- Parallax, Partikel, Glitch-Effekte
- Animationen >500ms für UI-Feedback
- Animated Gradients
- Schwere Page-Transitions

---

## 9. Referenz-Produkte

### ✅ Qualitäten extrahieren (nicht kopieren)

| Von | Eigenschaft |
|-----|-------------|
| Instagram | Content dominiert, UI verschwindet |
| Apple | Ruhe, Präzision, Typografie |
| Airbnb | Vertrauen, warme Light UI |
| Spotify | Dunkle Ruhe, Cover als Held |
| Notion | Admin ohne Enterprise-Look |
| Linear | Präzision, Geschwindigkeit |
| Arc | Modernität, Fokus |

### ❌ Nicht kopieren

- Instagram Stories UI für Event-Detail
- Apple Settings 1:1 für Profile
- Material Design Komponenten
- Spotify's grüne Akzentfarbe
- Notion's Sidebar-Struktur 1:1
- Gaming UI Patterns (XP Bars, Achievements)
- Cyberpunk Neon Interfaces

---

## 10. Accessibility

### ✅ Do

- Touch Targets ≥ 44px
- WCAG AA Kontrast
- Labels für alle Formular-Felder
- `accessibilityLabel` auf Icon Buttons
- Reduced Motion Support

### ❌ Don't

- Farbe als einziges Status-Signal
- Text unter 12px für wichtige Informationen
- Interaktive Elemente unter 44px ohne HitSlop
- Placeholder als einziges Label

---

## 11. Die eine Frage

Bei jedem UI-Element:

> **„Macht dieses Element die Seite besser?"**

Falls nein → nicht übernehmen.

---

## 12. Verwandte Dokumente

- `ER_UI_CONSTITUTION.md` — Grundgesetze
- `ER_UI_REVIEW_CHECKLIST.md` — Prüfliste
- `ER_DESIGN_EVOLUTION_V2.md` — Bewusste Verbesserungen
- `ER_CURSOR_UI_GUIDE.md` — KI-Leitfaden
