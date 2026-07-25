# ER Screen Patterns

**Status:** Kanonisch · Sprint 1 Design DNA  
**Quelle:** 79 UI-Mockups (ZIP 01–79), MOCKUP-SCREENS.md, Mockup Index  
**Zweck:** Wiederkehrende Screen-Strukturen und Layout-Muster — nicht pixelgenaue Spezifikation.

---

## 1. Screen-Taxonomie

| Kategorie | Mockups | Route-Muster |
|-----------|---------|--------------|
| **Onboarding & Auth** | 01–08 | Splash, Onboarding, Login, Register |
| **Consumer Tabs** | 09–15 | `/(tabs)/*` |
| **Tickets & Settings** | 16–19 | Wallet, Notifications, Settings |
| **Organizer** | 20–40, 49–50 | `/organizer/*` |
| **User Submissions** | 22–24 | `/my-submissions`, Success |
| **Admin** | 41–48 | `/admin/*` |
| **Support** | 51 | Help |
| **UI Library** | 52–61 | Komponenten-Referenz |
| **Design System** | 62–69 | Token-Referenz |
| **Motion** | 70–79 | Animations-Referenz |

---

## 2. Universelles Screen-Gerüst (Consumer)

```
┌─────────────────────────────────┐
│ Safe Area Top                   │
├─────────────────────────────────┤
│ Header Zone (optional)          │
│  · Location / Title             │
│  · 0–2 Icon Actions             │
├─────────────────────────────────┤
│ Primary Content (scroll)        │
│  · Sections mit sectionGap      │
│  · Content-first                │
├─────────────────────────────────┤
│ Bottom Nav (64px)               │
│ Safe Area Bottom                │
└─────────────────────────────────┘
```

**Evolution V2 Änderungen:**

- Header oft transparent auf Hero-Screens (Home Featured)
- Weniger sichtbare Header-Borders
- Scroll-Content mit `screenHorizontal` (16px) — konstant
- Bottom Nav: Surface-Hintergrund, keine harte Trennlinie (optional hairline)

---

## 3. Consumer Screen Patterns

### 3.1 Home (Mockup 09)

**Zweck:** Herz der App — „Was passiert in meiner Nähe?"

**Sektionen (Reihenfolge):**

1. Location + Notification
2. Search Bar
3. Quick Filter Chips (horizontal scroll)
4. Featured Hero Event (16:9)
5. „Raves in deiner Nähe" / Nearby
6. Tonight (horizontal)
7. Trending (horizontal)
8. Popular Organizers

**Evolution V2:**

- Mehr Abstand zwischen Sektionen (`sectionGap` 32px statt 24px)
- Section Titles leiser (semibold, nicht bold-heavy)
- Featured Card: weniger Padding um Flyer, mehr um Meta
- Nie leer: Skeleton oder Fallback-Content

### 3.2 Events / Search (Mockup 10, 13)

**Zweck:** Durchsuchbare Event-Liste

**Struktur:**

- Search + Filter Row
- Result Count („145 Events gefunden")
- Vertical List (Thumbnail 4:3 links, Meta rechts)

**Evolution V2:**

- Filter als Bottom Sheet statt inline-Überladung (Mobile)
- List Rows: mehr vertikaler Abstand, klarere Trennung ohne Border
- Result Count als leises Meta-Label

### 3.3 Map (Mockup 12)

**Zweck:** Räumliche Discovery

**Struktur:**

- Full-screen Map (dunkel, Mapbox-Stil)
- Purple Cluster Pins
- User Location Dot
- Bottom Sheet Preview bei Pin-Tap

**Evolution V2:**

- Sheet: großzügiger Radius oben, kein schwerer Shadow
- Preview Card im Sheet: nur Event-Essentials

### 3.4 Event Detail (Mockup 11)

**Zweck:** Conversion — Ticket, Save, Share

**Struktur:**

- Hero Flyer (16:9, full width)
- Title, Date, Time
- Venue + Address
- Line-up
- Organizer + Verified Badge
- Primary CTA: „Tickets sichern"
- Map Preview
- Similar Events (horizontal)

**Evolution V2:**

- Hero ohne übermäßiges Gradient-Overlay
- CTA sticky bottom optional — aber nur eine Primary Action
- Share/Favorite als Icon Actions im Header — nicht als Buttons
- Sections durch Spacing getrennt, nicht durch Cards

### 3.5 Saved (Mockup 14)

**Zweck:** Persönliche Kuratierung

- List oder Grid von favorisierten Events
- Empty State zentral, einladend

### 3.6 Profile (Mockup 15)

**Zweck:** Identität und Einstieg

- Avatar, Name, Stats Row (Favorites · Submissions · Visited)
- Menu Links (Settings, Support)

**Evolution V2:**

- Stats als leichte Zahlen-Row, nicht als schwere Stat-Cards
- Menu: List-Style wie iOS Settings — nicht Card-Grid

---

## 4. Auth & Onboarding (01–08)

### Onboarding (03–06)

- Full-screen Illustration oder Foto
- Kurzer Titel + 1–2 Sätze
- Progress Dots
- Primary CTA unten

**Evolution V2:** Weniger Text, mehr Bild. Ein Gedanke pro Screen.

### Login / Register (07–08)

- Logo oder Wortmarke oben
- Formular minimal (Email, Password)
- Primary CTA
- Secondary Link (Register / Forgot)

**Evolution V2:** Formular ohne Card-Wrapper — direkt auf Background.

---

## 5. Organizer Patterns (20–40)

### Dashboard (20)

- Stats Row (kompakt)
- Create Event CTA (prominent)
- Sections: Drafts, Pending, Published

### Create/Edit Event (21–30)

**Mockup:** 5-Step Wizard  
**Evolution V2:** Wizard beibehalten, aber:

- Jeder Step: eine Frage, eine Fokusfläche
- Progress Indicator dezent
- Keine Form-in-Card-in-Card

---

## 6. Admin Patterns (41–48)

### Admin Dashboard (41)

**Mockup-Ist:** Stat Cards + Quick Action Links

**Evolution V2:**

```
┌─────────────────────────────────┐
│ Page Title (kein „Admin" Banner) │
├─────────────────────────────────┤
│ Key Metrics (inline, nicht Cards)│
├─────────────────────────────────┤
│ Navigation List / Sidebar        │
│  · Events                        │
│  · Sources                       │
│  · Imports                       │
├─────────────────────────────────┤
│ Content Area (scroll)            │
└─────────────────────────────────┘
```

**Regeln:**

- Gleiche Typografie wie Consumer
- Light Mode als Admin-Standard (Design Evolution V2)
- Sidebar auf Desktop; Drawer auf Mobile
- Keine `summaryCard`-Kaskaden (Box-in-Box)
- Sektionen durch `border-top` + `spacing.xl` getrennt — sparsam

### List Screens (Sources, Events, Jobs)

**Evolution V2 Pattern:**

- Header + Search/Filter (fix oder im Scroll)
- **Ein** Scroll-Container (ScrollView) — nicht Header + FlatList
- List Items: kompakte Rows, nicht schwere Cards
- Actions: Icon oder kompakte Row — nicht 3 volle Buttons

### Detail / Editor Screens

- ScrollView mit allen Sektionen
- Sektions-Trennung: Spacing + optional hairline
- Source Actions am Ende: klar abgetrennt
- Formulare: Labels über Inputs, großzügiger vertical rhythm

### Review Queue (42–43)

- List mit Status-Badge
- Swipe oder kompakte Actions (Approve / Reject)
- Duplicate Warning als Inline-Banner — nicht Modal-Kaskade

---

## 7. Zustands-Patterns (alle Screens)

| Zustand | Pattern |
|---------|---------|
| **Loading** | Skeleton (pulsing), nie Spinner allein auf Full Screen |
| **Empty** | Illustration optional + Titel + Beschreibung + eine CTA |
| **Error** | Inline Banner + Retry — nicht Modal |
| **Success** | Kurzes Feedback (Toast/Haptic) — nicht Full-Screen Celebration |
| **Offline** | Dezenter Banner oben |

---

## 8. Dialog- und Sheet-Patterns

| Typ | Wann | Evolution V2 |
|-----|------|--------------|
| **Bottom Sheet** | Filter, Add/Edit (Mobile) | Opaker Hintergrund, 92% max height, Actions unten fix |
| **Modal (Desktop)** | Formulare, Confirm | Zentriert, max 560px, nicht fullscreen |
| **Alert** | Destruktive Bestätigung | Kurz, zwei Buttons, klar |
| **Toast** | Erfolg/Fehler transient | Unten, auto-dismiss |

**Regel:** Nie zwei Modals gleichzeitig. Nie Modal über Modal.

---

## 9. Responsive Verhalten

| Breakpoint | Verhalten |
|------------|-----------|
| Mobile (<768) | Single column, Bottom Nav, Sheets |
| Tablet (768–1023) | Mehr Spalten in Grids, Sidebar optional |
| Desktop (≥1024) | Sidebar (Admin), max Content Width, kein Bottom Nav |

**Admin Web:** Desktop Sidebar + Content; Mobile Top Bar + Drawer.

---

## 10. Mockup-Abdeckung (Referenz)

| Status | Anzahl | Hinweis |
|--------|--------|---------|
| ✅ Nah am Mockup | ~18 | Consumer Kern + Admin Kern |
| 🟡 Teilweise | ~28 | Layout OK, Details fehlen |
| 🔴 Nicht implementiert | ~33 | Tickets, Analytics, V3+ |

Priorität MVP: Kategorien B (Consumer) + F (Admin Kern).

---

## 11. Verwandte Dokumente

- `ER_LAYOUT_SYSTEM.md` — Spacing, Grid
- `ER_COMPONENT_LIBRARY.md` — Bausteine
- `ER_DESIGN_EVOLUTION_V2.md` — Verbesserungen
- `ER_UI_REVIEW_CHECKLIST.md` — Screen-Prüfung
