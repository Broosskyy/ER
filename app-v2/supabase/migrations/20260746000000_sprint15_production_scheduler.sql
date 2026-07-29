-- Eternal Rave — Sprint 15: Production scheduler & automation engine.
-- Additive only. Extends existing schedule contract; does not replace import pipeline.

-- Interval presets configurable per source (maps to schedule_policy + polling_interval_minutes).
alter table public.sources
  add column if not exists schedule_interval_preset text not null default 'manual',
  add column if not exists scheduler_maintenance_mode boolean not null default false;

alter table public.sources
  drop constraint if exists sources_schedule_interval_preset_check;

alter table public.sources
  add constraint sources_schedule_interval_preset_check
    check (schedule_interval_preset in (
      'disabled',
      'manual',
      'every_15_minutes',
      'every_30_minutes',
      'hourly',
      'every_6_hours',
      'daily',
      'custom'
    ));

create index if not exists sources_schedule_interval_preset_idx
  on public.sources(schedule_interval_preset);

create index if not exists sources_schedule_due_idx
  on public.sources(schedule_enabled, next_scheduled_at)
  where schedule_enabled = true
    and schedule_policy = 'interval'
    and archived = false;

-- Scheduler run audit log (global tick history).
create table if not exists public.scheduler_runs (
  id text primary key,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'completed', 'completed_with_errors', 'failed')),
  sources_scanned integer not null default 0,
  sources_due integer not null default 0,
  jobs_enqueued integer not null default 0,
  jobs_processed integer not null default 0,
  jobs_succeeded integer not null default 0,
  jobs_failed integer not null default 0,
  duration_ms integer,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists scheduler_runs_started_at_idx
  on public.scheduler_runs(started_at desc);

-- Import job queue — scheduler enqueues; processor executes via existing pipeline.
create table if not exists public.import_job_queue (
  id text primary key,
  source_id text not null references public.sources(id) on delete cascade,
  import_job_id text not null references public.import_jobs(id) on delete cascade,
  priority integer not null default 50,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  scheduled_for timestamptz not null,
  enqueued_at timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  scheduler_run_id text references public.scheduler_runs(id) on delete set null,
  trigger_type text not null default 'scheduled',
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  unique (import_job_id)
);

create index if not exists import_job_queue_status_scheduled_idx
  on public.import_job_queue(status, scheduled_for, priority desc);

create index if not exists import_job_queue_source_id_idx
  on public.import_job_queue(source_id, status);

-- RLS: admin-only for scheduler tables.
alter table public.scheduler_runs enable row level security;
alter table public.import_job_queue enable row level security;
alter table public.import_schedule_locks enable row level security;

drop policy if exists admin_read_scheduler_runs on public.scheduler_runs;
drop policy if exists admin_write_scheduler_runs on public.scheduler_runs;
drop policy if exists admin_read_import_job_queue on public.import_job_queue;
drop policy if exists admin_write_import_job_queue on public.import_job_queue;
drop policy if exists admin_read_import_schedule_locks on public.import_schedule_locks;
drop policy if exists admin_write_import_schedule_locks on public.import_schedule_locks;

create policy admin_read_scheduler_runs on public.scheduler_runs
  for select using (public.is_admin());

create policy admin_write_scheduler_runs on public.scheduler_runs
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_import_job_queue on public.import_job_queue
  for select using (public.is_admin());

create policy admin_write_import_job_queue on public.import_job_queue
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_import_schedule_locks on public.import_schedule_locks
  for select using (public.is_admin());

create policy admin_write_import_schedule_locks on public.import_schedule_locks
  for all using (public.is_admin()) with check (public.is_admin());
