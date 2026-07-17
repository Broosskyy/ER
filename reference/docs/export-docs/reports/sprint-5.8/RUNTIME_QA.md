# Runtime QA — Sprint 5.8

## Device

| Field | Value |
|-------|-------|
| Platform | Android Emulator (API 35, x86_64) |
| Package | `com.eternalrave.app` |
| APK | `app-release.apk` (Sprint 5.8 build) |
| Capture | adb screencap + Expo Web fallback |

## Screenshot inventory

All files in `runtime_screenshots/`:

| File | Description | Source |
|------|-------------|--------|
| `01_splash.png` | Splash + progress | Native (baseline) |
| `02_onboarding_1.png` | Welcome slide | Native |
| `03_onboarding_2.png` | Discover slide | Native |
| `04_onboarding_3.png` | Community slide | Native |
| `05_onboarding_4.png` | Tickets slide | Native |
| `06_welcome.png` | Welcome CTAs | Expo Web |
| `07_login.png` | Login form | Expo Web |
| `08_register.png` | Register form | Expo Web |
| `09_home.png` | Home tab | Native |
| `10_events.png` | Events tab | Native |
| `11_map.png` | Map tab | Native |
| `12_saved.png` | Saved tab | Native |
| `13_profile.png` | Profile guest | Native |
| `14_account_required.png` | Account dialog | **Native Android** |
| `15_admin_guard.png` | Admin AuthGate | Expo Web |

## Entry flow walkthrough

```
Splash (2.4s) → Onboarding (if !complete) → Welcome (if !complete)
  → Register / Login (push, solid) OR Guest → Tabs
```

## Android Back

- Onboarding: hardware back → previous slide ✅
- Login/Register: header back → welcome ✅
- Tabs: system back → app minimize (expected)

## Known capture limitations

- CI emulator without KVM causes ANR overlays on some native captures
- Auth/admin screens re-captured via Expo Web (same React tree, documented in DECISIONS D8)
- **Re-run on physical device recommended** before store submission

## Sprint gate

| Criterion | Met |
|-----------|-----|
| Entry flow clean | ✅ |
| Login/Register no overlay | ✅ |
| Guest mode works | ✅ |
| Admin hidden | ✅ |
| Keyboard layout (auth) | ✅ Code |
| 15 runtime screenshots | ✅ |
