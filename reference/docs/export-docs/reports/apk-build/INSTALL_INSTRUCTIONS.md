# APK Build — Install Instructions

## Requirements

- Android 7.0+ (API 24 minimum)
- ~110 MB free storage
- “Install from unknown sources” enabled for your browser/file manager

---

## Install from APK file

1. Download `Eternal-Rave-v1.7.0-preview.apk`
2. Open the file on your Android device
3. Tap **Install**
4. Open **Eternal Rave**

---

## Install via ADB (developers)

```bash
adb install -r Eternal-Rave-v1.7.0-preview.apk
```

---

## First launch

- **Without Supabase env:** App runs in demo mode with seed events
- **With Supabase env:** Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` before building for live backend

---

## Verify installation

```bash
adb shell pm list packages | grep eternalrave
# → package:com.eternalrave.app
```

---

## Uninstall

Settings → Apps → Eternal Rave → Uninstall

Or: `adb uninstall com.eternalrave.app`
