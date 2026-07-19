# Release Checklist

Use this checklist before shipping a web or Android release of Eternal Rave.

## Before build

- [ ] Branch is clean and reviewed
- [ ] `npm install` completed
- [ ] Environment variables set for target environment
- [ ] No secrets in git diff
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run doctor` (Expo Doctor)

## Web

- [ ] `npm run validate:env -- --production` (when using Supabase in production)
- [ ] `npm run validate:pwa`
- [ ] `npm run build:web`
- [ ] `npm run validate:build-output`
- [ ] Manifest reachable in `dist/manifest.webmanifest`
- [ ] Icons present in `dist/pwa/`
- [ ] Service worker present at `dist/sw.js`
- [ ] Direct routes open (`/search`, `/notifications`, `/event/<id>`, `/admin/login`)
- [ ] Browser refresh on inner routes
- [ ] Console free of unhandled errors
- [ ] Network tab free of 404 for manifest/icons/sw
- [ ] Offline banner / offline fallback verified
- [ ] PWA install check on HTTPS host
- [ ] Admin login/logout and browser-back after logout

## Android

- [ ] `cd android && ./gradlew assembleRelease` (or project-standard build)
- [ ] App starts
- [ ] Home / Search / Saved / Notifications work
- [ ] Event details open
- [ ] Bottom tabs unchanged
- [ ] No admin navigation visible
- [ ] No web-only runtime errors

## Supabase

- [ ] `EXPO_PUBLIC_SUPABASE_URL` correct
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` correct
- [ ] No service role in client bundle
- [ ] RLS policies applied
- [ ] Published events readable anonymously
- [ ] Admin routes protected

## Deployment

- [ ] Hosting environment configured
- [ ] HTTPS enabled
- [ ] SPA/static routing verified on host
- [ ] Security headers configured (baseline)
- [ ] Cache headers configured
- [ ] Smoke test on production URL
- [ ] Rollback plan documented

## After deployment

- [ ] Home loads
- [ ] Event detail direct link
- [ ] Notification center
- [ ] Admin login + logout
- [ ] Manifest loads
- [ ] Installability checked on real device/browser
- [ ] Error logs monitored
- [ ] Version/build recorded in release notes

## Quick smoke test (≈15 minutes)

1. Home
2. Event detail
3. Search
4. Saved
5. Notifications + bell badge
6. Reload page
7. Direct event URL
8. Admin login
9. Admin subpage
10. Admin logout
11. Browser back after logout
12. Manifest
13. Install prompt / add to home screen
14. Offline simulation
15. Android app launch
