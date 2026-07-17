# Logcat Report — Sprint 5.8.1

**File:** `logcat_stability.txt`  
**Capture window:** Stability soak test (~10 min navigation)  
**Package:** `com.eternalrave.app` v1.7.1

## Summary

| Signal | Count | Status |
|--------|-------|--------|
| ANR / „not responding“ | **0** | ✅ Pass |
| FATAL EXCEPTION | **0** | ✅ Pass |
| ReactNativeJS Error | **0** | ✅ Pass |
| ReactNativeJS „Running main“ | 6 | ℹ️ Cold starts (expected) |

## App Process Notes

- Clean install via `pm clear` before soak
- Multiple cold starts during deeplink navigation (6× „Running main“)
- No `AndroidRuntime` crash stack for `com.eternalrave.app`
- No `Input dispatching timed out` for app package

## System Noise (Non-App)

- Package replace / force-stop messages during test setup
- Emulator warnings (CPU variant, SQLite double-quoted strings) — environmental

## Choreographer / Frame Skips

No sustained `Skipped N frames` bursts tied to eternalrave.app after 5.8.1 fixes (post warm-start).

## Conclusion

Logcat shows **no app-level crashes or ANR signatures** during the soak script. Remaining risk: emulator without KVM under parallel load — recommend identical capture on physical device.
