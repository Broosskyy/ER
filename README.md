# Eternal Rave

**Discover. Connect. Rave.**

Premium event discovery platform for electronic music — Android, iOS-compatible (Expo), and Web/PWA.

## Platforms

| Platform | Status |
|---|---|
| Android | supported |
| iOS | Expo-compatible; EAS/TestFlight prepared (Sprint 12.7A) |
| Web | supported (static export) |
| PWA | installable online-first foundation (Sprint 12.6D) |

## Quick Start

```bash
cd app-v2
npm install
npm start
```

Web development:

```bash
npm run web
```

Web production build:

```bash
npm run build:web
npm run validate:build-output
```

Release validation:

```bash
npm run release:check
```

## Environment

Copy `.env.example` to `.env` and set:

- `EXPO_PUBLIC_USE_SUPABASE`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Optional:

- `EXPO_PUBLIC_WEB_BASE_URL`
- `EXPO_PUBLIC_WEB_NOINDEX=true` (preview/staging)
- `EXPO_PUBLIC_SUPPORT_URL`, `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL` (after domain setup)

Never put service role keys in client env vars.

## Documentation

- [Architecture](app-v2/docs/ARCHITECTURE.md)
- [Web Foundation](app-v2/docs/web-foundation.md)
- [PWA](app-v2/docs/pwa.md)
- [Web Deployment](app-v2/docs/web-deployment.md)
- [Release Checklist](app-v2/docs/release-checklist.md)
- [Admin Web Access](app-v2/docs/admin-web.md)
- [iOS Build & TestFlight](app-v2/docs/ios-build.md)
- [Domain Strategy](app-v2/docs/domain.md)
- [Email Infrastructure](app-v2/docs/email.md)
- [Business Setup](app-v2/docs/business-setup.md)
- [Brand Guidelines](app-v2/docs/brand.md)
- [Design System](app-v2/docs/DESIGN_SYSTEM.md)
- [Build Status](app-v2/docs/BUILD_STATUS.md)

## Sprint status

- 12.6A Web Foundation — complete
- 12.6B Notification Center — complete
- 12.6C Admin Web Access — complete
- 12.6D PWA & Release Hardening — complete
- 12.7A iOS Foundation & TestFlight — complete
- 12.7B Domain, Email & Brand Foundation — complete
