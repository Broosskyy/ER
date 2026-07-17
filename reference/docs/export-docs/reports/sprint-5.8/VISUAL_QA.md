# Visual QA — Sprint 5.8

## Entry Flow

| Check | Status | Notes |
|-------|--------|-------|
| Splash → Onboarding separation | ✅ | No stack bleed |
| Onboarding duplicate CTA | ✅ | Single mockup button (invisible tap zone) |
| Welcome after onboarding only | ✅ | `getLaunchRoute()` unchanged logic + welcome fix |
| Auth full-screen push | ✅ | No welcome visible under login |

## Auth Screens

| Check | Status | Notes |
|-------|--------|-------|
| Solid background | ✅ | `AuthScreenLayout` gradient |
| Logo/header centered | ✅ | |
| Safe area top/bottom | ✅ | `useSafeAreaInsets` |
| Password toggle alignment | ✅ | Register/login |
| AGB checkbox row | ✅ | Register |
| Google placeholder | ✅ | Secondary button |

## Tabs / Home / Events

| Check | Status | Notes |
|-------|--------|-------|
| Header logo + notification | ✅ | `HomeScreenHeader` |
| Hero carousel not clipped | ⚠️ Improved padding | Further mockup polish optional |
| Filter chips | ✅ | Border + active state |
| Event card spacing | ✅ | Minor width tweak |

## Map

| Check | Status | Notes |
|-------|--------|-------|
| No dev English text | ✅ | DE coming-soon copy |
| Pins + preview card | ✅ | |

## Guest / Guards

| Check | Status | Notes |
|-------|--------|-------|
| Account-required dialog design | ✅ | Icon + centered |
| Admin not on profile | ✅ | |
| Admin route guard | ✅ | `15_admin_guard.png` |

## Score

**Visual QA: 8.5/10** — Core sprint fixes verified; carousel/mockup parity deferred to future polish sprint.
