# Android System Bars Fix Report

**Version:** 0.1.2 (versionCode 3)  
**Branch:** `cursor/android-system-bars-fix-6b06`  
**Date:** 2026-07-18

## Problem

The Android system navigation bar at the bottom of the screen was hidden (immersive-style behavior). Users had to swipe up to reveal it. The Eternal Rave bottom tab bar was positioned as if no system navigation existed.

## Root Cause — What Was Hiding the Navigation Bar

Navigation bar hiding was applied in **four places**:

| Location | Previous behavior |
|---|---|
| `app/_layout.tsx` | `<NavigationBar hidden style="dark" />` on Android |
| `src/platform/android-system-ui.ts` | `NavigationBar.setHidden(true)` on app start and when returning to foreground |
| `app.config.ts` | `expo-navigation-bar` plugin: `{ hidden: true, style: 'dark' }` |
| `android/app/src/main/res/values/styles.xml` | `expoNavigationBarHidden=true`, transparent `navigationBarColor`, `windowLightNavigationBar=true` |

This was originally intentional (documented in `docs/SPRINT_01_HOME_POLISH_REPORT.md`) to maximize screen space with swipe-to-reveal navigation.

No immersive mode, `MainActivity` overrides, or other `SystemUI` flags were found beyond the above.

## Changes Made

### 1. Show system navigation permanently

- **`src/platform/android-system-ui.ts`** — `NavigationBar.setHidden(false)` and `NavigationBar.setStyle('light')` (light icons on dark bar). Status bar unchanged: visible, light style.
- **`app/_layout.tsx`** — `<NavigationBar style="light" />` (removed `hidden` prop).
- **`app.config.ts`** — Plugin updated to `{ hidden: false, style: 'light', enforceContrast: false }`.
- **`android/app/src/main/res/values/styles.xml`** — `expoNavigationBarHidden=false`, solid `#0B0B0F` navigation bar color, `windowLightNavigationBar=false`.

### 2. Safe area / bottom tab bar

Android previously used a fixed `spacing.sm` bottom padding because the system nav was hidden. With the nav bar visible, Android now uses the real bottom inset once via a shared helper:

- **`src/platform/tab-bar-insets.ts`** (new) — `getBottomTabBarPadding()` and `getBottomTabBarHeight()`.
- Updated tab layout and scroll content padding in:
  - `app/(tabs)/_layout.tsx`
  - `app/(tabs)/index.tsx`
  - `app/(tabs)/search.tsx`
  - `app/(tabs)/saved.tsx`
  - `src/features/collections/components/CollectionScreen.tsx`
  - `src/features/map/components/NativeEventMap.tsx`
  - `src/features/search/components/FilterSheet.tsx`

### 3. Version bump

- App version `0.1.1` → `0.1.2`
- Android `versionCode` `2` → `3`

## Resulting Behavior

| Area | Behavior |
|---|---|
| **Status bar (top)** | Remains visible. Light icons on dark background via `StatusBar style="light"`. Transparent native status bar color (edge-to-edge). |
| **System navigation (bottom)** | Always visible. Solid `#0B0B0F` background matching app theme. Light system button icons. No auto-hide, no swipe required. |
| **Eternal Rave tab bar** | Sits directly above the system navigation. Height includes real bottom safe-area inset. |
| **Scroll content** | `paddingBottom` uses tab bar height once — no double bottom gap. |
| **Edge-to-edge** | Still enabled (`edgeToEdgeEnabled=true`). Content draws behind status bar; tab bar and lists respect insets. |

## Validation

| Check | Result |
|---|---|
| `npm run lint` | Pass (0 errors; pre-existing import-order warnings only) |
| `npx tsc --noEmit` | Pass |
| `npx expo-doctor` | 19/20 — expected CNG warning (native folders + app.config); does not block release |
| `npm test` | 25/25 passed |
| `./gradlew assembleRelease` | Pass |

## APK

| Field | Value |
|---|---|
| **Filename** | `eternal-rave-0.1.2-android-system-bars-fix.apk` |
| **Size** | ~99 MB |
| **Build** | `npx expo prebuild --platform android` + `./gradlew assembleRelease` |
| **Download** | https://github.com/Broosskyy/ER/releases/download/v1-android-0.1.2-system-bars-fix/eternal-rave-0.1.2-android-system-bars-fix.apk |
| **Artifact path** | `/opt/cursor/artifacts/apk/eternal-rave-0.1.2-android-system-bars-fix.apk` |

## Manual Test Checklist (Android device)

- [ ] Home — system nav visible, tab bar above it, list scrolls fully
- [ ] Events — search, filters, keyboard open/closed
- [ ] Map placeholder — no overlap
- [ ] Saved — empty and populated states
- [ ] Profile
- [ ] Event Detail — ticket CTA above system nav
- [ ] Collection screens
- [ ] Filter modal — content not clipped
- [ ] Tab switching works
- [ ] Android back button works
- [ ] App restart — system nav still visible
