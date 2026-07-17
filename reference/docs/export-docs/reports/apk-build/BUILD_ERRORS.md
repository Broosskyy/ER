# APK Build — Errors & Warnings

## Build Errors

**None.** Gradle `assembleRelease` completed successfully.

---

## Expo Doctor Warnings (non-blocking)

| Issue | Severity | Action |
|-------|----------|--------|
| `.expo/` not in `.gitignore` | Info | Document only — not fixed (out of scope) |
| app.json schema: `splash`, `newArchEnabled` | Warning | False positive / Expo SDK 56 — build succeeded |
| Missing peer `expo-font` | Warning | @expo/vector-icons recommends it — app builds without |
| Package version mismatches (expo 56.0.12 vs 56.0.13, async-storage 3.x vs 2.x) | Warning | Not upgraded — no breaking changes per build spec |

---

## ESLint

Not configured in project — skipped.

---

## EAS Cloud Build

Not attempted — no `EXPO_TOKEN` / EAS credentials in environment. Local Gradle build used instead.

---

## Supabase

If `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are not set at build time, app runs in **demo mode** with seed data. This does not block the APK build.
