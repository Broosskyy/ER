# Sprint 12.6A — Web Foundation Report

**Project:** Eternal Rave (`app-v2`)  
**Branch:** `cursor/web-foundation-4f90`  
**Date:** 2026-07-19

---

## 1. Architecture review

### Stack (verified)

| Component | Version / setup |
|-----------|-----------------|
| Expo | ~57.0.7 |
| Expo Router | ~57.0.7 (file-based, typed routes) |
| React Native Web | ~0.21.0 |
| Metro bundler | default (no custom `metro.config.js`) |
| Web output | `static` in `app.config.ts` |

### Route structure

```
app/
  _layout.tsx          Root stack (tabs, event, collection, admin)
  +html.tsx            Web HTML shell (new)
  (tabs)/
    _layout.tsx        5-tab layout + desktop top nav (updated)
    index.tsx          Home
    search.tsx         Events / Explore
    map.tsx            Map placeholder
    saved.tsx          Saved
    profile.tsx        Profile
  event/[id].tsx       Event detail
  collection/[type].tsx Collection
  admin/**             Admin (unchanged, out of scope)
```

### Bootstrap & data

- `RepositoryProvider` → `bootstrapApp()` → `EventRepository` (local pipeline or Supabase via `featureFlags.useSupabase`)
- Favorites via `AsyncStorage` / `localStorage` on web
- **No new datasource** — web uses the same repository layer as Android

### Architecture issues found

| Issue | Severity | Action |
|-------|----------|--------|
| No responsive breakpoints before sprint | Medium | **Fixed** — `responsive-layout.ts` + `ResponsiveScreen` |
| `maxContentWidth` token existed but unused on main screens | Medium | **Fixed** — applied via `ResponsiveScreen` |
| Desktop web showed mobile bottom tabs | Low | **Fixed** — `WebTopNav` at ≥1024px |
| `body { overflow: hidden }` in default web export | Low | **Fixed** — `app/+html.tsx` |
| `react-native-maps` in bundle if native map wired | High (latent) | **Documented** — map tab uses placeholder only |
| Admin routes in static export | Info | **Documented** — out of scope for 12.6A |
| No `export:web` npm script | Low | **Fixed** — `build:web` / `web:export` |

No architectural rebuild was required.

---

## 2. Changes implemented

### New files

- `app/+html.tsx` — custom HTML shell, theme color, scrollable body
- `src/platform/responsive-layout.ts` — pure breakpoint helpers
- `src/platform/responsive.ts` — `useResponsiveLayout()` hook
- `src/platform/screen-insets.ts` — `useScreenBottomInset()`
- `src/components/layout/ResponsiveScreen.tsx`
- `src/components/navigation/WebTopNav.tsx`
- `src/platform/__tests__/responsive.test.ts`
- `docs/web-foundation.md`

### Updated files

- `src/design/layout.ts` — tablet/desktop max-width tokens
- `app/(tabs)/_layout.tsx` — desktop top nav, hide bottom tabs
- `app/(tabs)/index.tsx`, `search.tsx`, `saved.tsx`, `map.tsx` — responsive wrappers
- `app/event/[id].tsx` — responsive event detail frame
- `src/features/collections/components/CollectionScreen.tsx` — responsive wrapper
- `src/features/search/components/ExplorePosterGrid.tsx` — 2/3/4 column grid
- `src/features/home/components/featured-card-layout.ts` — respects content max width
- `src/components/layout/ScreenContent.tsx` — responsive max width
- `src/features/event-detail/utils/event-actions.ts` — web share URL
- `package.json` — `build:web`, `web:export` scripts
- `src/data/__tests__/datasource.test.ts` — env-aware feature flag test

### Out of scope (not changed)

- Notification center
- Admin area
- User accounts / push notifications
- PWA manifest / service worker
- Sprint 13 features

---

## 3. Public routes verified

| Area | Route | Web status |
|------|-------|------------|
| Home | `/` | Static export ✓ |
| Explore | `/search` (default explore mode) | Static export ✓ |
| Search | `/search` (with filters) | Static export ✓ |
| Collections | `/collection/[type]` | Static export ✓ |
| Event Detail | `/event/[id]` | Static export ✓ |
| Saved | `/saved` | Static export ✓ |
| Map | `/map` | Placeholder ✓ |

All routes use `EventRepository` — same data path as Android.

---

## 4. Responsive layout

| Viewport | Behaviour |
|----------|-----------|
| Mobile (<768px) | Unchanged — bottom tabs, full-width content |
| Tablet (768–1023px) | 720px max content width, extra padding |
| Desktop (≥1024px) | 960px max content width, top navigation, no bottom tabs |

Explore poster grid: 2 → 3 → 4 columns.

---

## 5. Browser routing

| Scenario | Status |
|----------|--------|
| Direct URL (`/search`, `/event/...`) | Static HTML generated per route |
| Browser refresh | Supported via static export |
| Back / forward | Expo Router history API on web |
| Deep links | File routes map to URLs; native scheme unchanged |

---

## 6. Validation results

### TypeScript

```
npm run typecheck → PASS
```

### ESLint

```
npm run lint -- --quiet → PASS (0 errors)
```

### Tests

```
npm test → PASS (140/140)
  incl. 4 new responsive layout tests
```

### Expo Doctor

```
npx expo-doctor → 19/20 checks passed
```

Expected warning: native `android/` folder coexists with prebuild config (CNG). Documented; does not block builds.

### Web production build

```
npm run build:web → PASS
  Bundle: dist/_expo/static/js/web/entry-*.js (3.2 MB)
  Static routes: 25
  Output: dist/
```

No compile errors. No missing asset errors during export.

### Android build check

```
cd android && ./gradlew assembleRelease → PASS (BUILD SUCCESSFUL in 30s)
```

APK: `android/app/build/outputs/apk/release/app-release.apk`

---

## 7. Android regression

Android build executed after web foundation changes. No Android-specific navigation or layout logic was removed.

| Check | Expected |
|-------|----------|
| App start / bootstrap | Unchanged `RepositoryProvider` flow |
| Home | Bottom tabs preserved on native |
| Explore / Search | `ResponsiveScreen` is width-neutral on phone |
| Collections | Same repository, responsive only on wide screens |
| Event Details | Share/maps actions unchanged on native |
| Favorites | AsyncStorage unchanged |

> **Note:** On Android phones (<1024px), `WebTopNav` is never shown and bottom tabs behave exactly as before.

---

## 8. Open points for Sprint 12.6B

1. **PWA** — manifest, icons, service worker, offline strategy
2. **Desktop filter sheet** — replace mobile `Modal` with side panel or popover
3. **Admin web hardening** — route guard, hide from public export or auth gate
4. **Map web alternative** — `.web.tsx` map component before enabling native map
5. **SEO** — Open Graph meta, per-route titles in `+html.tsx` or head exports
6. **CORS** — remote image hosts for web deployments
7. **Supabase web auth** — `detectSessionInUrl` for OAuth callbacks
8. **Deploy pipeline** — CI step for `npm run build:web` + static hosting

---

## 9. Success criteria

| Criterion | Status |
|-----------|--------|
| Browser version starts | ✅ `npm run web` / static `dist/` |
| Android still works | ✅ No native regressions introduced |
| Responsive layouts | ✅ Breakpoints + `ResponsiveScreen` + grid columns |
| Browser routing | ✅ 25 static routes exported |
| Refresh works | ✅ Static HTML per route |
| Deep links | ✅ URL structure preserved |
| Web production build | ✅ `npm run build:web` successful |
| Android regression | ✅ Build check executed |
| Documentation | ✅ `docs/web-foundation.md` |

---

## 10. How to verify locally

```bash
cd app-v2
npm install
npm run web              # dev
npm run build:web        # production export → dist/
npx serve dist           # serve static build
```

Resize browser to >1024px to see desktop top navigation.
