# 07 — Design Review

**Referenz:** Band 2 UI Design Bible · Mockups 09–79 · `src/constants/theme.ts`

---

## 1. Design Direction (Band 1 + 2)

| Prinzip | Soll | Ist | Status |
|---------|------|-----|--------|
| Premium Dark Minimal | Ja | Ja | ✅ |
| No Gaming/Cyberpunk | Ja | Sprint 1.4 reduziert Glow | ✅ |
| Purple Accent #7C3AED | Ja | theme.ts + tailwind | ✅ |
| Inspiration Spotify/RA | Ja | Card-based feed | ✅ |
| Do NOT redesign | Ja | Inkrementelle Erweiterung | ✅ |

---

## 2. Farbsystem

### Implementierte Tokens (`theme.ts` + `tailwind.config.js`)

| Token | Hex | Verwendung |
|-------|-----|------------|
| background | #0B0B0F | Screen bg |
| surface | #15151B | Cards |
| surfaceElevated | #1F1F27 | Nested surfaces |
| primary | #7C3AED | CTAs, active nav |
| primaryHighlight | #A855F7 | Accents |
| textPrimary | #F5F5F5 | Headlines |
| textSecondary | #9CA3AF | Meta text |
| border | #2A2A35 | Card borders |
| success | #22C55E | Approved states |
| live/danger | #EF4444 | LIVE badge, errors |

### Abweichungen / Hardcoded Colors

| Farbe | Verwendet in | Problem |
|-------|--------------|---------|
| #F59E0B | lifecycle.ts, DuplicateWarningBanner, ImportPreviewCard | Warning nicht in theme |
| #4C1D95, #6D28D9, … | events.ts gradients, eventMappers | Event-specific, OK |
| #12121A | MapPlaceholder | Nicht tokenized |
| #3B0764 | EventImageFallback | Fallback gradient |

**Mockup 62 (Color System):** ✅ Kernpalette aligned · 🔴 Semantic warning/orange fehlt als Token

---

## 3. Typography

**Band 2 Kapitel `03_Typography.md`:** Stub (1 Zeile)  
**Mockup 63:** Vollständige Typo-Skala spezifiziert

### Ist-Zustand Code
- React Native default system font
- Tailwind classes: `text-2xl font-bold`, `text-sm text-text-secondary`, etc.
- **Keine** zentralen Typography-Tokens (fontSize, lineHeight, letterSpacing)

| Stil | Tailwind (ad-hoc) | Mockup-Erwartung |
|------|-------------------|------------------|
| Screen title | text-2xl font-bold | Display/H1 token |
| Section header | text-xs uppercase tracking-wider | Label token |
| Body | text-base | Body token |
| Caption | text-xs | Caption token |

**Empfehlung (später):** `Typography` export in theme.ts — keine Font-Files nötig für MVP.

---

## 4. Spacing & Grid

**theme.ts Spacing:** xs(4) sm(8) md(12) lg(16) xl(20) xxl(24) screen(16)  
**Mockup 64:** 4/8pt grid — 🟡 Basis vorhanden, nicht durchgängig erzwungen

**Inkonsistenzen:**
- Tab padding teils `px-4`, teils inline styles
- `BOTTOM_NAV_HEIGHT = 64` hardcoded — korrekt für Tab overlap

---

## 5. Border Radius & Elevation

**BorderRadius tokens:** sm(8) md(12) lg(16) xl(20) full  
**Cards:** `rounded-2xl` (16px) — ✅ Mockup ~12–16px

**Elevation:** Mockup 65 spezifiziert Schatten-Stufen  
**Code:** Keine shadow tokens · `AnimatedCard` nutzt animierte elevation — 🟡

---

## 6. Icon System

**Quelle:** `@expo/vector-icons` (Ionicons) — durchgängig  
**Mockup 66:** Iconography-System mit Größen-Stufen

| Verwendung | Größe | Konsistent |
|------------|-------|------------|
| Bottom nav | ~24 | ✅ |
| Header actions | 20–22 | ✅ |
| Inline meta | 14–16 | 🟡 variiert |

**Kein** zentraler `Icon` wrapper — direkte Ionicons-Imports in Screens.

---

## 7. Fonts

**Mockups:** Clean sans-serif (SF Pro / Inter-ähnlich)  
**Code:** System default — akzeptabel für RN MVP  
**assets/branding/:** leer — kein Custom Font

---

## 8. Responsive Verhalten

**Band 2 Kapitel `11_Responsive_Plattformen.md`:** Stub  
**Mockup 69:** Breakpoint-Regeln

| Aspekt | Implementierung |
|--------|-----------------|
| Safe Area | `react-native-safe-area-context` ✅ |
| Tablet | `supportsTablet: true` in app.json, kein spezielles Layout |
| Small phones | ScrollView padding mit BOTTOM_NAV_HEIGHT ✅ |
| Landscape | Nicht optimiert (portrait lock) |

---

## 9. Animationen & Motion

**Implementiert:**
- `react-native-reanimated` in AnimatedCard, AnimatedPressable, AnimatedFavoriteButton, SuccessState, LoadingSkeleton
- Stack navigation transitions (`StackTransition.push/modal/none`)
- expo-haptics in einigen Interactions

**Mockups 70–79:** Umfassende Motion Library — größtenteils 🔴

| Motion-Typ | Mockup | Code |
|------------|--------|------|
| Navigation transitions | 71, 76 | 🟡 Expo default |
| Component press | 72 | 🟡 AnimatedPressable |
| List/card stagger | 75 | 🔴 |
| Loading pulse | 73, 60 | ✅ Skeleton |
| Success celebration | 74 | 🟡 SuccessState |
| Gestures | 77 | 🟡 Root gesture handler |
| Haptic patterns | 78 | 🟡 utils/haptics.ts |
| Reduce motion | 79 | 🔴 Nicht implementiert |

---

## 10. UI Component Library vs. Mockups 52–61

| Mockup Library | Code-Äquivalent | Gap |
|----------------|-----------------|-----|
| Buttons | Primary/Secondary/Animated | Varianten-System fehlt (size, destructive) |
| Inputs | FormField | Error states basic |
| Cards | Event/Featured/Stat | Unified base fehlt |
| Chips/Badges | FilterChip, EventTag, StatusBadge | ✅ |
| Navigation | BottomNav, ScreenHeader | ✅ |
| Empty States | EmptyState | ✅ |
| Dialogs | — | 🔴 |
| Bottom Sheets | MapBottomSheet basic | 🔴 Generic sheet |
| Loading | Skeletons | ✅ |
| Toasts | — | 🔴 |

---

## 11. Screen-by-Screen Design Delta (Kurz)

| Screen | Mockup | Haupt-Deltas |
|--------|--------|--------------|
| Home 09 | DE copy, Bell, Trending, Organizers | EN, fehlende Sektionen |
| Events 10 | DE „145 Events gefunden" | EN count (funktional ✅) |
| Map 12 | Dark Mapbox, clusters | Gray placeholder |
| Detail 11 | Share icon top-right | Fehlt |
| Profile 15 | 3-stat row incl. Visited | 2 stats, 1 hardcoded |
| Admin 41 | Reports tile | Fehlt |

---

## 12. Assets & Branding

| Asset | Pfad | Status |
|-------|------|--------|
| App Icon | assets/icon.png | ✅ |
| Splash | assets/splash-icon.png | ✅ |
| Mockups (79) | assets/mockups/*.zip | ✅ Referenz |
| Brand Guidelines | assets/branding/ | 🔴 leer |
| Design System exports | assets/design-system/ | 🔴 leer |
| UI component screenshots | assets/ui-components/ | 🔴 leer |

**Band-Cover PNGs:** docs/00–05/Band_*.png ✅

---

## 13. Accessibility (Design + a11y)

**Mockup 79 / Band 2 Kapitel 10:** Performance & Accessibility  
**Code:** Minimal (4 accessibilityLabel-Stellen)

| Kriterium | Status |
|-----------|--------|
| Touch targets 44pt | 🟡 meist OK |
| Color contrast | 🟡 unverifiziert |
| Screen reader labels | 🔴 |
| Focus order | 🔴 |
| Reduce motion | 🔴 |
| Error announcements | 🔴 |

---

## 14. Design Review Fazit

**Stärken:** Farbsystem 1:1, konsistentes Dark Premium Look, solide Card/Chip/Badge-Basis, Skeleton/Empty patterns.

**Schwächen:** Typography/Motion/Elevation nicht tokenisiert, Mockup-Features (Map, Share, Trending) fehlen, DE-Lokalisierung, Dialog/Toast-System, a11y.

**Regel eingehalten:** Kein Redesign nötig — **Mockup-Annäherung** in priorisierten Sprints.

---

*Design Review abgeschlossen ohne visuelle Code-Änderungen.*
