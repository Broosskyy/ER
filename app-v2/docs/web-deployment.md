# Web Deployment

## Prerequisites

- Node.js 20+ recommended
- npm dependencies installed in `app-v2/`
- Environment variables configured for target environment

## Install

```bash
cd app-v2
npm install
```

## Environment variables

| Variable | Client-safe | Required when |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | yes | `EXPO_PUBLIC_USE_SUPABASE=true` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | `EXPO_PUBLIC_USE_SUPABASE=true` |
| `EXPO_PUBLIC_USE_SUPABASE` | yes | optional (default mock mode) |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | yes | optional (maps) |
| `EXPO_PUBLIC_WEB_BASE_URL` | yes | optional (Open Graph URL) |
| `EXPO_PUBLIC_WEB_NOINDEX` | yes | optional (`true` for preview/staging) |
| `SUPABASE_SERVICE_ROLE_KEY` | **no** | server-side only |

Validate environment:

```bash
npm run validate:env
npm run validate:env -- --production
```

Never set `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.

## Production build

```bash
npm run build:web
```

Output directory: `app-v2/dist/`

Post-build validation:

```bash
npm run validate:build-output
```

Full release check:

```bash
npm run release:check
```

## Hosting requirements

Eternal Rave uses **Expo static export**. Each route is emitted as HTML (for example `search.html`, `event/[id].html`).

### Static hosting platforms

Compatible with:

- Vercel
- Netlify
- Cloudflare Pages
- any static file host with HTTPS

### HTTPS

Required for:

- Supabase auth in production
- PWA installability
- secure cookies/session behavior

### SPA / deep-link rewrites

Expo static export already emits per-route HTML files. Many hosts work without extra rewrites.

If your host only serves `index.html` for unknown paths, add a fallback rewrite to the matching HTML file or to `/index.html` according to your host docs.

#### Example: Vercel (`vercel.json`)

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Use only if your host requires SPA fallback. Do not rewrite `/_expo/*`, `/assets/*`, `/sw.js`, or `/manifest.webmanifest`.

#### Example: Netlify (`public/_redirects` or `netlify.toml`)

```
/*    /index.html   200
```

#### Example: Cloudflare Pages

Configure a single-page application fallback only if direct route HTML files are not served automatically.

## Manifest and service worker

Ensure these files are deployed from `dist/`:

- `/manifest.webmanifest`
- `/sw.js`
- `/offline.html`
- `/pwa/*`
- `/favicon.ico`

## Cache headers (recommended)

| Asset | Recommendation |
|---|---|
| `/_expo/static/*` (hashed) | `Cache-Control: public, max-age=31536000, immutable` |
| `/assets/*` | long-lived cache |
| `/index.html`, route HTML | short cache or `no-cache` |
| `/sw.js` | `no-cache` or very short TTL |
| `/manifest.webmanifest` | short TTL |

## Security headers (recommended baseline)

Configure at the host/CDN:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (restrict unused APIs)
- `Strict-Transport-Security` on HTTPS production domains

Content-Security-Policy should be tuned per host and tested before enforcement. Include Supabase domains if using remote data/images.

## Supabase configuration

- Use anon key in client bundle only
- Keep RLS enabled
- Assign admin roles via `app_metadata.role`

## Smoke test after deploy

1. Open home page
2. Open `/search`, `/saved`, `/notifications`
3. Open an event detail URL directly
4. Refresh on an inner route
5. Open `/admin/login`, sign in, open a subpage, sign out
6. Verify `/manifest.webmanifest` loads
7. Verify install prompt / add to home screen (HTTPS)
8. Simulate offline and confirm fallback banner/page

## Rollback

1. Redeploy previous known-good `dist/` artifact or hosting rollback
2. Database migrations are independent — do not auto-rollback DB
3. Users with an old service worker may need one reload after rollback
4. Re-run smoke tests

## Known limitations

- No SSR / SEO beyond client-side titles
- PWA service worker disabled on localhost
- Full offline mode is not supported
