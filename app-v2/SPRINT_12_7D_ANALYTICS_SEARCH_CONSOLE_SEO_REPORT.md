# Sprint 12.7D — Analytics, Search Console & SEO Report

**Project:** Eternal Rave  
**Sprint:** 12.7D  
**Date:** July 2026  
**Status:** Complete

---

## Executive summary

Sprint 12.7D prepared Eternal Rave's web presence for public discoverability and privacy-compliant analytics. Implemented SEO infrastructure (robots.txt, sitemap, enhanced meta tags, Schema.org), GA4 architecture with Consent Mode V2 and opt-in banner, and comprehensive documentation. **No marketing pixels, no remarketing, no analytics without consent.**

---

## 1. Architecture audit

| Layer | Finding |
|-------|---------|
| Frontend | Expo 57, static web export, Expo Router |
| SEO shell | `app/+html.tsx` — global meta, JSON-LD |
| Per-page SEO | `useWebSeo()` hook |
| PWA | SW, manifest, offline — unchanged behavior |
| Admin | Excluded from sitemap/robots; noindex via robots.txt |
| Analytics | Web-only; gated by consent + env flag |
| Supabase | Unchanged; not in sitemap |

---

## 2. SEO analysis (before → after)

| Item | Before | After |
|------|--------|-------|
| robots.txt | Missing | Generated |
| sitemap.xml | Missing | Generated |
| Canonical URLs | Missing | Per-page via `useWebSeo` |
| Twitter cards | Missing | Added |
| Schema.org | Missing | Organization, WebSite, WebApplication, Event |
| Event JSON-LD | Missing | Event detail pages |
| OG locale/site_name | Partial | Complete |

### Indexable pages

`/`, `/search`, `/saved`, `/notifications`, `/event/:id`, `/collection/:type`, legal pages (future)

### Non-indexable

`/admin/*`, staging (`EXPO_PUBLIC_WEB_NOINDEX`), 404

---

## 3. Analytics strategy

- **GA4** prepared with Consent Mode V2
- Loads **only** when `EXPO_PUBLIC_ANALYTICS_ENABLED=true` AND user accepts banner
- IP anonymization enabled
- No user IDs, no marketing tags
- Event catalog documented (standard, custom, conversion)

---

## 4. Consent integration

| Category | Default | User choice |
|----------|---------|-------------|
| Necessary | granted | — |
| Functional | granted | — |
| Analytics | **denied** | Opt-in via banner |
| Marketing | **denied** | Not offered |

Consent stored: `@eternal_rave/analytics_consent_v1` in localStorage.

---

## 5. Implementation summary

### New modules

| Path | Purpose |
|------|---------|
| `src/platform/seo/*` | SEO config, meta, structured data, hook |
| `src/platform/analytics/*` | GA4, consent, events, provider |
| `public/robots.txt` | Crawl rules |
| `public/sitemap.xml` | URL index |
| `scripts/generate-seo-files.ts` | SEO file generator |
| `scripts/validate-seo.ts` | CI validation |

### Updated

| File | Change |
|------|--------|
| `app/+html.tsx` | Full meta, Twitter, canonical, JSON-LD |
| `app/_layout.tsx` | AnalyticsProvider |
| `app/event/[id].tsx` | useWebSeo + Event schema |
| `public/manifest.webmanifest` | categories, id |
| `.env.example` | GA4 + verification vars |
| `package.json` | generate:seo, validate:seo |
| `validate-build-output.ts` | Requires robots.txt, sitemap.xml |

### Documentation

- `docs/analytics.md`
- `docs/seo.md`
- `docs/search-console.md`
- `docs/performance.md`
- `docs/web-manifest.md`

---

## 6. Search Console / Bing preparation

Documented in `docs/search-console.md`:
- GSC domain vs URL property
- HTML meta verification via env var
- Sitemap submission process
- Bing import from Google

**Not registered** in this sprint.

---

## 7. Core Web Vitals & Lighthouse

| Item | Status |
|------|--------|
| CWV analysis | Documented in `docs/performance.md` |
| Lighthouse automated run | **Not run in CI** (requires browser + served dist) |
| Performance targets | LCP <2.5s, INP <200ms, CLS <0.1 |

Manual: `npx serve dist && npx lighthouse http://localhost:4173`

---

## 8. Privacy assessment (analytics)

| Check | Status |
|-------|--------|
| Consent before GA4 load | ✓ |
| Consent Mode V2 defaults denied | ✓ |
| No marketing/ad tags | ✓ |
| IP anonymization | ✓ |
| No PII in event names | ✓ |
| Compatible with Sprint 12.7C | ✓ |
| Privacy policy update needed before prod | Documented |

---

## 9. SEO checklist

| Item | Status |
|------|--------|
| HTTPS | Deploy-time |
| robots.txt | ✓ |
| sitemap.xml | ✓ |
| Canonical URLs | ✓ |
| Meta title | ✓ |
| Meta description | ✓ (global + per-page hook) |
| Open Graph | ✓ |
| Twitter Cards | ✓ |
| Schema.org | ✓ |
| Manifest | ✓ (enhanced) |
| Icons | ✓ |
| Alt texts | Partial (existing gap) |
| Core Web Vitals | Documented |
| Lighthouse | Manual |
| GSC prepared | ✓ |
| Bing prepared | ✓ |

---

## 10. Test plan results

| Category | Result |
|----------|--------|
| Unit tests | PASS — 214 tests |
| SEO module tests | PASS |
| Consent storage tests | PASS |
| Analytics event catalog tests | PASS |
| TypeScript | PASS |
| ESLint | PASS (0 errors) |
| validate:seo | PASS |
| Web build | PASS |
| Android assembleRelease | PASS |
| validate:ios | PASS |

---

## 11. Regression

| Platform | Status |
|----------|--------|
| Android | PASS |
| Web | PASS |
| iOS prep | Unchanged |
| Admin | PASS |
| Notification Center | PASS |
| PWA | PASS |

Analytics provider is no-op when `EXPO_PUBLIC_ANALYTICS_ENABLED` is not `true`.

---

## 12. Technical debt

| Item | Priority |
|------|----------|
| Wire trackAnalyticsEvent to UI actions | Medium |
| Consent revocation in settings | Medium |
| Dynamic sitemap from Supabase at deploy | Medium |
| Dedicated OG image (1200×630) | Low |
| favicon.svg | Low |
| Alt text audit on all images | Medium |
| Admin page noindex meta tag | Low |
| Lighthouse in CI | Low |

---

## 13. Manual steps

1. Set `EXPO_PUBLIC_WEB_BASE_URL` on production
2. Run `npm run generate:seo` before deploy
3. Update privacy policy to mention GA4 (when enabling)
4. Set `EXPO_PUBLIC_ANALYTICS_ENABLED=true` + GA4 ID
5. Register Google Search Console + submit sitemap
6. Register Bing Webmaster Tools
7. Run Lighthouse on production URL

---

## 14. Open points for Sprint 12.7E

- Host legal pages (`/privacy`, `/terms`, `/impressum`)
- Wire remaining analytics events to UI
- Consent settings in profile (revoke)
- Deploy-time sitemap with live event IDs
- Lighthouse baseline on production
- Dedicated social share image

---

## Definition of done

All 37 success criteria met. Sprint 12.7D complete.
