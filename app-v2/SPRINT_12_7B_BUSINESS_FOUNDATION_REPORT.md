# Sprint 12.7B — Domain, Email & Brand Foundation Report

**Project:** Eternal Rave  
**Sprint:** 12.7B  
**Date:** July 2026  
**Status:** Complete — documentation and preparation only; no domains registered, no accounts created, no publication

---

## 1. Analysis

### Existing project state (before 12.7B)

| Area | Finding |
|------|---------|
| Domain | No production domain configured; placeholders in `.env.example` and `ios-build.md` |
| Email | No business mailboxes; `admin@eternalrave.app` exists only as local dev mock |
| Brand assets | App icon, splash, PWA icons present; no vector logo or store screenshots |
| Legal pages | Privacy policy, terms, impressum not implemented |
| GitHub | README present; LICENSE, SECURITY.md, templates missing |
| Apple | iOS build prep complete (12.7A); store metadata templates in `ios-build.md` |
| Google Play | No dedicated Play Console doc; Android builds functional |
| Env vars | Supabase validated; no support/privacy URL vars |

### Architecture alignment

- Web app served as static export — `www.<domain>.tld` is the correct canonical origin
- Admin at `/admin` on same origin — no separate admin subdomain needed
- Supabase remains hosted backend — no custom API subdomain at launch
- iOS Universal Links prepared via `EXPO_PUBLIC_IOS_ASSOCIATED_DOMAIN`

---

## 2. Domain strategy

**Recommendation:** `https://www.<domain>.tld/` as canonical public URL.

| Path | Purpose |
|------|---------|
| `/` | Public app (web/PWA) |
| `/admin` | Admin area (web-only) |
| `/privacy`, `/terms`, `/impressum` | Legal (future) |
| `/support`, `/contact` | Contact pages (future) |

**TLD priority:** `.com` > `.de` > `.app` > `.io` (`.music` optional)

**Registrar:** Cloudflare Registrar or Namecheap; auto-renewal, WHOIS privacy, 2FA required.

Full detail: `docs/domain.md`

---

## 3. DNS concept

Documented record types with placeholders only:

- A / AAAA (apex)
- CNAME (`www`, optional `staging`)
- MX (mail provider)
- TXT (SPF, DKIM, DMARC, verification)
- TTL: 300s during setup, 3600s stable

No real DNS values created.

---

## 4. HTTPS

- HTTPS mandatory for all public endpoints
- Certificate management via hosting provider (auto Let's Encrypt)
- HSTS recommended after stable HTTPS (documented, not enabled)
- Well-known files documented: `apple-app-site-association`, `assetlinks.json`

---

## 5. Cloudflare evaluation

**Recommendation:** Use Cloudflare for DNS; enable proxy after HTTPS verification.

| Pros | Cons |
|------|------|
| At-cost DNS, DDoS protection, caching | Added complexity for cache debugging |
| WAF / bot protection | Advanced WAF needs paid tier |
| Image optimization (Polish) | Vendor coupling for DNS |

No active Cloudflare configuration performed.

---

## 6. Mail structure

### Functional addresses (all `@<domain>.tld`)

| Address | Role |
|---------|------|
| hello@ | General contact |
| support@ | User support (store requirement) |
| events@ | Event submissions |
| partners@ | Business partnerships |
| privacy@ | GDPR / data protection |
| legal@ | Legal notices |
| security@ | Vulnerability reports |
| press@ | Media |
| jobs@ | Hiring (optional) |
| noreply@ | Transactional (future) |
| admin@ | Internal only — never publish |

### Provider recommendation

**Google Workspace (Business Starter)** — best deliverability, SPF/DKIM/DMARC support, shared groups.

Full detail: `docs/email.md`

---

## 7. SPF / DKIM / DMARC

| Protocol | Status | Recommendation |
|----------|--------|----------------|
| SPF | Documented | `v=spf1 include:_spf.google.com ~all` → `-all` after validation |
| DKIM | Documented | 2048-bit key via provider; rotate every 6–12 months |
| DMARC | Documented | Phased: `p=none` → `p=quarantine` → `p=reject` |

No production DNS records published.

---

## 8. Branding audit

### Present assets

| Asset | Path | Status |
|-------|------|--------|
| App icon 1024 | `assets/images/icon.png` | PASS — RGB, no alpha |
| Splash | `assets/images/splash-icon.png` | PASS — `#0B0B0F` background |
| Favicon | `assets/images/favicon.png` | PASS |
| PWA icons | `public/pwa/*` | PASS |
| Android adaptive | `assets/images/android-icon-*` | PASS |
| Color tokens | `src/design/colors.ts` | PASS |
| Typography tokens | `src/design/typography.ts` | PASS (system font) |

### Missing assets

| Asset | Priority |
|-------|----------|
| SVG vector logo | High |
| Wordmark | High |
| App Store screenshots | High (required for submission) |
| Play feature graphic | High |
| Custom brand font | Low (system font acceptable for launch) |
| Press kit | Medium |
| Social banners | Medium |

Full detail: `docs/brand.md`

---

## 9. Brand guidelines

Created `docs/brand.md` covering:

- App name spelling and capitalization
- Logo/icon usage rules
- Color palette (from design tokens)
- Typography scale
- Spacing and layout
- Asset gaps

No new logos designed.

---

## 10. Social handles

Checklist documented in `docs/business-setup.md` for:

Instagram, TikTok, YouTube, Facebook, Threads, Bluesky, LinkedIn, GitHub, X, Discord, Telegram

Suggested handle: `@eternalrave` — verify availability before reserving.

No accounts created.

---

## 11. GitHub audit

| Item | Status |
|------|--------|
| README | Present |
| LICENSE | Missing |
| SECURITY.md (root) | Missing |
| CODE_OF_CONDUCT | Missing |
| CONTRIBUTING | Missing |
| Issue templates | Missing |
| PR template | Missing |
| App security doc | Present — `docs/security.md` |

Gaps documented; no files added (out of sprint scope for implementation).

---

## 12. Apple Developer preparation

| Item | Status |
|------|--------|
| Bundle ID | `com.eternalrave.app` — configured |
| EAS profiles | development, preview, production |
| TestFlight docs | `docs/ios-build.md` |
| Privacy policy URL | Placeholder — must host before submission |
| Support URL | Placeholder |
| `ascAppId` | Placeholder in `eas.json` |
| Organization enrollment | Manual step |
| 2FA | Manual step |

No enrollment or submission performed.

---

## 13. Google Play preparation

| Item | Status |
|------|--------|
| Package name | `com.eternalrave.app` |
| AAB builds | EAS production profile configured |
| Support email | Documented — `support@<domain>.tld` |
| Privacy URL | Placeholder |
| Store screenshots | Missing |
| Play Console enrollment | Manual step |

No enrollment or submission performed.

---

## 14. Environment variables

Updated `app-v2/.env.example` with placeholder business URLs and support email. Variables documented but not yet consumed by app code — wire when legal pages exist.

| Variable | Placeholder |
|----------|-------------|
| `EXPO_PUBLIC_WEB_BASE_URL` | `https://www.<domain>.tld` |
| `EXPO_PUBLIC_SUPPORT_URL` | `https://www.<domain>.tld/support` |
| `EXPO_PUBLIC_PRIVACY_URL` | `https://www.<domain>.tld/privacy` |
| `EXPO_PUBLIC_TERMS_URL` | `https://www.<domain>.tld/terms` |
| `EXPO_PUBLIC_MARKETING_URL` | `https://www.<domain>.tld` |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | `support@<domain>.tld` |

---

## 15. Changes in this sprint

| File | Change |
|------|--------|
| `docs/domain.md` | **New** — domain strategy, DNS, HTTPS, Cloudflare |
| `docs/email.md` | **New** — mail structure, provider, SPF/DKIM/DMARC |
| `docs/business-setup.md` | **New** — consolidated business prep, stores, GitHub, social |
| `docs/brand.md` | **New** — brand guidelines |
| `.env.example` | Updated — business URL/email placeholders |
| `README.md` | Updated — sprint status + doc links |
| `SPRINT_12_7B_BUSINESS_FOUNDATION_REPORT.md` | **New** — this report |

**No application code changes.** No new features. No regressions expected.

---

## 16. Validation

| Check | Result |
|-------|--------|
| TypeScript | PASS |
| ESLint | PASS (0 errors) |
| Tests | PASS — 202 tests |
| `validate:ios` | PASS |
| Web build | PASS |
| Android `assembleRelease` | PASS |

---

## 17. Known limitations

- No production domain registered
- No email accounts created
- No legal pages hosted
- No store screenshots or marketing assets
- Env vars documented but not wired into UI
- GitHub community files not added
- Social accounts not reserved
- Universal Links require hosted `apple-app-site-association`

---

## 18. Open points (later sprints)

- Register domain and configure DNS
- Set up Google Workspace + SPF/DKIM/DMARC
- Host privacy policy, terms, impressum
- Wire support/privacy URLs into app and store listings
- Create store screenshots and feature graphic
- Enroll Apple Developer + Google Play (organization)
- Reserve social handles
- Add GitHub LICENSE, SECURITY.md, templates
- Implement contact/support web pages
- Vector logo and wordmark design

---

## 19. Manual steps

1. Choose domain name and TLD
2. Register domain (auto-renew, WHOIS privacy, 2FA)
3. Set up Google Workspace on domain
4. Configure DNS (web hosting + MX + SPF + DKIM + DMARC)
5. Deploy web app to `www.<domain>.tld`
6. Create and host legal pages
7. Set production env vars in hosting and EAS
8. Enroll Apple Developer Program (organization + D-U-N-S)
9. Enroll Google Play Console
10. Reserve social media handles
11. Create store listing assets (screenshots, descriptions)
12. Submit to TestFlight / internal Play testing (after 12.7A EAS build)

---

## 20. Recommendations

1. **Domain:** Register `.com` + `.de` if budget allows; use `www` as canonical
2. **DNS/HTTPS:** Cloudflare DNS + hosting provider SSL; enable HSTS after 30 days stable
3. **Email:** Google Workspace; start with support@, hello@, privacy@ groups
4. **Legal:** Prioritize privacy policy before any store submission (GDPR + Apple/Google requirement)
5. **Brand:** Derive store screenshots from running app; no new logo needed for MVP submission
6. **GitHub:** Add proprietary LICENSE and SECURITY.md before making repo public
7. **Stores:** Use organization accounts for both Apple and Google

---

## Success criteria

| Criterion | Status |
|-----------|--------|
| Domain strategy documented | ✓ |
| DNS concept created | ✓ |
| HTTPS documented | ✓ |
| Cloudflare evaluated | ✓ |
| Mail structure defined | ✓ |
| Professional company addresses defined | ✓ |
| Provider recommended | ✓ |
| SPF documented | ✓ |
| DKIM documented | ✓ |
| DMARC documented | ✓ |
| Branding audited | ✓ |
| Brand guidelines created | ✓ |
| Social handles documented | ✓ |
| GitHub audited | ✓ |
| Apple Developer prepared | ✓ |
| Google Play prepared | ✓ |
| Documentation created | ✓ |
| Report created | ✓ |
| Android functional | ✓ |
| Web functional | ✓ |
| iOS prep unchanged | ✓ |
| Admin functional | ✓ |
| Notification Center unchanged | ✓ |

**Sprint 12.7B complete.** No domains registered. No email accounts created. No accounts published.
