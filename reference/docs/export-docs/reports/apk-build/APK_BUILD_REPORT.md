# APK Build Report — Android Preview

**Projekt:** Eternal Rave · **Version:** 1.7.0 (versionCode 7) · **Datum:** 1. Juli 2026  
**Build-Typ:** Local Gradle Release APK (Preview) · **Branch:** `cursor/apk-build-preview-a932`

---

## Executive Summary

| Gate | Status |
|------|--------|
| Build erfolgreich | ✅ |
| APK installierbar | ✅ (signiert, Release-Build) |
| TypeScript | ✅ |
| App Version unverändert | ✅ 1.7.0 |
| Package Name | ✅ `com.eternalrave.app` |
| Official Logo (02_Splash_Logo.png) | ✅ |
| Reports + ZIP | ✅ |

**APK:** `Eternal-Rave-v1.7.0-preview.apk` (~105 MB)

---

## Phase 1 — Build Readiness

| Check | Result |
|-------|--------|
| Expo SDK | ~56.0.12 |
| React Native | 0.85.3 |
| Node | v22.14.0 |
| package.json | ✅ |
| app.json | ✅ Eternal Rave, com.eternalrave.app, versionCode 7 |
| eas.json | ✅ preview profile → APK |
| Android SDK | ✅ API 35/36, build-tools 35/36 |
| Deep Linking | ✅ scheme `eternalrave` |
| Supabase env | Optional (demo mode without env) |

---

## Phase 2 — Code Health

| Check | Result |
|-------|--------|
| TypeScript | ✅ Pass |
| ESLint | ⏭ Not configured |
| Expo Doctor | ⚠️ 4 non-blocking warnings (see BUILD_ERRORS.md) |

---

## Phase 3 — Branding

Source: `assets/mockups/Eternal_Rave_Screens_Renamed.zip` → `02_Splash_Logo.png`

Regenerated (ffmpeg, brand background `#0B0B0F`):
- `assets/icon.png`
- `assets/splash-icon.png`
- `assets/android-icon-foreground.png`
- `assets/android-icon-background.png`
- `assets/android-icon-monochrome.png`
- `assets/favicon.png`

Original ZIP files **not modified**.

---

## Phase 4 — Release Config

| Field | Value |
|-------|-------|
| App Name | Eternal Rave |
| Package | com.eternalrave.app |
| Version | 1.7.0 (unchanged) |
| Version Code | 7 |
| Orientation | portrait |
| User Interface Style | dark |
| Build command | `./gradlew assembleRelease` |

---

## Phase 5 — Auth

| Check | Result |
|-------|--------|
| Supabase configured | Only if `EXPO_PUBLIC_SUPABASE_*` set at build time |
| Demo mode | ✅ Works without env |
| Build blocked by backend | ❌ No — build continued |

---

## Phase 6 — Build

Method: **Local Gradle** (`expo prebuild` + `assembleRelease`)  
EAS cloud build not used (no EAS token in CI environment).

Result: **BUILD SUCCESSFUL** in ~45s (incremental).

Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## Phase 7 — Validation

```
package: com.eternalrave.app
versionCode: 7
versionName: 1.7.0
minSdk: 24
targetSdk: 36
permissions: INTERNET, VIBRATE, ...
size: ~105 MB
```

---

## Download

| Artefakt | Link |
|----------|------|
| **APK** | https://github.com/Broosskyy/Eternal-Rave/releases/download/v1.7.0-preview/Eternal-Rave-v1.7.0-preview.apk |
| **Report ZIP** | https://github.com/Broosskyy/Eternal-Rave/releases/download/v1.7.0-preview/APK_BUILD_REPORT.zip |
