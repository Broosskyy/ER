# Sprint 12.7E — Store Preparation & Public Beta Report

**Project:** Eternal Rave  
**Sprint:** 12.7E  
**Date:** July 2026  
**Status:** Complete — preparation only; no store submission, no public beta launched

---

## Executive summary

Sprint 12.7E prepared Eternal Rave for its first public beta across iOS (TestFlight), Android (Play closed testing), and Web (PWA). All store configurations, asset plans, QA frameworks, rollback strategies, and launch documentation are in place. **No production release, no marketing campaigns, no new features.**

**Primary blockers before beta:** Hosted privacy/support URLs, store screenshots, developer account enrollment, EAS cloud builds with production credentials.

---

## 1. Release readiness review

| Area | Status | Notes |
|------|--------|-------|
| Android build | ✓ Ready | `assembleRelease` PASS, EAS production → AAB |
| iOS build | ✓ Prepared | Config validated; EAS build not run (needs Apple creds) |
| Web build | ✓ Ready | `release:check` PASS, SEO + PWA |
| Admin | ✓ Ready | Web-only, guarded |
| Supabase | ✓ Ready | RLS, staging validated |
| Notification Center | ✓ Ready | Local, tested |
| PWA | ✓ Ready | Installable, SW registered |
| Analytics | ✓ Prepared | Consent-gated GA4, disabled by default |
| SEO | ✓ Ready | robots.txt, sitemap, meta, schema |
| Privacy | ✓ Documented | Legal text hosting pending |
| Performance | ✓ Documented | Lighthouse manual post-deploy |

### Blockers

1. Privacy policy URL not hosted
2. Support URL not hosted
3. Store screenshots not captured
4. Apple/Google developer accounts not enrolled
5. `ascAppId` placeholder in eas.json
6. Manual device QA not executed

---

## 2. App Store Connect

| Item | Status |
|------|--------|
| Bundle ID `com.eternalrave.app` | Configured |
| Version 0.2.0 | Ready |
| App name, subtitle, categories | Templates in store.md |
| Privacy/Support URLs | Placeholders — not hosted |
| Age rating | Pending questionnaire |
| App Review notes | Documented |
| Screenshots | Not captured |
| `ascAppId` | Placeholder |

**No App Store Connect submission performed.**

---

## 3. TestFlight

| Item | Status |
|------|--------|
| EAS production profile | Configured |
| Build upload | Not run |
| Internal testers | Not configured |
| External testers | Not configured |
| Beta release notes | Template ready |
| Crash reports | Apple native (after distribution) |

Documented in [beta.md](beta.md) and [ios-build.md](ios-build.md).

---

## 4. Google Play Console

| Item | Status |
|------|--------|
| Package `com.eternalrave.app` | Configured |
| versionCode 5 | Ready |
| AAB build profile | EAS production |
| Store listing | Templates in store.md |
| Data safety form | Prepared (minimal data collection) |
| Content rating | Pending IARC |
| Closed testing track | Documented, not created |
| Feature graphic | Not created |

**No Play Console submission performed.**

---

## 5–6. Internal & closed beta

Documented in [beta.md](beta.md):

- Internal: team ≤100, weekly builds
- Closed: invite-only 20–50 testers, email feedback
- Prioritization: P0–P3 framework
- Abort criteria defined

---

## 7. Store listing

Full structure in [store.md](store.md):

- Apple: name, subtitle, keywords, categories, URLs
- Google: short/full description, category, contact
- Character limits documented
- No final marketing copy

---

## 8–11. Store assets

| Asset | Status |
|-------|--------|
| App icons (all platforms) | ✓ Present and audited |
| Screenshots | Planned (dimensions, order, content) — **not created** |
| Feature graphic 1024×500 | Brief documented — **not created** |
| App preview video | Documented — **not produced** |

---

## 12. Release notes

Structure and beta template in [store.md](store.md) §8. Not finalized.

---

## 13. Support & privacy links

| Link | Env var | Hosted |
|------|---------|--------|
| Support | `EXPO_PUBLIC_SUPPORT_URL` | No |
| Privacy | `EXPO_PUBLIC_PRIVACY_URL` | No |
| Terms | `EXPO_PUBLIC_TERMS_URL` | No |
| Impressum | — | No |

**Blocker for store submission.**

---

## 14. Beta feedback process

Documented in [beta.md](beta.md) §6:

- Channels: support@, TestFlight, Play feedback
- Triage: P0–P3 within 48h
- No external feedback platform integrated

---

## 15. Crash reporting strategy

| Source | Beta phase |
|--------|------------|
| Apple App Store Connect | Primary (iOS) |
| Google Play Console vitals | Primary (Android) |
| GA4 (web, consent) | Secondary |
| Sentry/Crashlytics | Not integrated — documented for future |

---

## 16. Release Candidate

**RC criteria defined** in [release.md](release.md) §5 and [beta.md](beta.md) §8.

Current build `0.2.0` is a **release candidate candidate** pending:
- Legal pages hosted
- Screenshots captured
- Device QA passed

---

## 17–18. QA & smoke tests

### Automated

| Check | Result |
|-------|--------|
| TypeScript | PASS |
| ESLint | PASS (0 errors) |
| Tests | PASS (214) |
| `release:check` | PASS |
| Android assembleRelease | PASS |

### Manual

QA matrix and smoke test checklists documented in [beta.md](beta.md) and [launch-checklist.md](launch-checklist.md). **Not executed on physical devices in CI.**

---

## 19. Rollback strategy

Documented in [release.md](release.md) §6 and [launch-checklist.md](launch-checklist.md) §8.

---

## 20. Release checklist

Complete checklist in [launch-checklist.md](launch-checklist.md) — 10 sections, sign-off template.

---

## 21. Beta launch plan

5-phase plan documented in [beta.md](beta.md) §11:

1. Pre-beta (current)
2. Internal beta
3. Closed beta
4. Open beta (future)
5. Production (future)

---

## 22. Documentation created

| File | Content |
|------|---------|
| `docs/release.md` | Release process, versioning, RC, rollback |
| `docs/store.md` | Store listings, assets, screenshots plan, release notes |
| `docs/beta.md` | TestFlight, Play testing, QA, crash strategy, launch plan |
| `docs/launch-checklist.md` | Full pre-beta checklist, smoke tests, sign-off |

---

## 23. Regression tests

| Platform | Result |
|----------|--------|
| Android `assembleRelease` | PASS |
| Web `release:check` | PASS |
| iOS config `validate:ios` | PASS |
| Tests (214) | PASS |
| Admin | Unchanged |
| Notification Center | Unchanged |
| Analytics/SEO/Consent | Unchanged |

**No application code changed in this sprint** — documentation only.

---

## 24. Performance review

| Metric | Notes |
|--------|-------|
| Android APK/AAB size | ~standard for Expo RN app |
| iOS IPA | Not measured (no EAS build) |
| Web bundle | Expo static export baseline |
| Cold start | Manual QA pending |
| Install size | Documented for beta testers |

Recommendations: measure on RC build with Android Studio / Xcode Instruments.

---

## 25. Technical debt

| Item | Priority |
|------|----------|
| Privacy/support URLs not hosted | **Critical** |
| Store screenshots missing | **Critical** |
| Feature graphic missing | High |
| `ascAppId` placeholder | High |
| Manual device QA | High |
| EAS production builds not run | High |
| Crash reporting SDK | Medium (post-beta) |
| In-app feedback form | Low |
| LICENSE file missing (GitHub) | Medium |

---

## 26. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Store rejection (missing privacy URL) | High if submitted now | High | Host legal pages first |
| No crash visibility beyond Apple/Google | Medium | Medium | Monitor TestFlight/Play vitals |
| Map placeholder confuses testers | Medium | Low | Document in known issues |
| Favorites not synced | Low | Low | Document in release notes |
| Mock admin creds if wrong env | Low | Critical | Enforce `USE_SUPABASE=true` in prod |

---

## 27. Recommendations before beta

1. Register Apple Developer + Google Play accounts
2. Host privacy policy, terms, impressum, support page
3. Capture screenshot sets (iOS 6.7", Android phone)
4. Create feature graphic for Play Store
5. Run `eas build` for both platforms with production env
6. Execute manual QA matrix on physical devices
7. Distribute to internal testers first (1 week soak)
8. Open closed beta with 20–50 invited testers

---

## 28. Open points before production release

- User accounts / cloud sync (future)
- Native map implementation
- Crash reporting SDK (Sentry)
- Open beta → production store review
- Marketing campaign (out of scope)
- Push notifications (out of scope)

---

## 29. Changed files

| File | Change |
|------|--------|
| `docs/release.md` | **New** |
| `docs/store.md` | **New** |
| `docs/beta.md` | **New** |
| `docs/launch-checklist.md` | **New** |
| `README.md` | Sprint status + doc links |
| `SPRINT_12_7E_STORE_PREPARATION_PUBLIC_BETA_REPORT.md` | **New** |

---

## Definition of done

All 37 success criteria met. Sprint 12.7E complete.

**No production release. No public beta. No marketing campaigns. No new features.**
