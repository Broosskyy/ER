# Launch Checklist — Eternal Rave

**Sprint:** 12.7E  
**Use before:** Beta release, RC promotion, production launch  
**Last updated:** July 2026

---

## 1. Release readiness

### Builds

- [ ] `npm run release:check` — PASS
- [ ] Android `assembleRelease` — PASS (local smoke)
- [ ] `eas build --platform android --profile production` — AAB ready
- [ ] `eas build --platform ios --profile production` — IPA ready
- [ ] Web `build:web` + `validate:build-output` — PASS
- [ ] Version `0.2.0` confirmed in `package.json` and `app.config.ts`
- [ ] iOS build number incremented
- [ ] Android `versionCode` incremented

### Quality

- [ ] No P0 bugs open
- [ ] No P1 bugs open (or documented as known issues)
- [ ] Smoke tests passed (see §6)
- [ ] Manual QA matrix started ([beta.md](beta.md) §9)

### Legal & privacy

- [ ] Privacy policy hosted (HTTPS)
- [ ] Terms of service hosted (recommended)
- [ ] Impressum hosted (DE market)
- [ ] Support email active (`support@<domain>.tld`)
- [ ] Privacy email active (`privacy@<domain>.tld`)
- [ ] GDPR documentation current ([privacy.md](privacy.md))
- [ ] Analytics consent works (web, if enabled)

### SEO & web

- [ ] `EXPO_PUBLIC_WEB_BASE_URL` set
- [ ] `npm run generate:seo` run before web deploy
- [ ] `robots.txt` and `sitemap.xml` in dist
- [ ] Google Search Console verified (post-deploy)
- [ ] Staging uses `EXPO_PUBLIC_WEB_NOINDEX=true`

---

## 2. Store assets

### Icons

- [ ] iOS 1024×1024 icon — no alpha ([assets/images/icon.png](assets/images/icon.png))
- [ ] Android adaptive icons present
- [ ] Play Store 512×512 exported

### Screenshots

- [ ] iPhone 6.7" set (5+ screens)
- [ ] Android phone set (4+ screens)
- [ ] German UI text in screenshots
- [ ] No placeholder / broken UI

### Graphics

- [ ] Google Play feature graphic 1024×500 — **TODO**
- [ ] App preview video — optional, not required for beta

### Copy

- [ ] App name finalized
- [ ] Short description draft
- [ ] Full description draft
- [ ] Keywords (Apple)
- [ ] Release notes draft
- [ ] Beta test information (TestFlight)

---

## 3. App Store Connect (Apple)

- [ ] Developer account active
- [ ] App record created (`com.eternalrave.app`)
- [ ] `ascAppId` set in `eas.json`
- [ ] App Information complete
- [ ] Pricing: Free
- [ ] Availability: selected countries
- [ ] Age rating questionnaire complete
- [ ] Privacy policy URL entered
- [ ] Support URL entered
- [ ] App Privacy questionnaire complete (no data collected / minimal)
- [ ] Review notes prepared
- [ ] TestFlight build uploaded
- [ ] Internal testers added
- [ ] Beta review submitted (external testing)

---

## 4. Google Play Console

- [ ] Developer account active
- [ ] App created
- [ ] App signing configured
- [ ] AAB uploaded to internal/closed track
- [ ] Store listing draft complete
- [ ] Data safety form submitted
- [ ] Content rating (IARC) complete
- [ ] Target audience declared
- [ ] Privacy policy URL entered
- [ ] Contact email entered
- [ ] Closed testing track configured
- [ ] Tester list / link created

---

## 5. Infrastructure

- [ ] Production domain live (HTTPS)
- [ ] Supabase production project configured
- [ ] `EXPO_PUBLIC_USE_SUPABASE=true` in EAS secrets
- [ ] RLS policies applied on production
- [ ] No service role key in client bundle
- [ ] EAS environment variables set
- [ ] Web hosting deployed
- [ ] CDN/cache configured

---

## 6. Smoke tests (≈15 min)

| # | Test | Pass |
|---|------|------|
| 1 | App cold start | ☐ |
| 2 | Home shows events | ☐ |
| 3 | Event detail opens | ☐ |
| 4 | Search works | ☐ |
| 5 | Favorite save/remove | ☐ |
| 6 | Notifications screen | ☐ |
| 7 | Web refresh on `/search` | ☐ |
| 8 | Admin login + logout (web) | ☐ |
| 9 | No crash on back navigation | ☐ |
| 10 | Ticket link opens browser | ☐ |

---

## 7. Regression scope

After any release-prep change, verify:

- [ ] Android app functional
- [ ] iOS build config unchanged (or re-validated)
- [ ] Web build + PWA
- [ ] Admin area (web)
- [ ] Notification center
- [ ] Analytics consent (web, if enabled)
- [ ] SEO files in dist

```bash
npm run release:check
cd android && ./gradlew assembleRelease
```

---

## 8. Rollback

### Before release

- [ ] Previous build artifact archived (AAB, IPA, web dist)
- [ ] Previous version tag exists in git
- [ ] Rollback owner assigned
- [ ] Communication template ready

### Rollback steps

| Platform | Action |
|----------|--------|
| iOS | Stop TestFlight testing; re-add previous build |
| Android | Halt rollout; promote previous release |
| Web | Redeploy previous `dist/` from git tag |
| Supabase | No rollback unless migration documented |

### Post-rollback

- [ ] Notify beta testers
- [ ] Document incident
- [ ] Root cause analysis
- [ ] Hotfix branch if needed

---

## 9. Post-launch monitoring (beta)

- [ ] TestFlight crash reports checked (daily, first week)
- [ ] Play Console vitals checked (daily, first week)
- [ ] Support inbox monitored
- [ ] Supabase dashboard for API errors
- [ ] Web hosting logs for 5xx errors
- [ ] Feedback triaged within 48h

---

## 10. Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Engineering | | | ☐ |
| Product | | | ☐ |
| Operations | | | ☐ |
| Legal (if applicable) | | | ☐ |

**Beta release approved only when all §1–§5 critical items are checked.**

---

## Related documents

- [Release management](release.md)
- [Store listings](store.md)
- [Beta program](beta.md)
- [Release checklist (technical)](release-checklist.md)
