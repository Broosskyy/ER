# Crash Fix Plan

## Fix 1 — Reanimated Babel plugin (P0) ✅

**File:** `babel.config.js`

```javascript
plugins: ['react-native-reanimated/plugin'], // MUST be last
```

**Why:** Transforms worklets for Hermes release bundle. Without this, any `useSharedValue` / `useAnimatedStyle` crashes at runtime.

**Risk:** None — official Reanimated requirement.

---

## Fix 2 — expo-font + preload (P1) ✅

**Files:** `package.json`, `app.json`, `app/_layout.tsx`

- Add `expo-font` dependency + config plugin
- Load `Ionicons` and `MaterialCommunityIcons` fonts via `useFonts` before rendering tree

**Why:** Standalone APK requires explicit font loading for vector icons.

**Risk:** Low — brief null render until fonts load (~100ms).

---

## Fix 3 — gesture-handler side effect (P2) ✅

**File:** `app/_layout.tsx`

```javascript
import 'react-native-gesture-handler'; // first import
```

**Why:** Prevents gesture handler init race in release builds.

---

## Rebuild steps

```bash
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## Verification checklist

- [x] TypeScript passes
- [x] Gradle BUILD SUCCESSFUL
- [x] aapt validates package `com.eternalrave.app` v1.7.0
- [ ] Physical device smoke test (user)

---

## Out of scope (NOT changed)

- No feature changes
- No UI redesign
- No version bump
- No architecture refactor
- No Supabase/schema changes
