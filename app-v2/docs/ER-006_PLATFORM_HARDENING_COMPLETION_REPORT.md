# ER-006 Platform Hardening — Completion Report

**Epic:** ER-006 Platform Hardening (follow-up to ER-006 Admin Moderation)  
**Status:** Done  
**Date:** 2026-07-21  
**Branch:** `feature/er-006-platform-hardening`

---

## A. Architecture changes

No architectural redesign. Hardening extends the existing ER-005.4 stack:

- **Repository layer:** `AdminEventRepository.save()` and `.delete()` now validate CMS vs moderation paths via `AdminEventSaveContext`.
- **Domain constants:** `canAdminEditorialTransition()` is now enforced through `assertValidAdminEditorialTransition()` and `isContributorReviewEvent()`.
- **Database:** Replaced monolithic `admin_manage_events` with scoped policies plus a `BEFORE UPDATE` trigger — RLS remains authoritative.

---

## B. Security improvements

| Gap (review finding) | Fix |
|----------------------|-----|
| RLS allowed any `is_admin()` role to publish/reject | Migration `20260732000000`: trigger requires `has_admin_role(['admin','owner'])` for `published`/`rejected` transitions |
| Contributor `review` events archivable via Delete | UI hides Delete/Archive/Save; repository blocks CMS save/delete on contributor review events |
| Viewer could Save/Edit/Delete via admin editor | `canEditEvents()` enforced in UI (read-only fields, hidden actions) and repository transition checks |
| CMS arbitrary status changes | `assertValidAdminEditorialTransition()` in UI + repository for CMS saves |
| Withdraw vs publish race | Optimistic re-read in `withdrawFromReview` and `AdminEventRepository.save({ source: 'moderation' })` |

---

## C. Permission improvements

- **`canDeleteEvents()`** added (alias of `canEditEvents`) for clarity.
- **Event list:** “New” button hidden for view-only roles.
- **Event editor:** View-only banner; inputs `editable={false}` when `!canEditEvents(role)` or contributor review.
- **Moderation:** Unchanged — still `admin` / `owner` only via `canModerateContributorEvents`.

---

## D. Database changes

**One additive migration:** `20260732000000_er006_platform_hardening.sql`

**Why required:** `admin_manage_events` granted ALL write access to every admin JWT role. Application permissions restrict publish/reject to `admin`/`owner` only. Without DB enforcement, direct Supabase API calls could bypass moderation.

**Contents:**
1. Drop `admin_manage_events`
2. Add `admin_insert_events`, `admin_update_events`, `admin_delete_events` (scoped to `editor`/`admin`/`owner`)
3. Add `enforce_admin_event_status_rules()` trigger:
   - Publish/reject → `admin`/`owner` only
   - Contributor `review` rows → only `admin`/`owner` may update; status may only move to `published`/`rejected`
   - Contributor self-service (`auth.uid() = created_by`) bypasses trigger

No schema-breaking changes. No historical migrations modified.

---

## E. Files changed

### New

| File | Purpose |
|------|---------|
| `supabase/migrations/20260732000000_er006_platform_hardening.sql` | RLS + trigger hardening |
| `src/data/__tests__/admin-event-repository.test.ts` | Repository transition/delete tests |
| `src/data/__tests__/er006-platform-hardening-migration.test.ts` | Migration content assertions |
| `docs/ER-006_PLATFORM_HARDENING_COMPLETION_REPORT.md` | This report |

### Modified

| File | Change |
|------|--------|
| `src/data/repositories/repositories.ts` | CMS/moderation save validation; contributor review delete guard |
| `src/features/admin/constants/admin-event-status.ts` | `isContributorReviewEvent`, `assertValidAdminEditorialTransition` |
| `src/features/admin/admin-permissions.ts` | `canDeleteEvents` |
| `src/features/admin/services/admin-event-moderation-service.ts` | Moderation saves use `{ source: 'moderation' }` |
| `src/features/create/services/contributor-event-service.ts` | Optimistic withdraw validation |
| `app/admin/events/[id].tsx` | Permission enforcement, contributor review protection |
| `app/admin/events/index.tsx` | Hide “New” for view-only roles |
| `scripts/validate-migrations.ts` | Updated required policy/trigger checks |
| Tests: `admin-event-status`, `admin-event-moderation-service`, `admin-permissions`, `contributor-event-service` | Hardening coverage |
| `AI_CONTEXT.md`, `BACKLOG.md`, `docs/PROJECT_STATE.md` | Migration count, ER-006 status |
| `docs/admin-web.md`, `docs/PLATFORM_ARCHITECTURE_FOUNDATION.md` | Moderation routes, RLS, ER-006 status |

---

## F. Tests added

| Suite | New tests |
|-------|-----------|
| `admin-event-repository.test.ts` | 5 (illegal transition, CMS on contributor review, delete protection, moderation save, stale moderation) |
| `er006-platform-hardening-migration.test.ts` | 3 (policy split, publish restriction, contributor review trigger) |
| `admin-event-status.test.ts` | 2 (contributor review detection, assert editorial transition) |
| `admin-event-moderation-service.test.ts` | 1 (publish after withdraw) |
| `contributor-event-service.test.ts` | 1 (withdraw after publish) |
| `admin-permissions.test.ts` | 1 (`canDeleteEvents` for viewer) |

**Total new tests:** 13  
**Full suite:** 375/375 passed

---

## G. Full test results

```bash
cd app-v2
npm test
# Test Files  73 passed (73)
# Tests       375 passed (375)
```

---

## H. Migration validation

```bash
cd app-v2
npm run validate:migrations
# Validated 14 migration file(s).
# Import foundation tables and admin RLS checks passed.
```

---

## I. Remaining known limitations

| Item | Notes |
|------|-------|
| In-memory moderation audit | Reject notes still not persisted (out of scope) |
| Contributor notifications | No email/in-app on publish/reject (out of scope) |
| Review queue pagination | Still capped at 100 items |
| Rejected → draft reopen | Admin CMS path only; contributor cannot self-resubmit without admin action |
| Local mock mode | RLS trigger not exercised; repository + service checks provide local parity |
| `reviewer` role naming | Can approve imports but not events — documented in `admin-web.md` |

---

## J. Recommendation: Is ER-006 now production-ready?

**Yes, for Supabase go-live with community contributor moderation**, subject to standard pre-release checks (remote migration apply, smoke test on staging, manual role verification).

The critical review findings (RLS/app permission mismatch, contributor review bypass, editorial transition gaps, viewer write access) are closed. Remaining limitations are documented deferrals, not security blockers.

**ER-006 is accepted as the platform baseline** for event moderation, with the caveats in section I tracked for future epics.
