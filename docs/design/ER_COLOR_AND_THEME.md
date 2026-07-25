# ER Color & Theme

**Status:** Kanonisch · Sprint 1 Design DNA  
**Quelle:** ER Design System v3, Mockup 62, app-v2 `colors.ts`, Evolution V2  
**Zweck:** Vollständige Farb- und Theme-Spezifikation für Light und Dark Mode.

---

## 1. Grundsatz

- **Zwei gleichwertige Themes** — Light und Dark sind eigenständige Systeme
- Light ist **nicht** invertierter Dark Mode
- Violett ist **Akzent**, nie dominante Flächenfarbe
- Semantische Farben haben feste Bedeutung
- Alle Farben über Tokens — keine Hardcodes in Screens

---

## 2. Markenfarbe

| Name | Hex | Rolle |
|------|-----|-------|
| **Primary** | `#7C3AED` | CTAs, aktive Navigation, Selected Chips, Links |
| **Primary Highlight** | `#A855F7` | Pressed/Hover States |
| **Primary Deep** | `#4C1D95` | Seltene Akzente, Gradienten (sparsam) |

**Evolution V2 Light Accent (Design System v3):**

| Name | Hex | Rolle |
|------|-----|-------|
| **Accent (Light)** | `#6D5DF6` | Leicht wärmer/weicher für helle Flächen |

**Regel:** Maximal **ein** violetter CTA pro Screen. Violett nie als Hintergrundfläche für ganze Sektionen.

---

## 3. Dark Mode (Emotional, nicht schwer)

### 3.1 Surfaces

| Token | Hex | Verwendung |
|-------|-----|------------|
| `background` | `#0B0B0F` | App-Hintergrund (Ist, Mockup) |
| `surface` | `#15151B` | Cards, Inputs, Bottom Nav |
| `surfaceElevated` | `#1F1F27` | Badges, erhöhte Elemente |
| `mapSurface` | `#12121A` | Karten-Hintergrund |

**Evolution V2 (Design System v3 — Ziel):**

| Token | Hex | Verwendung |
|-------|-----|------------|
| `background` | `#111214` | Ruhiger, weniger hart |
| `surface` | `#1A1C1F` | Weichere Flächen |
| `surfaceElevated` | `#24272C` | Subtile Tiefe |

**Migrationshinweis:** Ist-Werte (`#0B0B0F`) bleiben gültig bis Token-Update. Ziel-Palette ist weicher und weniger kontrastreich.

### 3.2 Text (Dark)

| Token | Hex | Verwendung |
|-------|-----|--------|
| `textPrimary` | `#F5F5F5` | Headlines, Body |
| `textSecondary` | `#9CA3AF` | Meta, Placeholder, Captions |
| `textOnPrimary` | `#FFFFFF` | Text auf Primary Buttons |

**Evolution V2:** Weniger reines Weiß — `#F5F5F5` statt `#FFFFFF` für Body reduziert Härte.

### 3.3 Borders (Dark)

| Token | Hex | Verwendung |
|-------|-----|--------|
| `border` | `#2A2A35` | Cards, Inputs, Dividers |
| `divider` | `#2A2A35` | Sektions-Trenner (hairline) |

**Evolution V2:** Borders sparsamer — oft durch Spacing ersetzen. Wenn Border: hairline (1px), nie 2px+.

---

## 4. Light Mode (Primäre Referenz ab 2026)

### 4.1 Surfaces (Design System v3)

| Token | Hex | Verwendung |
|-------|-----|--------|
| `background` | `#FAFAF8` | Warmes Off-White — nicht `#FFFFFF` |
| `surface` | `#FFFFFF` | Cards, Inputs, Sheets |
| `surfaceElevated` | `#F5F5F5` | Badges, leichte Erhebung |
| `surfaceMuted` | `#F3F3F0` | Sekundäre Flächen, Hover |

**Charakter:** hell · ruhig · warm · freundlich · hochwertig

### 4.2 Text (Light)

| Token | Hex | Verwendung |
|-------|-----|--------|
| `textPrimary` | `#111111` | Headlines, Body — nicht reines Schwarz |
| `textSecondary` | `#6B7280` | Meta, Placeholder |
| `textTertiary` | `#9CA3AF` | Deaktiviert, sehr leise Labels |
| `textOnPrimary` | `#FFFFFF` | Auf Accent Buttons |

### 4.3 Borders (Light)

| Token | Hex | Verwendung |
|-------|-----|--------|
| `border` | `#E5E7EB` | Subtile Trennung |
| `borderStrong` | `#D1D5DB` | Inputs, fokussierte Felder |
| `divider` | `#F3F4F6` | Hairline zwischen Sektionen |

**Evolution V2:** Light Mode nutzt **Schatten statt Borders** für Cards — sehr subtil (opacity 0.04–0.08).

---

## 5. Semantische Farben (beide Themes)

| Token | Hex | Bedeutung | Verwendung |
|-------|-----|-----------|------------|
| `success` | `#22C55E` | Erfolg, Aktiv, Approved | Badges, Confirmations |
| `warning` | `#F59E0B` | Warnung, Pending | Import-Warnings, Duplicate |
| `live` | `#EF4444` | Live, Fehler, Destruktiv | LIVE Badge, Delete, Errors |
| `info` | `#3B82F6` | Informational | Map User Dot, Links (selten) |

**Regel:** Semantische Farben nie als Dekoration. Nur wenn Status kommuniziert wird.

---

## 6. Color Roles (semantische Zuordnung)

Statt direkter Token-Nutzung in Screens bevorzugt:

| Rolle | Dark | Light | Kontext |
|-------|------|-------|---------|
| `appBackground` | background | background | Screen Root |
| `cardBackground` | surface | surface | Event Cards |
| `searchBackground` | surface | surfaceMuted | Search Bar |
| `chipSelectedBackground` | primary | accent | Filter |
| `buttonPrimaryBackground` | primary | accent | CTAs |
| `overlayScrim` | rgba(11,11,15,0.72) | rgba(17,18,20,0.48) | Sheets, Modals |
| `skeletonBase` | surface | surfaceMuted | Loading |
| `skeletonHighlight` | surfaceElevated | surfaceElevated | Pulse |

---

## 7. Overlays & Scrim

| Kontext | Dark | Light |
|---------|------|-------|
| Bottom Sheet Backdrop | 72–90% opacity | 40–55% opacity |
| Modal Backdrop | 72% | 48% |
| Hero Gradient (Event) | transparent → 85% bg | transparent → 60% bg |
| Image Overlay Text | Dunkler Scrim unten | Leichter Scrim oder keiner |

**Evolution V2:** Weniger aggressive Gradients auf Event Heroes — Flyer soll leuchten.

---

## 8. Theme-Wechsel-Regeln

| Aspekt | Regel |
|--------|-------|
| Struktur | Identisch in beiden Themes |
| Spacing | Identisch |
| Typografie-Skala | Identisch |
| Farben | Theme-spezifische Tokens |
| Schatten | Light: subtil; Dark: minimal bis none |
| Borders | Light: sparsam; Dark: hairline |
| Bilder | Unverändert — Content ist theme-agnostisch |

**Verboten:** `filter: invert()` oder automatische Farbumkehrung.

---

## 9. Kontrast & Accessibility

| Prüfung | Minimum |
|---------|---------|
| Body Text auf Background | WCAG AA (4.5:1) |
| Large Text (≥18px bold / 24px) | WCAG AA (3:1) |
| Primary Button Text | WCAG AA auf Primary Fill |
| Secondary/Meta Text | Lesbar in Sonnenlicht und Club-Dunkelheit |

**Dark Mode:** Nicht maximaler Kontrast — ruhige Oberflächen mit ausreichender Lesbarkeit.

**Light Mode:** Nicht zu blass — `#111111` auf `#FAFAF8` als Minimum.

---

## 10. Farb-Verwendungsmatrix

| Element | Dark | Light | Evolution V2 |
|---------|------|-------|--------------|
| Screen BG | `#0B0B0F` | `#FAFAF8` | Weicher Dark |
| Event Card | surface + border | surface + shadow | Weniger Border |
| Primary CTA | primary fill | accent fill | Ein CTA |
| Filter Chip selected | primary | accent | ✅ |
| Admin Sidebar | surface | surface | Light default |
| Empty State BG | background | background | Kein extra Surface |
| Form Input | surface + border | surfaceMuted + borderStrong | Kein Card-Wrapper |
| Status Badge | semantic + surfaceElevated | semantic + surfaceMuted | Kompakt |

---

## 11. Verbotene Farb-Muster

| ❌ Verboten | Warum |
|------------|-------|
| Neon-Farben (#00FF00, #FF00FF) | Gaming/Cyberpunk |
| Gradient Buttons (Standard) | Material Template |
| Violett als Section Background | Überladung |
| Hardcoded Hex in Screens | Wartbarkeit |
| Rot/Grün ohne semantische Bedeutung | Verwirrung |
| Reines `#000000` Text (Light) | Zu hart |
| Reines `#FFFFFF` Background (Light) | Zu klinisch |

---

## 12. Implementierungs-Hinweis (für spätere Sprints)

**Aktueller Stand (app-v2):** Nur Dark Tokens implementiert.

**Nächster Schritt (nicht Sprint 1):**

```
src/design/
  colors.ts        → darkColors, lightColors
  colorRoles.ts    → getColorRoles(theme)
  theme.ts         → ThemeProvider
```

Sprint 1 definiert nur die Spezifikation — keine Code-Änderung.

---

## 13. Verwandte Dokumente

- `ER_VISUAL_LANGUAGE.md`
- `ER_TYPOGRAPHY.md`
- `ER_COMPONENT_LIBRARY.md`
- `ER_DESIGN_EVOLUTION_V2.md`
