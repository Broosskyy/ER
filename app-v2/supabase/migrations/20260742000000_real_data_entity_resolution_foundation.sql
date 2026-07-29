-- Eternal Rave — Sprint 8 Phase 2: Real Data entity resolution + lifecycle foundation.
-- Additive only. No canonical consumer rewrites; saved references remain stable via alias resolution.

-- Entity identity aliases for organizer, venue, and artist resolution.
create table if not exists public.entity_identity_aliases (
  id text primary key,
  entity_type text not null,
  canonical_id text not null,
  alias_type text not null,
  alias_value text not null,
  source_id text references public.sources(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by text,
  check (entity_type in ('organizer', 'venue', 'artist')),
  check (alias_type in ('external_id', 'normalized_name', 'url', 'domain', 'social_handle', 'manual'))
);

create unique index if not exists entity_identity_aliases_unique_idx
  on public.entity_identity_aliases(entity_type, alias_type, alias_value, coalesce(source_id, ''));
create index if not exists entity_identity_aliases_canonical_idx
  on public.entity_identity_aliases(entity_type, canonical_id);

-- Manual keep-separate / override decisions (audit trail).
create table if not exists public.entity_resolution_decisions (
  id text primary key,
  entity_type text not null,
  candidate_key text not null,
  decision text not null,
  canonical_id text,
  decided_by text not null,
  decided_at timestamptz not null default now(),
  reason text not null,
  check (entity_type in ('organizer', 'venue', 'artist')),
  check (decision in ('keep_separate', 'manual_override')),
  unique (entity_type, candidate_key)
);

-- Event lifecycle timestamps (computed status stays in application layer).
alter table public.events
  add column if not exists timezone text,
  add column if not exists doors_open_at timestamptz,
  add column if not exists sales_start_at timestamptz,
  add column if not exists sales_end_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists postponed_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists first_published_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_imported_at timestamptz,
  add column if not exists canonical_event_id text references public.events(id) on delete set null,
  add column if not exists duplicate_group_id text;

create index if not exists events_canonical_event_id_idx on public.events(canonical_event_id);
create index if not exists events_duplicate_group_id_idx on public.events(duplicate_group_id);
create index if not exists events_lifecycle_timestamps_idx
  on public.events(published_at, first_published_at, last_seen_at);

-- Source presence tracking for missing-event detection (no immediate delete).
alter table public.event_source_references
  add column if not exists consecutive_missing_count integer not null default 0,
  add column if not exists missing_since timestamptz;

-- Import scheduling contract fields (runner not deployed in this phase).
alter table public.sources
  add column if not exists schedule_enabled boolean not null default true,
  add column if not exists schedule_policy text not null default 'manual_only',
  add column if not exists schedule_timezone text not null default 'UTC',
  add column if not exists last_scheduled_at timestamptz,
  add column if not exists last_failed_import_at timestamptz,
  add column if not exists backoff_until timestamptz;

alter table public.sources
  drop constraint if exists sources_schedule_policy_check;

alter table public.sources
  add constraint sources_schedule_policy_check
    check (schedule_policy in ('interval', 'cron', 'manual_only', 'paused'));

create table if not exists public.import_schedule_locks (
  source_id text primary key references public.sources(id) on delete cascade,
  lease_id text not null,
  acquired_at timestamptz not null,
  expires_at timestamptz not null
);

create index if not exists import_schedule_locks_expires_idx
  on public.import_schedule_locks(expires_at);
