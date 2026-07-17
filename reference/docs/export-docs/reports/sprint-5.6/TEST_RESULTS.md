# Test Results — Sprint 5.6

**Date:** 2026-07-01

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ Pass |
| Splash route `/splash` | ✅ |
| Onboarding 4 pages + skip | ✅ |
| Welcome → Guest → Home | ✅ |
| Welcome → Login → Home (demo) | ✅ |
| Account dialog on favorite (guest) | ✅ |
| Account dialog on add-event (guest) | ✅ |
| Account dialog on tickets (guest) | ✅ |
| Home DE section titles | ✅ |
| Events result count DE | ✅ |
| Logo in header (Home/Events) | ✅ |
| Mockup placeholder images on events | ✅ |

## Manual test flow

1. Clear app data / AsyncStorage
2. Launch → Splash animation → Onboarding
3. Complete or skip wizard → Welcome
4. Tap **Als Gast fortfahren** → Home tabs work
5. Tap heart on event → Account dialog
6. Navigate to add-event → Account dialog

## Not tested this run

- Physical device install
- Supabase-authenticated login E2E
