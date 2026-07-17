# Logcat Excerpt — Confirmed crash (pre-fix)

Captured from `Eternal-Rave-v1.7.0-preview.apk` on Android 35 emulator via:

```bash
adb logcat -c
adb shell monkey -p com.eternalrave.app 1
adb logcat -d | grep -B2 -A50 "FATAL EXCEPTION: mqt"
```

---

## ReactNativeJS error

```
07-01 18:31:33.572  5464  5495 E ReactNativeJS: { [Error: A navigator cannot contain multiple 'Screen' components with the same name (found duplicate screen named 'admin')]
07-01 18:31:33.572  5464  5495 E ReactNativeJS:   isComponentError: true }
```

---

## FATAL EXCEPTION (process terminating)

```
07-01 18:31:33.766  5464  5496 E AndroidRuntime: FATAL EXCEPTION: mqt_v_native
07-01 18:31:33.766  5464  5496 E AndroidRuntime: Process: com.eternalrave.app, PID: 5464
07-01 18:31:33.766  5464  5496 E AndroidRuntime: com.facebook.react.common.JavascriptException: Error: A navigator cannot contain multiple 'Screen' components with the same name (found duplicate screen named 'admin')
07-01 18:31:33.766  5464  5496 E AndroidRuntime:
07-01 18:31:33.766  5464  5496 E AndroidRuntime: This error is located at:
07-01 18:31:33.766  5464  5496 E AndroidRuntime:     at NativeStackNavigator (address at index.android.bundle:1:1333953)
07-01 18:31:33.766  5464  5496 E AndroidRuntime:     at anonymous (address at index.android.bundle:1:1876240)
07-01 18:31:33.766  5464  5496 E AndroidRuntime:     at FavoritesProvider (address at index.android.bundle:1:1493392)
07-01 18:31:33.766  5464  5496 E AndroidRuntime:     at AppWithFavorites (address at index.android.bundle:1:1545171)
07-01 18:31:33.766  5464  5496 E AndroidRuntime:     at EventSourceProvider (address at index.android.bundle:1:1573301)
07-01 18:31:33.766  5464  5496 E AndroidRuntime:     at EventStoreProvider (address at index.android.bundle:1:1502091)
07-01 18:31:33.766  5464  5496 E AndroidRuntime:     at AuthProvider (address at index.android.bundle:1:1396598)
07-01 18:31:33.766  5464  5496 E AndroidRuntime:     at RootLayout (<anonymous>)
07-01 18:31:33.766  5464  5496 E AndroidRuntime:     at ExpoRoot (address at index.android.bundle:1:1380254)
07-01 18:31:33.766  5464  5496 E AndroidRuntime: 	at com.facebook.react.modules.core.ExceptionsManagerModule.reportException(ExceptionsManagerModule.kt:52)
```

---

## Pre-fix route warnings (same session)

```
07-01 18:25:45.022  3883  3925 W ReactNativeJS: '[Layout children]: No route named "organizer/create-event" exists in nested children:', [ ..., 'admin', ..., 'admin', ..., 'organizer' ]
```

Note duplicate `'admin'` and `'organizer'` entries in nested children list.

---

## Post-fix verification excerpt

From `crash-logcat-fix2.txt` after installing `Eternal-Rave-v1.7.0-crashfix2.apk`:

```
07-01 18:48:47.219  1949  1977 I ActivityTaskManager: Displayed com.eternalrave.app/.MainActivity for user 0: +23s157ms
```

No `FATAL EXCEPTION` lines present in full logcat dump. Process remained alive (`pidof` → 9672).
