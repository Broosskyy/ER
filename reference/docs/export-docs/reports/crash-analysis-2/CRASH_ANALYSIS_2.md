# Crash Analysis 2 — Logcat-verified startup crash

**App:** Eternal Rave v1.7.0 (versionCode 7)  
**Package:** `com.eternalrave.app`  
**Symptom:** App closes immediately after launch (release APK)  
**Date:** 2026-07-01  
**Method:** Android emulator + ADB logcat (no guessing)

---

## Executive summary

Phase 1 fixes (Reanimated Babel plugin, expo-font, gesture-handler) were **necessary but insufficient**.

**Confirmed root cause (P0):** Duplicate Expo Router screen name `admin` in the root `Stack` navigator.

```
Error: A navigator cannot contain multiple 'Screen' components with the same name
(found duplicate screen named 'admin')
```

This is a **fatal JavaScript exception** in release builds. React Native reports it as `FATAL EXCEPTION: mqt_v_native` and terminates the app process.

---

## Logcat workflow executed

Environment: Android 35 x86_64 emulator (software acceleration), ADB 36.x.

```bash
adb devices
adb logcat -c
adb shell monkey -p com.eternalrave.app 1
adb logcat -d > crash-logcat.txt
adb logcat -d | grep -i -E "FATAL EXCEPTION|AndroidRuntime|ReactNativeJS|Expo|Hermes|Reanimated|Eternal|com.eternalrave"
```

APKs tested:
- `Eternal-Rave-v1.7.0-preview.apk` — **crashes**
- `Eternal-Rave-v1.7.0-preview-fix.apk` — **still crashes** (Phase 1 only)
- `Eternal-Rave-v1.7.0-crashfix2.apk` — **starts successfully**

---

## Confirmed crash signature

| Field | Value |
|-------|-------|
| Thread | `mqt_v_native` |
| Process | `com.eternalrave.app` |
| Type | `com.facebook.react.common.JavascriptException` |
| Message | Duplicate screen named **`admin`** |
| React Native tag | `ReactNativeJS` (Error, `isComponentError: true`) |
| Component stack | `NativeStackNavigator` → `RootLayout` → `ExpoRoot` |

See `LOGCAT_EXCERPT.md` for verbatim log lines.

---

## Root cause detail

### Conflicting route definitions

Two separate route sources both registered the name **`admin`** in the root navigator:

1. **`app/admin.tsx`** — flat file route `/admin`
2. **`app/admin/_layout.tsx`** — nested route group `/admin/*`

The same pattern existed for **`organizer`** (`app/organizer.tsx` + `app/organizer/`).

Additionally, `app/_layout.tsx` declared explicit `<Stack.Screen name="admin" />` **and** nested screens like `admin/import`, `organizer/create-event`, etc. at the **root** level. Expo Router auto-discovers nested group routes; re-declaring them at root produced warnings such as:

```
[Layout children]: No route named "organizer/create-event" exists in nested children
```

…and duplicated entries (`admin` listed twice in nested children).

### Why immediate crash on launch

Startup flow:

```
App start → Root Stack mounts → registers all Stack.Screen children
→ duplicate "admin" detected → JS fatal error → process exit
```

This happens **before** Home feed or Supabase logic runs.

---

## Ruled out (via logcat)

| Hypothesis | Evidence |
|------------|----------|
| Reanimated Babel plugin (Phase 1) | `libreanimated.so` loads; no Reanimated mismatch in final crash |
| Hermes engine failure | Hermes loads successfully (`libhermesvm.so`) |
| Missing native module | SoLoader initializes; RN screens load |
| Supabase env error | Crash occurs during navigator setup, before network/auth |
| Font / asset error | No font or asset exceptions in crash stack |
| Splash screen native crash | Splash shows; crash is JS in `NativeStackNavigator` |
| Gesture Handler | Not in stack trace |

---

## Fix applied (crashfix2)

1. Move `app/admin.tsx` → `app/admin/index.tsx`
2. Move `app/organizer.tsx` → `app/organizer/index.tsx`
3. Remove redundant nested `Stack.Screen` declarations from root `app/_layout.tsx`
4. Preserve demo-mode auth bypass in group `_layout.tsx` files

**Rebuild required:** Yes — JS bundle must be regenerated.

---

## Conclusion

The real startup crash was an **Expo Router navigation configuration error** (duplicate screen names), not a native module or Supabase issue. Phase 1 fixes remain valid hardening but did not address this fatal navigator error.
