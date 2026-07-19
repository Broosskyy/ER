# Sprint 12.7A — iOS Foundation & TestFlight Report

## 1. Architecture audit

### Existing configuration (before)
| Item | Status |
|---|---|
| Bundle identifier | `com.eternalrave.app` (minimal) |
| iOS build number | missing |
| EAS config | missing |
| iOS native project | missing |
| Deployment target | not explicit |
| Universal Links | not prepared |
| Privacy manifest | not declared |
| Deep link helpers | implicit via Expo Router only |
| Ticket URL validation | basic `Linking.canOpenURL` only |

### Findings
- Android native project present; iOS relied on future prebuild
- Safe area utilities already implemented (`SafeAreaContainer`, tab bar insets)
- PWA provider and web-only code guarded by `Platform.OS`
- App icon 1024×1024 RGB (App Store compliant, no transparency)
- Splash configured via `expo-splash-screen`
- No unnecessary iOS permissions requested
- `react-native-maps` present but map tab uses placeholder (no native map crash risk on iOS)

---

## 2. Changes implemented

### iOS configuration (`app.config.ts`)
- `buildNumber` via `EXPO_IOS_BUILD_NUMBER` (default `1`)
- `userInterfaceStyle: 'dark'`
- `requireFullScreen: true`
- `LSApplicationQueriesSchemes`: https, http, maps
- `ITSAppUsesNonExemptEncryption: false`
- Privacy manifest for UserDefaults (AsyncStorage)
- Associated Domains prep via `EXPO_PUBLIC_IOS_ASSOCIATED_DOMAIN`
- `expo-build-properties` plugin with iOS deployment target 15.1

### EAS (`eas.json`)
- Profiles: `development`, `preview`, `production`
- Production auto-increment enabled
- Submit profile placeholder for App Store Connect app id

### Native iOS project
- Generated via `npx expo prebuild --platform ios --no-install`
- URL schemes: `eternal-rave`, `com.eternalrave.app`
- Info.plist validated

### Linking & external URLs
- `src/platform/linking/app-linking.ts` — deep/universal link helpers
- `src/platform/linking/external-url.ts` — safe http(s) validation
- Improved `openEventTicketUrl()` for iOS Safari handoff

### Tooling
- `scripts/validate-ios-config.ts`
- `npm run validate:ios`
- Added to `release:check`

### Documentation
- `docs/ios-build.md`

### Tests
- Linking helpers
- Ticket URL validation
- iOS config validation script

---

## 3. iOS configuration summary

| Setting | Value |
|---|---|
| Bundle ID | `com.eternalrave.app` |
| Display name | Eternal Rave |
| Version | 0.2.0 |
| Build number | 1 (env override supported) |
| Scheme | `eternal-rave` |
| Orientation | Portrait |
| Tablet | Disabled |
| Deployment target | iOS 15.1 |
| Encryption export | Not exempt / declared false |
| Push permissions | None |
| Universal Links | Prepared (env + associated domains) |

---

## 4. Assets

| Asset | Status |
|---|---|
| App icon 1024 | PASS — RGB, no alpha |
| Splash icon | PASS — dark background `#0B0B0F` |
| Retina variants | Generated at build/prebuild time |
| App Store icon | Derived from 1024 source |

---

## 5. Build status

| Check | Result |
|---|---|
| TypeScript | PASS |
| ESLint | PASS (0 errors) |
| Tests | PASS — 199 tests |
| Expo Doctor | 19/20 (pre-existing prebuild sync warning) |
| `expo config` | PASS |
| `expo prebuild --platform ios` | PASS |
| EAS cloud iOS build | **NOT RUN** (requires Apple credentials) |
| TestFlight upload | **NOT RUN** (manual) |
| Android regression (`assembleRelease`) | PASS |
| Web regression (`build:web`) | PASS |

---

## 6. TestFlight preparation

Documented in `docs/ios-build.md`:

1. `eas login`
2. `eas init` (set project id)
3. Configure Apple credentials (`eas credentials`)
4. `eas build --platform ios --profile production`
5. `eas submit --platform ios --latest`
6. Add internal testers in App Store Connect
7. Complete compliance questionnaire (encryption exempt)
8. Run device QA checklist

---

## 7. App Store Connect preparation

Templates provided in `docs/ios-build.md` for:

- App name, subtitle, keywords, description
- Support / privacy URLs (placeholders)
- Category, copyright, review notes
- Screenshot requirements
- Beta release notes template

No App Store submission performed.

---

## 8. Manual QA checklist (device)

Not executed in CI (no iOS simulator/device in environment):

- [ ] Home / Search / Saved / Notifications
- [ ] Event detail + ticket link opens Safari
- [ ] Deep link `eternal-rave://event/<id>`
- [ ] Safe areas (notch / Dynamic Island / home indicator)
- [ ] Cold/warm start
- [ ] Rotation blocked (portrait only)
- [ ] Supabase data load in production config
- [ ] Local favorites/notifications persistence
- [ ] Admin web-only block on native (expected)

---

## 9. Known limitations

- No on-device iOS QA in cloud agent environment
- EAS production build requires Apple Developer credentials
- Universal Links require hosted `apple-app-site-association`
- Map tab remains placeholder (no native map on iOS)
- Dynamic SEO / web-only admin unchanged
- No push notifications

---

## 10. Manual steps required

1. Create/link App Store Connect app record
2. Run `eas init` and store `EAS_PROJECT_ID`
3. Configure Apple distribution certificate + provisioning profile
4. Set production env vars in EAS
5. Run `eas build --platform ios --profile production`
6. Submit to TestFlight
7. Execute device QA checklist
8. Host privacy policy URL before public App Store release
9. For Universal Links: set domain env + host AASA file

---

## 11. Open points (later sprints)

- Push notifications (not in scope)
- Native map implementation for iOS
- Public user accounts
- App Store public release / marketing assets
- Hosted Universal Links production cutover

---

## Changed files (high level)

- `app.config.ts`
- `eas.json`
- `ios/**` (generated native project)
- `src/platform/linking/**`
- `src/features/event-detail/utils/event-actions.ts`
- `scripts/validate-ios-config.ts`
- `package.json`, `package-lock.json`, `.env.example`
- `docs/ios-build.md`
