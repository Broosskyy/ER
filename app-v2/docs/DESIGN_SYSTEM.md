# Design System — Eternal Rave (app-v2)

**Stand:** 17. Juli 2026  
**Quelle:** `reference/old-code/src/constants/theme.ts`  
**Implementierung:** `app-v2/src/design/`

---

## Übernahme-Regel

Alle Token-Werte stammen aus der alten `theme.ts` und den Mockup-Spezifikationen (`MOCKUP-SCREENS.md`).  
Es wurde **keine Design-Neuinterpretation** vorgenommen.

---

## Farben (`src/design/colors.ts`)

| Token | Wert | Quelle | Verwendung |
|-------|------|--------|------------|
| `background` | `#0B0B0F` | theme.ts `Colors.background` | App-Hintergrund |
| `surface` | `#15151B` | theme.ts `Colors.surface` | Karten, Panels |
| `surfaceElevated` | `#1F1F27` | theme.ts `Colors.surfaceElevated` | Erhöhte Flächen |
| `mapSurface` | `#12121A` | theme.ts `Colors.mapSurface` | Karten-Hintergrund (geplant) |
| `primary` | `#7C3AED` | theme.ts `Colors.primary` | Buttons, aktive Elemente |
| `primaryHighlight` | `#A855F7` | theme.ts `Colors.primaryHighlight` | Pressed/Hover |
| `primaryDeep` | `#4C1D95` | theme.ts `Colors.primaryDeep` | Gradienten (geplant) |
| `textPrimary` | `#F5F5F5` | theme.ts `Colors.textPrimary` | Haupttext |
| `textSecondary` | `#9CA3AF` | theme.ts `Colors.textSecondary` | Sekundärtext |
| `border` | `#2A2A35` | theme.ts `Colors.border` | Rahmen, Trennlinien |
| `live` | `#EF4444` | theme.ts `Colors.live` | Live-Indikator |
| `success` | `#22C55E` | theme.ts `Colors.success` | Erfolg |
| `warning` | `#F59E0B` | theme.ts `Colors.warning` | Warnung |
| `white` | `#FFFFFF` | theme.ts `Colors.white` | Button-Text auf Primary |

---

## Abstände (`src/design/spacing.ts`)

| Token | Wert | Quelle |
|-------|------|--------|
| `xs` | 4 | theme.ts `Spacing.xs` |
| `sm` | 8 | theme.ts `Spacing.sm` |
| `md` | 12 | theme.ts `Spacing.md` |
| `lg` | 16 | theme.ts `Spacing.lg` |
| `xl` | 20 | theme.ts `Spacing.xl` |
| `xxl` | 24 | theme.ts `Spacing.xxl` |
| `screen` | 16 | theme.ts `Spacing.screen` |

---

## Typografie (`src/design/typography.ts`)

### Schriftgrößen

| Token | Wert (px) | Quelle |
|-------|-----------|--------|
| `caption` | 10 | theme.ts `Typography.caption` |
| `xs` | 11 | theme.ts `Typography.xs` |
| `sm` | 12 | theme.ts `Typography.sm` |
| `base` | 14 | theme.ts `Typography.base` |
| `md` | 16 | theme.ts `Typography.md` |
| `lg` | 18 | theme.ts `Typography.lg` |
| `xl` | 20 | theme.ts `Typography.xl` |
| `xxl` | 24 | theme.ts `Typography.xxl` |
| `display` | 30 | theme.ts `Typography.display` |

### Text-Varianten

| Variante | Größe | Gewicht | Farbe |
|----------|-------|---------|-------|
| `display` | 30 | bold | textPrimary |
| `title` | 24 | semibold | textPrimary |
| `heading` | 20 | semibold | textPrimary |
| `body` | 16 | regular | textPrimary |
| `bodySmall` | 14 | regular | textPrimary |
| `caption` | 12 | regular | textSecondary |
| `label` | 12 | medium | textSecondary |

**Hinweis:** Font-Familie noch nicht definiert — System-Font als Fallback. Aus Mockup 63 ableiten.

---

## Radien (`src/design/radii.ts`)

| Token | Wert (px) | Quelle |
|-------|-----------|--------|
| `sm` | 8 | theme.ts `BorderRadius.sm` |
| `md` | 12 | theme.ts `BorderRadius.md` |
| `lg` | 16 | theme.ts `BorderRadius.lg` |
| `xl` | 20 | theme.ts `BorderRadius.xl` |
| `full` | 9999 | theme.ts `BorderRadius.full` |

---

## Schatten (`src/design/shadows.ts`)

| Token | Werte | Quelle |
|-------|-------|--------|
| `card` | offset(0,2), opacity 0.2, radius 6, elevation 3 | theme.ts `Shadows.card` |
| `none` | transparent | neu (kein Schatten) |

---

## Layout (`src/design/layout.ts`)

| Token | Wert | Quelle |
|-------|------|--------|
| `bottomNavHeight` | 64 | theme.ts `BOTTOM_NAV_HEIGHT` |
| `minTouchTarget` | 44 | iOS/Android Accessibility Guideline |
| `maxContentWidth` | 480 | neu (Responsive-Begrenzung) |
| `screenPadding` | 16 | theme.ts `Spacing.screen` |

### App-Konfiguration

| Feld | Wert | Quelle |
|------|------|--------|
| `name` | Eternal Rave | theme.ts `AppConfig.name` |
| `tagline` | Discover. Connect. Rave. | theme.ts `AppConfig.tagline` |
| `locationLabel` | Near you | theme.ts `AppConfig.locationLabel` |
| `defaultCity` | Berlin | theme.ts `AppConfig.defaultCity` |

---

## Basis-Komponenten

| Komponente | Token-Nutzung |
|------------|---------------|
| `AppScreen` | `colors.background` |
| `SafeAreaContainer` | `colors.background` |
| `AppText` | `textVariants.*` |
| `PrimaryButton` | `colors.primary`, `radii.md`, `layout.minTouchTarget` |
| `SecondaryButton` | `colors.border`, `radii.md` |
| `IconButton` | `colors.surface`, `radii.full`, `layout.minTouchTarget` |
| `SurfaceCard` | `colors.surface`, `radii.lg`, `shadows.card` |
| `ImagePlaceholder` | `colors.surfaceElevated`, `radii.md` |
| `EmptyState` | `textVariants.heading`, `textVariants.bodySmall` |

---

## Nicht übernommen (bewusst)

| Alt | Grund |
|-----|-------|
| `ImageGradients` | Erst bei Hero-Cards relevant |
| `TabRoutes` | Navigation noch nicht implementiert |
| Filter-Konstanten (GenreFilters, etc.) | Erst bei Screen-Implementierung |
| `getImportConfidenceColor()` | Admin-Feature, später |
| NativeWind/Tailwind Config | Explizit ausgeschlossen |
