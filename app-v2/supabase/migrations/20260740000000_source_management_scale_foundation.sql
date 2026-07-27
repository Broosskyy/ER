-- Eternal Rave — Source Management Scale Foundation
-- Additive migration. Existing source, import, event, and saved records remain unchanged.

alter table public.sources
  add column if not exists stable_key text,
  add column if not exists region text,
  add column if not exists city text,
  add column if not exists language_codes text[] not null default '{}',
  add column if not exists source_lifecycle_status text not null default 'active',
  add column if not exists connector_type text,
  add column if not exists last_successful_sync_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists consecutive_failure_count integer not null default 0,
  add column if not exists total_import_count integer not null default 0,
  add column if not exists total_valid_event_count integer not null default 0,
  add column if not exists total_rejected_event_count integer not null default 0,
  add column if not exists duplicate_rate numeric not null default 0,
  add column if not exists update_rate numeric not null default 0,
  add column if not exists error_rate numeric not null default 0,
  add column if not exists average_duration_ms integer,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.sources
set stable_key = coalesce(stable_key, slug)
where stable_key is null;

alter table public.sources
  alter column stable_key set not null;

create unique index if not exists sources_stable_key_idx on public.sources(stable_key);
create index if not exists sources_lifecycle_enabled_idx
  on public.sources(source_lifecycle_status, enabled)
  where archived = false;
create index if not exists sources_country_city_idx on public.sources(country_code, city);
create index if not exists sources_last_successful_sync_idx on public.sources(last_successful_sync_at);

create table if not exists public.source_groups (
  id text primary key,
  name text not null,
  type text not null,
  parent_group_id text references public.source_groups(id) on delete set null,
  priority_policy text,
  merge_policy text,
  region_scope text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.source_group_memberships (
  group_id text not null references public.source_groups(id) on delete cascade,
  source_id text not null references public.sources(id) on delete cascade,
  primary key (group_id, source_id)
);

create table if not exists public.source_relations (
  id text primary key,
  source_id text not null references public.sources(id) on delete cascade,
  related_source_id text not null references public.sources(id) on delete cascade,
  relation_type text not null,
  confidence numeric not null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  check (source_id <> related_source_id),
  check (confidence >= 0 and confidence <= 1)
);
create index if not exists source_relations_source_idx on public.source_relations(source_id);

create table if not exists public.source_status_history (
  id text primary key,
  source_id text not null references public.sources(id) on delete cascade,
  previous_status text not null,
  next_status text not null,
  reason text not null,
  changed_at timestamptz not null default now(),
  changed_by text,
  automatic boolean not null default false
);
create index if not exists source_status_history_source_changed_idx
  on public.source_status_history(source_id, changed_at desc);

-- Deliberately no secret columns: connector authentication references stay in source_config
-- as token environment keys / metadata only.
