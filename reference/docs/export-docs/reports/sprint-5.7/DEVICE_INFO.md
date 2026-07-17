# Device Information — Sprint 5.7

| Property | Value |
|----------|-------|
| **Device type** | Android Emulator (AVD) |
| **AVD name** | `eternal_rave_test` |
| **Model** | sdk_gphone64_x86_64 (Android Emulator) |
| **Android version** | 15 (API 35) |
| **Display size** | 1080 × 2400 px |
| **Density** | 420 dpi (~2.625x) |
| **Orientation** | Portrait |
| **GPU** | swiftshader_indirect (software) |
| **Acceleration** | Disabled (`-accel off`) |

## Build stack

| Component | Version |
|-----------|---------|
| Expo SDK | ~56.0.12 |
| React Native | 0.85.3 |
| React | 19.2.3 |
| App version | 1.7.0 |
| Package | `com.eternalrave.app` |

## APK tested

| Property | Value |
|----------|-------|
| File | `android/app/build/outputs/apk/release/app-release.apk` |
| Build | `./gradlew assembleRelease` (post PNG asset fix) |
| Install | `adb install app-release.apk` |

## Capture method

- **Runtime screenshots:** `adb exec-out screencap` + deep links (`eternalrave://…`) + UI taps
- **Rendered UI:** Expo Web (`npx expo start --web`) + Puppeteer @ 412×915 viewport
- **Mockups:** Official PNGs from `/assets/onboarding/` (design reference)

## Known environment issues

- Emulator occasionally shows **System UI isn't responding** (ANR) under load — documented in runtime screenshots and `OPEN_ISSUES.md`
- Software rendering (`-accel off`) used for CI stability
