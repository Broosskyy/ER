-- Eternal Rave — Sprint 12D Admin Review & Import Operations

-- Role helper: any admin panel role grants access
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') in (
      'viewer', 'editor', 'reviewer', 'source_manager', 'admin', 'owner'
    ),
    false
  );
$$;

create or replace function public.admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    'viewer'
  );
$$;

create or replace function public.has_admin_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() and public.admin_role() = any(allowed_roles);
$$;

-- Extend sources
alter table public.sources
  add column if not exists review_required boolean not null default true,
  add column if not exists last_import_at timestamptz,
  add column if not exists last_job_status text,
  add column if not exists next_scheduled_at timestamptz;

-- Extend import_jobs
alter table public.import_jobs
  add column if not exists triggered_by text;

-- Extend import_records for review workflow
alter table public.import_records
  drop constraint if exists import_records_status_check;

alter table public.import_records
  add constraint import_records_status_check
    check (status in (
      'fetched', 'parsed', 'needs_review', 'invalid',
      'duplicate', 'approved', 'rejected', 'imported'
    ));

alter table public.import_records
  add column if not exists resulting_event_id text references public.events(id) on delete set null,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reject_reason text,
  add column if not exists reject_note text,
  add column if not exists reviewer_edits jsonb,
  add column if not exists duplicate_decision text
    check (duplicate_decision is null or duplicate_decision in ('confirmed', 'dismissed', 'override'));

create index if not exists import_records_status_review_idx on public.import_records(status)
  where status in ('needs_review', 'duplicate');
create index if not exists import_records_resulting_event_id_idx on public.import_records(resulting_event_id);

-- Audit log
create table if not exists public.import_audit_logs (
  id text primary key default gen_random_uuid()::text,
  actor_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists import_audit_logs_entity_idx on public.import_audit_logs(entity_type, entity_id);
create index if not exists import_audit_logs_created_at_idx on public.import_audit_logs(created_at desc);

alter table public.import_audit_logs enable row level security;

create policy "admin_read_import_audit_logs" on public.import_audit_logs
  for select using (public.is_admin());

create policy "admin_write_import_audit_logs" on public.import_audit_logs
  for insert with check (public.is_admin());

-- Active job guard: only one pending/running job per source
create unique index if not exists import_jobs_one_active_per_source_idx
  on public.import_jobs(source_id)
  where status in ('pending', 'running');
