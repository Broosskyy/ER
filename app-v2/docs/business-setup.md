# Business Setup — Eternal Rave

**Sprint:** 12.7B  
**Status:** Preparation only — no accounts created, nothing published  
**Last updated:** July 2026

---

## 1. Overview

This document consolidates business and infrastructure preparation for Eternal Rave as a professional product. It covers developer accounts, GitHub hygiene, contact structure, environment variables, and cross-references to domain/email/brand docs.

**Out of scope:** CMS, CRM, analytics, SEO, push notifications, user accounts, new app features.

---

## 2. Product identity

| Field | Value |
|-------|-------|
| Product name | Eternal Rave |
| Tagline | Discover. Connect. Rave. |
| Bundle ID (iOS/Android) | `com.eternalrave.app` |
| URL scheme | `eternal-rave://` |
| npm package | `eternal-rave` |
| Version | `0.2.0` |
| Default market | DACH (German UI in PWA), international English tagline |
| GitHub | `github.com/Broosskyy/ER` |

---

## 3. Domain & hosting summary

See [domain.md](domain.md) for full detail.

| Item | Recommendation |
|------|----------------|
| Canonical URL | `https://www.<domain>.tld/` |
| Admin | `https://www.<domain>.tld/admin` (same origin) |
| Staging | `https://staging.<domain>.tld/` (optional) |
| DNS | Cloudflare recommended (DNS + optional proxy) |
| HTTPS | Provider-managed certs, HSTS after validation |
| Backend | Supabase (no custom API subdomain at launch) |

---

## 4. Email summary

See [email.md](email.md) for full detail.

| Item | Recommendation |
|------|----------------|
| Provider | Google Workspace (Business Starter) |
| Public support | `support@<domain>.tld` |
| Privacy | `privacy@<domain>.tld` |
| General | `hello@<domain>.tld` |
| Authentication | SPF → DKIM → DMARC (phased rollout) |

---

## 5. Branding summary

See [brand.md](brand.md) for full detail.

| Asset | Status |
|-------|--------|
| App icon 1024×1024 | Present — `assets/images/icon.png` |
| Splash | Present — dark `#0B0B0F` |
| Favicon / PWA icons | Present — `public/pwa/*` |
| Vector logo (SVG) | **Missing** |
| Wordmark | **Missing** |
| Store screenshots | **Missing** |
| Feature graphic (Play) | **Missing** |
| Brand font (custom) | **Not wired** — system sans-serif |

---

## 6. Social handles checklist

Reserve handles consistently. Suggested primary handle: `@eternalrave` or `@eternalraveapp` (verify availability).

| Platform | Handle to check | Profile image | Bio link | Status |
|----------|-----------------|---------------|----------|--------|
| Instagram | `@eternalrave` | App icon 320×320 | `www.<domain>.tld` | Not reserved |
| TikTok | `@eternalrave` | App icon | Website | Not reserved |
| YouTube | `@eternalrave` | App icon + banner | Website | Not reserved |
| Facebook | `/eternalrave` | App icon + cover | Website | Not reserved |
| Threads | `@eternalrave` | App icon | Website | Not reserved |
| Bluesky | `@eternalrave.bsky.social` | App icon | Website | Not reserved |
| LinkedIn | `/company/eternal-rave` | Logo | Website | Not reserved |
| GitHub | `Broosskyy/ER` (org: `eternal-rave`?) | — | Website | Repo exists |
| X (Twitter) | `@eternalrave` | App icon + header | Website | Not reserved |
| Discord | Server invite | App icon | Website | Not reserved |
| Telegram | `@eternalrave` | App icon | Website | Not reserved |

### Profile setup checklist (when accounts are created)

- [ ] Use app icon as profile picture (no transparency for Instagram)
- [ ] Bio: tagline + link to `www.<domain>.tld`
- [ ] Pin link to web app / PWA install
- [ ] Use brand colors in banners where platform allows
- [ ] Document credentials in team password manager

**No accounts created in this sprint.**

---

## 7. GitHub repository audit

Repository: `Broosskyy/ER`

| Item | Status | Recommendation |
|------|--------|----------------|
| README | Present | Update sprint status after 12.7B merge |
| LICENSE | **Missing** | Add MIT or proprietary license before public release |
| SECURITY.md | **Missing** at root | Add with `security@<domain>.tld` disclosure process |
| CODE_OF_CONDUCT.md | **Missing** | Add if accepting external contributors |
| CONTRIBUTING.md | **Missing** | Add contribution guidelines |
| Issue templates | **Missing** | Add `.github/ISSUE_TEMPLATE/` (bug, feature request) |
| Pull request template | **Missing** | Add `.github/pull_request_template.md` |
| Security policy | Partial — `app-v2/docs/security.md` | App security only; not GitHub disclosure policy |
| Workflows | Only in `reference/old-code/` | Add CI workflow in future sprint |
| Visibility | Private (assumed) | Do not make public until legal + license ready |

**No public release or template files added in this sprint** — gaps documented for manual follow-up.

---

## 8. Apple Developer preparation

See [ios-build.md](ios-build.md) for build/TestFlight detail.

| Item | Value / status |
|------|----------------|
| Account type | Apple Developer Program — **Organization** recommended |
| Cost | $99 USD/year |
| Bundle ID | `com.eternalrave.app` (configured) |
| Team ID | Assign after enrollment — store in password manager |
| App Store Connect | Create app record matching bundle ID |
| TestFlight | After first EAS iOS build + submit |
| 2FA | Required on Apple ID — use hardware key if possible |
| D-U-N-S number | Required for organization enrollment |
| Privacy policy URL | **Required** — host before submission |
| Support URL | **Required** — `https://www.<domain>.tld/support` |
| Encryption | `ITSAppUsesNonExemptEncryption: false` (already set) |
| `ascAppId` in eas.json | Replace `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` |

### App Store Connect metadata (templates)

| Field | Draft value |
|-------|-------------|
| App name | Eternal Rave |
| Subtitle | Discover electronic music events |
| Primary category | Entertainment |
| Secondary category | Music |
| Keywords | rave, electronic, events, techno, festival, club, köln |
| Copyright | `© 2026 Eternal Rave` |
| Support URL | `https://www.<domain>.tld/support` |
| Privacy policy URL | `https://www.<domain>.tld/privacy` |
| Marketing URL | `https://www.<domain>.tld` |

**No enrollment or submission in this sprint.**

---

## 9. Google Play preparation

| Item | Value / status |
|------|----------------|
| Account type | Google Play Console — Organization |
| Cost | $25 USD one-time |
| Package name | `com.eternalrave.app` |
| Developer name | Eternal Rave |
| Support email | `support@<domain>.tld` |
| Privacy policy URL | `https://www.<domain>.tld/privacy` |
| App category | Events or Music & Audio |
| Content rating | Complete questionnaire (likely Everyone / PEGI 3) |
| Target audience | Not designed for children |
| Data safety form | Declare local storage (favorites, notifications prefs) |
| AAB builds | `eas build --platform android --profile production` |

### Play Store listing (templates)

| Field | Draft value |
|-------|-------------|
| Short description | Discover electronic music events near you. |
| Full description | (Write in later sprint — German + English) |
| Feature graphic | 1024×500 — **asset missing** |
| Screenshots | Phone + tablet — **assets missing** |
| App icon | 512×512 — derive from `icon.png` |

**No Play Console enrollment or submission in this sprint.**

---

## 10. Contact pages (structure only)

| Page | URL | Key content blocks |
|------|-----|-------------------|
| Support | `/support` | How to get help, support@, FAQ links |
| Contact | `/contact` | hello@, partners@, press@ |
| Privacy | `/privacy` | Policy text, privacy@, data categories |
| Impressum | `/impressum` | Legal entity, address (add when registered) |
| Terms | `/terms` | Terms of use |
| Press | `/press` | press@, fact sheet placeholder |
| Business | `/business` | partners@, events@ |

Implement as static web routes in a future sprint. **No pages created in 12.7B.**

---

## 11. Environment variables

Placeholders in `app-v2/.env.example` (no real domains):

| Variable | Placeholder | Purpose |
|----------|-------------|---------|
| `EXPO_PUBLIC_WEB_BASE_URL` | `https://www.<domain>.tld` | Canonical web origin |
| `EXPO_PUBLIC_WEB_NOINDEX` | `true` on staging | Block search indexing |
| `EXPO_PUBLIC_IOS_ASSOCIATED_DOMAIN` | `https://www.<domain>.tld` | Universal Links |
| `EXPO_PUBLIC_SUPPORT_URL` | `https://www.<domain>.tld/support` | Store + in-app links |
| `EXPO_PUBLIC_PRIVACY_URL` | `https://www.<domain>.tld/privacy` | Store + legal |
| `EXPO_PUBLIC_TERMS_URL` | `https://www.<domain>.tld/terms` | Legal |
| `EXPO_PUBLIC_MARKETING_URL` | `https://www.<domain>.tld` | App Store marketing |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | `support@<domain>.tld` | Display in footer/settings |

Admin URL: `{EXPO_PUBLIC_WEB_BASE_URL}/admin` — no separate variable.

**Note:** These vars are documented but not yet consumed by app code. Wire in a future sprint when legal pages exist.

---

## 12. Legal & compliance gaps

| Item | Status | Blocker for |
|------|--------|-------------|
| Privacy policy (hosted) | Missing | App Store, Play Store, GDPR |
| Terms of service | Missing | Public launch |
| Impressum (DE) | Missing | German web presence |
| Cookie notice | Not needed yet | No analytics cookies |
| Company registration | Manual | Business mail, store org accounts |

---

## 13. Manual steps (ordered)

1. Register domain → [domain.md](domain.md)
2. Set up Google Workspace → [email.md](email.md)
3. Configure DNS (web + mail)
4. Deploy web app to `www.<domain>.tld`
5. Create legal pages (privacy, terms, impressum)
6. Enroll Apple Developer Program (organization)
7. Enroll Google Play Console (organization)
8. Reserve social handles
9. Add GitHub LICENSE, SECURITY.md, templates
10. Update production env vars in EAS/hosting
11. Run store listing QA before submission

---

## Related docs

- [Domain strategy & DNS](domain.md)
- [Email infrastructure](email.md)
- [Brand guidelines](brand.md)
- [iOS build & TestFlight](ios-build.md)
- [Web deployment](web-deployment.md)
- [Release checklist](release-checklist.md)
