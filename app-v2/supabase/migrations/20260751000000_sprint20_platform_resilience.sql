-- Eternal Rave — Sprint 20: Platform Resilience & Production Hardening.
-- Additive only. Worker recovery, connector health persistence, service role support.

-- Connector health snapshots (persistent runtime metrics).
create table if not exists public.connector_health_snapshots (
  id text primary key,
  connector_key text not null,
  source_id text references public.sources(id) on delete set null,
  status text not null
    check (status in ('healthy', 'degraded', 'offline', 'unauthorized', 'rate_limited', 'maintenance')),
  success_rate numeric not null default 0 check (success_rate >= 0 and success_rate <= 1),
  error_count integer not null default 0,
  total_run_count integer not null default 0,
  average_duration_ms numeric not null default 0,
  last_response_time_ms numeric,
  last_successful_run_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  last_error_message text,
  metadata jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);

create index if not exists connector_health_snapshots_key_idx
  on public.connector_health_snapshots(connector_key, computed_at desc);

create index if not exists connector_health_snapshots_source_idx
  on public.connector_health_snapshots(source_id, computed_at desc);

-- Worker recovery audit log.
create table if not exists public.worker_recovery_runs (
  id text primary key,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'completed', 'completed_with_errors', 'failed')),
  stuck_queue_entries integer not null default 0,
  recovered_queue_entries integer not null default 0,
  dead_lettered_queue_entries integer not null default 0,
  expired_locks_released integer not null default 0,
  stale_worker_runs_reconciled integer not null default 0,
  duration_ms integer,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists worker_recovery_runs_started_idx
  on public.worker_recovery_runs(started_at desc);

-- Queue processing lease for stuck-job detection.
alter table public.import_job_queue
  add column if not exists processing_lease_expires_at timestamptz;

create index if not exists import_job_queue_stuck_processing_idx
  on public.import_job_queue(status, processing_lease_expires_at)
  where status = 'processing';

-- Service role policies for worker/cron operations (no admin session required).
drop policy if exists service_role_scheduler_runs on public.scheduler_runs;
drop policy if exists service_role_import_job_queue on public.import_job_queue;
drop policy if exists service_role_worker_runs on public.worker_runs;
drop policy if exists service_role_worker_recovery_runs on public.worker_recovery_runs;
drop policy if exists service_role_platform_operations_state on public.platform_operations_state;
drop policy if exists service_role_operations_backfill_jobs on public.operations_backfill_jobs;
drop policy if exists service_role_import_schedule_locks on public.import_schedule_locks;
drop policy if exists service_role_connector_health_snapshots on public.connector_health_snapshots;

create policy service_role_scheduler_runs on public.scheduler_runs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy service_role_import_job_queue on public.import_job_queue
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy service_role_worker_runs on public.worker_runs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy service_role_worker_recovery_runs on public.worker_recovery_runs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy service_role_platform_operations_state on public.platform_operations_state
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy service_role_operations_backfill_jobs on public.operations_backfill_jobs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy service_role_import_schedule_locks on public.import_schedule_locks
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy service_role_connector_health_snapshots on public.connector_health_snapshots
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

alter table public.connector_health_snapshots enable row level security;
alter table public.worker_recovery_runs enable row level security;

drop policy if exists admin_read_connector_health_snapshots on public.connector_health_snapshots;
drop policy if exists admin_write_connector_health_snapshots on public.connector_health_snapshots;
drop policy if exists admin_read_worker_recovery_runs on public.worker_recovery_runs;
drop policy if exists admin_write_worker_recovery_runs on public.worker_recovery_runs;

create policy admin_read_connector_health_snapshots on public.connector_health_snapshots
  for select using (public.is_admin());

create policy admin_write_connector_health_snapshots on public.connector_health_snapshots
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_worker_recovery_runs on public.worker_recovery_runs
  for select using (public.is_admin());

create policy admin_write_worker_recovery_runs on public.worker_recovery_runs
  for all using (public.is_admin()) with check (public.is_admin());
