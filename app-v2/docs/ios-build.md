# iOS Build & TestFlight

Sprint 12.7A prepares Eternal Rave for iOS distribution via Expo Application Services (EAS).

## Prerequisites

- Apple Developer Program membership
- Expo account with EAS access
- Node.js 20+
- `npm install` in `app-v2/`

Install EAS CLI (global or via npx):

```bash
npm install -g eas-cli
eas login
```

## Project identifiers

| Setting | Value |
|---|---|
| App name | Eternal Rave |
| Bundle identifier | `com.eternalrave.app` |
| URL scheme | `eternal-rave` |
| Version (`CFBundleShortVersionString`) | `0.2.0` (from `package.json` / `app.config.ts`) |
| iOS build number | `EXPO_IOS_BUILD_NUMBER` or `1` |
| Deployment target | iOS 15.1 |
| Orientation | Portrait |
| Tablet support | disabled |

## Environment variables

Set in EAS secrets or local `.env` for builds:

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `EXPO_PUBLIC_USE_SUPABASE` | `true` for production builds |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | optional (map tab placeholder today) |
| `EAS_PROJECT_ID` | Expo project UUID (`extra.eas.projectId`) |
| `EXPO_ACCOUNT_OWNER` | Expo account slug (optional) |
| `EXPO_IOS_BUILD_NUMBER` | override iOS build number |
| `EXPO_PUBLIC_IOS_ASSOCIATED_DOMAIN` | Universal Links prep, e.g. `https://your-domain.example` |

Never store service role keys in client env vars.

## Local validation

```bash
npm run validate:ios
npx expo config --type public
npx expo prebuild --platform ios --no-install
```

Regenerate native iOS project after config changes:

```bash
npx expo prebuild --platform ios --clean
```

## EAS build profiles (`eas.json`)

| Profile | Purpose |
|---|---|
| `development` | Dev client, iOS simulator |
| `preview` | Internal device testing |
| `production` | TestFlight / App Store |

### Build commands

```bash
# Internal simulator build
eas build --platform ios --profile development

# Internal device build (ad-hoc / internal distribution)
eas build --platform ios --profile preview

# TestFlight / App Store build
eas build --platform ios --profile production
```

On first run, link the project:

```bash
eas init
```

This sets `EAS_PROJECT_ID` in `app.config.ts` via `extra.eas`.

## TestFlight upload

After a successful `production` iOS build:

```bash
eas submit --platform ios --profile production
```

Or upload the `.ipa` manually in App Store Connect → TestFlight.

### Recommended flow

1. Run `eas build --platform ios --profile production`
2. Wait for build completion on Expo dashboard
3. Run `eas submit --platform ios --latest`
4. In App Store Connect, add internal testers
5. Complete export compliance (encryption already declared as exempt)
6. Add beta release notes
7. Promote to external testing when ready

### Suggested beta release notes (template)

```
Eternal Rave 0.2.0 (iOS beta)

- Browse electronic music events
- Save favorites locally
- Local notification center for saved/updated events
- Supabase-backed live data in production configuration
```

## Versioning

- Marketing version: bump `version` in `package.json` and `app.config.ts`
- iOS build number: set `EXPO_IOS_BUILD_NUMBER` or use EAS `autoIncrement` in production profile
- Android `versionCode` remains independent

## Deep links

### Custom scheme (active)

- `eternal-rave://event/<id>`
- `eternal-rave://collection/<type>`
- `eternal-rave://notifications`

Helpers: `src/platform/linking/app-linking.ts`

### Universal Links (prepared, not active until hosted)

1. Set `EXPO_PUBLIC_IOS_ASSOCIATED_DOMAIN=https://your-domain.example`
2. Rebuild iOS app
3. Host `apple-app-site-association` on the domain
4. Enable Associated Domains capability in Apple Developer portal

No server implementation is included in this sprint.

## Permissions

No camera, microphone, photo library, location, or push permissions are requested.

`LSApplicationQueriesSchemes` includes `https`, `http`, and `maps` for ticket and map links.

## Assets

| Asset | Path |
|---|---|
| App icon (1024, no alpha) | `assets/images/icon.png` |
| Splash icon | `assets/images/splash-icon.png` |
| Splash background | `#0B0B0F` |

Icons are generated into the native project during prebuild/EAS build.

## Safe areas

The app uses `react-native-safe-area-context` and tab bar inset helpers:

- `SafeAreaContainer`
- `useSafeAreaInsets` on event detail CTA
- `getBottomTabBarHeight()` for bottom tabs

Test on notch, Dynamic Island, and home-indicator devices during TestFlight QA.

## Troubleshooting

| Issue | Action |
|---|---|
| Build fails on credentials | Run `eas credentials` and configure distribution cert + provisioning profile |
| `No bundle identifier` | Verify `com.eternalrave.app` in `app.config.ts` |
| Ticket links do not open | Ensure URLs are `https://`; check device network |
| Supabase auth fails | Verify EAS env vars and RLS |
| Prebuild differs from EAS | Prefer EAS cloud prebuild; commit `ios/` after local `expo prebuild` when needed |
| Splash dark mode warning | App uses global dark UI; splash uses dark background |

## App Store Connect preparation

Prepare manually in App Store Connect (not automated in this sprint):

| Field | Suggested value |
|---|---|
| Name | Eternal Rave |
| Subtitle | Discover electronic events |
| Primary category | Entertainment |
| Secondary category | Music |
| Privacy Policy URL | your hosted privacy policy |
| Support URL | your support page |
| Marketing URL | optional |
| Copyright | your legal entity |
| Keywords | events, rave, techno, electronic, köln |
| Review notes | No login required for public app; admin is web-only |

Screenshots: capture from iPhone 6.7" and 6.1" simulators or devices.

Demo account: not required for current public read-only scope.

## Privacy

Data handled locally:

- saved events (AsyncStorage)
- notification center state (AsyncStorage)

Remote data:

- published events via Supabase (anon key + RLS)

No account registration in the public app.

## Regression scope after iOS changes

Always verify before release:

- Android `assembleRelease`
- Web `build:web`
- Notification center
- Admin web routes

```bash
npm run release:check
cd android && ./gradlew assembleRelease
```
