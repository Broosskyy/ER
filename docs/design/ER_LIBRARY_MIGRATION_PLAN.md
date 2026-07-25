# ER Library Migration Plan

**Status:** Kanonisch · Voraussetzung für alle Screen-Redesigns  
**Gültigkeit:** Ersetzt `app-v2/docs/DESIGN_SYSTEM.md`, `DESIGN_GUIDELINES.md` und alle UI-Annahmen im Code  
**Regel:** Kein Screen-Redesign, bevor Phase 0–3 abgeschlossen und geprüft sind.

---

## 1. Ziel

Eine vollständige React-Native-Designbibliothek unter `app-v2/src/components/`, die die Spezifikation in `docs/design/` exakt widerspiegelt:

- Token-basiert (Light + Dark)
- Theme-aware über `ThemeProvider`
- Wiederverwendbare Primitives statt Feature-Duplikate
- Evolution V2 konform (leichter, luftiger, weniger Cards)
- Testbar und über ein Barrel exportierbar

**Nicht Ziel dieses Plans:** Einzelne Screens visuell überarbeiten. Screens konsumieren erst die fertige Bibliothek.

---

## 2. Ist-Analyse (app-v2)

### 2.1 Token-Schicht (`src/design/`)

| Modul | Status | Abweichung von `docs/design/` |
|-------|--------|-------------------------------|
| `colors.ts` | ✅ Vorhanden | Nur Dark; keine Light-Palette; Dark noch Ist (`#0B0B0F`), nicht Evolution-Ziel (`#111214`) |
| `colorRoles.ts` (in colors) | ✅ Vorhanden | Keine theme-aware Roles |
| `spacing.ts` | ✅ Vorhanden | `sectionGap` noch 16px, Spec V2: 32px |
| `typography.ts` | ✅ Vorhanden | `textRoles` definiert, aber `AppText` nutzt nur `textVariants` |
| `radii.ts` | ✅ Vorhanden | ✅ aligned |
| `shadows.ts` | ✅ Vorhanden | Nur `card`; Light-Shadows fehlen |
| `layout.ts` | ✅ Vorhanden | `bottomNavHeight: 58` — Spec: 64px |
| `theme.ts` | ✅ Aggregator | **Kein ThemeProvider, keine Light/Dark-Auflösung** |

### 2.2 Shared Components (`src/components/` — 14 Exporte)

| Kategorie | Vorhanden | Spec (`ER_COMPONENT_LIBRARY.md`) |
|-----------|-----------|----------------------------------|
| **Primitives** | `AppText` | + `Icon`, `Spacer`, `Divider` fehlen |
| **Layout** | `AppScreen`, `SafeAreaContainer`, `ResponsiveScreen`, `ScreenContent` | + `Section`, `Stack` fehlen |
| **Actions** | `PrimaryButton`, `SecondaryButton`, `IconButton`, `FavoriteButton` | + `TextButton`, `DestructiveButton` fehlen |
| **Cards** | `SurfaceCard`, `InteractiveCard` | `Section` als Card-Ersatz fehlt |
| **Feedback** | `EmptyState`, `ImagePlaceholder` | + `Skeleton`, `Toast`, `Banner`, `Badge` fehlen |
| **Navigation** | `WebTopNav` | + `BottomNav`, `ScreenHeader`, `Sidebar` fehlen |
| **Overlay** | — | + `BottomSheet`, `Modal`, `Dialog`, `ConfirmDialog` fehlen |
| **Inputs** | — | + `SearchBar`, `TextInput`, `FormField`, `Chip` fehlen (nur in Features) |
| **Admin** | — | + `DataRow`, `FilterBar`, `StatInline`, `ReviewCard` fehlen |

### 2.3 Feature-Components (nicht in `src/components/`)

Gut implementiert, aber **falsch platziert** — gehören in die Designbibliothek oder als Domain-Wrapper darüber:

| Komponente | Pfad | Spec-Entsprechung | Bewertung |
|------------|------|-------------------|-----------|
| `FilterChip` | `features/home/components/` | Chip / FilterChip | ✅ Spec-konform, promoten |
| `SearchInput` | `features/search/components/` | SearchBar | ✅ Spec-konform, umbenennen + promoten |
| `FormField` | `features/create/components/` | FormField | ✅ Spec-konform, promoten |
| `SectionHeader` | `features/home/components/` | Section / ScreenHeader partial | ⚠️ generalisieren |
| `HomeHeader`, `SavedHeader`, … | je Feature | ScreenHeader | ⚠️ 5 Duplikate → 1 Primitive |
| `FilterSheet` | `features/search/components/` | BottomSheet | ⚠️ ad-hoc Modal, nicht generisch |
| `LocationPickerModal` | `features/location/components/` | Dialog | ⚠️ ad-hoc |
| `ActivityPanel` | `features/activity/components/` | BottomSheet | ⚠️ ad-hoc |
| `EndpointStatusBadge` | inline in `SourceEndpointsSection` | Badge | 🔴 nicht shared |
| `AdminStates` | `features/admin/components/` | EmptyState Varianten | ⚠️ dupliziert EmptyState |
| `EventCard`, `FeaturedEventCard` | `features/home/components/` | Content Cards | ✅ Domain, bleiben in Features |
| 6× `*EmptyState` | je Feature | EmptyState Varianten | ⚠️ Wrapper OK, Primitive muss stimmen |
| 6× `*LoadingState` | je Feature | Skeleton | 🔴 nutzen ActivityIndicator statt Skeleton |

### 2.4 Architektur-Probleme

| Problem | Auswirkung | Spec-Verstoß |
|---------|------------|--------------|
| Kein `ThemeProvider` | Light Mode unmöglich | Gesetz 6 (Constitution) |
| `AppText` ohne `role` Prop | `textRoles` ungenutzt in Primitive | Typografie-Spec |
| 5 ad-hoc Modal-Implementierungen | Inkonsistente Overlays | ER_COMPONENT_LIBRARY §8 |
| Bottom Nav in Route-Layout | Nicht wiederverwendbar, Map Tab hidden | ER_SCREEN_PATTERNS §3 |
| `ActivityIndicator` in 12 Dateien | Kein Skeleton | ER_MOTION §6, ER_DO_AND_DONT |
| `SurfaceCard` kaum genutzt (3 Dateien) | Gut — aber kein `Section`-Ersatz existiert | Evolution V2 |
| Keine UI-Tests (Render) | Regressionsrisiko | ER_UI_REVIEW_CHECKLIST |
| `theme.ts` ungenutzt | Token-Import chaos (`@/design/colors` direkt) | Wartbarkeit |

---

## 3. Soll-Architektur

```
app-v2/src/
├── design/
│   ├── theme/
│   │   ├── ThemeProvider.tsx      # NEU
│   │   ├── useTheme.ts            # NEU
│   │   ├── dark.ts                # darkColors + darkColorRoles
│   │   ├── light.ts               # lightColors + lightColorRoles
│   │   └── index.ts
│   ├── colors.ts                  # Re-export / deprecated → theme
│   ├── spacing.ts                 # + sectionGapV2: 32
│   ├── typography.ts
│   ├── radii.ts
│   ├── shadows.ts                 # + lightShadows
│   ├── layout.ts                  # bottomNavHeight → 64
│   ├── motion.ts                  # NEU — durations, easing
│   └── theme.ts                   # Unified export
│
├── components/
│   ├── primitives/
│   │   ├── AppText.tsx            # + role prop (textRoles)
│   │   ├── Icon.tsx               # NEU — Ionicons wrapper
│   │   ├── Spacer.tsx             # NEU
│   │   └── Divider.tsx            # NEU
│   ├── layout/
│   │   ├── AppScreen.tsx
│   │   ├── SafeAreaContainer.tsx
│   │   ├── ResponsiveScreen.tsx
│   │   ├── ScreenContent.tsx
│   │   ├── Section.tsx            # NEU — Title + Content, kein Card
│   │   └── Stack.tsx              # NEU — vertical/horizontal gap
│   ├── inputs/
│   │   ├── TextInput.tsx          # NEU — styled base input
│   │   ├── SearchBar.tsx          # MOVE from SearchInput
│   │   ├── FormField.tsx          # MOVE from create feature
│   │   ├── FilterChip.tsx         # MOVE from home feature
│   │   └── ChipRow.tsx            # NEU — horizontal chip container
│   ├── buttons/
│   │   ├── PrimaryButton.tsx      # theme-aware
│   │   ├── SecondaryButton.tsx
│   │   ├── IconButton.tsx
│   │   ├── TextButton.tsx         # NEU
│   │   ├── DestructiveButton.tsx  # NEU
│   │   └── FavoriteButton.tsx
│   ├── cards/
│   │   ├── SurfaceCard.tsx        # Behalten, seltener Einsatz
│   │   └── InteractiveCard.tsx
│   ├── feedback/
│   │   ├── EmptyState.tsx         # + role="sectionTitle"
│   │   ├── Skeleton.tsx           # NEU
│   │   ├── SkeletonText.tsx       # NEU
│   │   ├── SkeletonCard.tsx       # NEU
│   │   ├── Toast.tsx              # NEU + ToastProvider
│   │   ├── Banner.tsx             # NEU
│   │   ├── Badge.tsx              # NEU
│   │   └── ImagePlaceholder.tsx
│   ├── navigation/
│   │   ├── BottomNav.tsx          # NEU — extracted from tabs layout
│   │   ├── ScreenHeader.tsx       # NEU — replaces 5 headers
│   │   ├── WebTopNav.tsx
│   │   └── AdminSidebar.tsx       # EXTRACT from AdminShell
│   ├── overlay/
│   │   ├── BottomSheet.tsx        # NEU — generic
│   │   ├── Modal.tsx              # NEU
│   │   ├── Dialog.tsx             # NEU
│   │   └── ConfirmDialog.tsx      # NEU
│   ├── admin/
│   │   ├── DataRow.tsx            # NEU
│   │   ├── FilterBar.tsx          # NEU
│   │   ├── StatInline.tsx         # NEU
│   │   └── ReviewCard.tsx         # NEU
│   └── index.ts                   # Full barrel export
```

**Feature-Components bleiben domain-spezifisch:**

`EventCard`, `FeaturedEventCard`, `LineupList`, `MapEventPreview`, `NotificationRow`, `ContributorEventFormScreen`, etc. — diese **konsumieren** die Bibliothek, werden aber nicht in `src/components/` verschoben.

---

## 4. Gap-Matrix: Spec vs. Code

Legende: ✅ aligned · ⚠️ partial · 🔴 missing · 🔄 needs refactor

### 4.1 Primitives

| Spec-Komponente | Code | Gap | Aktion |
|-----------------|------|-----|--------|
| AppText | `AppText` | ⚠️ | `role` Prop für `textRoles` |
| Icon | Ionicons direkt | 🔴 | `Icon` wrapper mit Größen-Tokens |
| Spacer | — | 🔴 | Neu |
| Divider | — | 🔴 | Neu (hairline, token-based) |

### 4.2 Layout

| Spec | Code | Gap | Aktion |
|------|------|-----|--------|
| AppScreen | ✅ | ⚠️ | theme-aware background |
| SafeAreaContainer | ✅ | ⚠️ | theme-aware |
| Section | `SectionHeader` + `EventSection` | ⚠️ | Unified `Section` |
| Stack | — | 🔴 | Neu |

### 4.3 Inputs

| Spec | Code | Gap | Aktion |
|------|------|-----|--------|
| TextInput | RN TextInput direkt | 🔴 | Styled `TextInput` primitive |
| SearchBar | `SearchInput` (feature) | ⚠️ | Promote → `SearchBar` |
| FormField | `FormField` (feature) | ⚠️ | Promote |
| FilterChip | `FilterChip` (feature) | ✅ | Promote |
| ChipSelector | `FilterChipRow`, `QuickFilterRow`, … | ⚠️ | Unified `ChipRow` |

### 4.4 Actions

| Spec | Code | Gap | Aktion |
|------|------|-----|--------|
| PrimaryButton | ✅ | ⚠️ | 48px ✅, theme-aware accent |
| SecondaryButton | ✅ | ⚠️ | Ghost-Variante fehlt |
| IconButton | ✅ | ✅ | Behalten |
| TextButton | — | 🔴 | Neu |
| DestructiveButton | — | 🔴 | Neu |
| FavoriteButton | ✅ | ✅ | Behalten |

### 4.5 Content (Domain — nicht in Library)

| Spec | Code | Gap | Aktion |
|------|------|-----|--------|
| EventCard | ✅ | ⚠️ | Evolution V2: optional ohne Card-Rahmen |
| FeaturedEventCard | ✅ | ⚠️ | Gradient-Overlay reduzieren |
| ArtistRow | `LineupList` | ⚠️ | Bei Screen-Redesign |
| VenueRow | `EventInfoRow` | ⚠️ | Bei Screen-Redesign |

### 4.6 Feedback

| Spec | Code | Gap | Aktion |
|------|------|-----|--------|
| EmptyState | ✅ | ⚠️ | `sectionTitle` statt `heading` |
| Skeleton | — | 🔴 | **P0** — Tokens existieren, Komponente fehlt |
| Toast | — | 🔴 | **P0** — Mockup 61 |
| Banner | PWA/Cookie inline | ⚠️ | Unified `Banner` |
| Badge | inline only | 🔴 | Unified `Badge` |

### 4.7 Navigation

| Spec | Code | Gap | Aktion |
|------|------|-----|--------|
| BottomNav (5 Tabs) | Expo Tabs (4 sichtbar) | ⚠️ | `BottomNav` primitive; Map-Tab klären |
| ScreenHeader | 5 separate Header | ⚠️ | Unified `ScreenHeader` |
| Admin Sidebar | in `AdminShell` | ⚠️ | Extract `AdminSidebar` |
| TabBar (Web) | `WebTopNav` | ✅ | Behalten |

### 4.8 Overlay

| Spec | Code | Gap | Aktion |
|------|------|-----|--------|
| BottomSheet | `FilterSheet` | ⚠️ | Generic `BottomSheet` → FilterSheet wird Consumer |
| Modal | 5 ad-hoc | 🔴 | Generic `Modal` |
| Dialog | `LocationPickerModal` | ⚠️ | Generic `Dialog` |
| ConfirmDialog | — | 🔴 | Neu |
| Tooltip | — | 🔴 | P3 — später |

### 4.9 Admin

| Spec | Code | Gap | Aktion |
|------|------|-----|--------|
| DataRow | inline in Listen | 🔴 | Neu |
| FilterBar | `FilterSummaryBar` partial | ⚠️ | Unified `FilterBar` |
| StatInline | Stat-Cards in Dashboard | 🔴 | Neu (ersetzt Cards) |
| ReviewCard | inline in review screens | 🔴 | Neu |
| EndpointCard | `SourceEndpointsSection` | ⚠️ | Pattern extrahieren |

---

## 5. Token-Migration

### 5.1 Phase 0 — Theme-Fundament

**Ziel:** Light + Dark als erstklassige Bürger.

| Task | Datei | Detail |
|------|-------|--------|
| 0.1 | `design/theme/dark.ts` | Bestehende `colors` + `colorRoles` extrahieren |
| 0.2 | `design/theme/light.ts` | Spec aus `ER_COLOR_AND_THEME.md` §4 |
| 0.3 | `design/theme/ThemeProvider.tsx` | Context mit `theme` + `colorScheme` |
| 0.4 | `design/theme/useTheme.ts` | Hook: `const { colors, colorRoles } = useTheme()` |
| 0.5 | `app/_layout.tsx` | ThemeProvider wrappen |
| 0.6 | `design/spacing.ts` | `sectionGapV2: 32` zu `spacingRoles` |
| 0.7 | `design/layout.ts` | `bottomNavHeight: 64` |
| 0.8 | `design/motion.ts` | `durations`, `easing` aus `ER_MOTION.md` |
| 0.9 | `design/shadows.ts` | `lightCard`, `none` |
| 0.10 | `design/typography.ts` | Theme-aware text colors via `useTheme` |

**Light-Palette (aus Spec):**

```
background:      #FAFAF8
surface:         #FFFFFF
surfaceElevated: #F5F5F5
surfaceMuted:    #F3F3F0
textPrimary:     #111111
textSecondary:   #6B7280
border:          #E5E7EB
accent:          #6D5DF6
```

**Akzeptanzkriterium Phase 0:**

- [ ] `useTheme()` liefert korrekte Tokens für `light` und `dark`
- [ ] Theme-Switch funktioniert (auch wenn UI dafür noch kein Toggle hat)
- [ ] Kein Screen bricht bei Light-Theme
- [ ] Bestehende Dark-App unverändert im Default (`dark`)

### 5.2 Rückwärtskompatibilität

Bis alle Komponenten migriert sind:

```typescript
// design/colors.ts — deprecated re-export
export { darkColors as colors, darkColorRoles as colorRoles } from './theme/dark';
```

Neue Komponenten nutzen `useTheme()`. Alte Imports funktionieren weiter.

---

## 6. Migrationsphasen

### Phase 1 — Primitives & Layout (Woche 1)

**Kein Screen wird angerührt. Nur `src/design/` + `src/components/`.**

| # | Komponente | Abhängigkeit | Aufwand |
|---|------------|--------------|---------|
| 1.1 | `AppText` + `role` Prop | Phase 0 | S |
| 1.2 | `Icon` | Phase 0 | S |
| 1.3 | `Spacer`, `Divider` | Phase 0 | S |
| 1.4 | `Section` | 1.1 | S |
| 1.5 | `Stack` | — | S |
| 1.6 | `TextInput` (base) | Phase 0 | M |
| 1.7 | `TextButton` | 1.1 | S |
| 1.8 | `DestructiveButton` | 1.1 | S |
| 1.9 | `Badge` | Phase 0 | S |
| 1.10 | `Banner` | Phase 0 | M |

**Akzeptanz:**

- [ ] Alle Primitives rendern in Light + Dark
- [ ] Storybook oder `/design-preview` Screen zeigt alle Varianten
- [ ] Unit-Tests für jede Primitive (render + snapshot)

### Phase 2 — Inputs, Feedback, Actions (Woche 2)

| # | Komponente | Herkunft | Aufwand |
|---|------------|----------|---------|
| 2.1 | `SearchBar` | Move `SearchInput` | S |
| 2.2 | `FormField` | Move `FormField` | S |
| 2.3 | `FilterChip` | Move `FilterChip` | S |
| 2.4 | `ChipRow` | Neu (ersetzt 4 Row-Varianten) | M |
| 2.5 | `Skeleton`, `SkeletonText`, `SkeletonCard` | Neu | M |
| 2.6 | `Toast` + `ToastProvider` | Neu | L |
| 2.7 | `EmptyState` | Refactor (sectionTitle, theme) | S |
| 2.8 | Buttons theme-aware | Refactor 1.7–1.8 | S |

**Akzeptanz:**

- [ ] `FilterSheet` kann `SearchBar` + `FilterChip` aus `@/components` importieren
- [ ] `ActivityIndicator` in Loading States ersetzbar durch `Skeleton`
- [ ] Toast kann programmatisch getriggert werden
- [ ] Alte Feature-Imports werden zu Re-Exports (kein Breaking Change)

### Phase 3 — Navigation, Overlay, Admin (Woche 3)

| # | Komponente | Herkunft | Aufwand |
|---|------------|----------|---------|
| 3.1 | `ScreenHeader` | Merge 5 Header | M |
| 3.2 | `BottomNav` | Extract from tabs layout | M |
| 3.3 | `BottomSheet` | Generalize `FilterSheet` | L |
| 3.4 | `Modal` | Generalize common pattern | M |
| 3.5 | `Dialog` | Generalize `LocationPickerModal` | M |
| 3.6 | `ConfirmDialog` | Neu | S |
| 3.7 | `AdminSidebar` | Extract from `AdminShell` | M |
| 3.8 | `DataRow` | Neu | S |
| 3.9 | `StatInline` | Neu | S |
| 3.10 | `FilterBar` | Neu | M |
| 3.11 | `ReviewCard` | Neu | M |

**Akzeptanz:**

- [ ] `FilterSheet` = `BottomSheet` + Inhalt (kein eigenes Modal)
- [ ] `LocationPickerModal` = `Dialog` + Inhalt
- [ ] `AdminShell` nutzt `AdminSidebar` + `ScreenHeader`
- [ ] `SourceEndpointsSection` nutzt `Badge`, `DataRow`, `ConfirmDialog`
- [ ] Admin Dashboard nutzt `StatInline` statt Stat-Cards

### Phase 4 — Konsumierung & Deprecation (Woche 4)

**Erst jetzt Features auf neue Imports umstellen.**

| # | Task | Dateien |
|---|------|---------|
| 4.1 | Feature-Imports umleiten | Alle `features/*/components/` |
| 4.2 | Alte Pfade → Re-Exports | `@/features/home/components/FilterChip` → `@/components` |
| 4.3 | `ActivityIndicator` → `Skeleton` | 12 Loading States |
| 4.4 | 5 Header → `ScreenHeader` | Home, Saved, Notifications, Collection, Admin |
| 4.5 | Inline Badges → `Badge` | Admin, Endpoints, Notifications |
| 4.6 | `AppText role=` statt `textRoles` spread | ~100 Dateien (schrittweise) |
| 4.7 | `docs/design/`-Checklist pro PR | `ER_UI_REVIEW_CHECKLIST.md` |
| 4.8 | Deprecated Markierungen entfernen | Nach 2 Sprints |

**Akzeptanz:**

- [ ] `@/components` Barrel exportiert alle Spec-Komponenten
- [ ] Kein Feature importiert `@/features/*/FilterChip` etc. direkt
- [ ] 0 `ActivityIndicator` in Loading States (außer Bootstrap)
- [ ] CI: Lint-Rule gegen hardcoded colors in Screens

---

## 7. Migrationsreihenfolge (Dependency Graph)

```
Phase 0: ThemeProvider + Light/Dark Tokens
    │
    ├── Phase 1: Primitives (AppText, Icon, Section, Divider, Badge, Banner)
    │       │
    │       ├── Phase 2: Inputs (SearchBar, FormField, FilterChip, ChipRow)
    │       │       │
    │       │       └── Phase 3: Overlay (BottomSheet, Dialog, ConfirmDialog)
    │       │               │
    │       │               └── Phase 4: Feature-Konsumierung
    │       │
    │       ├── Phase 2: Feedback (Skeleton, Toast, EmptyState)
    │       │
    │       └── Phase 2: Actions (TextButton, DestructiveButton)
    │
    └── Phase 3: Navigation (ScreenHeader, BottomNav, AdminSidebar)
            │
            └── Phase 3: Admin (DataRow, StatInline, FilterBar, ReviewCard)
```

**Parallelisierbar:**

- Phase 2 Feedback ∥ Phase 2 Inputs (nach Phase 1)
- Phase 3 Admin ∥ Phase 3 Navigation (nach Phase 1)
- Phase 4 ist rein sequentiell

---

## 8. Bewusst NICHT in diesem Plan

| Ausgeschlossen | Wann |
|----------------|------|
| Screen-Redesigns (Home, Events, Detail, …) | Nach Phase 4 |
| EventCard ohne Card-Rahmen (Evolution V2) | Screen-Redesign Sprint |
| Dark-Palette Weichzeichnung (`#111214`) | Token-Update Sprint (optional in Phase 0) |
| Inter/Geist Font | Separater Sprint |
| Map Tab in BottomNav aktivieren | Produktentscheidung |
| Pull-to-Refresh | Screen-Redesign Sprint |
| Haptic Feedback | Motion Sprint |
| Storybook Setup | Empfohlen in Phase 1, nicht blocking |

---

## 9. Qualitätssicherung

### 9.1 Design-Preview Screen

Neuer Dev-Only Screen: `app/design-preview.tsx`

Zeigt alle Komponenten in Light + Dark nebeneinander:

- Buttons (alle Varianten + States)
- Inputs (SearchBar, FormField, Chips)
- Feedback (Empty, Skeleton, Toast, Banner, Badge)
- Overlay (Sheet, Dialog, Confirm)
- Admin (DataRow, StatInline, ReviewCard)
- Typography (alle textRoles)
- Colors (alle Tokens)

### 9.2 Tests

| Typ | Scope | Minimum |
|-----|-------|---------|
| Unit | Jede Primitive in `src/components/` | Render + Props |
| Theme | `useTheme()` | Light/Dark Token-Werte |
| A11y | Buttons, IconButtons | role, label, min 44px |
| Visual | Design-Preview | Screenshot-Diff (optional) |

### 9.3 PR-Checkliste

Jeder Library-PR muss:

1. `ER_UI_REVIEW_CHECKLIST.md` — alle A-Punkte Pass
2. Light + Dark Screenshot (Design-Preview)
3. Kein neuer hardcoded Color/Spacing Wert
4. Barrel `index.ts` aktualisiert
5. Alte Imports als Re-Export (wenn Move)

---

## 10. Risiken

| Risiko | Mitigation |
|--------|------------|
| Breaking Changes in Features | Re-Export-Bridge für 2 Sprints |
| Theme-Migration bricht Admin Web | Phase 0: Dark als Default, Light opt-in |
| BottomSheet auf RN Web | `FilterSheet` als Referenz — bereits battle-tested |
| Toast auf RN Web | Portal-basiert, `position: fixed` |
| Scope Creep (Screen-Redesign) | Strikt: Library first, Screens later |
| 100+ Dateien `textRoles` Migration | ESLint-Rule + schrittweise in Phase 4 |

---

## 11. Erfolgskriterien (Definition of Done)

Die Designbibliothek ist **fertig**, wenn:

1. **Alle Spec-Komponenten** aus `ER_COMPONENT_LIBRARY.md` §2 existieren in `src/components/`
2. **ThemeProvider** mit Light + Dark — jede Library-Komponente theme-aware
3. **0 ad-hoc Modals** in Features — alle nutzen `BottomSheet` / `Dialog` / `ConfirmDialog`
4. **0 ActivityIndicator** in Content-Loading — `Skeleton` überall
5. **Toast** implementiert und in mindestens einem Flow genutzt
6. **ScreenHeader** — ein Primitive, 5+ Consumer
7. **Admin Primitives** — `DataRow`, `StatInline`, `FilterBar`, `ReviewCard`, `Badge`
8. **Design-Preview** Screen dokumentiert alle Komponenten
9. **Tests** — mindestens 1 Render-Test pro Primitive
10. **Barrel Export** — `import { X } from '@/components'` für alle Primitives

**Erst danach:** Screen-Redesigns gemäß `ER_SCREEN_PATTERNS.md` und `ER_DESIGN_EVOLUTION_V2.md`.

---

## 12. Nächster Schritt

**Sprint 2 — Phase 0 starten:**

```
1. design/theme/dark.ts + light.ts
2. design/theme/ThemeProvider.tsx + useTheme.ts
3. app/_layout.tsx wrappen
4. AppText role= Prop
5. design-preview Screen (Skeleton)
```

Kein Screen-Redesign. Kein EventCard-Refactor. Nur Fundament.

---

## 13. Verwandte Dokumente

| Dokument | Rolle in Migration |
|----------|-------------------|
| `ER_UI_CONSTITUTION.md` | Nicht verhandelbare Regeln |
| `ER_COMPONENT_LIBRARY.md` | Soll-Inventar |
| `ER_COLOR_AND_THEME.md` | Light/Dark Token-Werte |
| `ER_TYPOGRAPHY.md` | textRoles → AppText role |
| `ER_LAYOUT_SYSTEM.md` | Spacing, sectionGap 32px |
| `ER_MOTION.md` | motion.ts Tokens |
| `ER_DESIGN_EVOLUTION_V2.md` | Was sich an Mockups ändert |
| `ER_UI_REVIEW_CHECKLIST.md` | PR-Gate |
| `ER_CURSOR_UI_GUIDE.md` | KI-Arbeitsanweisung |

**Ersetzt:** `app-v2/docs/DESIGN_SYSTEM.md`, `app-v2/docs/DESIGN_GUIDELINES.md` (weiterhin als Referenz bis Migration abgeschlossen, dann archivieren).
