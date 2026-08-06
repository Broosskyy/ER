# Phase 4.6.2 Completion — Progress Report (In Progress)

**Date:** 2026-08-02  
**Status:** **Not complete** — Parts 1–3 remain open; do not run final manual acceptance yet.

This document tracks work against the Phase 4.6.2 Completion brief. Production re-import, migration deploy, and final browser acceptance are **explicitly deferred** until code blockers close.

---

## 1. Web-bundle secret root cause and fix

### Root cause (dependency path)

```
app bootstrap → registry.ts (static import getSupabaseServiceClient)
  → client.ts (resolveSupabaseServiceRoleKey, getSupabaseServiceClient, error strings containing SUPABASE_SERVICE_ROLE_KEY)
  → web export entry-*.js
```

`entity-alias-store-bootstrap.ts` also imported `resolveSupabaseServiceRoleKey` from `client.ts` (JWT skew diagnostics).

### Fix implemented

| Change | File |
|--------|------|
| Public anon-only client | `src/services/supabase/client.ts` |
| Ops-only service-role module | `src/services/supabase/client-service-role.ts` |
| Registry uses `getSupabaseClient()` (RLS) for corpus expansion | `registry.ts` |
| Bootstrap uses anon key for clock skew | `entity-alias-store-bootstrap.ts` |
| Ops scripts import service-role from `client-service-role` | `scripts/operations/*`, `ops-supabase-rows.ts` |
| Boundary tests | `client-auth-config.test.ts` |

### Validation

- `npm run validate:build-output` — **PASS** (after `build:web`)

---

## 2. ESLint fixes

| File | Fix |
|------|-----|
| `UserProfileProvider.tsx` | Hydration via `userKey` match — no synchronous `setHydrated(false)` in effect |
| `app/profile/edit.tsx` | `ProfileEditForm` child remounts on `profile.updatedAt` — no `setDraft` in effect |

Run `npx eslint app/profile/edit.tsx src/features/profile/UserProfileProvider.tsx --quiet` — **PASS**

Full-repo ESLint still has warnings; zero-error gate on profile files verified.

---

## 3–8. Pipeline (Part 1) — **NOT COMPLETE**

Still required before Part 3 acceptance:

- Complete `buildAdminEventFromImportRecord` (coordinates, age, venue address, ticket offers, timezone, doors)
- `ticketOffers` → consumer `ticketPhases` end-to-end
- Timetable/running-order extraction
- Detail/Info-tab extraction audit per Source
- Lineup recovery validation on production corpus
- Structured description sections (admission, FAQ, ticket notes, etc.)

**Do not re-import production** until these land and preflight passes.

---

## 9–11. UX (Part 2) — **NOT COMPLETE**

- Location search (city/ZIP/address, radius, recent) — not implemented
- Unified filter contract across Home/Search/Map/Calendar — not implemented
- Empty Search preview policy — not formalized

---

## 12–14. Profiles / parity — **PARTIAL**

- `entity_follows` migration exists (`20260801120000_phase46_entity_follows.sql`) — **not deployed** (needs approval)
- Follow UX code paths exist; persistent counts depend on migration
- Ticket semantic layer (`ticket-presentation`, `TicketPriceLabel`) — done in Part 2
- Text-only relationship repair plan — **not written**

---

## 15–16. Mobile venue + unknown time — **PARTIAL**

| Item | Status |
|------|--------|
| Venue card vertical layout + full-width route button | **Done** (`VenueDetailCard.tsx`) |
| Unknown midnight / `00:00 – 00:00` | **Done** (`hasKnownEventClockTime`, `formatEventTimeRange`, `display-event`) |

Add overnight/timezone regression tests — **pending**.

---

## 17–19. Production ops — **NOT RUN**

- Read-only preflight script — **pending**
- Migration deploy — **awaiting approval**
- Controlled re-import (pass 1 + 2) — **awaiting code + migration**

---

## 22. Test / build results (this session)

| Gate | Result |
|------|--------|
| `typecheck:app` | Pass |
| `validate:build-output` | **Pass** |
| `build:web` | Pass |
| Profile ESLint (target files) | Pass |
| Full `npm test` | Not re-run full suite this pass |

---

## 23. Remaining blockers before Part 3 acceptance

1. Complete Part 1 publish mapper + ticket offers + timetable + lineup production validation
2. Complete Part 2 location search + unified filters + search preview policy
3. Deploy `entity_follows` migration + verify follow persistence
4. Production read-only preflight + approved re-import (2 passes, idempotent)
5. Source-to-UI trace on live reprocessed data
6. Full ESLint zero errors repo-wide
7. **Manual browser acceptance** (only after live data reprocessed)

---

## Production readiness decision

**NOT READY** for Phase 5 or Part 3 final acceptance.

**Ready to continue:** bundle security gate, profile ESLint, venue layout, unknown-time handling.

**Next recommended implementation order:** publish mapper → ticket offers bridge → preflight script → migration deploy (approved) → re-import → Part 3 manual walkthrough.
