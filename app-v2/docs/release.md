# Release Management — Eternal Rave

**Sprint:** 12.7E  
**Status:** Preparation — no production release performed  
**Last updated:** July 2026

---

## 1. Release overview

Eternal Rave uses **semantic versioning** for marketing version and **platform-specific build numbers** for store uploads.

| Platform | Marketing version | Build identifier | Source |
|----------|-------------------|------------------|--------|
| All | `0.2.0` | — | `package.json`, `app.config.ts` |
| iOS | `0.2.0` | Build number | `EXPO_IOS_BUILD_NUMBER` or EAS auto-increment |
| Android | `0.2.0` | `versionCode: 5` | `app.config.ts` |
| Web/PWA | `0.2.0` | Cache `v0.2.0` | `pwa-config.ts` |

---

## 2. Release channels

| Channel | Platform | Profile | Purpose |
|---------|----------|---------|---------|
| Development | iOS/Android | `development` | Dev client, simulator |
| Internal preview | iOS/Android | `preview` | APK/ad-hoc device testing |
| Beta (closed) | iOS | TestFlight internal/external | Pre-public testing |
| Beta (closed) | Android | Play Closed testing | Pre-public testing |
| Beta (open) | Android | Play Open testing | Wider beta (future) |
| Production | iOS | App Store | Public release (future) |
| Production | Android | Play Production | Public release (future) |
| Web | Static host | `build:web` | PWA + admin |

---

## 3. Release process

### 3.1 Pre-release

1. Complete [launch-checklist.md](launch-checklist.md)
2. Run `npm run release:check`
3. Verify no critical bugs in issue tracker
4. Confirm privacy policy and support URLs are live (HTTPS)
5. Update release notes draft
6. Bump version if required (see §4)

### 3.2 Build

```bash
# Web
npm run generate:seo   # with EXPO_PUBLIC_WEB_BASE_URL set
npm run build:web
npm run validate:build-output

# Android (local smoke)
cd android && ./gradlew assembleRelease

# Android (store)
eas build --platform android --profile production

# iOS (TestFlight)
eas build --platform ios --profile production
```

### 3.3 Submit

```bash
# iOS TestFlight
eas submit --platform ios --profile production

# Android Play Console (manual upload of AAB or)
eas submit --platform android --profile production
```

### 3.4 Post-release

1. Tag git: `v0.2.0-beta.1`
2. Record build numbers in release log
3. Notify beta testers
4. Monitor crash reports / feedback channels
5. Run smoke tests on distributed build

---

## 4. Versioning rules

### Marketing version (`MAJOR.MINOR.PATCH`)

| Bump | When |
|------|------|
| MAJOR | Breaking changes, major redesign |
| MINOR | New features, beta milestones |
| PATCH | Bug fixes only |

**Current beta target:** `0.2.0` (pre-1.0 = beta phase)

### iOS build number

- Must increase monotonically per App Store upload
- EAS production profile: `autoIncrement: true`
- Override: `EXPO_IOS_BUILD_NUMBER` env var

### Android versionCode

- Must increase monotonically per Play upload
- Manually bump in `app.config.ts` → `android.versionCode`
- EAS does not auto-increment Android versionCode

### Web

- Bump `PWA_CONFIG.cacheVersion` when SW cache strategy changes
- No store build number

---

## 5. Release Candidate (RC) criteria

A build qualifies as **RC** when:

| Criterion | Required |
|-----------|----------|
| `release:check` passes | Yes |
| Zero P0 (crash/data loss) bugs | Yes |
| Zero P1 (broken core flow) bugs | Yes |
| Privacy policy URL live | Yes |
| Support URL live | Yes |
| Store listing draft complete | Yes |
| Screenshots uploaded (min set) | Yes |
| Smoke tests passed on RC build | Yes |
| Rollback plan documented | Yes |

**RC naming:** `0.2.0-rc.1`, `0.2.0-rc.2`, etc.

---

## 6. Rollback strategy

### Triggers

- Crash rate spike (>1% sessions)
- Data loss or corruption
- Auth/RLS breach
- Store rejection with blocking issue
- Supabase outage affecting core flows

### Process

| Platform | Rollback method |
|----------|-----------------|
| **iOS TestFlight** | Stop testing current build; promote previous build to testers |
| **Android Play** | Halt rollout; promote previous release in Play Console |
| **Web** | Redeploy previous `dist/` artifact from git tag |
| **Supabase** | No schema rollback in beta unless migration is reversible — document per change |

### Communication

1. Post status to beta tester channel
2. Document incident in release log
3. Create hotfix branch if needed
4. Do not delete previous build artifacts

See [launch-checklist.md](launch-checklist.md) § Rollback.

---

## 7. Responsibilities

| Role | Responsibility |
|------|----------------|
| Engineering | Builds, smoke tests, hotfixes |
| Product | Release notes, beta scope |
| Operations | Store console, tester management |
| Legal | Privacy policy, store compliance |

---

## 8. Environment matrix

| Environment | `USE_SUPABASE` | `WEB_NOINDEX` | Analytics |
|-------------|----------------|---------------|-----------|
| Local dev | `false` (default) | — | Off |
| Staging | `true` | `true` | Off |
| Beta production | `true` | `false` | Consent-gated |
| Public release | `true` | `false` | Consent-gated |

---

## 9. Git workflow

```bash
# Recommended branch per sprint
git checkout -b cursor/sprint-12-7e-store-preparation-public-beta-4f90

# After RC approval
git tag -a v0.2.0-beta.1 -m "Beta release 0.2.0"
git push origin v0.2.0-beta.1
```

---

## Related documents

- [Store preparation](store.md)
- [Beta program](beta.md)
- [Launch checklist](launch-checklist.md)
- [iOS build & TestFlight](ios-build.md)
- [Release checklist (legacy)](release-checklist.md)
- [Web deployment](web-deployment.md)
