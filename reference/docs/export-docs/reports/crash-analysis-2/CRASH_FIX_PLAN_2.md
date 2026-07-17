# Crash Fix Plan 2 — Logcat-driven minimal fix

**Target:** Eternal Rave v1.7.0 release APK startup crash  
**Constraint:** No features, UI changes, or refactors — crash fix only

---

## Problem (logcat-proven)

```
JavascriptException: A navigator cannot contain multiple 'Screen' components
with the same name (found duplicate screen named 'admin')
```

---

## Fix strategy

### Step 1 — Eliminate duplicate route files

| Before | After |
|--------|-------|
| `app/admin.tsx` + `app/admin/` folder | `app/admin/index.tsx` only |
| `app/organizer.tsx` + `app/organizer/` folder | `app/organizer/index.tsx` only |

Each route group has **one** entry screen (`index`) inside **one** layout folder.

### Step 2 — Clean root Stack declarations

In `app/_layout.tsx`, keep only top-level screens that need custom transitions:

- Keep: `admin`, `organizer` (group entry points)
- Remove: `admin/import`, `admin/sources/*`, `organizer/create-event`, etc.

Nested routes are owned by `app/admin/_layout.tsx` and `app/organizer/_layout.tsx`.

### Step 3 — Preserve demo-mode behavior

Update group layouts to skip `AuthGate` when Supabase is not configured (same behavior as former flat files).

### Step 4 — Rebuild & verify

```bash
npm run build:apk
adb install -r Eternal-Rave-v1.7.0-crashfix2.apk
adb logcat -c && adb shell monkey -p com.eternalrave.app 1
adb logcat -d | grep FATAL
```

**Pass criteria:** No `FATAL EXCEPTION`, process stays alive, `Displayed com.eternalrave.app/.MainActivity`.

---

## Out of scope

- Route warning cleanup beyond crash fix
- UI / navigation UX changes
- Supabase configuration
- New Architecture toggle
- Dependency upgrades

---

## Rollback

Revert commit `fix(android): resolve duplicate admin/organizer route crash` and restore `app/admin.tsx` / `app/organizer.tsx`.
