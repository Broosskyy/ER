# ER Layout System

**Status:** Kanonisch · Sprint 1 Design DNA  
**Quelle:** Mockup 64 (Spacing Grid), app-v2 Tokens, Design System v3, Evolution V2  
**Zweck:** Strukturelles Raster, Abstände, Breakpoints und Layout-Regeln.

---

## 1. Grundprinzip

Layout ist **Rhythmus**, nicht Rasterfolter.

- 8pt-Basis mit 4pt-Halbschritten
- Konsistenz über Screens hinweg
- Whitespace als aktives Gestaltungsmittel
- Evolution V2: **mehr** Abstand zwischen Sektionen, **weniger** sichtbare Container

---

## 2. Spacing-Skala

| Token | Wert | Verwendung |
|-------|------|------------|
| `xs` | 4px | Mikro-Abstände (Icon-Text, Badge-Padding) |
| `sm` | 8px | Inline-Gaps, Chip-Abstände, Section-Title-Gap |
| `md` | 12px | List-Item-Gap, Card-Content-Gap |
| `lg` | 16px | Screen-Padding, Card-Padding, Section-Gap (Basis) |
| `xl` | 20px | Größere Sektionsabstände |
| `xxl` | 24px | Hero-Abstände, große Trennungen |
| `screen` | 16px | Horizontaler Screen-Rand (Standard) |

### Evolution V2 Erweiterungen (empfohlen)

| Token | Wert | Verwendung |
|-------|------|------------|
| `sectionGap` | **32px** | Zwischen Hauptsektionen (statt 24px) |
| `sectionGapLoose` | **40px** | Home, Event Detail zwischen Blöcken |
| `adminSectionGap` | **24px** | Admin-Sektionen (kompakter als Consumer) |

**Regel:** Nur Werte aus der Skala — keine `margin: 13px` oder `padding: 18px`.

---

## 3. Semantische Spacing-Rollen

| Rolle | Token | Wert | Kontext |
|-------|-------|------|---------|
| `screenHorizontal` | `screen` | 16px | Links/rechts auf allen Screens |
| `sectionGap` | `lg` → `xl` (V2) | 16–32px | Zwischen Sektionen |
| `sectionTitleGap` | `sm` | 8px | Titel → Content |
| `listItemGap` | `md` | 12px | Zwischen Listenzeilen |
| `cardPadding` | `lg` | 16px | Innenabstand Cards |
| `cardContentGap` | `sm` | 8px | Vertikaler Stack in Cards |
| `chipGap` | `sm` | 8px | Filter-Chips horizontal |
| `inlineGap` | `sm` | 8px | Icon + Label |
| `headerActionGap` | `sm` | 8px | Header-Icons |
| `listBottomInset` | `md` | 12px | Scroll-Padding über Bottom Nav |

---

## 4. Screen-Layout-Anatomie

### 4.1 Consumer Screen

```
┌─ SafeArea Top ─────────────────────┐
│ Header Zone          56px + safe   │
│   paddingH: screenHorizontal       │
├────────────────────────────────────┤
│ Scroll Content                     │
│   paddingH: screenHorizontal       │
│   paddingTop: md–lg                │
│   sectionGap zwischen Blöcken      │
│   paddingBottom: bottomNav + inset │
├────────────────────────────────────┤
│ Bottom Nav           64px + safe   │
└────────────────────────────────────┘
```

### 4.2 Admin Screen (Web)

```
┌─ Sidebar ─┬─ Content Area ──────────┐
│  260px    │  flex: 1                │
│  fixed    │  padding: lg–xl         │
│           │  max-width: optional    │
│           │  ScrollView (ein Container) │
└───────────┴─────────────────────────┘
```

**Kritische Regel (aus Implementierungserfahrung):**

- **Ein Scroll-Container pro Screen** — nicht Header fix + FlatList
- Flex-Children brauchen `minHeight: 0` für korrektes Scrollen (Web)
- Admin Mobile: ScrollView statt verschachtelter Listen

---

## 5. Grid & Spalten

### Mobile (Standard)

- **1 Spalte** — volle Breite minus `screenHorizontal`
- Horizontale Carousels: Peek des nächsten Items (optional 8px)

### Tablet (≥768px)

- Content max-width: 480–640px (Consumer zentriert)
- Admin: Sidebar + Content nebeneinander

### Desktop (≥1024px)

- Admin Sidebar: 260px
- Content: flex 1, Padding `xl` (20px) oder `xxl` (24px)
- Modals: max 560px zentriert
- Consumer Web: max 480px Content (Mobile-First-Erbe)

---

## 6. Touch Targets & Interaktionsflächen

| Element | Mindestgröße | Quelle |
|---------|--------------|--------|
| Buttons | 44×44px | iOS HIG, WCAG |
| Icon Buttons | 44×44px | Via HitSlop wenn visuell kleiner |
| List Rows | 48–56px Höhe | Komfortables Tippen |
| Chips | 32px Höhe, 44px Touch via Padding | Filter |
| Bottom Nav Items | 64px Zone | Tab Bar |

---

## 7. Feste Layout-Konstanten

| Konstante | Wert | Verwendung |
|-----------|------|------------|
| `bottomNavHeight` | 64px | Tab Bar |
| `minTouchTarget` | 44px | Alle interaktiven Elemente |
| `maxContentWidth` | 480px | Consumer Web Begrenzung |
| `screenPadding` | 16px | Horizontal |
| Header Höhe | ~56px | + Safe Area |
| Admin Sidebar | 260px | Desktop |

---

## 8. Sektions-Trennung (Evolution V2)

**Bevorzugt (in dieser Reihenfolge):**

1. **Spacing** — `sectionGap` (32px)
2. **Typografie** — Section Title als visueller Anker
3. **Hairline Divider** — nur wenn semantisch nötig (z.B. Settings)
4. **Surface-Wechsel** — Background → Surface (selten)
5. **Card** — nur wenn Inhalt logisch gruppiert

**Vermeiden:**

- Border um jede Sektion
- Card um jede Sektion
- Box-in-Box (SurfaceCard in SurfaceCard)

---

## 9. Scroll-Verhalten

| Kontext | Pattern |
|---------|---------|
| Consumer Feed | ScrollView oder FlatList mit `contentContainerStyle` Padding |
| Admin Listen | **ScrollView** mit gemappten Rows (Mobile Web Fix) |
| Horizontal Carousels | Nested ScrollView horizontal, `showsHorizontalScrollIndicator: false` |
| Sticky CTA | Nur Event Detail — ein Primary Button, nicht mehrere fixierte Bars |
| Pull to Refresh | Consumer Listen — dezent |

---

## 10. Safe Areas

- Immer `SafeAreaContainer` oder `useSafeAreaInsets`
- Bottom Nav respektiert `safeArea.bottom`
- Modals/Sheets: Padding unten für Home Indicator
- Web: `100vh` mit `overflow: hidden` auf Root, Scroll in Content

---

## 11. Bildverhältnisse (Content Layout)

| Kontext | Ratio | Verwendung |
|---------|-------|------------|
| Event Thumbnail (Liste) | 4:3 | Links in Row |
| Event Hero (Detail) | 16:9 | Full width |
| Featured Card | 16:9 | Home Hero |
| Avatar | 1:1 | Profile, Organizer |
| Map Preview | 16:9 oder 2:1 | Event Detail |

**Regel:** Bilder bestimmen die visuelle Hierarchie — UI passt sich an.

---

## 12. Admin Layout-Regeln

| Regel | Detail |
|-------|--------|
| Kein Dashboard-Grid aus Stat-Cards | Inline Metrics |
| Formulare: Label über Input | Nicht nebeneinander auf Mobile |
| Actions am Ende der ScrollView | Nicht fixiert über Content |
| Sektions-Trenner | `borderTop` + `paddingTop: xl` — sparsam |
| Mobile Endpoint Cards | Kompakt, max 2 Preview + Expand |

---

## 13. Anti-Patterns

| ❌ Vermeiden | ✅ Stattdessen |
|-------------|---------------|
| `margin: 13px` | Token aus Skala |
| Header + FlatList (Admin Mobile) | Single ScrollView |
| 3+ verschachtelte flex:1 | Klare Scroll-Hierarchie |
| Volle Breite ohne screenHorizontal | Konsistentes Padding |
| Fixierte Button-Bar + Scroll | Actions im Flow oder ein Sticky CTA |

---

## 14. Verwandte Dokumente

- `ER_SCREEN_PATTERNS.md` — Screen-Gerüste
- `ER_COMPONENT_LIBRARY.md` — Komponenten-Abmessungen
- `ER_VISUAL_LANGUAGE.md` — Whitespace-Philosophie
- `ER_DO_AND_DONT.md` — Layout-Verbote
