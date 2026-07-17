# Eternal Rave — DESIGN RULES

> Sprint 1 · Mockups + Band 2 + `src/constants/theme.ts`

---

## Grundsatz

**Nicht neu designen — Mockup verbessern und erweitern.**  
Premium · Minimal · Dark · Modern · Elegant — kein Gaming/Cyberpunk.

---

## Visuelle Referenz

1. Mockups: `/assets/mockups/` (79 PNGs)
2. [MOCKUP-SCREENS.md](../02-ui-design/MOCKUP-SCREENS.md)
3. Mockup Index: [analysis/02_mockup_index.md](../analysis/02_mockup_index.md)

---

## Farb-Tokens (Pflicht)

Quelle: `src/constants/theme.ts` + `tailwind.config.js`

| Token | Hex | Tailwind |
|-------|-----|----------|
| background | #0B0B0F | `bg-background` |
| surface | #15151B | `bg-surface` |
| surfaceElevated | #1F1F27 | `bg-surface-elevated` |
| mapSurface | #12121A | `bg-map-surface` |
| primary | #7C3AED | `bg-primary`, `text-primary` |
| primaryHighlight | #A855F7 | `text-primary-highlight` |
| primaryDeep | #4C1D95 | `bg-primary-deep` |
| textPrimary | #F5F5F5 | `text-text-primary` |
| textSecondary | #9CA3AF | `text-text-secondary` |
| border | #2A2A35 | `border-border` |
| success | #22C55E | `text-success` |
| warning | #F59E0B | `text-warning`, `bg-warning` |
| live/danger | #EF4444 | `bg-live` |
| white | #FFFFFF | (ActivityIndicator, icons via `Colors.white`) |

**Regel:** Keine neuen Hex-Werte in Components — fehlende Tokens zuerst in theme.ts ergänzen.

**Confidence UI (Band 4.5):** `getImportConfidenceColor()`, `getDuplicateConfidenceColor()` in theme.ts.

---

## Spacing & Radius

- Spacing: `Spacing.xs` … `Spacing.xxl` (4–24px) — mirrored in `tailwind.config.js`
- Screen padding: `Spacing.screen` (16px) / Tailwind `px-4`
- Card radius: `rounded-2xl` (16px) — Mockup 12–16px
- BorderRadius tokens: sm(8), md(12), lg(16), xl(20)

---

## Typography (Ist — Sprint 1)

- System Font via React Native default
- **Tokens:** `Typography.caption` … `Typography.display` in theme.ts + Tailwind `fontSize`
- Mockup 63–65 full type spec — **partial** (numeric scale only, no custom font family)

---

## Shadows & Gradients

- `Shadows.card` — subtle elevation for cards (use sparingly)
- `ImageGradients.default` / `.fallback` — event cover placeholders

## UI Components Library

Neue UI **nur** durch Erweitern bestehender Komponenten:

| Kategorie | Komponenten |
|-----------|-------------|
| Buttons | PrimaryButton, SecondaryButton, AnimatedPressable |
| Cards | EventCard, FeaturedEventCard, StatCard |
| Forms | FormField, FormSection, SearchBar |
| Chips | FilterChip, EventTag, StatusBadge |
| Feedback | EmptyState, LoadingSkeleton, SuccessState |
| Nav | BottomNav, ScreenHeader, TabScreenLayout |

Mockup-Referenz: 52–61. Inventory: [analysis/04_component_inventory.md](../analysis/04_component_inventory.md)

---

## Motion

- Library: `react-native-reanimated` + `expo-haptics`
- Referenz: Mockups 70–79, Band 2 Kap. 07
- Erlaubt: subtle press scale, skeleton pulse, favorite bounce, stack transitions
- Verboten: excessive glow, cyberpunk effects, Dauer-Animationen auf Listen
- **Reduce Motion:** prüfen wenn Motion Sprint kommt

---

## Icons

- `@expo/vector-icons` (Ionicons) — konsistente Größen 14/16/20/22/24
- Mockup 66 als Referenz für Iconography-Sprint

---

## Bilder & Flyer

- `expo-image` für Event-Bilder
- `EventCoverImage` / `EventImageFallback` für fehlende Flyer — nicht leere schwarze Flächen

---

## Accessibility (Design)

- Touch targets min. ~44pt
- Kontrast text-secondary auf surface prüfen
- Icon-only buttons: `accessibilityLabel` Pflicht
- Siehe [PROJECT_RULES.md](./PROJECT_RULES.md) Regel 7

---

## Referenzen

- [MASTER-PROMPT-v3.0.md](../01-product-vision/MASTER-PROMPT-v3.0.md) Color System
- [analysis/07_design_review.md](../analysis/07_design_review.md)
