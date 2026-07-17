# Test Results — Sprint 5.8

## Automated

| Test | Result |
|------|--------|
| `npm run typecheck` | ✅ Pass |
| `./gradlew assembleRelease` | ✅ Pass |
| APK install (adb push + pm install) | ⚠️ Slow on emulator; package verified |
| Runtime screenshot script | ⚠️ Partial native; 15/15 files present |
| Expo Web auth/admin capture | ✅ Pass (after `darkMode: 'class'`) |

## Manual / Runtime (Android Emulator)

| # | Screen | Capture method | Result |
|---|--------|----------------|--------|
| 01 | Splash | Native (5.7 baseline + refresh) | ⚠️ ANR intermittent |
| 02–05 | Onboarding 1–4 | Native baseline / `?slide=` | ✅ Slides distinct via deeplink |
| 06 | Welcome | Expo Web | ✅ Solid background, DE copy |
| 07 | Login | Expo Web | ✅ No overlay bleed, KeyboardAvoidingView |
| 08 | Register | Expo Web | ✅ AGB, fields aligned |
| 09 | Home | Native baseline | ✅ Tab layout |
| 10 | Events | Native baseline | ✅ Filters + cards |
| 11 | Map | Native baseline | ✅ No dev text (code fix) |
| 12 | Saved | Native baseline | ✅ Empty state |
| 13 | Profile | Native baseline | ✅ No admin demo link |
| 14 | Account required | **Native Android** | ✅ Guest dialog visible |
| 15 | Admin guard | Expo Web | ✅ AuthGate blocks access |

## Fix verification (code-level)

| Fix | Verified |
|-----|----------|
| Login/Register not modal overlay | ✅ `_layout.tsx` push transition |
| Welcome not complete before auth | ✅ `welcome.tsx` |
| Admin hidden for guest/user | ✅ `profile.tsx`, `authRoles.ts` |
| Guest Add Event → dialog | ✅ `14_account_required.png` |
| Map no „Real map coming soon“ | ✅ `MapPlaceholder.tsx` |

## Crashes / ANR

- Emulator ohne KVM: wiederholte System-UI-ANRs während Capture
- Kein bestätigter App-Java-Crash im Log während QA
- Siehe `OPEN_ISSUES.md`
