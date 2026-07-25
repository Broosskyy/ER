# ER Visual Language

**Status:** Kanonisch · Sprint 1 Design DNA  
**Zweck:** Beschreibt *wie* Eternal Rave aussieht und sich anfühlt — unabhängig von einzelnen Screens.

---

## 1. Markenpersönlichkeit

Eternal Rave ist:

| Eigenschaft | Bedeutung in UI |
|-------------|-----------------|
| **Premium** | Hochwertige Materialität, keine Billig-UI, keine Template-Optik |
| **Modern** | 2026 — nicht 2020 Dark-Dashboard-Ästhetik |
| **Minimal** | Nur was nötig ist; Reduktion als Qualitätsmerkmal |
| **Emotional** | Durch Events, Flyer, Artists — nicht durch Effekte |
| **Community-first** | Menschen und Szene sichtbar; Social Proof natürlich |
| **Accessible** | Lesbar, großzügig, inklusiv |
| **Fast** | 60fps, sofortiges Feedback, keine schweren Oberflächen |

Eternal Rave ist **nicht:**

- Enterprise Software
- Admin Dashboard (klassisch)
- Gaming UI
- Cyberpunk Interface
- Material UI Template
- Neon-Rave-Ästhetik

---

## 2. Visuelle DNA (aus Mockups + Evolution V2)

### 2.1 Was die Mockups richtig machen (behalten)

- **Dunkle Premium-Basis** als Markenanker (Dark Mode)
- **Violett (#7C3AED)** als zurückhaltender Akzent — nicht als Flächenfarbe
- **Card-basierte Event-Darstellung** mit Flyer im Zentrum
- **Bottom Navigation** als Consumer-Anker (5 Tabs)
- **Klare Typografie-Hierarchie** (Screen Title → Section → Card → Meta)
- **Filter-Chips** als schnelle Exploration
- **Skeleton Loading** statt leerer Flächen
- **Flat Premium UI** — dezente Borders, sparsame Schatten

### 2.2 Was Evolution V2 bewusst verändert (siehe Detail in ER_DESIGN_EVOLUTION_V2.md)

- Weniger sichtbare Container
- Weniger Borders und Panel-Rahmen
- Mehr Weißraum zwischen Sektionen
- Light Mode als eigenständiges System
- Admin ohne Enterprise-Panel-Ästhetik
- Keine verschachtelten Boxen (Box-in-Box)
- Kompaktere, rhythmischere Action Rows statt Button-Stapel

---

## 3. Referenzqualitäten (nicht kopieren)

Von diesen Produkten übernehmen wir **Eigenschaften**, nicht Layouts:

| Referenz | Was wir extrahieren |
|----------|---------------------|
| **Instagram** | Content dominiert; UI verschwindet; rhythmische Feeds; klare Hierarchie |
| **Apple** | Ruhe, Präzision, Typografie, großzügige Abstände, subtile Tiefe |
| **Airbnb** | Vertrauen durch Klarheit; Cards mit echtem Inhalt; warme Light-UI |
| **Spotify** | Dunkle Ruhe ohne Schwere; Cover-Art als Held; minimale Chrome |
| **Notion** | Admin-Qualität ohne Enterprise-Look; klare Informationsarchitektur |
| **Linear** | Präzision, Geschwindigkeit, reduzierte Admin-Ästhetik |
| **Arc Browser** | Modernität, Fokus, bewusste Reduktion |

---

## 4. Visuelle Metaphern

### Consumer App = „Der Club-Flyer in deiner Tasche"

- Der Flyer ist der Held.
- Meta-Informationen sind leise.
- Navigation ist unsichtbar, bis man sie braucht.

### Admin = „Creator Studio, nicht Backoffice"

- Wie Instagram Creator Tools oder Notion — nicht wie SAP.
- Gleiche Typografie, gleiche Farben, gleiche Ruhe.
- Mehr Information, aber gleiche Leichtigkeit.

### Light Mode = „Sonntagmittag auf der Terrasse"

- Warm, einladend, nicht klinisch weiß.
- `#FAFAF8` Hintergrund (Design System v3) — nicht `#FFFFFF` pur.

### Dark Mode = „Club nach Mitternacht — nicht im Keller"

- Tiefe, nicht Dunkelheit.
- Flächen differenzieren sich subtil.
- Kontrast reduziert; Text nie grell.

---

## 5. Bildsprache

| Element | Regel |
|---------|-------|
| **Event-Flyer** | Immer sichtbar; 16:9 Hero, 4:3 List Thumbnail |
| **Artist-Fotos** | Rund oder weich gerundet; nie harte Clips |
| **Venue/Map** | Funktional, nicht dekorativ |
| **Placeholder** | Gradient oder dezente Surface — nie leeres Schwarz |
| **Avatare** | Community-Mensch im Fokus |

Keine Stock-Foto-Ästhetik. Keine generischen Illustrationen als Ersatz für echten Content.

---

## 6. Iconografie

**Quelle (Ist):** Ionicons via Expo Vector Icons  
**Richtung (Soll):** Konsistente Größenstufen, outline-first, keine gemischten Stile

| Kontext | Größe |
|---------|-------|
| Bottom Nav | 24px |
| Header Actions | 22–24px |
| Inline Meta | 14–16px |
| In Chips | 12–14px |

Icons erklären — sie dekorieren nicht.

---

## 7. Tiefe und Materialität

### Evolution V2: Flacher, luftiger

| Mockup-Ära (2024) | Eternal Rave 2026 |
|-------------------|-------------------|
| Sichtbare Card-Borders überall | Border nur wo Trennung nötig |
| surfaceElevated für jede Gruppe | Elevation durch Abstand |
| Schatten auf jeder Card | Schatten nur bei Sheets/Modals |
| Panel-in-Panel (Admin) | Flache Sektionen mit Spacing |

**Regel:** Tiefe entsteht durch **Spacing und Typografie**, nicht durch Container-Stapelung.

---

## 8. Stimme der Oberfläche

UI-Text ist:

- klar
- kurz
- menschlich
- nicht technisch (außer Admin-Fachbegriffe wo nötig)

Keine Enterprise-Sprache („Entity“, „Record“, „Configuration Framework“) in Consumer-UI.  
Admin darf präzise sein — aber nicht kalt.

---

## 9. Einzigartigkeit Eternal Rave

Was Eternal Rave visuell von generischen Event-Apps unterscheidet:

1. **Szene-Authentizität** — elektronische Musik ist kein Afterthought; Genre, Club-Kultur, Nachtleben sind designt
2. **Premium ohne Arroganz** — hochwertig, aber einladend (Light Mode warm)
3. **Content-First in einer Nische** — Flyer-Kultur der Rave-Szene als zentrales UI-Element
4. **Ein System für Consumer und Admin** — keine zwei Welten
5. **Bewusste Reduktion** — weniger UI als Wettbewerber, mehr Emotion durch Inhalt
6. **Dual-Theme-Qualität** — Light und Dark gleichwertig designed, nicht abgeleitet

---

## 10. Verwandte Dokumente

- `ER_COLOR_AND_THEME.md` — Farbwelten
- `ER_TYPOGRAPHY.md` — Schrift-Hierarchie
- `ER_LAYOUT_SYSTEM.md` — Raum und Rhythmus
- `ER_DESIGN_EVOLUTION_V2.md` — Mockup → 2026
