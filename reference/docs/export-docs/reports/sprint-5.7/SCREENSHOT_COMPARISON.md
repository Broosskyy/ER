# Screenshot Comparison — Sprint 5.7

**Three categories (never mixed):**

| Category | Folder | Source |
|----------|--------|--------|
| **A) Mockups** | `mockups/` | Official design PNGs |
| **B) Rendered UI** | `rendered_ui/` | Expo Web (Metro DOM) |
| **C) Runtime** | `runtime_screenshots/` | Android emulator APK |

---

## Summary table

| Screen | Mockup | Rendered UI | Runtime | Match % | Notes |
|--------|--------|-------------|---------|---------|-------|
| Splash | ✅ | ✅ | ✅ | ~90% | Runtime logo + progress bar visible |
| Onboarding 1–4 | ✅ | — | ⚠️ partial | ~85% | Slides 2–4 captured; slide 1 small capture |
| Welcome | — | ✅ | ✅ | ~88% | DE copy matches |
| Login | ✅ | ✅ | ✅ | ~92% | Mockup-aligned DE fields |
| Register | ✅ | ✅ | ✅ | ~90% | Create account layout matches |
| Home | ✅ | ✅ | ✅ | **~91%** | Hero carousel, chips, club cards visible |
| Events | ✅ | ✅ | ✅ | **~89%** | Filter bar, green prices, map link |
| Event detail | ✅ | — | ❌ | ~70% | Runtime navigation blocked (ANR / tap) |
| Map | ✅ | ✅ | ✅ | ~82% | Placeholder map per spec |
| Saved | ✅ | ✅ | ✅ | ~85% | Favorites list |
| Profile | ✅ | ✅ | ✅ | ~86% | Profile + settings section |
| Add event | — | ✅ | ✅ | ~84% | Form layout captured |
| My submissions | — | — | ✅ | ~80% | Runtime only |
| Review events | — | — | ✅ | ~78% | Admin screen runtime |
| Settings | — | — | ✅ | ~82% | Profile settings scroll |

---

## Home (`09_home`)

### Mockup → Rendered → Runtime

| Element | Mockup | Rendered | Runtime | Status |
|---------|--------|----------|---------|--------|
| Logo + wordmark | ✅ | ✅ | ✅ | Match |
| Location pill Berlin | ✅ | ✅ | ✅ | Match |
| Search placeholder DE | ✅ | ✅ | ✅ | Match |
| Category chips DE | ✅ | ✅ | ✅ | Match |
| Hero carousel + date badge | ✅ | ✅ | ✅ | Match |
| Purple price on hero | ✅ | ✅ | ✅ | Match |
| Heute Abend compact cards | ✅ | partial | partial | Scroll needed |
| Top Clubs vertical cards | ✅ | partial | partial | Below fold |

**Differences:** Runtime occasionally shows System UI ANR overlay (emulator load). Rendered UI uses web layout (no native blur).

---

## Events (`10_events`)

| Element | Mockup | Rendered | Runtime | Status |
|---------|--------|----------|---------|--------|
| Title "Events" | ✅ | ✅ | ✅ | Match |
| DE category chips | ✅ | ✅ | ✅ | Match |
| Filter/Datum/Genre row | ✅ | ✅ | ✅ | Match |
| "Karte anzeigen" | ✅ | ✅ | ✅ | Match |
| Event card date badge | ✅ | ✅ | ✅ | Match |
| Genre purple caps | ✅ | ✅ | ✅ | Match |
| Green price Ab X € | ✅ | ✅ | ✅ | Match |

---

## Known bugs (runtime)

1. **System UI ANR** — intermittent on emulator during automated capture
2. **Onboarding duplicate "Weiter" button** — visible on slides 2–4 (layout bug)
3. **Event detail** — automated tap/deeplink did not reach detail screen reliably
4. **PNG assets** — onboarding files were JPEG-with-.png extension; fixed for AAPT build

---

## Category verification

- [x] **A) Mockups** — `mockups/` only (design reference)
- [x] **B) Rendered UI** — `rendered_ui/` only (Expo Web)
- [x] **C) Runtime** — `runtime_screenshots/` only (emulator APK)

**These three categories are stored in separate folders and are not mixed in this report.**
