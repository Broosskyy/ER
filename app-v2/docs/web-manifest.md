# Web App Manifest — Eternal Rave

**Sprint:** 12.7D  
**Last updated:** July 2026

---

## 1. Manifest file

**Path:** `public/manifest.webmanifest`  
**Linked from:** `app/+html.tsx`, `app.config.ts` web config

---

## 2. Configuration

| Field | Value | Notes |
|-------|-------|-------|
| `name` | Eternal Rave | Full name |
| `short_name` | Eternal Rave | Home screen label |
| `description` | German tagline | Matches PWA_CONFIG |
| `start_url` | `/` | Entry point |
| `scope` | `/` | Entire app |
| `id` | `/` | Manifest V3 app id |
| `display` | `standalone` | Full-screen without browser UI |
| `orientation` | `portrait` | Matches mobile app |
| `lang` | `de` | German |
| `theme_color` | `#0B0B0F` | Status bar / browser chrome |
| `background_color` | `#0B0B0F` | Splash background |
| `categories` | `entertainment`, `music` | Store-style categorization |

---

## 3. Icons

| File | Size | Purpose |
|------|------|---------|
| `/pwa/icon-192.png` | 192×192 | Android/PWA |
| `/pwa/icon-512.png` | 512×512 | Splash, install |
| `/pwa/icon-maskable-512.png` | 512×512 | Adaptive icon safe zone |
| `/pwa/apple-touch-icon.png` | 180×180 | iOS home screen (web) |
| `/favicon.png` | 48×48 | Browser tab |

Generate: `npm run generate:pwa-icons`

---

## 4. Installability

| Requirement | Status |
|-------------|--------|
| HTTPS | Required at deploy |
| manifest.webmanifest | ✓ |
| Service worker | ✓ (`public/sw.js`, prod only) |
| Icons 192 + 512 | ✓ |
| start_url | ✓ |
| display standalone | ✓ |

Validated by `npm run validate:pwa`

---

## 5. Offline behavior

- **Strategy:** Online-first
- SW precaches shell assets + offline.html
- HTML pages: network-first, fallback to offline page
- Event data: requires network (Supabase or mock in bundle)
- Admin: never cached

---

## 6. Future extensions

| Feature | Status |
|---------|--------|
| `screenshots` | Not added — needed for richer install UI |
| `shortcuts` | Not added — quick actions to Search/Saved |
| `share_target` | Not planned |
| `protocol_handlers` | Custom scheme via native app |

---

## 7. Icon audit (Sprint 12.7D)

| Asset | Format | Transparency | Brand consistent |
|-------|--------|--------------|------------------|
| favicon.png | PNG | No | ✓ |
| icon-192/512 | PNG RGB | No | ✓ |
| maskable-512 | PNG on `#0B0B0F` | No | ✓ |
| apple-touch-icon | PNG | No | ✓ |
| OG image | icon-512.png | No | ✓ |
| favicon.svg | **Missing** | — | Future |
| favicon.ico | Build output | — | Generated at export |

---

## Related docs

- [PWA](pwa.md)
- [SEO](seo.md)
- [Brand guidelines](brand.md)
