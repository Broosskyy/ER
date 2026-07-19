-- Eternal Rave — Sprint 12B Import Adapters & Normalization
-- Additive migration: job metrics, record validation fields, source config

-- Extend sources for adapter configuration
alter table public.sources
  add column if not exists source_url text,
  add column if not exists source_config jsonb not null default '{}'::jsonb,
  add column if not exists default_timezone text;

-- Extend import_jobs with metrics and completed_with_warnings status
alter table public.import_jobs
  drop constraint if exists import_jobs_status_check;

alter table public.import_jobs
  add constraint import_jobs_status_check
    check (status in ('pending', 'running', 'completed', 'completed_with_warnings', 'failed', 'cancelled'));

alter table public.import_jobs
  add column if not exists fetched_count integer not null default 0,
  add column if not exists parsed_count integer not null default 0,
  add column if not exists invalid_count integer not null default 0,
  add column if not exists warning_count integer not null default 0,
  add column if not exists error_count integer not null default 0,
  add column if not exists created_count integer not null default 0,
  add column if not exists updated_count integer not null default 0,
  add column if not exists duplicate_count integer not null default 0,
  add column if not exists error_summary text;

-- Extend import_records with validation metadata
alter table public.import_records
  add column if not exists source_url text,
  add column if not exists validation_errors jsonb,
  add column if not exists validation_warnings jsonb;
