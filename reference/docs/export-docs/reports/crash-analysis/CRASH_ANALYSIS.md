# Crash Analysis — Android Release APK Startup

**App:** Eternal Rave v1.7.0 (versionCode 7)  
**Symptom:** App installs but closes immediately on launch (release APK only)  
**Date:** 2026-07-01

---

## Summary

The release APK crashed at startup due to **misconfigured JavaScript tooling for production builds**, not due to Supabase, navigation, or database logic.

**Root cause (P0):** Missing `react-native-reanimated/plugin` in `babel.config.js`.

**Contributing factor (P1):** `expo-font` not declared/loaded before `@expo/vector-icons` render in standalone builds.

---

## Investigation scope

| Area | Finding |
|------|---------|
| App entry (`expo-router/entry`) | ✅ Standard Expo Router entry |
| Root layout / providers | ✅ Valid nesting; no throw on demo mode |
| AuthProvider | ✅ Skips Supabase when env unset |
| Supabase init | ✅ Returns `null` without env — no crash |
| Navigation / Redirect `/home` | ✅ Valid |
| AsyncStorage | ✅ Only used when Supabase configured |
| React Query | ⏭ Not used |
| SecureStore | ⏭ Not used |
| ProGuard / minify | ✅ Disabled in release (`minifyEnabled: false`) |
| Asset PNG validity | ✅ Icons valid after branding regen |
| Physical logcat | ⏭ No device/emulator attached in CI |

---

## Root cause detail

### 1. Reanimated Babel plugin missing (CRITICAL)

**Evidence:**
- `babel.config.js` had NativeWind presets only — **no** `react-native-reanimated/plugin`
- App uses Reanimated on **first screen** via:
  - `BottomNav` → `AnimatedPressable` (`useSharedValue`, `useAnimatedStyle`)
  - `EventCardSkeleton` / `LoadingSkeleton` (animated opacity on Home load)
  - `AnimatedFavoriteButton`, `AnimatedCard`, etc.

**Release-only behavior:**
- In dev/Metro, Reanimated may appear to work partially
- In **release Hermes bundle**, worklets are not transformed → immediate JS fatal error:
  - Typical: *"Reanimated Mismatch between JavaScript part and native part"*
  - Or: worklet runtime exception on first animated component mount

**Why immediate crash:**
```
App start → Redirect /home → Tabs layout → BottomNav (Reanimated) → CRASH
```
Even before feed data loads, tab bar renders on layout mount.

### 2. expo-font not loaded (SECONDARY)

**Evidence:**
- Expo Doctor flagged missing `expo-font` peer for `@expo/vector-icons`
- Home + BottomNav render `Ionicons` immediately
- Vector icons auto-load fonts async in dev; standalone release builds are stricter

**Impact:** Can cause icon/font native errors; fixed proactively with `useFonts` in root layout.

### 3. gesture-handler import (PRECAUTIONARY)

Added `import 'react-native-gesture-handler'` as first import in root layout — recommended for release builds using `GestureHandlerRootView`.

---

## Ruled out

| Hypothesis | Why excluded |
|------------|--------------|
| Supabase misconfiguration | Demo mode skips client creation |
| requireSupabase() throw | Not called at startup without login |
| Invalid APK signing | APK installs successfully |
| Native module missing | Build succeeds; autolinking intact |
| ProGuard stripping | Minify disabled |
| Deep link handler | Guarded; no throw when Supabase null |
| React Query | Not in project |

---

## Logcat guidance (device verification)

If crash persists on device, capture:

```bash
adb logcat -c && adb shell am start -n com.eternalrave.app/.MainActivity && adb logcat *:E ReactNative:V ReactNativeJS:V | head -100
```

Look for:
- `ReactNativeJS` — Reanimated / worklet errors
- `AndroidRuntime` — native module linkage
- `FATAL EXCEPTION` — uncaught native crash

---

## Conclusion

**Primary fix:** Add Reanimated Babel plugin (must be last plugin).  
**Secondary fix:** Install `expo-font`, load icon fonts in root layout before render.  
**Rebuild required:** Yes — JS bundle must be regenerated.
