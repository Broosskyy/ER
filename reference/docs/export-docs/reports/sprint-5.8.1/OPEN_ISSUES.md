# Open Issues — Sprint 5.8.1

## P2 — Home nested horizontal ScrollViews

Home still uses nested ScrollViews for hero/carousel/clubs. Lower priority than Events tab fix; monitor on device.

## P2 — EventStore monolithic context

Large context value still re-renders admin/submission consumers. Consider Zustand or context selectors in future sprint.

## P2 — Emulator without KVM

CI/cloud emulator may still show system ANR under heavy parallel load. **Physical device test recommended** for final sign-off.

## P3 — Onboarding PNG asset size

Mockup PNGs remain large in APK. Compress to WebP in asset pipeline (not code hotfix scope).

## P3 — Seed data eager import

`seedUserSubmissions` etc. still load at module init in demo mode. Low impact for guest flow.
