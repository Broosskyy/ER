# Brand Guidelines — Eternal Rave

**Sprint:** 12.7B  
**Status:** Foundation document — no new logos designed  
**Last updated:** July 2026

---

## 1. Brand name

| Rule | Value |
|------|-------|
| Official name | **Eternal Rave** |
| Capitalization | Title case: `Eternal Rave` |
| Incorrect | `eternal rave`, `EternalRave`, `ETERNAL RAVE` (except logos) |
| Abbreviation | `ER` — internal / repo only, not public marketing |
| Tagline | Discover. Connect. Rave. |
| German description | Entdecke elektronische Musikveranstaltungen, speichere Events und bleibe über Updates informiert. |

### Usage contexts

| Context | Format |
|---------|--------|
| App store listing | Eternal Rave |
| In-app header | Eternal Rave |
| Social bios | Eternal Rave |
| Legal / copyright | © 2026 Eternal Rave |
| Code / packages | `eternal-rave`, `com.eternalrave.app` |

---

## 2. Logo & icon usage

### Current assets

| Asset | Path | Dimensions | Format |
|-------|------|------------|--------|
| App icon | `app-v2/assets/images/icon.png` | 1024×1024 | PNG, RGB, no alpha |
| Splash icon | `app-v2/assets/images/splash-icon.png` | 1024×1024 | PNG, RGB |
| Favicon | `app-v2/assets/images/favicon.png` | 48×48 | PNG |
| PWA icons | `app-v2/public/pwa/icon-*.png` | 192, 512 | PNG |
| Apple touch icon | `app-v2/public/pwa/apple-touch-icon.png` | 180×180 | PNG |
| Reference splash logo | `reference/assets/onboarding/02_Splash_Logo.png` | 1536×1024 | PNG (archive only) |

### Rules

- Use the **official app icon** for store listings, social avatars, and PWA
- **Do not** stretch, rotate, or skew the icon
- **Do not** add effects (drop shadows, gradients, outlines) to the icon
- **Do not** place the icon on busy backgrounds without sufficient contrast
- Minimum clear space: **1× icon radius** on all sides
- App Store icon: 1024×1024, **no transparency**, **no rounded corners** (Apple applies mask)

### Missing assets (do not create in this sprint)

| Asset | Needed for |
|-------|------------|
| SVG vector logo | Print, large-format, partner materials |
| Horizontal wordmark | Website header, press kit |
| Monochrome logo | Single-color contexts |
| Store screenshots | App Store, Play Store |
| Play feature graphic (1024×500) | Play Store listing |
| Social banners | Twitter/X header, YouTube channel art |

---

## 3. Colors

Source of truth: `app-v2/src/design/colors.ts`

### Primary palette

| Name | Hex | Token | Usage |
|------|-----|-------|-------|
| Background | `#0B0B0F` | `colors.background` | App background, splash, PWA theme |
| Surface | `#15151B` | `colors.surface` | Cards, inputs, nav bar |
| Surface elevated | `#1F1F27` | `colors.surfaceElevated` | Badges, elevated cards |
| Primary | `#7C3AED` | `colors.primary` | CTAs, active nav, chips, links |
| Primary highlight | `#A855F7` | `colors.primaryHighlight` | Pressed states, hover |
| Primary deep | `#4C1D95` | `colors.primaryDeep` | Deep accents |

### Text & UI

| Name | Hex | Token | Usage |
|------|-----|-------|-------|
| Text primary | `#F5F5F5` | `colors.textPrimary` | Headlines, body |
| Text secondary | `#9CA3AF` | `colors.textSecondary` | Metadata, placeholders |
| Border | `#2A2A35` | `colors.border` | Dividers, card borders |
| Live / favorite | `#EF4444` | `colors.live` | Live badge, active heart |
| Success | `#22C55E` | `colors.success` | Confirmations |
| Warning | `#F59E0B` | `colors.warning` | Alerts |

### Color rules

- UI is **dark-mode first** (`userInterfaceStyle: 'dark'`)
- Primary purple is the **only** accent hue for interactive elements
- Do not introduce new accent colors without updating design tokens
- Ensure **WCAG AA contrast** for text on surfaces (verify during implementation)
- Web/PWA `theme-color` and `background-color`: `#0B0B0F`

---

## 4. Typography

Source of truth: `app-v2/src/design/typography.ts`

### Font family

| Role | Current | Target |
|------|---------|--------|
| Primary | System sans-serif (iOS SF Pro, Android Roboto) | Clean sans-serif per mockups |
| Monospace | `SpaceMono-Regular.ttf` bundled but **unused** | Dev/debug only if needed |

**No custom brand font is wired.** Use platform system fonts until a typeface is selected and licensed.

### Type scale

| Token | Size | Weight | Typical use |
|-------|------|--------|-------------|
| `display` | 30px | Bold | Hero titles |
| `xxl` | 24px | Bold/Semibold | Screen titles |
| `xl` | 20px | Semibold | Section headers |
| `md` | 16px | Regular/Semibold | Body, card titles |
| `base` | 14px | Regular | Secondary body, search |
| `sm` | 13px | Regular/Medium | Captions, chips |
| `xs` | 12px | Medium | Nav labels |

### Typography rules

- Use semantic roles (`textRoles.screenTitle`, etc.) — not raw font sizes in screens
- Line height: tight (1.2) for titles, normal (1.4) for body
- Do not use more than **2 weights** per screen (regular + semibold/bold)

---

## 5. Spacing & layout

Source of truth: `app-v2/src/design/spacing.ts`, `layout.ts`

| Token | Value | Usage |
|-------|-------|-------|
| Screen padding | 16px | Horizontal screen margins |
| Card padding | 12–16px | Event cards |
| Min touch target | 44px | Buttons, icons |
| Bottom nav height | 58px | Tab bar |
| Max content width (mobile) | 480px | Narrow layout cap |
| Border radius (cards) | 12px | Per `radii` tokens |

---

## 6. Iconography

- Tab bar icons: 22–24px, outline style (Ionicons via `@expo/vector-icons`)
- Active tab: `colors.primary`
- Inactive tab: `colors.textSecondary`
- Event metadata icons: 16–20px, secondary color

---

## 7. Imagery

- Event posters: 4:3 thumbnails in lists, 16:9 hero on detail
- Use `imageOverlayGradientEnd` for text-over-image readability
- No stock photos for brand marketing until a photo style is defined
- Demo images in `assets/demo/` are **not** for production marketing

---

## 8. Voice & tone (structural only)

Not marketing copy — structural guidance for future content:

| Attribute | Direction |
|-----------|-----------|
| Tone | Direct, energetic, inclusive |
| Language | German for DE market UI; English tagline for international |
| Avoid | Jargon-heavy techno gatekeeping, aggressive hype |
| CTAs | Short verbs: Discover, Save, Explore |

---

## 9. Asset inventory & gaps

### Present

- [x] App icon (all platforms)
- [x] Splash screen (dark background)
- [x] Favicon + PWA icons
- [x] Android adaptive icons
- [x] Design tokens (colors, typography, spacing)

### Missing

- [ ] Vector logo (SVG)
- [ ] Wordmark
- [ ] Brand font license
- [ ] App Store screenshots (6.7", 6.5", 5.5", iPad)
- [ ] Play Store screenshots + feature graphic
- [ ] Press kit (PDF/ZIP)
- [ ] Social media banner templates
- [ ] Email signature template

---

## 10. File reference

| Resource | Path |
|----------|------|
| Color tokens | `src/design/colors.ts` |
| Typography | `src/design/typography.ts` |
| Spacing | `src/design/spacing.ts` |
| Layout | `src/design/layout.ts` |
| App config (name) | `src/design/layout.ts` → `appConfig` |
| Design guidelines (UI) | `docs/DESIGN_GUIDELINES.md` |
| Design system | `docs/DESIGN_SYSTEM.md` |
| PWA manifest | `public/manifest.webmanifest` |

---

## Related docs

- [Business setup](business-setup.md)
- [Design guidelines (UI implementation)](DESIGN_GUIDELINES.md)
- [Design system](DESIGN_SYSTEM.md)
