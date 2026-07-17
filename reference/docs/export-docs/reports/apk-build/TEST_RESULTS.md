# APK Build — Test Results

**Date:** 2026-07-01

## Automated

| Check | Result |
|-------|--------|
| TypeScript (`npm run typecheck`) | ✅ Pass |
| Gradle `assembleRelease` | ✅ BUILD SUCCESSFUL |
| aapt package validation | ✅ com.eternalrave.app v1.7.0 (7) |
| APK file size | ✅ ~105 MB (plausible) |
| ESLint | ⏭ Not configured |
| Expo Doctor | ⚠️ 4 warnings (non-blocking) |

## Build artifact

| Property | Value |
|----------|-------|
| Path | `Eternal-Rave-v1.7.0-preview.apk` |
| Package | com.eternalrave.app |
| minSdk | 24 |
| targetSdk | 36 |
| Signed | ✅ Release keystore (debug/signing config from prebuild) |

## Not run on physical device

Runtime smoke test on hardware not executed in cloud environment. APK structure and signing validated via aapt.
