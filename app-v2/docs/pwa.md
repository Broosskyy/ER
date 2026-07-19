# Progressive Web App (PWA)

Sprint 12.6D adds an **installable online-first PWA foundation** to Eternal Rave.

## Current PWA level

| Capability | Status |
|---|---|
| Web App Manifest | yes |
| Installable (supported browsers) | yes, with service worker + HTTPS |
| Standalone display mode | yes |
| App icons (192/512/maskable) | yes |
| Service worker | yes (production web only) |
| Offline app shell fallback | partial (`offline.html` for navigation failures) |
| Full offline data | no |
| Offline writes | no |
| Push notifications | no |
| Background sync | no |

Eternal Rave remains **online-first**. Event data is loaded from repositories/Supabase at runtime.

## Manifest

- Path: `/manifest.webmanifest`
- Source: `public/manifest.webmanifest`
- Linked from `app/+html.tsx`

Key values:

- name: Eternal Rave
- short_name: Eternal Rave
- start_url: `/`
- scope: `/`
- display: `standalone`
- theme_color / background_color: `#0B0B0F`
- lang: `de`

## Icons

Generated from `assets/images/icon.png`:

| File | Size | Purpose |
|---|---|---|
| `public/pwa/icon-192.png` | 192×192 | install icon |
| `public/pwa/icon-512.png` | 512×512 | install / splash |
| `public/pwa/icon-maskable-512.png` | 512×512 | maskable safe area |
| `public/pwa/apple-touch-icon.png` | 180×180 | iOS home screen |
| `public/favicon.png` | source favicon | browser tab |

Regenerate:

```bash
npm run generate:pwa-icons
```

## Service worker

- Path: `/sw.js`
- Registered only on **production web** hosts (not `localhost`)
- Registration: `src/platform/pwa/register-service-worker.ts`
- Provider/banners: `src/platform/pwa/PwaProvider.tsx`

### Caching strategy

| Request type | Strategy |
|---|---|
| Hashed Expo bundles (`/_expo/`, `/assets/`) | cache-first |
| HTML navigation | network-first, fallback to `/offline.html` |
| `/admin/*` | network-only |
| Supabase / auth | network-only (not intercepted) |
| Non-GET | not cached |

### Cache versioning

Cache names include app version (`v0.2.0`). Old `eternal-rave-*` caches are deleted on service worker activation.

### Update behavior

When a new service worker is waiting, a small banner offers **Neu laden**. No forced reload loop.

## Offline behavior

- No connection: bottom banner with retry guidance
- Navigation failure while offline: `offline.html`
- Local notifications remain readable from AsyncStorage/localStorage
- Admin mutations are not supported offline (network-only paths)

## Installability

Browsers generally require:

- valid manifest
- HTTPS (except localhost dev)
- service worker (Chrome/Edge)

No custom install prompt is implemented. Use the browser install action.

### iOS notes

- Safari supports “Add to Home Screen” with manifest metadata
- iOS does not use the same install prompt as Chromium browsers
- Service worker support is more limited than Chrome

## Browser support assumptions

| Browser | Expected support |
|---|---|
| Chrome / Edge (desktop + Android) | primary target |
| Firefox | supported for web app usage |
| Safari desktop | supported with iOS caveats |
| Legacy browsers | not supported |

## Security

- Auth and admin responses are not cached by the service worker
- Logout remains protected by admin route guards (Sprint 12.6C)
- Do not add cache-first rules for API responses

## Known limitations

- No web push
- No background sync
- No offline event database
- Dynamic document titles are client-side only (no SSR SEO)
- Service worker is disabled on localhost to avoid dev cache confusion

## Future extensions (not in 12.6D)

- Web push notifications
- richer offline read models
- install analytics
- optional app shortcuts
