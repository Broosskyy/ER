-- Eternal Rave — ER-012 Source & Acquisition Foundation
-- Evolve the existing sources table into the canonical acquisition source registry.
-- Additive only: legacy columns (name, type, active, adapter_key, source_url) remain for import compatibility.

alter table public.sources
  add column if not exists slug text,
  add column if not exists display_name text,
  add column if not exists description text,
  add column if not exists source_type text,
  add column if not exists base_url text,
  add column if not exists parser_type text,
  add column if not exists acquisition_strategy text not null default 'manual',
  add column if not exists polling_strategy text,
  add column if not exists polling_interval_minutes integer,
  add column if not exists rate_limit_per_hour integer,
  add column if not exists priority integer not null default 50,
  add column if not exists requires_authentication boolean not null default false,
  add column if not exists enabled boolean,
  add column if not exists archived boolean not null default false,
  add column if not exists notes text;

update public.sources
set
  display_name = coalesce(display_name, name),
  source_type = coalesce(source_type, type, 'unknown'),
  base_url = coalesce(base_url, source_url, website),
  parser_type = coalesce(parser_type, adapter_key, 'unknown'),
  slug = coalesce(
    slug,
    regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g'),
    id
  ),
  enabled = coalesce(enabled, active, true),
  acquisition_strategy = coalesce(acquisition_strategy, 'manual')
where display_name is null
   or source_type is null
   or parser_type is null
   or slug is null
   or enabled is null;

-- Resolve duplicate slugs before unique index
with ranked as (
  select
    id,
    slug,
    row_number() over (partition by slug order by created_at, id) as row_num
  from public.sources
  where slug is not null
)
update public.sources s
set slug = ranked.slug || '-' || ranked.row_num
from ranked
where s.id = ranked.id
  and ranked.row_num > 1;

alter table public.sources
  alter column display_name set not null,
  alter column source_type set not null,
  alter column parser_type set not null,
  alter column enabled set not null,
  alter column slug set not null;

alter table public.sources
  drop constraint if exists sources_trust_score_check;

alter table public.sources
  add constraint sources_trust_score_check
    check (trust_score >= 0 and trust_score <= 100);

alter table public.sources
  drop constraint if exists sources_priority_check;

alter table public.sources
  add constraint sources_priority_check
    check (priority >= 0 and priority <= 100);

alter table public.sources
  drop constraint if exists sources_polling_interval_check;

alter table public.sources
  add constraint sources_polling_interval_check
    check (polling_interval_minutes is null or polling_interval_minutes >= 5);

alter table public.sources
  drop constraint if exists sources_rate_limit_check;

alter table public.sources
  add constraint sources_rate_limit_check
    check (rate_limit_per_hour is null or rate_limit_per_hour >= 1);

alter table public.sources
  drop constraint if exists sources_acquisition_strategy_check;

alter table public.sources
  add constraint sources_acquisition_strategy_check
    check (acquisition_strategy in ('manual', 'scheduled', 'webhook', 'future'));

create unique index if not exists sources_slug_idx on public.sources(slug);
create index if not exists sources_enabled_idx on public.sources(enabled) where archived = false;
create index if not exists sources_archived_idx on public.sources(archived);
create index if not exists sources_priority_idx on public.sources(priority desc);
create index if not exists sources_source_type_idx on public.sources(source_type);

-- Extend import records with acquisition provenance metadata (optional, informational)
alter table public.import_records
  add column if not exists source_type text,
  add column if not exists original_url text,
  add column if not exists retrieved_at timestamptz;

create index if not exists import_records_source_type_idx on public.import_records(source_type);

-- RLS: sources already scoped in ER-011 (admin read; source_manager+ write)
