# Known Limitations — Sprint 5.8

1. **No real Mapbox map** — styled placeholder with event pins only.
2. **Google Sign-In** — placeholder alert, not implemented.
3. **Supabase optional** — demo mode bypasses real auth; role guards use local logic.
4. **Runtime screenshots** — partial Expo Web fallback for auth/admin due to emulator ANR; native proof for account-required dialog.
5. **Onboarding slide deeplink `?slide=`** — QA helper, not user-facing.
6. **Emulator install** — `pm install` can exceed 90s without KVM; use `adb push` + retry.
7. **Web Welcome buttons** — full-width buttons render differently on web vs native.
8. **Sprint scope** — no new features, maps extension, automation, or Sprint 6 work included.
