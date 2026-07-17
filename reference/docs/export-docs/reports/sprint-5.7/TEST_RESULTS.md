# Test Results — Sprint 5.7 (Screenshot & QA Standard v1.0)

## Automated

| Test | Result |
|------|--------|
| `npm run typecheck` | ✅ Pass |
| `./gradlew assembleRelease` | ✅ Pass (after PNG asset fix) |
| APK install on emulator | ✅ Pass |
| Runtime screenshot script | ✅ 18/18 files generated |
| Rendered UI (Expo Web) | ✅ 10 screens captured |
| Mockup reference copy | ✅ `mockups/` populated |

## APK smoke test (manual via adb)

| Screen |package | Route / action | Result | Screenshot |
|----------|----------------|--------|------------|
| Splash | Cold start | ✅ Visible | `01_splash.png` |
| Onboarding 1–4 | Tap Weiter | ⚠️ Slides 2–4 OK; ANR intermittent | `02–05_*.png` |
| Welcome | After onboarding | ✅ | `06_welcome.png` |
| Login | Deep link `/login` | ✅ DE mockup layout | `07_login.png` |
| Register | Deep link `/register` | ✅ | `08_register.png` |
| Guest → Home | Deep link `/home` | ✅ Sprint 5.7 UI | `09_home.png` |
| Events | Deep link `/search` | ✅ Filter bar + cards | `10_events.png` |
| Event detail | Tap / deeplink | ❌ Blocked by ANR / nav | `11_event_detail.png` ⚠️ |
| Map | Deep link `/map` | ✅ Placeholder map | `12_map.png` |
| Saved | Deep link `/favorites` | ✅ | `13_saved.png` |
| Profile | Deep link `/profile` | ✅ | `14_profile.png` |
| Add event | Deep link `/add-event` | ✅ Form visible | `15_add_event.png` |
| My submissions | Deep link | ✅ | `16_my_submissions.png` |
| Review events | Admin deeplink | ✅ | `17_review_events.png` |
| Settings | Profile scroll | ✅ | `18_settings.png` |

## Crashes / ANR

- **System UI isn't responding** — observed during automated capture on emulator
- Documented in runtime screenshots (overlay visible)
- Not a confirmed app Java crash; emulator resource contention suspected
- See `OPEN_ISSUES.md`

## Three-category compliance

| Category | Folder | Status |
|----------|--------|--------|
| A) Mockups | `mockups/` | ✅ |
| B) Rendered UI | `rendered_ui/` | ✅ |
| C) Runtime | `runtime_screenshots/` | ✅ |

**No category mixing in ZIP.**

## Recommendation

Re-run runtime capture on physical device or `-accel on` emulator for cleaner event detail + onboarding slide 1 shots.
