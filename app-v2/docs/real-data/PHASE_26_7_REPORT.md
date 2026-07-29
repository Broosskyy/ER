# Sprint 26.7 — Production Hardening Report

**Date:** 2026-07-28  
**Migration:** `supabase/migrations/20260755000000_sprint26_7_production_hardening.sql`  
**Revision:** Post-review hardening + publish_mode drift repair (§2b)

---

## 0. Root cause — `publish_mode` missing (ERROR 42703)

### Symptom

Applying `20260755000000_sprint26_7_production_hardening.sql` failed at §3/§4:

```
ERROR 42703: column "publish_mode" of relation "sources" does not exist
```

### Canonical definition (exists in repository)

| Property | Value |
|----------|-------|
| **Migration** | `20260744000000_sprint13_production_integration.sql` |
| **Timestamp** | Before `20260755000000` (Sprint 26.7) |
| **Column** | `publish_mode text NOT NULL DEFAULT 'manual_review'` |
| **Check** | `IN ('auto_publish', 'manual_review', 'conditional_review')` |
| **Index** | `sources_publish_mode_idx` |
| **TypeScript** | `PublishMode` in `src/features/import/domain/publish-mode.ts` |
| **Default** | `'manual_review'` (`DEFAULT_PUBLISH_MODE`) |

No PostgreSQL enum — plain `text` with `CHECK` constraint.

### Cause

The real database schema is **behind Sprint 13**: `public.sources` has scheduler/pilot columns from later migrations but **`publish_mode` was never created**. Typical reasons:

1. `20260744000000` not applied (migration history gap)
2. Migration marked applied but `ALTER TABLE` failed partially (unlikely)
3. Column dropped manually (unlikely)

### Follow-up fix — `pg_catalog.coalesce` (ERROR 42883)

PostgreSQL `COALESCE` is a SQL construct, not a schema-qualifiable function. `pg_catalog.coalesce(...)` fails at runtime. Sprint 26.7 uses plain `coalesce(...)`; other builtins remain `pg_catalog.*` where valid.

### Repair strategy (chosen)

**Strategy A** — canonical migration exists; Sprint 13 file unchanged.

**Plus drift repair in Sprint 26.7 §2b** — idempotent column-existence guard before §3/§4, matching Sprint 13 type/default/check/index. No-op when Sprint 13 already applied.

### Staging verification before re-run

```sql
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version >= '20260744000000' ORDER BY version;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sources' AND column_name = 'publish_mode';
```

If `20260744000000` is **not** in `schema_migrations`, apply all pending migrations through Sprint 26.6 first, then 26.7.

---

## 1. Files

### New files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260755000000_sprint26_7_production_hardening.sql` | Production hardening migration |
| `src/data/__tests__/sprint26-7-production-hardening-migration.test.ts` | Migration structure tests |
| `docs/real-data/PHASE_26_7_REPORT.md` | This report |
| `docs/real-data/SPRINT26_7_QUEUE_CLAIM_SQL_TESTS.md` | Manual PostgreSQL queue-claim test script |
| `docs/real-data/SPRINT26_7_EVENT_SEARCH_DOCUMENT_BACKFILL.sql` | Manual controlled search-document backfill (ops, not migration) |

### Changed files (revision pass)

| File | Change |
|------|--------|
| `supabase/migrations/20260755000000_sprint26_7_production_hardening.sql` | Post-review corrections; search row backfill removed |
| `src/data/__tests__/sprint26-7-production-hardening-migration.test.ts` | Assertions aligned with revised migration |
| `docs/real-data/PHASE_26_7_REPORT.md` | This revision |
| `docs/real-data/SPRINT26_7_EVENT_SEARCH_DOCUMENT_BACKFILL.sql` | New manual ops script for search backfill |

Existing migrations Sprint 13–26.6 remain untouched.

---

## 2. Changes

### 2.1 Post-review corrections

| Area | Correction |
|------|------------|
| **COMMENT ON COLUMN** | Every comment requires both table (`to_regclass`) and column (`information_schema.columns`) |
| **updated_at function** | No `CREATE OR REPLACE` on `public.set_updated_at()`; reuse only parameterless suitable function (`p.pronargs = 0`); otherwise `public.sprint267_set_updated_at()` |
| **SECURITY DEFINER** | Claim function `search_path = pg_catalog, public, pg_temp`; builtins schema-qualified |
| **Constraint validation** | `conrelid`-scoped checks; re-validates existing `NOT VALID` constraints when data is clean |
| **Search backfill** | **Removed from migration** — manual ops script only |
| **publish_mode drift** | §2b adds column idempotently if missing (Sprint 13 parity) before §3/§4 |
| **Score comments** | Added guarded comments for trust/quality/success/error score columns |

### Queue claim function

- Replaced `public.claim_import_job_queue_entries(integer, timestamptz, text, integer)` with hardened `SECURITY DEFINER` implementation.
- Validates `p_limit` (1–100), `p_worker_id` (non-blank, max 128), `p_lease_ms` (60s–1h).
- Falls back `p_now` to `pg_catalog.clock_timestamp()` when null.
- Returns empty set when `worker_paused` or `global_maintenance_mode` is true.
- Does **not** block on `scheduler_paused`.
- Claim filters: `queued`, due `scheduled_for`, retry window, no dead letter, `attempt_count < max_attempts`.
- Sort: `priority DESC`, `scheduled_for ASC`, `enqueued_at ASC`, `id ASC`.
- Atomic `FOR UPDATE SKIP LOCKED` + conditional update.
- Does **not** increment `attempt_count` on claim (matches application semantics — see §2.2).

### 2.2 Retry semantics (`attempt_count`)

Verified against TypeScript worker code:

| Phase | Location | Behaviour |
|-------|----------|-----------|
| **Enqueue** | `import-job-queue-service.ts` → `enqueueScheduledImport` | `attemptCount: 0`, `maxAttempts: 3` |
| **Claim** | SQL `claim_import_job_queue_entries` + `claimReadyJobs` | **No increment** — only sets `processing` / lease fields |
| **Failure / retry** | `import-job-queue-processor.ts` catch block | `attemptCount = (entry.attemptCount ?? 0) + 1`; requeue if `attemptCount < maxAttempts` |
| **Stuck recovery** | `worker-recovery-service.ts` | Same increment-on-failure pattern before requeue or dead-letter |
| **Manual retry** | `import-job-queue-service.ts` → `retryQueueEntry` | Resets `attemptCount: 0` |

**Consistency verdict:** With `maxAttempts = 3`, a job may be claimed while `attempt_count` is 0, 1, or 2 (`attempt_count < max_attempts`). After each failed run the app increments before requeue. After the third failure `attempt_count` becomes 3; claim filter `3 < 3` blocks further claims; constraint `attempt_count <= max_attempts` allows the terminal state. **No migration change required.**

### Rights

- `REVOKE ALL` from `PUBLIC`, `anon`, `authenticated` (role-checked via `pg_catalog.pg_roles`).
- `GRANT EXECUTE` to `service_role` only.

### Maintenance mode

- Reads `public.platform_operations_state` (`id = 'default'`).
- Missing row treated as unpaused / no maintenance.

### Affenkäfig (`source-affenkaefig`)

- `enabled = false`, `active = false`
- `review_required = true`, `publish_mode = manual_review`
- `schedule_enabled = false`, `next_scheduled_at = NULL`
- **Reference HTML in `source_config` preserved** (not removed).

### Bootshaus (`source-bootshaus-koeln`)

- `publish_mode = conditional_review`, `review_required = true`
- Only when source remains enabled, not archived, and has `base_url`
- Schedule from Sprint 26.6 unchanged

### Constraints

Added with `NOT VALID` + conditional `VALIDATE` (including re-validation on re-run when `convalidated = false`):

| Table | Constraint |
|-------|------------|
| `import_job_queue` | `attempt_count >= 0`, `max_attempts >= 1`, `attempt_count <= max_attempts` |
| `operations_backfill_jobs` | `batch_size > 0` |
| `scheduler_runs` | `duration_ms >= 0`, `finished_at >= started_at` |
| `worker_runs` | `duration_ms >= 0`, `finished_at >= started_at` |
| `worker_recovery_runs` | `duration_ms >= 0`, `finished_at >= started_at` |
| `connector_health_snapshots` | `average_duration_ms >= 0`, `last_response_time_ms >= 0` |
| `source_intelligence_snapshots` | `avg_import_duration_ms >= 0` |
| `festival_editions` | date order, year 1900–2200 |
| `events` | `end_date >= start_date` |
| `import_schedule_locks` | `expires_at >= acquired_at` |
| `event_match_evaluations` | `auto_link` requires `canonical_event_id` |

**Validation status at migration time:** Cannot be determined without a live database. On a clean DB all constraints should validate; on DBs with legacy violations they remain `NOT VALID` until manual cleanup + re-run or `VALIDATE CONSTRAINT`.

### Foreign keys

- `import_records.match_evaluation_id → event_match_evaluations.id ON DELETE SET NULL`
- Added only when zero orphan references exist; re-validates on re-run if still `NOT VALID`.

### Matching uniqueness

- Unique index `event_merge_candidates_evaluation_canonical_unique_idx`
- Created only when no duplicate `(evaluation_id, canonical_event_id)` pairs exist.

### Triggers (`updated_at`)

- **Existing `public.set_updated_at()` in Sprint 13–26.6 migrations:** Not found.
- **Strategy:** Reuse existing parameterless suitable `public.set_updated_at()` (`p.pronargs = 0`) if present; never overwrite. Otherwise create `public.sprint267_set_updated_at()` only.
- Applied to Sprint 13–26.6 tables with `updated_at`:
  - `trust_quality_rules`, `import_review_queue`, `festivals`, `festival_editions`
  - `event_merge_candidates`, `event_series`, `platform_operations_state`, `operations_backfill_jobs`

### Indexes

- `import_job_queue_claim_ready_idx` — partial claim index
- `events_discovery_start_date_only_idx` — `(start_date) WHERE status = 'published'`
- `events_search_document_gin_idx` — verified/created if missing (Sprint 21 parity)

### Event search infrastructure (migration §12)

The migration **does not** backfill event rows. It only ensures (idempotently):

- `public.events.search_document` column exists
- `public.events_search_document_trigger()` exists (created only if missing)
- `events_search_document_update` trigger exists (created only if missing)
- `events_search_document_gin_idx` exists

### Search document backfill (manual ops — not in migration)

- **Removed from schema migration** for safety: bulk `UPDATE` on `public.events` can fire all general `UPDATE` triggers (`enforce_admin_event_status_rules`, audit hooks, etc.).
- **Moved to:** `docs/real-data/SPRINT26_7_EVENT_SEARCH_DOCUMENT_BACKFILL.sql`
- Script lists triggers, counts NULL/stale documents, supports batched NULL backfill, optional stale repair with explicit operator approval.
- **Non-null stale detection** requires mirroring the Sprint 21 trigger expression; documented honestly in the script.
- **No database backfill has been executed** as part of this sprint work.

---

## 3. Schema deviations

| Expected | Actual | Handling |
|----------|--------|----------|
| `import_job_queue.updated_at` | Column does not exist | Skipped on claim update |
| `response_time_ms` on queue/connector | Only `last_response_time_ms` on connector snapshots | Constraint on existing column only |
| `created_at` on queue | Uses `enqueued_at` as tie-breaker | Documented |
| Central `set_updated_at` before Sprint 26.7 | None in prior migrations | Creates `sprint267_set_updated_at()` |
| `last_successful_import_at` on sources | App maps to `last_successful_sync_at` | Not altered |
| `publish_mode` on real DB | Defined in Sprint 13 but missing on drifted DB | §2b drift repair in 26.7 |

### Sprint 26.7 column dependency audit

| § | Table | Column(s) | Definition migration | Existenz garantiert | Guard | Staging-Risiko |
|---|-------|-----------|---------------------|---------------------|-------|----------------|
| 1 | `import_job_queue` | `status`, `scheduled_for`, `next_retry_at`, `dead_lettered_at`, `attempt_count`, `max_attempts`, `priority`, `enqueued_at`, `id`, `processing_*`, `worker_id` | `20260746000000`, `20260750000000`, `20260751000000`, `20260754000000` | nein (Tabelle guarded) | Tabelle via Claim nur wenn Queue existiert | Mittel — fehlende Queue-Spalten → Claim-Fehler |
| 1 | `platform_operations_state` | `worker_paused`, `global_maintenance_mode` | `20260750000000` | nein | `to_regclass` + leere Zeile = false | Niedrig |
| 2b | `sources` | `publish_mode` | `20260744000000` (+ §2b repair) | **ja nach §2b** | `information_schema.columns` | **Behoben** |
| 3 | `sources` | `enabled`, `active`, `review_required`, `publish_mode`, `schedule_enabled`, `next_scheduled_at`, `updated_at` | diverse (er012, sprint13, sprint15, sprint42) | nein | §2b für `publish_mode` | Niedrig nach §2b |
| 4 | `sources` | `publish_mode`, `review_required`, `updated_at`, `archived`, `base_url`, `enabled` | sprint13, er012, sprint42 | nein | §2b für `publish_mode`; `coalesce(archived,false)` | Niedrig nach §2b |
| 5–7 | diverse | Constraint-Spalten | Sprint 15–20 | nein | `to_regclass` + teils `information_schema` | Mittel bei fehlenden Tabellen |
| 8 | diverse | Kommentar-Spalten | Sprint 13–21 | nein | Tabelle + Spalte geprüft | Niedrig |
| 9 | 8 Tabellen | `updated_at` | Sprint 13–19 | nein | Tabelle + Spalte + `pg_trigger` | Niedrig |
| 10 | `import_job_queue` | Index-Spalten | Sprint 15+ | nein | `IF NOT EXISTS` Index | Niedrig |
| 11–12 | `events` | `start_date`, `status`, `search_document`, `title`, `description`, `venue_name` | Sprint 21 | nein | `add column if not exists`; Trigger nur wenn fehlend | Niedrig |

---

## 4. Not implemented (with reason)

| Item | Reason |
|------|--------|
| Event search backfill in migration | Safety — avoids uncontrolled `UPDATE` side effects on all event rows |
| Remove Affenkäfig `reference.html` | Would delete embedded config; deactivation is safer |
| `scheduler_paused` blocks worker | Architecture separates scheduler/worker per spec |
| `attempt_count` increment on claim | Application increments on failure/requeue only |
| Force unique merge index when duplicates exist | Would fail migration; skipped if duplicates found |
| FK when orphan `match_evaluation_id` rows exist | Would fail migration; skipped if orphans found |
| Drop redundant discovery indexes | Risk without production query analysis |
| `completed_at >= started_at` on queue | `import_job_queue` has no `completed_at` column |

---

## 5. Tests executed

| Command | Result |
|---------|--------|
| `npm run typecheck` | ✅ Pass |
| `npm run lint` | ✅ Pass |
| `npm test` | ✅ **1071 tests passed** (208 files) |
| Staging migration apply | ❌ Not executed |
| Local `supabase db reset` | ❌ Not executed (no local Supabase confirmed) |
| Migration idempotency (2× apply) | ❌ Not executed |
| Live PostgreSQL queue-claim tests | ❌ Not executed — see `SPRINT26_7_QUEUE_CLAIM_SQL_TESTS.md` |
| Event search document backfill | ❌ Not executed — see `SPRINT26_7_EVENT_SEARCH_DOCUMENT_BACKFILL.sql` |

### New automated tests

- `src/data/__tests__/sprint26-7-production-hardening-migration.test.ts` — 6 structure tests

---

## 6. Risks

- Affenkäfig reference HTML remains in DB; source is disabled but config still contains fixture events.
- Bootshaus now requires review (`conditional_review`) — auto-publish from Sprint 13 seed is rolled back at DB level.
- Constraints left `NOT VALID` if legacy violations exist — require manual cleanup + `VALIDATE CONSTRAINT` or re-run migration after cleanup.
- Merge-candidate unique index skipped if duplicates already exist.
- `import_records` FK skipped if orphan `match_evaluation_id` values exist.
- Stale non-null `search_document` rows may remain until manual ops backfill on staging.
- No external alerting; ops still manual.

---

## 7. Go-live verdict

**CONDITIONAL GO**

Bootshaus can run as a controlled pilot with hardened queue claims and disabled Affenkäfig reference imports. Full unattended production requires: applying migration on **staging**, running manual queue-claim SQL tests, optional search backfill on staging, verifying Bootshaus review workflow accepts `conditional_review`, and confirming zero constraint violations before `VALIDATE`.

---

## 8. Next actions

1. On staging, run verification queries from §0 (migration history + `publish_mode` column).
2. Apply migration to **staging**: `supabase db push` or CI pipeline (26.7 includes §2b drift repair).
3. Confirm `publish_mode` exists and §3/§4 updated Bootshaus/Affenkaefig rows.
4. Run manual queue-claim tests from `docs/real-data/SPRINT26_7_QUEUE_CLAIM_SQL_TESTS.md`.
5. Query `pg_constraint` for any `NOT VALID` constraints and remediate.
6. Confirm Affenkäfig remains disabled in admin/source list.
7. Re-run migration idempotency test on staging after cleanup.
8. Monitor first scheduled Bootshaus run after production deployment.
