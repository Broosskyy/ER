-- Phase 4.7.3 — Canonical event attributes (additive, requires explicit production approval).
-- Extensible jsonb store + filterable scalar columns for discovery/search.

alter table public.events
  add column if not exists event_attributes jsonb,
  add column if not exists floor_count integer,
  add column if not exists stage_count integer,
  add column if not exists venue_environment text,
  add column if not exists last_entry_at timestamptz,
  add column if not exists dress_code text,
  add column if not exists accessibility_notes text;

alter table public.events
  drop constraint if exists events_venue_environment_check;

alter table public.events
  add constraint events_venue_environment_check
  check (venue_environment is null or venue_environment in ('indoor', 'outdoor', 'hybrid'));

comment on column public.events.event_attributes is
  'Canonical event attribute records (type, label, provenance). Excludes ticket-state and editorial badges.';
comment on column public.events.floor_count is
  'Filterable floor count derived from canonical attribute merge.';
comment on column public.events.stage_count is
  'Filterable stage count derived from canonical attribute merge.';
comment on column public.events.venue_environment is
  'Filterable venue environment: indoor | outdoor | hybrid.';
comment on column public.events.last_entry_at is
  'Last admission entry time when explicitly evidenced.';
comment on column public.events.dress_code is
  'Dress code when explicitly evidenced in source text.';
comment on column public.events.accessibility_notes is
  'Accessibility statements when explicitly evidenced.';

create index if not exists events_event_attributes_gin_idx
  on public.events using gin (event_attributes jsonb_path_ops);

create index if not exists events_floor_count_idx
  on public.events (floor_count)
  where floor_count is not null;

create index if not exists events_venue_environment_idx
  on public.events (venue_environment)
  where venue_environment is not null;
