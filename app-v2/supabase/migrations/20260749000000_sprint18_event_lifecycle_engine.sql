-- Eternal Rave — Sprint 18: Event Lifecycle Engine foundation.
-- Additive only. Versioned lifecycle history without replacing import/publish/matching.

create table if not exists public.event_series (
  id text primary key,
  slug text not null unique,
  display_name text not null,
  series_type text not null default 'recurring'
    check (series_type in ('recurring', 'annual_festival', 'club_night', 'special_edition')),
  timezone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_lifecycle_history (
  id text primary key,
  canonical_event_id text not null references public.events(id) on delete cascade,
  lifecycle_event_type text not null
    check (lifecycle_event_type in (
      'event_created',
      'event_updated',
      'event_moved',
      'time_changed',
      'venue_changed',
      'organizer_changed',
      'festival_edition_changed',
      'ticket_link_changed',
      'lineup_changed',
      'description_changed',
      'image_changed',
      'event_cancelled',
      'event_reactivated',
      'event_archived',
      'event_postponed'
    )),
  decision text not null
    check (decision in ('apply_immediately', 'review_required', 'create_conflict', 'ignore')),
  source_id text references public.sources(id) on delete set null,
  import_job_id text references public.import_jobs(id) on delete set null,
  import_record_id text references public.import_records(id) on delete set null,
  confidence_score numeric,
  lifecycle_status_before text,
  lifecycle_status_after text,
  change_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists event_lifecycle_history_event_idx
  on public.event_lifecycle_history(canonical_event_id, created_at desc);

create index if not exists event_lifecycle_history_source_idx
  on public.event_lifecycle_history(source_id, created_at desc);

create table if not exists public.event_lifecycle_changes (
  id text primary key,
  history_id text not null references public.event_lifecycle_history(id) on delete cascade,
  canonical_event_id text not null references public.events(id) on delete cascade,
  field_path text not null,
  old_value jsonb,
  new_value jsonb,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  provenance_source_id text references public.sources(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists event_lifecycle_changes_history_idx
  on public.event_lifecycle_changes(history_id);

create index if not exists event_lifecycle_changes_event_idx
  on public.event_lifecycle_changes(canonical_event_id, field_path);

alter table public.events
  add column if not exists event_series_id text references public.event_series(id) on delete set null;

create index if not exists events_event_series_id_idx
  on public.events(event_series_id);

alter table public.event_series enable row level security;
alter table public.event_lifecycle_history enable row level security;
alter table public.event_lifecycle_changes enable row level security;

drop policy if exists admin_read_event_series on public.event_series;
drop policy if exists admin_write_event_series on public.event_series;
drop policy if exists admin_read_event_lifecycle_history on public.event_lifecycle_history;
drop policy if exists admin_write_event_lifecycle_history on public.event_lifecycle_history;
drop policy if exists admin_read_event_lifecycle_changes on public.event_lifecycle_changes;
drop policy if exists admin_write_event_lifecycle_changes on public.event_lifecycle_changes;

create policy admin_read_event_series on public.event_series
  for select using (public.is_admin());

create policy admin_write_event_series on public.event_series
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_event_lifecycle_history on public.event_lifecycle_history
  for select using (public.is_admin());

create policy admin_write_event_lifecycle_history on public.event_lifecycle_history
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_event_lifecycle_changes on public.event_lifecycle_changes
  for select using (public.is_admin());

create policy admin_write_event_lifecycle_changes on public.event_lifecycle_changes
  for all using (public.is_admin()) with check (public.is_admin());
