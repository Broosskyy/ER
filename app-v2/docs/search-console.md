# Search Console & Webmaster Tools — Eternal Rave

**Sprint:** 12.7D  
**Status:** Preparation only — no properties registered  
**Last updated:** July 2026

---

## 1. Google Search Console

### Property types

| Type | Recommendation | URL |
|------|----------------|-----|
| **Domain property** | Preferred long-term | `eternalrave.com` (example) |
| **URL prefix** | Faster initial setup | `https://www.<domain>.tld/` |

Domain property covers all subdomains and protocols. URL prefix is sufficient for launch.

### Verification methods

| Method | Implementation | Status |
|--------|----------------|--------|
| HTML meta tag | `EXPO_PUBLIC_GOOGLE_SITE_VERIFICATION` in `+html.tsx` | Prepared |
| HTML file upload | Host `google*.html` in `public/` | Manual at deploy |
| DNS TXT record | Add at registrar/Cloudflare | Documented in domain.md |
| Google Analytics | After GA4 active + consent | Future |
| GTM | Not used | — |

### Post-verification checklist

- [ ] Submit `sitemap.xml` URL
- [ ] Request indexing for homepage
- [ ] Monitor Coverage report
- [ ] Review Core Web Vitals
- [ ] Fix crawl errors
- [ ] Set geographic target (Germany) if needed

### Sitemap registration

```
https://www.<domain>.tld/sitemap.xml
```

Regenerate before submit: `npm run generate:seo` with `EXPO_PUBLIC_WEB_BASE_URL` set.

### Monitoring

| Report | Purpose |
|--------|---------|
| Performance | Queries, clicks, CTR, position |
| Indexing | Indexed vs excluded pages |
| Experience | Core Web Vitals |
| Enhancements | Structured data validity |

---

## 2. Bing Webmaster Tools

### Setup steps (manual)

1. Create Microsoft account / use org account
2. Add site `https://www.<domain>.tld/`
3. Verify via:
   - Import from Google Search Console (easiest)
   - HTML meta tag (add `msvalidate.01` — future env var)
   - DNS CNAME
4. Submit same `sitemap.xml`
5. Configure crawl rate (default)

### Import from Google

After GSC verification, Bing can import site configuration — reduces duplicate setup.

### robots.txt

Bing respects same `robots.txt` as Google. Ensure `Sitemap:` directive uses absolute URL in production.

---

## 3. Error monitoring

| Error type | Source | Action |
|------------|--------|--------|
| 404 crawl errors | GSC/Bing | Fix links or add redirects |
| Soft 404 | SPA routes | Ensure static export includes routes |
| Server errors | Hosting | Check deploy logs |
| Structured data errors | Rich Results Test | Fix JSON-LD |

---

## 4. Environment variables

| Variable | Service |
|----------|---------|
| `EXPO_PUBLIC_WEB_BASE_URL` | Canonical + sitemap |
| `EXPO_PUBLIC_GOOGLE_SITE_VERIFICATION` | GSC HTML tag |
| `EXPO_PUBLIC_WEB_NOINDEX` | Block staging indexing |

---

## 5. Manual steps (ordered)

1. Deploy web app to production domain with HTTPS
2. Set `EXPO_PUBLIC_WEB_BASE_URL`
3. Run `npm run generate:seo`
4. Redeploy with updated robots.txt/sitemap
5. Register GSC property + verify
6. Submit sitemap
7. Register Bing + import from Google
8. Monitor weekly for first month

---

## Related docs

- [SEO](seo.md)
- [Domain strategy](domain.md)
- [Performance](performance.md)
