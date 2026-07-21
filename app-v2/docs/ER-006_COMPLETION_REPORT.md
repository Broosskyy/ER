# ER-006 Completion Report — Admin Moderation & Contributor Publishing

**Epic:** ER-006  
**Status:** Done  
**Date:** 2026-07-21

---

## 1. Root cause analysis

Contributor event submission (ER-004 / ER-012) already supported `draft → review` on the consumer side, and the admin event editor exposed raw status chips including `published` and `rejected`. However:

1. **No dedicated moderation workflow** — Admins had no queue for contributor submissions in `review`.
2. **No status machine enforcement** — The editor allowed arbitrary status changes without validating contributor vs. CMS paths.
3. **No audit trail** — Publish/reject actions were not logged (import review already had audit; events did not).
4. **Permission gaps** — Editors could attempt publish via status chips; only `admin`/`owner` should moderate submissions.

ER-006 closes the contributor submission loop before Go-Live without new database migrations, following the ER-005.4 architecture.

---

## 2. Solution summary

| Layer | Change |
|-------|--------|
| **Domain** | `admin-event-status.ts` — moderation transitions (`review` → `published` / `rejected`) separate from CMS editorial transitions |
| **Service** | `AdminEventModerationService` — list queue, publish, reject with permission checks |
| **Audit** | `EventModerationAuditService` — in-memory audit log (no schema change; future ER can persist) |
| **Admin UI** | `/admin/events/review` queue + detail screens; nav item “Submissions”; events list banner |
| **Editor** | Contributor `review` events use moderation actions; status chips locked; role-gated publish |

---

## 3. Files changed

### New files

| File | Purpose |
|------|---------|
| `src/features/admin/constants/admin-event-status.ts` | Status transition rules |
| `src/features/admin/services/event-moderation-audit-service.ts` | In-memory moderation audit |
| `src/features/admin/services/admin-event-moderation-service.ts` | Moderation business logic |
| `app/admin/events/review/index.tsx` | Contributor submission queue |
| `app/admin/events/review/[id].tsx` | Submission review detail |
| `src/features/admin/__tests__/admin-event-status.test.ts` | Transition tests |
| `src/features/admin/__tests__/admin-event-moderation-service.test.ts` | Service + audit tests |
| `docs/ER-006_COMPLETION_REPORT.md` | This report |

### Modified files

| File | Change |
|------|--------|
| `src/data/repositories/registry.ts` | Register moderation services |
| `src/features/admin/admin-permissions.ts` | `canModerateContributorEvents`, `canViewContributorReviewQueue` |
| `src/features/admin/admin-route-utils.ts` | `events-review` route keys |
| `src/features/admin/components/AdminShell.tsx` | “Submissions” nav link |
| `app/admin/events/index.tsx` | Review banner, `rejected` filter, contributor labels |
| `app/admin/events/[id].tsx` | Moderation actions for contributor review events |
| `src/features/admin/__tests__/admin-permissions.test.ts` | Permission matrix |
| `src/features/admin/__tests__/admin-guard.test.ts` | Route resolution |
| `BACKLOG.md` | ER-006 → Done |
| `AI_CONTEXT.md` | Publish workflow updated |
| `docs/PROJECT_STATE.md` | Moderation status updated |

---

## 4. Database changes

**None.** ER-006 uses existing `events.status` column and RLS (`admin_manage_events`). Reject notes are stored in the in-memory audit service only (not persisted to DB).

Future recommendation: add `event_moderation_audit` table or extend a unified audit log when profiles/organizer domains land.

---

## 5. Tests

```bash
cd app-v2
npm test   # 67 files, 352/352 passed
```

### New tests (10)

- `admin-event-status.test.ts` — 4 tests (transitions, contributor detection)
- `admin-event-moderation-service.test.ts` — 6 tests (queue, publish, reject, permissions, validation, audit)

### Existing suites

All prior tests remain green; contributor status tests unchanged (contributors still cannot self-publish).

---

## 6. Admin workflow (post-ER-006)

```
Contributor: draft → review (submit)
                    ↓
Admin queue: /admin/events/review
                    ↓
         published  /  rejected
```

- **Roles:** `admin` / `owner` can publish/reject; `viewer`+ can view queue
- **CMS path:** Non-contributor events still use `/admin/events/[id]` editor with editorial transitions

---

## 7. Remaining recommendations

| Priority | Item |
|----------|------|
| High | Persist moderation audit to DB (when unified audit epic is scheduled) |
| Medium | Email/notification to contributor on publish/reject (depends on notifications epic) |
| Medium | ER-006.1 — CMS bulk actions & image upload (legacy backlog item) |
| Low | Sync `database.md` / `admin.md` with contributor columns and moderation routes |
| Low | Dashboard stat card for pending review count |

---

## 8. Validation commands

| Command | Result |
|---------|--------|
| `npm test` | **PASS** — 352/352 |
| `npm run validate:migrations` | Not re-run (no migration changes) |

Pre-existing lint/typecheck failures unchanged (not introduced by ER-006).
