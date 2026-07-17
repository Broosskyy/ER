# Changed Files — Crash Fix 2

## Modified

| File | Change |
|------|--------|
| `app/_layout.tsx` | Removed duplicate nested `Stack.Screen` entries for `admin/*` and `organizer/*`; kept group entry screens only |
| `app/admin/_layout.tsx` | Demo-mode auth bypass when Supabase not configured |
| `app/organizer/_layout.tsx` | Demo-mode auth bypass when Supabase not configured |

## Renamed / moved

| From | To |
|------|-----|
| `app/admin.tsx` | `app/admin/index.tsx` |
| `app/organizer.tsx` | `app/organizer/index.tsx |

## Deleted

| File | Reason |
|------|--------|
| `app/admin.tsx` | Conflicted with `app/admin/` route group (duplicate screen name) |
| `app/organizer.tsx` | Conflicted with `app/organizer/` route group |

## Artifacts (not committed)

| File | Description |
|------|-------------|
| `Eternal-Rave-v1.7.0-crashfix2.apk` | Release APK built after fix |
| `crash-logcat-fix2.txt` | Post-fix verification logcat |
| `CRASH_ANALYSIS_2.zip` | Report bundle |
