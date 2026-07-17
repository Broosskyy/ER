-- Sprint 3 — Event Foundation (non-destructive)
-- Extends events table + audit/history prep for moderation

-- Lifecycle: archived + deleted (Band 4.5 compatible — existing values preserved)
do $$ begin
  alter type lifecycle_status add value if not exists 'archived';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type lifecycle_status add value if not exists 'deleted';
exception when duplicate_object then null; end $$;

-- Extended event fields
alter table public.events add column if not exists short_description text;
alter table public.events add column if not exists timezone text default 'Europe/Berlin';
alter table public.events add column if not exists street text;
alter table public.events add column if not exists house_number text;
alter table public.events add column if not exists postal_code text;
alter table public.events add column if not exists state text;
alter table public.events add column if not exists gallery_urls jsonb default '[]'::jsonb;
alter table public.events add column if not exists tags text[] default '{}';
alter table public.events add column if not exists published_at timestamptz;
alter table public.events add column if not exists archived_at timestamptz;
alter table public.events add column if not exists deleted_at timestamptz;

-- Automation prep (Sprint 3 — not active)
alter table public.events add column if not exists automation_status text;
alter table public.events add column if not exists duplicate_group text;
alter table public.events add column if not exists import_source text;
alter table public.events add column if not exists external_id text;
alter table public.events add column if not exists automation_notes text;

-- Review audit log (admin/moderator actions)
create table if not exists public.event_review_audit (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  from_status lifecycle_status,
  to_status lifecycle_status,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_review_audit_event on public.event_review_audit(event_id);

alter table public.event_review_audit enable row level security;

drop policy if exists "Admins read review audit" on public.event_review_audit;
create policy "Admins read review audit"
  on public.event_review_audit for select to authenticated
  using (public.is_admin() or public.is_moderator());

drop policy if exists "Admins insert review audit" on public.event_review_audit;
create policy "Admins insert review audit"
  on public.event_review_audit for insert to authenticated
  with check (public.is_admin() or public.is_moderator());

-- Submission revision history (prep)
create table if not exists public.event_submission_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  snapshot jsonb not null default '{}'::jsonb,
  status lifecycle_status not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_submission_history_event on public.event_submission_history(event_id);

alter table public.event_submission_history enable row level security;

drop policy if exists "Owner read submission history" on public.event_submission_history;
create policy "Owner read submission history"
  on public.event_submission_history for select to authenticated
  using (
    submitted_by = auth.uid()
    or public.is_admin()
    or public.is_moderator()
  );

drop policy if exists "Owner insert submission history" on public.event_submission_history;
create policy "Owner insert submission history"
  on public.event_submission_history for insert to authenticated
  with check (submitted_by = auth.uid() or public.is_admin());

comment on table public.event_review_audit is 'Sprint 3 — moderation audit trail';
comment on table public.event_submission_history is 'Sprint 3 — submission revision snapshots';
