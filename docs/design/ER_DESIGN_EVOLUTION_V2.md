# ER Design Evolution V2

**Status:** Kanonisch · Sprint 1 Design DNA  
**Zweck:** Dokumentiert bewusste Weiterentwicklung der 79 Mockups für Eternal Rave 2026.  
**Prinzip:** Nicht weil die Mockups schlecht sind — sondern weil Eternal Rave heute leichter, ruhiger, moderner und hochwertiger wirken soll.

---

## 1. Evolution-Philosophie

```
Mockups analysieren
       ↓
DNA verstehen (was funktioniert)
       ↓
Für 2026 optimieren (was sich verbessern lässt)
       ↓
Design Knowledge Base (diese Dokumente)
```

Die Mockups bleiben die **wichtigste historische Referenz**. Evolution V2 definiert, was sich bewusst ändert — mit Begründung.

---

## 2. Gesamtverschiebung: 2024 → 2026

| Dimension | Mockup-Ist (2024) | Evolution V2 (2026) |
|-----------|-------------------|---------------------|
| **Gewicht** | Dunkle Cards mit Borders | Leichte Flächen, Spacing statt Rahmen |
| **Light Mode** | Nicht spezifiziert | Gleichwertig, warm, primäre Referenz |
| **Admin** | Stat-Card Dashboard | Inline Metrics, Consumer-Sprache |
| **Cards** | Default-Container überall | Nur wo Inhalt gruppiert wird |
| **Typografie** | Teilweise bold-heavy | Semibold-Sections, bold nur Screen Titles |
| **Motion** | AnimatedCard, Elevation | Statisch + subtile Press States |
| **Whitespace** | 24px Section Gap | 32px Section Gap |
| **Kontrast** | Hart (#0B0B0F / #F5F5F5) | Weicher (#111214 / #F5F5F5) |
| **Emotion** | UI + Content | Nur Content |

---

## 3. Screen-für-Screen Evolution

### 3.1 Home (Mockup 09)

| Element | Mockup | Evolution V2 | Begründung |
|---------|--------|--------------|------------|
| Section Gap | ~24px | 32px | Mehr Atemraum zwischen Sektionen |
| Section Titles | Bold | Semibold | Leiser, Content dominiert |
| Featured Card | Card mit Border | Flyer-Held, minimaler Rahmen | Content First |
| Filter Chips | Surface + Border | Unverändert (funktioniert) | ✅ Behalten |
| Quick Filters | Horizontal Scroll | Unverändert | ✅ Behalten |
| Bottom Nav | Surface + Border Top | Surface, optional hairline | Weniger Trennung |

### 3.2 Events / Search (Mockup 10, 13)

| Element | Mockup | Evolution V2 | Begründung |
|---------|--------|--------------|------------|
| List Rows | Card mit Border | Row mit Spacing, kein Card-Rahmen | Leichter |
| Result Count | Bold | Metadata-Style | Leise Information |
| Filter UI | Inline | Bottom Sheet (Mobile) | Weniger Überladung |
| Thumbnail | 4:3 in Card | 4:3 freistehend | Flyer dominiert |

### 3.3 Event Detail (Mockup 11)

| Element | Mockup | Evolution V2 | Begründung |
|---------|--------|--------------|------------|
| Hero Gradient | Starkes Overlay | Leichter oder kein Gradient | Flyer soll leuchten |
| CTA | Button im Flow | Optional sticky — aber nur einer | Eine Primary Action |
| Share/Favorite | Buttons | Icon Actions im Header | Weniger visuelles Gewicht |
| Sections | Cards | Spacing + Typography | Keine Box-in-Box |
| Line-up | Card-Liste | Einfache Rows | Leichter |
| Map Preview | Card | Eingebettet, kein Card-Wrapper | Reduktion |

### 3.4 Map (Mockup 12)

| Element | Mockup | Evolution V2 | Begründung |
|---------|--------|--------------|------------|
| Bottom Sheet | Schwerer Shadow | Leichter Radius, weniger Shadow | Premium, nicht Gaming |
| Cluster Pins | Purple | Unverändert | ✅ Markenfarbe |
| Sheet Preview | Card im Sheet | Minimale Info | Content First |

### 3.5 Profile (Mockup 15)

| Element | Mockup | Evolution V2 | Begründung |
|---------|--------|--------------|------------|
| Stats | Stat-Cards | Inline-Zahlen-Row | Keine Boxen für Zahlen |
| Menu | Card-Grid | iOS Settings List-Style | Bewährtes Pattern |
| Avatar | Circle | Unverändert | ✅ Behalten |

### 3.6 Auth (Mockup 07–08)

| Element | Mockup | Evolution V2 | Begründung |
|---------|--------|--------------|------------|
| Form | In Card | Direkt auf Background | Weniger Container |
| Logo | Zentriert | Unverändert | ✅ Behalten |

### 3.7 Onboarding (Mockup 03–06)

| Element | Mockup | Evolution V2 | Begründung |
|---------|--------|--------------|------------|
| Text | 2–3 Sätze | 1 Satz max | Klarheit |
| Illustration | Vollflächig | Unverändert | ✅ Emotional |
| CTA | Full-width Primary | Unverändert | ✅ Eine Action |

---

## 4. Admin Evolution (Mockup 41–48)

### 4.1 Dashboard (Mockup 41)

| Element | Mockup | Evolution V2 | Begründung |
|---------|--------|--------------|------------|
| Stat Cards | 4 Cards im Grid | Inline Metrics: `Events 128 · Pending 12` | Kein Dashboard-Look |
| Quick Actions | Button-Links | Navigation List | Linear/Notion-Stil |
| Header | „Admin Dashboard" | Seitentitel ohne Prefix | Consumer-Sprache |
| Theme | Dark | **Light als Standard** | Discovery, Admin = hell |

### 4.2 Review Queue (Mockup 42–43)

| Element | Mockup | Evolution V2 | Begründung |
|---------|--------|--------------|------------|
| Review Cards | Schwere Cards | Kompakte Rows + Status Badge | Schneller scannbar |
| Actions | 3 volle Buttons | Kompakte Action Row | Hierarchie |
| Duplicate Warning | Modal | Inline Banner | Weniger Unterbrechung |

### 4.3 Sources / Endpoints (Mockup 44–46)

| Element | Mockup | Evolution V2 | Begründung |
|---------|--------|--------------|------------|
| Source List | Cards | Data Rows | Leichter |
| Endpoint Cards | Volle Cards mit allem | Kompakt Mobile: Header+Badge, URL Block, Chips, Actions | Weniger Scroll |
| Endpoint Preview | Alle sichtbar | Max 2 + Expand | Mobile Reduktion |
| Form Modal | Basic | Bottom Sheet Mobile, Modal Desktop | Platform-native |
| Scroll | Header + FlatList | **Single ScrollView** | Web-Fix |

### 4.4 Import Preview (Mockup 47–48)

| Element | Mockup | Evolution V2 | Begründung |
|---------|--------|--------------|------------|
| Preview Cards | Schwere Cards | Kompakte Preview Rows | Schneller Review |
| Confidence | Farbiger Text | Badge + Tooltip | Klarer Status |
| Actions | Button Stack | Primary + Secondary inline | Hierarchie |

---

## 5. Komponenten-Evolution (Mockup 52–61)

| Mockup | Komponente | Evolution V2 |
|--------|------------|--------------|
| 52 Buttons | Primary/Secondary | + IconButton, TextButton; kein Glow |
| 53 Inputs | Basic TextInput | FormField Pattern; kein Card-Wrapper |
| 54 Cards | SurfaceCard default | Nur bei logischer Gruppierung |
| 55 Chips | FilterChip | ✅ Behalten |
| 56 Navigation | BottomNav, Header | Hairline statt Border; Light Nav |
| 57 Empty | EmptyState | ✅ Behalten |
| 58 Dialogs | Basic Modal | Bottom Sheet Standard (Mobile) |
| 59 Sheets | Map Sheet | Generic Sheet Component |
| 60 Skeleton | LoadingSkeleton | ✅ Behalten, Form folgt Content |
| 61 Toasts | — | **Neu implementieren** |

---

## 6. Design System Evolution (Mockup 62–69)

### Colors (62)

| Mockup | Evolution V2 |
|--------|--------------|
| Dark `#0B0B0F` | Ziel: `#111214` (weicher) |
| Kein Light Mode | Vollständiges Light System (`#FAFAF8`) |
| Primary `#7C3AED` | Behalten Dark; Light: `#6D5DF6` Accent |
| Warning fehlt als Token | `#F59E0B` als Token |

### Typography (63)

| Mockup | Evolution V2 |
|--------|--------------|
| System Font | Inter/Geist evaluieren |
| Bold Section Titles | Semibold |
| Uppercase Labels | Normal case |

### Spacing (64)

| Mockup | Evolution V2 |
|--------|--------------|
| 4/8pt Grid | ✅ Behalten |
| sectionGap 24px | sectionGap 32px |
| Konsistenz nicht erzwungen | spacingRoles Pflicht |

### Elevation (65)

| Mockup | Evolution V2 |
|--------|--------------|
| Card Shadows | Light: subtil (0.04–0.08); Dark: minimal |
| Animated Elevation | Entfernen — statische Cards |

---

## 7. Motion Evolution (Mockup 70–79)

| Mockup | Evolution V2 |
|--------|--------------|
| AnimatedCard bounce | Statisch + Press Scale 0.97 |
| Glow Transitions | Color Transition only |
| Page Transitions default | 250ms Slide/Fade |
| Pull to Refresh | Implementieren (dezent) |
| Haptic Feedback | Light impact on Primary CTA |
| Dauerhafte Pulse | Nur Skeleton |

---

## 8. Was bewusst NICHT geändert wird

| Element | Warum behalten |
|---------|----------------|
| Violett `#7C3AED` als Akzent | Markenidentität |
| Bottom Navigation (5 Tabs) | Consumer-Anker, bewährt |
| Card-basierte Event-Darstellung | Flyer im Zentrum funktioniert |
| Filter Chips | Schnelle Exploration |
| Skeleton Loading | Premium-Feel bei Wartezeit |
| 16:9 Featured / 4:3 Thumbnail | Content-Ratios optimal |
| Dark Mode als Option | Emotionale Club-Atmosphäre |
| Flat Premium UI | Kein Skeuomorphismus nötig |

---

## 9. Light Mode als strategische Verschiebung

**Mockups:** Ausschließlich Dark Mode spezifiziert.

**Evolution V2:** Light Mode wird **primäre Referenz** für:

- Discovery (Home, Events, Search)
- Community
- Eventsuche
- Profile
- **Administration**

**Charakter:** hell · ruhig · warm · freundlich · hochwertig

**Nicht:** invertierter Dark Mode, klinisches Weiß, Enterprise-Grau.

---

## 10. Anti-Patterns aus Mockup-Analyse

Diese Muster in den Mockups würden heute **nicht** übernommen:

| Pattern | Wo sichtbar | Warum nicht |
|---------|-------------|-------------|
| Stat-Card Grid | Admin Dashboard | Enterprise-Look |
| Box-in-Box | Admin Forms, Detail Pages | Visual Clutter |
| 3+ volle Buttons | Review, Endpoint Actions | Keine Hierarchie |
| Bold überall | Section Titles | Zu schwer |
| Card um alles | Admin Listen | Unnötige Container |
| Starker Hero Gradient | Event Detail | Verdeckt Flyer |
| ALL CAPS Labels | Filter, Admin | Aggressiv |
| Animated Elevation | Cards | Gaming-Feel |
| Dark-only Denken | Gesamtes System | Light ist gleichwertig |

---

## 11. Priorisierung

| Priorität | Änderung | Impact |
|-----------|----------|--------|
| **P0** | Light Mode System definieren | Strategisch |
| **P0** | Admin Card-Reduktion | Sofort sichtbar |
| **P0** | Single ScrollView (Admin Mobile) | Funktional |
| **P1** | Section Gap 32px | Gesamte App luftiger |
| **P1** | Semibold statt Bold Sections | Leichter |
| **P1** | Toast System | Feedback fehlt |
| **P2** | Inter/Geist Font | Typografie-Upgrade |
| **P2** | Dark Palette weicher | Subtile Verbesserung |
| **P2** | Bottom Sheet Standard | Mobile UX |
| **P3** | Motion System | Polish |

---

## 12. Verwandte Dokumente

- `ER_UI_CONSTITUTION.md` — Gesetz 7: Evolution ist Pflicht
- `ER_VISUAL_LANGUAGE.md` — Visuelle DNA
- `ER_DO_AND_DONT.md` — Konkrete Verbote
- `ER_COLOR_AND_THEME.md` — Light/Dark Tokens
- `ER_SCREEN_PATTERNS.md` — Aktualisierte Patterns
