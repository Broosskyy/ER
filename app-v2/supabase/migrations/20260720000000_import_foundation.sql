-- Eternal Rave — Sprint 12A Import Foundation
-- Additive migration: import staging tables + admin-only RLS

-- Admin role helper (JWT app_metadata.role = 'admin')
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- Extend sources for import adapter routing
alter table public.sources
  add column if not exists adapter_key text;

-- Import jobs
create table if not exists public.import_jobs (
  id text primary key default gen_random_uuid()::text,
  source_id text not null references public.sources(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  trigger_type text not null
    check (trigger_type in ('manual', 'scheduled', 'webhook')),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists import_jobs_source_id_idx on public.import_jobs(source_id);
create index if not exists import_jobs_status_idx on public.import_jobs(status);
create index if not exists import_jobs_created_at_idx on public.import_jobs(created_at desc);

-- Import records
create table if not exists public.import_records (
  id text primary key default gen_random_uuid()::text,
  import_job_id text not null references public.import_jobs(id) on delete cascade,
  source_id text not null references public.sources(id) on delete cascade,
  external_id text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb,
  status text not null default 'fetched'
    check (status in ('fetched', 'parsed', 'needs_review', 'invalid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_job_id, external_id)
);

create index if not exists import_records_job_id_idx on public.import_records(import_job_id);
create index if not exists import_records_source_id_idx on public.import_records(source_id);
create index if not exists import_records_status_idx on public.import_records(status);

-- Import logs
create table if not exists public.import_logs (
  id text primary key default gen_random_uuid()::text,
  import_job_id text not null references public.import_jobs(id) on delete cascade,
  import_record_id text references public.import_records(id) on delete set null,
  level text not null check (level in ('debug', 'info', 'warning', 'error')),
  code text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists import_logs_job_id_idx on public.import_logs(import_job_id);
create index if not exists import_logs_record_id_idx on public.import_logs(import_record_id);
create index if not exists import_logs_created_at_idx on public.import_logs(created_at desc);

-- RLS
alter table public.import_jobs enable row level security;
alter table public.import_records enable row level security;
alter table public.import_logs enable row level security;

-- Sources: restrict to admin only (replaces Sprint 11 open policies)
drop policy if exists "anon_read_active_sources" on public.sources;
drop policy if exists "auth_manage_sources" on public.sources;

create policy "admin_read_sources" on public.sources
  for select using (public.is_admin());

create policy "admin_manage_sources" on public.sources
  for all using (public.is_admin());

-- Import tables: admin only
create policy "admin_manage_import_jobs" on public.import_jobs
  for all using (public.is_admin());

create policy "admin_manage_import_records" on public.import_records
  for all using (public.is_admin());

create policy "admin_manage_import_logs" on public.import_logs
  for all using (public.is_admin());
