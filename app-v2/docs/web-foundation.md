# Web Foundation

Sprint 12.6A establishes the browser baseline for Eternal Rave on top of the existing Expo + React Native codebase.

## Architecture

| Layer | Implementation |
|-------|----------------|
| Framework | Expo SDK 57, React Native 0.86, React 19 |
| Routing | Expo Router (file-based, static web export) |
| Web runtime | React Native Web via Metro bundler |
| Data | Existing `EventRepository` + datasource bundle (local or Supabase via feature flags) |
| State | `RepositoryProvider`, `FavoritesProvider`, `SearchProvider` — platform-agnostic |
| Bootstrap | `bootstrapApp()` gates app start until `EventRepository` is ready |

No separate web app or duplicate screens were introduced. Public screens share one implementation for Android, iOS, and web.

## Routing

### Public routes

| Route | Screen |
|-------|--------|
| `/` | Home |
| `/search` | Events / Search (Explore + filters) |
| `/map` | Map placeholder |
| `/saved` | Saved favorites |
| `/profile` | Profile |
| `/event/[id]` | Event detail |
| `/collection/[type]` | Collection list |

### Web behaviour

- **Static export:** `app.config.ts` sets `web.output: 'static'`
- **Direct URL access:** routes are pre-rendered into `dist/` during `npm run build:web`
- **Browser refresh:** static HTML per route supports reload without client-only routing gaps
- **History:** Expo Router uses the browser history API on web; back/forward work for stack and tab navigation
- **Deep links:** native scheme `eternal-rave://` remains configured; web URLs map 1:1 to file routes

Custom HTML shell: `app/+html.tsx` (title, theme color, scrollable body fix).

## Responsive behaviour

Breakpoints (`src/platform/responsive-layout.ts`):

| Breakpoint | Width | Content max width | Notes |
|------------|-------|-------------------|-------|
| Mobile | `< 768px` | full width | unchanged mobile UX |
| Tablet | `768–1023px` | 720px | extra horizontal padding |
| Desktop | `≥ 1024px` | 960px | top navigation, no bottom tabs |

### Components

- `ResponsiveScreen` — centers content and applies max width on tablet/desktop
- `WebTopNav` — desktop-only top navigation (Home, Events, Map, Saved, Profile)
- `useScreenBottomInset()` — removes bottom tab padding when top nav is active
- `ExplorePosterGrid` — 2 / 3 / 4 columns by breakpoint

Applied to: Home, Search, Saved, Map, Event Detail, Collections.

## Platform compatibility

| API | Web handling |
|-----|----------------|
| `AsyncStorage` | localStorage via `@react-native-async-storage/async-storage` |
| `Linking` | opens URLs in browser; maps use Google Maps HTTPS fallback |
| `Share` | Web Share API when available; includes page URL on web |
| `StatusBar` / `NavigationBar` | Android-only guards preserved |
| `BackHandler` | guarded to Android only in filter sheets |
| `react-native-maps` | not mounted on any route; map tab shows placeholder |

## Known limitations (Sprint 12.6D+)

- PWA manifest, icons, and production service worker are documented in [pwa.md](./pwa.md)
- Admin routes are exported statically and reachable by URL (protected by auth guards)
- Native map (`react-native-maps`) requires `.web.tsx` alternative before enabling
- Filter sheet uses mobile `Modal` pattern — usable on desktop but not optimised
- Remote notification images may hit CORS depending on host
- Supabase `detectSessionInUrl` is not configured for web OAuth callbacks
- Dynamic SEO/SSR is not available in static export

## Build commands

### Development

```bash
cd app-v2
npm install
npm run web          # Expo dev server for browser
```

### Production web export

```bash
cd app-v2
npm run build:web    # outputs to dist/
```

Serve locally (example):

```bash
npx serve dist
```

### Android (unchanged)

```bash
cd app-v2
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
```

### Validation

```bash
npm run typecheck
npm run lint
npm test
npx expo-doctor
```

## File map

| Path | Purpose |
|------|---------|
| `app/+html.tsx` | Web HTML shell |
| `app/(tabs)/_layout.tsx` | Bottom tabs + desktop top nav |
| `src/platform/responsive-layout.ts` | Pure breakpoint helpers (testable) |
| `src/platform/responsive.ts` | `useResponsiveLayout()` hook |
| `src/platform/screen-insets.ts` | Bottom inset aware of web top nav |
| `src/components/layout/ResponsiveScreen.tsx` | Responsive content wrapper |
| `src/components/navigation/WebTopNav.tsx` | Desktop navigation bar |
