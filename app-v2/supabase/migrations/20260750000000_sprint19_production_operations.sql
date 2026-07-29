-- Eternal Rave — Sprint 19: Production Operations & Source Intelligence.
-- Additive only. Extends scheduler/queue with worker separation, ops controls, and metrics.

-- Platform-wide operations state (singleton row).
create table if not exists public.platform_operations_state (
  id text primary key default 'default',
  worker_paused boolean not null default false,
  scheduler_paused boolean not null default false,
  global_maintenance_mode boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.platform_operations_state (id)
values ('default')
on conflict (id) do nothing;

-- Idempotent backfill job tracking.
create table if not exists public.operations_backfill_jobs (
  id text primary key,
  backfill_type text not null
    check (backfill_type in ('blocking_keys', 'lifecycle_history', 'provenance', 'source_intelligence')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  cursor_value text,
  processed_count integer not null default 0,
  error_count integer not null default 0,
  batch_size integer not null default 500,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operations_backfill_jobs_type_status_idx
  on public.operations_backfill_jobs(backfill_type, status, created_at desc);

-- Source intelligence snapshots (objective metrics, no AI).
create table if not exists public.source_intelligence_snapshots (
  id text primary key,
  source_id text not null references public.sources(id) on delete cascade,
  availability_score numeric not null default 0 check (availability_score >= 0 and availability_score <= 100),
  success_rate numeric not null default 0 check (success_rate >= 0 and success_rate <= 100),
  avg_import_duration_ms numeric,
  error_rate numeric not null default 0 check (error_rate >= 0 and error_rate <= 100),
  last_successful_sync_at timestamptz,
  last_error_at timestamptz,
  last_error_summary text,
  queue_depth integer not null default 0,
  scheduler_load_score numeric not null default 0,
  pending_review_count integer not null default 0,
  match_evaluation_count integer not null default 0,
  lifecycle_change_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);

create index if not exists source_intelligence_snapshots_source_idx
  on public.source_intelligence_snapshots(source_id, computed_at desc);

create index if not exists source_intelligence_snapshots_computed_idx
  on public.source_intelligence_snapshots(computed_at desc);

-- Queue retry and dead-letter preparation.
alter table public.import_job_queue
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists next_retry_at timestamptz,
  add column if not exists dead_lettered_at timestamptz;

create index if not exists import_job_queue_retry_idx
  on public.import_job_queue(status, next_retry_at)
  where status = 'queued' and next_retry_at is not null;

create index if not exists import_job_queue_dead_letter_idx
  on public.import_job_queue(dead_lettered_at)
  where dead_lettered_at is not null;

-- Worker run audit log.
create table if not exists public.worker_runs (
  id text primary key,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'completed', 'completed_with_errors', 'failed', 'skipped')),
  jobs_processed integer not null default 0,
  jobs_succeeded integer not null default 0,
  jobs_failed integer not null default 0,
  jobs_requeued integer not null default 0,
  jobs_dead_lettered integer not null default 0,
  duration_ms integer,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists worker_runs_started_idx
  on public.worker_runs(started_at desc);

alter table public.platform_operations_state enable row level security;
alter table public.operations_backfill_jobs enable row level security;
alter table public.source_intelligence_snapshots enable row level security;
alter table public.worker_runs enable row level security;

drop policy if exists admin_read_platform_operations_state on public.platform_operations_state;
drop policy if exists admin_write_platform_operations_state on public.platform_operations_state;
drop policy if exists admin_read_operations_backfill_jobs on public.operations_backfill_jobs;
drop policy if exists admin_write_operations_backfill_jobs on public.operations_backfill_jobs;
drop policy if exists admin_read_source_intelligence_snapshots on public.source_intelligence_snapshots;
drop policy if exists admin_write_source_intelligence_snapshots on public.source_intelligence_snapshots;
drop policy if exists admin_read_worker_runs on public.worker_runs;
drop policy if exists admin_write_worker_runs on public.worker_runs;

create policy admin_read_platform_operations_state on public.platform_operations_state
  for select using (public.is_admin());

create policy admin_write_platform_operations_state on public.platform_operations_state
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_operations_backfill_jobs on public.operations_backfill_jobs
  for select using (public.is_admin());

create policy admin_write_operations_backfill_jobs on public.operations_backfill_jobs
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_source_intelligence_snapshots on public.source_intelligence_snapshots
  for select using (public.is_admin());

create policy admin_write_source_intelligence_snapshots on public.source_intelligence_snapshots
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_worker_runs on public.worker_runs
  for select using (public.is_admin());

create policy admin_write_worker_runs on public.worker_runs
  for all using (public.is_admin()) with check (public.is_admin());
