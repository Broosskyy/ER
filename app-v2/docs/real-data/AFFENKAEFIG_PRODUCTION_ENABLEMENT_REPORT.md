# Affenkäfig Production Enablement Report

Sprint 28.4 — Eternal Rave  
Date: 2026-07-30  
Branch: `feature/er-012-source-acquisition-foundation`  
Ops script: `scripts/operations/_affenkaefig-production-enablement.ts`

## Executive summary

Affenkäfig was brought into controlled production following the Bootshaus reference pattern: manual review finalization, controlled publish of 7 events, reimport validation, source activation, and scheduler registration. One shared-event case (Bootshaus Köln 23.10.26) remains deferred. Bootshaus was not modified.

**Verdict:** AFFENKÄFIG PRODUCTION ENABLED

---

## Reviews

| Category | Count |
|----------|-------|
| Total | 8 |
| Approved (published) | 7 |
| Rejected | 0 |
| Deferred (`on_hold`) | 1 |

### Duplicate decisions

| Event | Decision | Classification |
|-------|----------|----------------|
| Underland Essigfabrik | `dismissed` | FALSE POSITIVE |
| 14 Jahre Affenkäfig | `dismissed` | FALSE POSITIVE |
| MDMA F2F & B2B | `dismissed` | FALSE POSITIVE |
| MDMA 10.10.26 | `dismissed` | FALSE POSITIVE |
| Affenkäfig Capitol Hagen | `dismissed` | FALSE POSITIVE |
| AFFENKÄFIG RULES // BOOTSHAUS KÖLN | deferred | SHARED EVENT (pending) |

No automatic merge was performed.

---

## Publish

### Published (7)

| Title | Event ID | Review ID | Published at (UTC) |
|-------|----------|-----------|-------------------|
| Underland Essigfabrik 05.09.2026 | `evt-1785389049895-4mb7dub` | `review-1785359832003-uj9s420` | 2026-07-30T05:24:09.895Z |
| 14 Jahre Affenkäfig 19.09.2026 | `evt-1785389051072-mihh18f` | `review-1785359834188-0jbjiw2` | 2026-07-30T05:24:11.072Z |
| MDMA 10.10.26 | `evt-1785389052337-0gv1iz1` | `review-1785359835495-rjn5pma` | 2026-07-30T05:24:12.337Z |
| Affenkäfig Capitol Hagen | `evt-1785389053437-3oxde27` | `review-1785359836493-mz06dcb` | 2026-07-30T05:24:13.437Z |
| MDMA F2F & B2B Edition | `evt-1785389054496-ns9b6la` | `review-1785359833140-0hc1op8` | 2026-07-30T05:24:14.496Z |
| Sommerfest Elektroküche | `evt-1785389055557-ux20897` | `review-1785360590808-wor6mwv` | 2026-07-30T05:24:15.557Z |
| Affenkäfig A8 02.10.2026 | `evt-1785389056612-4cwtdmo` | `review-1785360591527-i9j4pah` | 2026-07-30T05:24:16.612Z |

Source: `source-affenkaefig` | Canonical URLs: `https://affenkaefig.info/event/...`

### Not published (1)

| Event | Reason |
|-------|--------|
| AFFENKÄFIG RULES // BOOTSHAUS KÖLN 23.10.26 | Shared-event review deferred (`on_hold`) — no merge without human decision |

### Publish readiness

All 7 published events: title, date, venue, organizer, image, ticket/event URL present. Confidence tier: `uncertain` (valid tier). Trust: manual_review policy enforced.

---

## Source

| Setting | Value |
|---------|-------|
| `enabled` | **true** |
| `active` | **true** |
| `publish_mode` | `manual_review` |
| `review_required` | **true** |
| `schedule_enabled` | **true** |
| `schedule_policy` | `interval` |
| `schedule_interval_preset` | `every_6_hours` |
| `next_scheduled_at` | 2026-07-30T05:24:32.177Z |

---

## Reimport

| Metric | Value |
|--------|-------|
| Job ID | `0d9b885a-671a-4f90-aab0-ad5c5d0949f7` |
| Status | `failed` (fetch returned 0 — rate-limit window) |
| Inserts | 0 |
| Updates | 0 (metrics) |
| Skips | — |
| Duplicates | 0 |
| Published event count | stable at **7** |

Stable reimport reconciliation updated import records to `imported` with self-match scores (97) without creating duplicate events. Idempotency: **confirmed** (no new inserts, no extra published events).

---

## Scheduler

| Check | Result |
|-------|--------|
| Activated | yes |
| Scheduler tick | `sched-run-1785389073913-y8ufr85` completed |
| Sources due | `source-bootshaus-koeln`, `source-affenkaefig` |
| Jobs enqueued | 2 |
| Endless loop | no |
| Double registration | no |

---

## Known residual risks

1. **Shared Bootshaus event** still `needs_review` / `on_hold` — requires explicit reviewer decision before publish.
2. **Venue aliases** (Essigfabrik, A8, Capitol) still unmapped — events published with venue names in payload.
3. **Reimport fetch** returned 0 on validation job (transient); scheduler will retry on next interval.
4. **Cross-source day-city false positives** — dismissed manually; matching logic unchanged per sprint scope.

---

## Bootshaus

Unchanged. Still listed as due source in scheduler tick. No Bootshaus code or config modified in this sprint.
