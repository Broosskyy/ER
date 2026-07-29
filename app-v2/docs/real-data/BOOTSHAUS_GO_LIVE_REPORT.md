# Bootshaus Go-Live Report

**Date:** 2026-07-28  
**Source:** `source-bootshaus-koeln`  
**Target:** `gnkjzinwvmrxcadwebhv.supabase.co`  
**Scope:** Final live execution after service-role grants fix

---

## Executive Summary

Service-role ops connectivity is **fully operational** after migration `20260756000000_service_role_backend_grants.sql`. Scheduler → queue → worker pipeline **completed two successful Bootshaus imports** (36 events fetched/parsed per run).

**Blocker for public go-live:** Trust Quality Engine returns **`hold`** for all records (quality score 34, threshold 65). Events remain in `import_review_queue` (`on_hold`) — **0 published**, **0 Discovery visibility**.

**Schema drift mitigated in code** (target DB missing Sprint 13 columns `last_error`, `source_roles`): mapper no longer sends absent columns.

**Verdict: CONDITIONAL GO** — ops/import pipeline green; publish/discovery red until trust/quality rules or parser enrichment resolved.

---

## Phase 1 — Ops connection

| Check | Result |
|-------|--------|
| Service role configured | ✅ |
| `platform_operations_state` readable | ✅ |
| `sources` readable | ✅ |
| `scheduler_runs` read/write | ✅ |
| `import_job_queue` read/write | ✅ |
| `events` readable | ✅ |
| `claim_import_job_queue_entries` executable | ✅ |

No `42501` errors in this run.

---

## Phase 2 — Bootshaus configuration

| Field | Expected | Actual |
|-------|----------|--------|
| `enabled` | true | ✅ |
| `publish_mode` | `auto_publish` | ✅ |
| `review_required` | false | ✅ |
| `schedule_enabled` | true | ✅ |
| `schedule_policy` | `interval` | ✅ |
| `schedule_interval_preset` | `every_6_hours` | ✅ |
| `next_scheduled_at` | set | ✅ |
| `connectorKey` | `club_website` | ✅ |
| `preferredStrategy` | `html_selector` | ✅ |
| `base_url` | set | ✅ `https://bootshaus.tv/events/` |

`BOOTSHAUS_GO_LIVE_ACTIVATION.sql` not required — source already in go-live posture.

---

## Phase 3 — Pre-import baseline

| Metric | Value |
|--------|-------|
| Queue (active) | 3 stuck `processing` (from prior failed runs) |
| Import jobs | 3 (2 failed, 1 pending blocking scheduler) |
| Published Bootshaus events | 0 |
| Review queue | 0 |
| Dead letter | 0 |
| Source trust | 76 |
| `next_scheduled_at` | set |

Stale queue/jobs from earlier schema-drift failures were reconciled before first clean import.

---

## Phase 4 — First live import

| Step | Result |
|------|--------|
| `run-scheduler-tick.ts` | ✅ `completed`, `jobsEnqueued: 1` |
| Queue after scheduler | ✅ 1 active `queued` job (`ae1cb135-…`) |
| `run-queue-worker.ts` | ✅ `jobsProcessed: 1`, `jobsSucceeded: 1`, ~22s |
| Recovery | ✅ no stuck entries |
| Worker retry | ✅ 0 jobs (nothing to retry) |

**Import job `ae1cb135-626b-4891-9115-8ebd63fb99d5`:**

| Metric | Value |
|--------|-------|
| Status | `completed` |
| Fetched | 36 |
| Parsed | 36 |
| Invalid | 0 |
| Created | 36 |
| Updated | 0 |
| Duplicates | 0 |
| Errors | 0 |

---

## Phase 5 — Pipeline validation

| Stage | Status | Notes |
|-------|--------|-------|
| Scheduler | ✅ OK | Enqueued exactly 1 job |
| Queue | ✅ OK | Single active job, no duplicates |
| Worker | ✅ OK | Claim + process succeeded |
| Fetch | ✅ OK | 36 from bootshaus.tv |
| Normalize | ✅ OK | 36 parsed |
| Validate | ✅ OK | 0 invalid |
| Matching | ✅ OK | No match errors |
| Trust | ⚠️ Warnung | Decision `hold` on all records |
| Lifecycle | ✅ OK | No lifecycle errors |
| Publish | ❌ Fehler | 0 published (trust hold) |
| Discovery | ❌ Fehler | 0 Bootshaus events public |
| API | — | Not tested in this run |

---

## Phase 6 — Event validation

| Metric | Value |
|--------|-------|
| Import records (total) | 72 (after 2 runs) |
| Record status | 72 × `needs_review` |
| Published events | 0 |
| `event_source_references` | 0 |
| Review queue entries | 72 (`on_hold`) |

**Trust hold reasons (sample):**

- City is missing.
- Organizer is missing.
- `quality_score_below_auto_publish_threshold` (score **34**, threshold **65**)

Source trust score **76** (above min 70) — quality rules block auto-publish, not source trust.

**Spot-check:** Not possible on published events (none exist). Parser extracts title, date, venue from HTML; city/organizer not populated from Bootshaus markup.

---

## Phase 7 — Discovery

| Check | Result |
|-------|--------|
| Bootshaus events in Discovery | ❌ 0 |
| Search title `%bootshaus%` | ❌ 0 |
| Search venue `%bootshaus%` | ❌ 0 |
| Staging seed events visible | ✅ 15 published |
| Review events public | ✅ 0 (RLS blocks anon) |

---

## Phase 8 — Idempotency (second import)

| Metric | Run 1 | Run 2 |
|--------|-------|-------|
| Job ID | `ae1cb135-…` | `d533d849-…` |
| Status | completed | completed |
| Fetched | 36 | 36 |
| Created | 36 | 36 |
| Updated | 0 | 0 |
| Duplicate count | 0 | 0 |
| Published delta | — | 0 |

**Assessment:** ❌ **Not idempotent** — second run created 36 new import records instead of updating existing ones. Root cause: first-run records never published (no canonical events / source references), so matching cannot dedupe across jobs.

Queue discipline per run: ✅ exactly 1 job enqueued each time.

---

## Phase 9 — Monitoring

| Area | Rating | Detail |
|------|--------|--------|
| Scheduler | 🟢 Grün | Last runs `completed` |
| Worker | 🟢 Grün | Last runs `completed` |
| Queue | 🟢 Grün | 0 queued, 0 processing, 0 dead letter |
| Bootshaus source | 🟡 Warnung | Import OK, publish blocked |
| Review backlog | 🔴 Fehler | 72 `on_hold` |
| Connector health | 🟡 Warnung | No persisted snapshots |
| Cron | 🔴 Fehler | Not deployed |

| Field | Value |
|-------|-------|
| Last successful import | `2026-07-28T21:49:48.121Z` |
| Source trust (computed) | 76.5 |
| `next_scheduled_at` | `2026-07-29T03:49:52Z` (~6h interval) |
| Consecutive failures | 0 |

---

## Code fixes applied during go-live (no new migration)

| Issue | Fix |
|-------|-----|
| `source_roles` column missing on DB | Omit from `mapSourceRecordToRow` unless non-empty |
| `last_error` column missing on DB | Never persist; removed from schedule state apply |
| Entity alias store | Initialized in ops scripts |
| Pending job blocking scheduler | Go-live orchestrator clears superseded pending jobs |

---

## Remaining risks

| Risk | Severity |
|------|----------|
| Trust quality holds all Bootshaus records | **Kritisch** for public go-live |
| Missing city/organizer in parser output | Hoch |
| Idempotency unproven until publish works | Hoch |
| No cron / external scheduler deployed | Hoch |
| 72 duplicate review entries from test runs | Mittel |
| DB schema drift (`last_error`, `source_roles`) | Mittel — code workaround only |
| Affenkäfig disabled (intentional) | Niedrig |

---

## Final answers

### 1. Ist Bootshaus jetzt vollständig produktiv?

**Nein.** Import pipeline runs, but **0 events published** — not consumer-ready.

### 2. Läuft Bootshaus jetzt automatisch?

**Teilweise.** Schedule configured (`every_6_hours`, `next_scheduled_at` set), but **no cron/worker deployment** — manual `npx tsx scripts/operations/run-*.ts` only.

### 3. Ist der Import idempotent?

**Nein.** Second run created 36 new records (72 total in review). Publish/matching dedupe not exercised.

### 4. Sind Bootshaus Events öffentlich sichtbar?

**Nein.** 0 in Discovery; all records held in review queue.

### 5. Kann jetzt AFFENKÄFIG GO-LIVE begonnen werden?

**Nein.** Bootshaus publish path not validated end-to-end.

---

## Live run summary

| Field | Value |
|-------|-------|
| Zielumgebung | `gnkjzinwvmrxcadwebhv.supabase.co` |
| Service Role erfolgreich | **ja** |
| Erster Import | **ja** — 36 fetched/parsed/created, 0 published |
| Zweiter Import | **ja** — 36 fetched/parsed/created, 0 published |
| Monitoring | Scheduler/worker **grün**, review backlog **rot** |
| Discovery | **nein** |
| Matching | Ran without errors; no cross-run dedupe |
| Lifecycle | OK |
| Trust | **hold** (quality 34 < 65) |
| Idempotenz | **nein** |
| Cron aktiv | **nein** |
| Kritische Blocker | Trust quality hold; parser missing city/organizer |

### Verdict: **CONDITIONAL GO**

Ops and import infrastructure are production-ready. **Full GO** requires resolving trust-quality hold (parser enrichment or Bootshaus-specific trust rule adjustment) and verifying publish → Discovery → idempotency.

---

## Sprint 26.8 update (2026-07-29)

| Item | Status |
|------|--------|
| Canonical entity repair `20260758000000` | **Applied** — `venue-bootshaus-koeln` live |
| Dedupe cleanup COMMIT | **Executed** — 72→36 records/reviews |
| Pre-publish idempotency code | `upsertManyBySourceExternal` + review queue dedup |
| Unique indexes | **Deferred** |
| Controlled re-import | **Pending** |
| Publish / Discovery | **Not validated** |

See **`BOOTSHAUS_DATA_QUALITY_IDEMPOTENCY_REPORT.md`** and **`_bootshaus_dedup_cleanup_commit_result.json`**.

**Updated verdict: CONDITIONAL GO** — infrastructure + idempotency proven; **final E2E validation NO GO** (trust hold).

See **`BOOTSHAUS_FINAL_GO_LIVE_VALIDATION_REPORT.md`** for 2026-07-29 E2E results.
