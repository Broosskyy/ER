# Performance — Eternal Rave Web

**Sprint:** 12.7D  
**Last updated:** July 2026

---

## 1. Core Web Vitals targets

| Metric | Target | Description |
|--------|--------|-------------|
| **LCP** | < 2.5s | Largest Contentful Paint |
| **INP** | < 200ms | Interaction to Next Paint |
| **CLS** | < 0.1 | Cumulative Layout Shift |
| **FCP** | < 1.8s | First Contentful Paint |
| **TTFB** | < 800ms | Time to First Byte (hosting) |

### Current status (static export analysis)

| Metric | Estimate | Risk | Notes |
|--------|----------|------|-------|
| LCP | Good-Medium | Hero images on home | Lazy load below fold |
| INP | Good | RN Web overhead | Minimal interactions on load |
| CLS | Good | Fixed layout tokens | Safe area handled |
| FCP | Medium | JS bundle size | Expo/RN Web baseline |
| TTFB | Depends on host | CDN recommended | Static files fast |

**Measurement:** Run Lighthouse on production deploy. CI does not run Lighthouse automatically.

---

## 2. Lighthouse targets

| Category | Target | Notes |
|----------|--------|-------|
| Performance | ≥ 90 | Limited by RN Web bundle |
| Accessibility | ≥ 95 | Audit alt texts, contrast |
| Best Practices | ≥ 95 | HTTPS, no console errors |
| SEO | ≥ 95 | After 12.7D meta/sitemap |
| PWA | No critical errors | Installable, SW registered |

### How to run

```bash
npm run build:web
npx serve dist -p 4173
npx lighthouse http://localhost:4173 --only-categories=performance,accessibility,best-practices,seo,pwa --view
```

---

## 3. Bundle & assets

| Asset | Strategy |
|-------|----------|
| JS bundles | Expo hashed chunks in `/_expo/` |
| Images | Event posters — use appropriate sizes |
| Fonts | System font (no web font load) |
| Icons | PWA icons precached by SW |
| Analytics | Loaded only after consent (zero impact until opt-in) |

### Recommendations

- Enable Brotli/Gzip on hosting
- CDN for static assets
- Do not load GA4 until consent
- Keep service worker cache version bumped on releases

---

## 4. Caching

| Layer | Policy |
|-------|--------|
| Service worker | Cache-first for `/_expo/`, `/assets/` |
| HTML | Network-first |
| Admin | Network-only (bypass SW) |
| Supabase API | Not cached by SW |

---

## 5. Render blocking

- Minimal inline CSS in `+html.tsx` for body background
- JS loaded via Expo bundle (defer via module)
- No external render-blocking fonts

---

## 6. Image optimization

| Context | Recommendation |
|---------|----------------|
| Event list thumbnails | Fixed dimensions in layout |
| Hero images | Aspect ratio locked (16:9) |
| OG image | 512×512 PNG |
| Future | WebP/AVIF via CDN (Cloudflare Polish) |

---

## 7. Performance impact of 12.7D

| Addition | Impact |
|----------|--------|
| SEO meta module | Negligible (client-side DOM updates) |
| JSON-LD scripts | Small per-page |
| Analytics (consent off) | **Zero** — script not loaded |
| Analytics (consent on) | +1 gtag.js request (~45KB) |
| robots.txt / sitemap | Static files, no runtime cost |

---

## 8. Known bottlenecks

- React Native Web bundle size (framework baseline)
- No image CDN yet
- Map tab placeholder (no heavy map SDK on web)
- Single-locale static export

---

## 9. Future optimizations (12.7E+)

- Route-based code splitting review
- Image CDN + responsive images
- Preconnect to Supabase origin
- Critical CSS extraction (if bundle grows)
- RUM via GA4 after consent

---

## Related docs

- [SEO](seo.md)
- [PWA](pwa.md)
- [Web deployment](web-deployment.md)
