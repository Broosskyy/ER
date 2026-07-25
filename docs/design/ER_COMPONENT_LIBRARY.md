# ER Component Library

**Status:** Kanonisch · Sprint 1 Design DNA  
**Quelle:** Mockups 52–61 (UI Component Library), app-v2 Implementierung, Design Evolution V2  
**Zweck:** Spezifikation aller UI-Bausteine — bestehend, geplant, verboten.

---

## 1. Prinzipien

1. **Wenige, starke Komponenten** — lieber erweitern als neue erfinden
2. **Token-basiert** — keine hardcodierten Werte in Komponenten
3. **Varianten über Props** — nicht über Copy-Paste
4. **Content-first** — Komponenten rahmen Inhalt, dominieren ihn nicht
5. **Light + Dark** — jede Komponente unterstützt beide Themes

---

## 2. Komponenten-Hierarchie

```
Primitives (Atoms)
  → AppText, Icon, Spacer, Divider
Layout (Structure)
  → AppScreen, SafeAreaContainer, Section, Stack
Inputs
  → TextInput, SearchBar, FormField, ChipSelector
Actions
  → PrimaryButton, SecondaryButton, IconButton, TextButton
Content
  → EventCard, FeaturedEventCard, ArtistRow, VenueRow
Feedback
  → EmptyState, Skeleton, Toast, Banner, Badge
Navigation
  → BottomNav, ScreenHeader, TabBar, Sidebar
Overlay
  → BottomSheet, Modal, Dialog, Tooltip
Admin
  → StatInline, DataRow, FilterBar, ReviewCard
```

---

## 3. Buttons (Mockup 52)

### PrimaryButton

| Eigenschaft | Wert |
|-------------|------|
| Höhe | 48px (Consumer), 44px min (Admin inline) |
| Radius | `radii.md` (12px) |
| Fill | `colors.primary` / Light: `accent` |
| Text | semibold, `textOnPrimary` |
| Breite | Full-width (Consumer CTA) oder auto (Admin) |

**Zustände:** default · pressed (`primaryHighlight`) · disabled (opacity 0.5)  
**Evolution V2:** Kein Glow, kein Gradient auf Standard-CTA

### SecondaryButton

| Eigenschaft | Wert |
|-------------|------|
| Höhe | 44px min |
| Style | Outline (`border`) oder Ghost (kein Border) |
| Verwendung | Sekundäre Aktionen, Filter, Admin Actions |

**Evolution V2:** Admin — kompakte Secondary statt voller Button-Stapel

### IconButton

| Eigenschaft | Wert |
|-------------|------|
| Größe | 44×44px |
| Form | Rund (`radii.full`) oder `radii.md` |
| Verwendung | Header Actions, Favorite, Share, Delete (Admin) |

### TextButton / LinkButton

- Nur Text, kein Border
- Für „Abbrechen", „Mehr anzeigen", „Skip"
- Min Touch Target 44px via HitSlop

### DestructiveButton

- Secondary Style mit `colors.live` Text/Border
- Nie Primary Fill für Destruktives

---

## 4. Inputs (Mockup 53)

### SearchBar

- Höhe 44px, Radius `md`, Background `surface` / Light: `surface`
- Icon links, Placeholder `textSecondary`
- Full width minus screen padding

### FormField

```
Label (metadata style)
Input (minHeight 44)
Helper / Error (metadata, live color)
```

**Evolution V2:**

- Kein Card-Wrapper um Formulargruppen
- Labels immer sichtbar (kein nur-Placeholder)
- Error inline unter Feld — nicht Modal

### Chip / FilterChip (Mockup 55)

| Zustand | Style |
|---------|-------|
| Default | `surface` + `border`, pill |
| Selected | `primary` Fill, white Text |
| Disabled | opacity 0.5 |

Höhe: ~32px. Horizontal scrollbar in Rows.

---

## 5. Cards (Mockup 54)

### Wann Cards — wann nicht

| ✅ Card verwenden | ❌ Keine Card |
|------------------|--------------|
| Event in Liste/Feed | Formular-Sektionen |
| Featured Hero Event | Admin Status-Block |
| Ticket (zukünftig) | Metadaten-Gruppen |
| Organizer Preview | Settings Menu Items |

### EventCard (List Row)

```
┌──────┬─────────────────────┐
│ 4:3  │ Title               │
│ Thumb│ Venue · Date        │
│      │ Distance · Genre    │
└──────┴─────────────────────┘
```

- Radius `lg` (16px) oder **kein Radius** (Evolution V2: Row ohne Card-Rahmen, nur Spacing)
- Padding 12–16px
- Flyer links, Meta rechts

### FeaturedEventCard

- 16:9 Flyer oben
- Title + Date + Venue unten
- Favorite optional overlay

### SurfaceCard (Admin — Evolution V2: reduziert)

**Ist:** Border + Padding + Surface Background  
**Soll:** Nur verwenden wenn logische Gruppe — nicht als Default-Wrapper

**Ersatz:** `Section` mit Title + Content, ohne sichtbare Card

### StatCard → StatInline (Evolution V2)

**Mockup:** Card mit Zahl + Label  
**Evolution V2:** Inline-Zahl + Label ohne Card-Container

```
Events  128    Pending  12    Published  89
```

---

## 6. Navigation (Mockup 56)

### BottomNav (Consumer)

- 5 Tabs: Home · Events · Map · Saved · Profile
- Höhe 64px
- Active: `primary` Icon + Label
- Inactive: `textSecondary`

### ScreenHeader

- Höhe ~56px + Safe Area
- Title links oder zentriert
- 0–2 Actions rechts (IconButton)

**Evolution V2:** Kein sichtbarer Header-Border; Hairline optional

### Admin Sidebar (Desktop)

- 260px breit
- Brand oben
- Nav Items: Icon + Label
- User + Logout unten
- **Evolution V2:** Gleiche Farben wie Consumer Light Theme

---

## 7. Feedback (Mockups 57, 60, 61)

### EmptyState

- Zentriert
- Optional Icon/Illustration
- Title (`sectionTitle`)
- Description (`body`, `textSecondary`)
- Eine CTA

### Skeleton

- `skeletonBase` / `skeletonHighlight` pulse
- Form folgt Content-Layout (nicht generische Boxen)

### Toast / Snackbar (Mockup 61 — fehlt im Code)

- Unten, über Bottom Nav
- 3–4 Sekunden auto-dismiss
- Success / Error / Info Varianten

### Banner (Inline)

- Volle Breite im Content
- Warning / Error / Info
- Dismissible optional

### Badge / StatusBadge

- Pill, klein (`radii.sm`)
- Semantic Colors: success, warning, live
- Text: kurz („Aktiv", „Pending", „Live")

---

## 8. Overlay (Mockups 58, 59)

### BottomSheet

- Radius `xl` oben
- Backdrop Scrim ~72–90% opacity
- Content scrollt, Actions fix unten
- Max Height 92%

### Dialog / Modal

- Desktop: zentriert, max 560px
- Mobile: Bottom Sheet Pattern
- Title + Hint + Content + Actions
- **Nie** transparent oder ghosting (RN Web Fix)

### Confirm Dialog

- Kurze Frage
- Abbrechen (Secondary) + Bestätigen (Primary oder Destructive)

---

## 9. Admin-spezifische Komponenten

### DataRow

- Kompakte Listenzeile
- Title + Meta + Chevron/Action
- Min Height 56px
- Kein Card-Wrapper

### FilterBar

- Search + Chips in einer Zone
- Auf Mobile: in ScrollView, nicht fixed + FlatList

### EndpointCard (Evolution V2 Beispiel)

**Kompakt Mobile:**

```
Name                    [Badge]
Description (max 3 lines)
┌ URL Block ─────────────┐
│ https://...            │
└────────────────────────┘
[HTTP] [Priority]
[Connector — full width]
[Bearbeiten] [🗑] [Test°]
```

### ReviewCard

- Event Title + Venue + Source
- Status Badge
- Actions: Review / Approve / Reject

---

## 10. Komponenten-Inventar: Ist vs. Soll

| Mockup | Komponente | Ist (app-v2) | Evolution V2 |
|--------|------------|--------------|--------------|
| 52 | Buttons | Primary, Secondary | + IconButton, TextButton, Destructive |
| 53 | Inputs | TextInput basic | + FormField, SearchBar unified |
| 54 | Cards | SurfaceCard, EventCard | - SurfaceCard overuse |
| 55 | Chips | FilterChip | ✅ |
| 56 | Navigation | BottomNav, AdminShell | Light theme Admin |
| 57 | Empty | EmptyState | ✅ |
| 58 | Dialogs | Modal basic | Bottom Sheet standard |
| 59 | Sheets | MapBottomSheet | Generic Sheet |
| 60 | Skeleton | LoadingSkeleton | ✅ |
| 61 | Toasts | — | 🔴 Implementieren |

---

## 11. Verbotene Komponenten-Muster

- `Panel` in `Panel` in `Panel`
- Full-width Button-Stapel (>2) ohne Hierarchie
- Card mit Card inside (Box-in-Box)
- Glow-Effekte auf Buttons
- Cyberpunk-Borders (neon, animated)
- Material Design FAB (außer Map)
- Tabellen mit sichtbaren Grid-Lines (Admin)

---

## 12. Verwandte Dokumente

- `ER_LAYOUT_SYSTEM.md`
- `ER_COLOR_AND_THEME.md`
- `ER_TYPOGRAPHY.md`
- `ER_DO_AND_DONT.md`
- `ER_CURSOR_UI_GUIDE.md`
