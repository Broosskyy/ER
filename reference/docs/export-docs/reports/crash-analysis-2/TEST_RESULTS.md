# Test Results — Crash Fix 2

**Date:** 2026-07-01  
**Device:** Android Emulator (API 35, x86_64, `-accel off`)  
**Package:** `com.eternalrave.app`

---

## Pre-fix (Phase 1 APK)

**APK:** `Eternal-Rave-v1.7.0-preview-fix.apk`

| Check | Result |
|-------|--------|
| Install | ✅ Success |
| Launch (`monkey -p com.eternalrave.app 1`) | ❌ Process dies |
| `FATAL EXCEPTION` in logcat | ✅ Present |
| Error message | Duplicate screen named **`admin`** |
| `Displayed MainActivity` | Sometimes reached, then crash during JS init |

---

## Post-fix (crashfix2)

**APK:** `Eternal-Rave-v1.7.0-crashfix2.apk`

| Check | Result |
|-------|--------|
| Install | ✅ Success |
| Launch (`monkey -p com.eternalrave.app 1`) | ✅ Success |
| `FATAL EXCEPTION` in logcat | ✅ **None** |
| `Process com.eternalrave.app died` | ✅ **None** |
| Process alive after 30s | ✅ PID 9672 |
| `Displayed com.eternalrave.app/.MainActivity` | ✅ +23s157ms |
| Duplicate route warnings | ✅ **None** |
| TypeScript (`npm run typecheck`) | ✅ Pass |
| Gradle `assembleRelease` | ✅ BUILD SUCCESSFUL in 1m 34s |

---

## Logcat commands used

```bash
adb logcat -c
adb shell monkey -p com.eternalrave.app 1
sleep 30
adb logcat -d > crash-logcat-fix2.txt
grep "FATAL EXCEPTION" crash-logcat-fix2.txt   # no output
adb shell pidof com.eternalrave.app             # 9672
```

---

## Verdict

**Crash fix verified.** Startup fatal error eliminated on emulator. Recommend physical device smoke test with same logcat workflow.
