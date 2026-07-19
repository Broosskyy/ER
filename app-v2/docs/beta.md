# Beta Program — Eternal Rave

**Sprint:** 12.7E  
**Status:** Prepared — no public beta launched  
**Last updated:** July 2026

---

## 1. Beta overview

| Platform | Program | Max testers | Status |
|----------|---------|-------------|--------|
| iOS | TestFlight Internal | 100 (team) | Not started |
| iOS | TestFlight External | 10,000 | Not started |
| Android | Internal testing | 100 | Not started |
| Android | Closed testing | Unlimited (invite) | Not started |
| Web | PWA on production URL | Unlimited | Ready after deploy |

**No public beta release performed in this sprint.**

---

## 2. TestFlight (iOS)

### Prerequisites

- [ ] Apple Developer Program enrolled (organization recommended)
- [ ] App Store Connect app record created
- [ ] `EAS_PROJECT_ID` configured
- [ ] Distribution certificate + provisioning profile
- [ ] `ascAppId` in `eas.json` (replace placeholder)
- [ ] Privacy policy URL live

### Configuration checklist

| Step | Status |
|------|--------|
| `eas build --platform ios --profile production` | Not run |
| Build processing in App Store Connect | — |
| Export compliance (encryption exempt) | Documented |
| Beta App Review (external testing) | Not started |
| Internal tester group created | Not started |
| External tester group created | Not started |
| Test information / beta description | Template in store.md |
| Feedback email configured | `support@<domain>.tld` |

### Tester groups

| Group | Members | Purpose |
|-------|---------|---------|
| **Internal** | Core team (≤100) | Daily builds, crash checks |
| **Closed External** | Trusted beta users (≤100 initially) | UX feedback, stability |
| **Open External** | Wider audience | Future — after closed beta stable |

### TestFlight feedback

- In-app screenshot feedback (TestFlight app)
- Email: `support@<domain>.tld`
- Optional: GitHub Issues (private) for bug tracking

### Crash reports

- **Apple:** Xcode Organizer / App Store Connect → Crashes (after TestFlight distribution)
- **No third-party SDK** (Sentry/Crashlytics not integrated)
- Manual: tester reports via email

---

## 3. Google Play testing (Android)

### Prerequisites

- [ ] Google Play Console account ($25 one-time)
- [ ] App signing by Google Play enabled
- [ ] AAB from `eas build --platform android --profile production`
- [ ] Data safety form completed
- [ ] Content rating (IARC) completed
- [ ] Privacy policy URL live

### Testing tracks

| Track | Purpose | Rollout |
|-------|---------|---------|
| **Internal** | Team smoke tests | Immediate, up to 100 testers |
| **Closed** | Beta testers via email/link | Invite-only |
| **Open** | Public beta | Future |
| **Production** | Public release | Future |

### Closed beta setup

1. Create closed testing track in Play Console
2. Upload AAB (versionCode > previous)
3. Add release notes (template in store.md)
4. Create email list or Google Group for testers
5. Share opt-in link with testers
6. Monitor Android vitals (ANR, crash rate)

### Install process (testers)

1. Receive invite link via email
2. Open link on Android device
3. Accept beta program in Play Store
4. Install / update from Play Store

---

## 4. Internal testing program

| Item | Policy |
|------|--------|
| Group size | Core team + 2–5 external advisors |
| Build frequency | Weekly during active beta, hotfix as needed |
| Install source | TestFlight (iOS), Play Internal (Android), HTTPS (web) |
| Feedback SLA | Acknowledge within 48h, P0 within 24h |
| Bug tracking | GitHub Issues or spreadsheet (no external platform) |
| Version naming | `0.2.0-beta.N` |

### Abort criteria (do not promote build)

- App crashes on launch
- Cannot load events (Supabase down or misconfigured)
- Data loss in favorites
- Admin exposed on native without guard

---

## 5. Closed beta program

### Participants

- Invite-only via email list
- Target: 20–50 testers initially
- DACH region focus (German UI)
- Mix of iOS and Android devices

### Invitation process

1. Collect tester email (Apple ID email for iOS, Google account for Android)
2. Add to TestFlight group / Play closed track
3. Send welcome email with install instructions + feedback channel
4. Include link to privacy policy and known issues

### Feedback channels

| Channel | Use |
|---------|-----|
| `support@<domain>.tld` | General feedback, bugs |
| TestFlight feedback | iOS screenshots + comments |
| Play Console feedback | Android user reviews (closed track) |
| Structured form (future) | Google Form / Typeform — not integrated |

### Prioritization

| Priority | Definition | Response |
|----------|------------|----------|
| P0 | Crash, data loss, security | Hotfix within 24–48h |
| P1 | Core flow broken | Fix in next beta build |
| P2 | UX issue, minor bug | Backlog |
| P3 | Feature request | Post-beta roadmap |

---

## 6. Beta feedback process

```
Tester reports issue
  → Email / TestFlight / Play feedback
  → Triage (P0–P3) within 48h
  → Reproduce on RC build
  → Fix or document as known issue
  → Include in next release notes
  → Notify tester on resolution (optional)
```

**No external feedback platform integrated** (no Instabug, no in-app feedback form in this sprint).

---

## 7. Crash reporting strategy

| Source | Platform | Active | Privacy |
|--------|----------|--------|---------|
| App Store Connect Crashes | iOS | After TestFlight | Aggregated, Apple-hosted |
| Play Console Android vitals | Android | After closed test | Aggregated, Google-hosted |
| GA4 error events | Web | With consent only | No stack traces |
| Console logs | Dev | Local only | Not shipped |
| Supabase logs | Backend | Admin/import only | No client crashes |

### Future options (not integrated)

| Tool | Pros | Cons |
|------|------|------|
| Sentry | RN + web, good grouping | Privacy review, cost |
| Firebase Crashlytics | Free tier | Google dependency |
| Bugsnag | Good RN support | Cost |

**Recommendation:** Use Apple/Google native crash reports for beta; add Sentry post-beta if volume warrants.

### Error classification

| Class | Examples | Action |
|-------|----------|--------|
| Fatal crash | Unhandled exception, OOM | P0 |
| ANR (Android) | Main thread blocked >5s | P0/P1 |
| Network error | Supabase timeout | P2 if recoverable |
| JS error (web) | Unhandled promise | P1 if user-facing |

---

## 8. Release Candidate definition

### RC 0.2.0-beta.1 requirements

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Version `0.2.0`, build numbers incremented | Ready |
| 2 | `npm run release:check` PASS | Verified |
| 3 | Android `assembleRelease` PASS | Verified |
| 4 | iOS config validated | Verified |
| 5 | Zero P0/P1 open bugs | Pending QA |
| 6 | Privacy policy hosted | **Blocker** |
| 7 | Support URL hosted | **Blocker** |
| 8 | Store screenshots (min 4) | **Blocker** |
| 9 | Smoke tests on physical devices | Pending |
| 10 | Rollback plan documented | ✓ |

### Known limitations (document in release notes)

- Map tab is placeholder (no native map)
- Favorites not synced across devices
- No user accounts
- Admin web-only
- German UI only
- Analytics opt-in on web only

---

## 9. QA analysis

### Automated (CI)

| Area | Result |
|------|--------|
| TypeScript | PASS |
| ESLint | PASS (0 errors) |
| Unit tests | PASS (214) |
| `release:check` | PASS |
| iOS config validation | PASS |
| SEO validation | PASS |
| PWA validation | PASS |

### Manual QA matrix (to execute on RC build)

| Test | Android | iOS | Web |
|------|---------|-----|-----|
| Cold start | Pending | Pending | Pending |
| Home loads events | Pending | Pending | Pending |
| Event detail | Pending | Pending | Pending |
| Search / filters | Pending | Pending | Pending |
| Save / unsave favorite | Pending | Pending | Pending |
| Notifications center | Pending | Pending | Pending |
| Offline banner (web) | N/A | N/A | Pending |
| Admin login (web) | N/A | N/A | Pending |
| Admin blocked (native) | Pending | Pending | N/A |
| Deep link `eternal-rave://event/id` | Pending | Pending | N/A |
| Ticket link opens browser | Pending | Pending | Pending |
| Consent banner (web, analytics on) | N/A | N/A | Pending |
| PWA install | N/A | N/A | Pending |
| Rotation locked portrait | Pending | Pending | N/A |
| Safe areas (notch) | Pending | Pending | N/A |

**Note:** Manual device QA not run in cloud agent environment — documented for team execution.

---

## 10. Smoke tests (pre-beta checklist)

Run before every beta build promotion:

- [ ] App launches without crash
- [ ] Events load (Supabase or mock)
- [ ] Navigate all tabs
- [ ] Open event detail
- [ ] Toggle favorite
- [ ] Open notifications screen
- [ ] Search returns results
- [ ] Web: refresh on `/search` works
- [ ] Web: admin login + logout
- [ ] Web: no console errors on home
- [ ] Android: back gesture works
- [ ] iOS: safe area correct on home

---

## 11. Beta launch plan (preparation only)

### Phase 1 — Pre-beta (current)

- Complete store documentation
- Host legal pages
- Capture screenshots
- Enroll developer accounts
- Run EAS production builds

### Phase 2 — Internal beta

- Distribute to team via TestFlight Internal + Play Internal
- 1 week soak test
- Fix P0/P1 issues

### Phase 3 — Closed beta

- Invite 20–50 external testers
- Collect feedback for 2–4 weeks
- Iterate builds weekly

### Phase 4 — Open beta (future)

- Play Open testing track
- TestFlight external (up to 10k)
- Monitor metrics

### Phase 5 — Production (future sprint)

- Store review submission
- Public launch

**No phase beyond documentation executed in Sprint 12.7E.**

---

## Related documents

- [Release management](release.md)
- [Store listings](store.md)
- [Launch checklist](launch-checklist.md)
- [iOS build](ios-build.md)
