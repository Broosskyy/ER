# Bootshaus Production Runbook

Operational guide for running **Bootshaus Köln** (`source-bootshaus-koeln`) as the first live production source on Eternal Rave.

---

## Overview

| Item | Value |
|------|-------|
| Source ID | `source-bootshaus-koeln` |
| URL | `https://bootshaus.tv/events/` |
| Connector | `club_website` |
| Strategy | `html_selector` |
| Schedule | `every_6_hours` (360 min) |
| Publish | `auto_publish` |

Pipeline:

```
Scheduler → Queue → Worker → club_website → Aggregation → Publish → Discovery
```

---

## Deployment

1. Apply all Supabase migrations including `20260754000000_sprint26_6_go_live_readiness.sql`.
2. Verify Bootshaus row:

```sql
select id, schedule_policy, schedule_enabled, schedule_interval_preset,
       next_scheduled_at, polling_interval_minutes
from public.sources
where id = 'source-bootshaus-koeln';
```

Expected: `schedule_policy = interval`, `schedule_enabled = true`, `every_6_hours`.

3. Deploy application with ops scripts available.

---

## Scheduler

**Script:** `npx tsx scripts/operations/run-scheduler-tick.ts`

- Enqueues due sources only (`processQueue: false`).
- Recommended cron: every 5–15 minutes.
- Respects `schedulerPaused` and `globalMaintenanceMode`.

Check latest runs:

```sql
select id, status, jobs_enqueued, started_at, finished_at
from public.scheduler_runs
order by started_at desc
limit 10;
```

---

## Worker

**Script:** `npx tsx scripts/operations/run-queue-worker.ts`

- Claims jobs atomically via `claim_import_job_queue_entries` (multi-worker safe).
- Recommended cron: every 1–5 minutes.
- **Single worker is still recommended** until distributed rate limiting is in place.

Worker ID is set per batch (`worker_runs.id`).

---

## Recovery

**Script:** `npx tsx scripts/operations/run-worker-recovery.ts`

- Requeues stuck `processing` entries after lease expiry.
- Dead-letters entries exceeding `max_attempts`.
- Releases expired schedule locks.
- Reconciles stale `worker_runs`.

Recommended cron: every 15–30 minutes.

---

## Queue

| Status | Meaning |
|--------|---------|
| `queued` | Waiting for worker claim |
| `processing` | Claimed with `worker_id` + lease |
| `completed` | Successfully processed |
| `failed` | Terminal failure or dead letter |

Atomic claim requirements (Sprint 26.6):

- `UPDATE ... WHERE status = 'queued' FOR UPDATE SKIP LOCKED`
- Sets `worker_id`, `processing_started_at`, `processing_lease_expires_at`

Inspect queue:

```sql
select id, source_id, status, worker_id, attempt_count,
       scheduled_for, processing_lease_expires_at, dead_lettered_at
from public.import_job_queue
where source_id = 'source-bootshaus-koeln'
order by enqueued_at desc
limit 20;
```

---

## Monitoring

Backend snapshot via `ProductionOperationsMonitoringService.getSnapshot()`:

| Field | Description |
|-------|-------------|
| `scheduler.*` | Latest runs, due sources, backoff count |
| `queue.*` | Queued, processing, retry, dead letter, stuck |
| `worker.*` | Latest worker runs, pause state |
| `imports.*` | Last successful/failed import timestamps |
| `bootshaus.*` | Bootshaus-specific schedule and error state |

**Alert on:**

- `queue.deadLetterCount > 0`
- `queue.stuckProcessingCount > 0`
- `bootshaus.consecutiveFailures >= 3`
- `bootshaus.lastSchedulerError` present
- Scheduler run `status = failed`

---

## Live Smoke Test

**Manual / CI (skips if offline):**

```bash
npx vitest run src/features/sources/production/__tests__/bootshaus-live-smoke.test.ts
```

Validates live fetch from `bootshaus.tv` without fixture HTML.

---

## Fehlerbehebung

### Bootshaus importiert nicht automatisch

1. Check `schedule_policy`, `next_scheduled_at`, `schedule_enabled`.
2. Check `platform_operations_state.scheduler_paused`.
3. Check for active `pending`/`running` import job blocking enqueue.
4. Review `scheduler_runs` for errors.

### Queue hängt in `processing`

1. Run recovery script.
2. Check `processing_lease_expires_at` and `worker_id`.
3. If worker crashed, recovery requeues after lease expiry.

### Dead Letter

1. Inspect `error_summary` on queue entry.
2. Fix root cause (HTML change, network, config).
3. Admin retry via `OperationsControlService.retryQueueEntry()`.

### HTML-Selektor bricht

1. Run live smoke test.
2. Update `source_config.website.htmlSelector` via migration or admin.
3. Re-run manual import before re-enabling schedule.

### Orphan `pending` import job

```sql
select id, status, source_id, created_at
from public.import_jobs
where source_id = 'source-bootshaus-koeln'
  and status in ('pending', 'running')
order by created_at desc;
```

Resolve stuck jobs manually if recovery does not clear them.

---

## Rollback

1. Pause scheduler: `OperationsControlService.pauseScheduler()`.
2. Pause worker: `OperationsControlService.pauseWorker()`.
3. Optionally set Bootshaus to `schedule_policy = 'paused'`.
4. Do **not** delete published events unless data quality requires it.

---

## Neustart

1. Resume worker, then scheduler.
2. Trigger manual recovery.
3. Verify next `scheduler_runs` and `worker_runs` complete successfully.
4. Check `bootshaus.lastSuccessfulImportAt` in monitoring snapshot.

---

## Wartung

- Review DLQ weekly.
- Monitor `bootshaus.tv` DOM changes after site updates.
- Keep `reference.html` **out** of production `source_config` (fixture is test-only).
- Run full test suite before deployments.

---

## Go-Live-Checkliste

- [ ] Migration `20260754000000` applied
- [ ] Bootshaus `schedule_policy = interval`, `next_scheduled_at` set
- [ ] Scheduler cron active
- [ ] Worker cron active
- [ ] Recovery cron active
- [ ] Live smoke test passes (or site confirmed reachable)
- [ ] Monitoring snapshot reviewed
- [ ] DLQ empty
- [ ] No stuck `processing` entries
- [ ] First scheduled import completes with `completed` status
- [ ] Published events visible in Discovery/Home

---

*Sprint 26.6 — Go-Live Readiness*
