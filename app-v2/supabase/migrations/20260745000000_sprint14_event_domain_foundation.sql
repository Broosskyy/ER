-- Eternal Rave — Sprint 14: Event domain foundation.
-- Additive only. Extends multi-source event model for festivals, venue types, canonical identity, and provenance RLS.

-- Festival series (organizer-owned, distinct from events and sources).
create table if not exists public.festivals (
  id text primary key,
  slug text not null unique,
  name text not null,
  description text,
  organizer_id text references public.organizers(id) on delete set null,
  series_key text,
  website text,
  logo_url text,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists festivals_organizer_id_idx on public.festivals(organizer_id);
create index if not exists festivals_series_key_idx on public.festivals(series_key);

-- Annual or recurring festival editions (multi-day container, optional venue anchor).
create table if not exists public.festival_editions (
  id text primary key,
  festival_id text not null references public.festivals(id) on delete cascade,
  slug text not null,
  name text not null,
  year integer,
  edition_label text,
  start_date timestamptz,
  end_date timestamptz,
  venue_id text references public.venues(id) on delete set null,
  city text,
  country text,
  status text not null default 'planned'
    check (status in ('planned', 'announced', 'on_sale', 'ongoing', 'completed', 'cancelled', 'archived')),
  camping_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (festival_id, slug)
);

create index if not exists festival_editions_festival_id_idx on public.festival_editions(festival_id);
create index if not exists festival_editions_year_idx on public.festival_editions(year);

alter table public.events
  add column if not exists festival_edition_id text references public.festival_editions(id) on delete set null;

create index if not exists events_festival_edition_id_idx on public.events(festival_edition_id);

-- Venue typing for clubs, open air, festival grounds, and temporary locations.
alter table public.venues
  add column if not exists venue_type text not null default 'unknown',
  add column if not exists is_temporary boolean not null default false;

alter table public.venues
  drop constraint if exists venues_venue_type_check;

alter table public.venues
  add constraint venues_venue_type_check
    check (venue_type in ('club', 'open_air', 'festival_ground', 'warehouse', 'hybrid', 'temporary', 'unknown'));

create index if not exists venues_venue_type_idx on public.venues(venue_type);

-- Canonical event identity aliases (fingerprint prep; no auto-matching engine in this sprint).
alter table public.entity_identity_aliases
  drop constraint if exists entity_identity_aliases_entity_type_check;

alter table public.entity_identity_aliases
  add constraint entity_identity_aliases_entity_type_check
    check (entity_type in ('organizer', 'venue', 'artist', 'event'));

alter table public.entity_resolution_decisions
  drop constraint if exists entity_resolution_decisions_entity_type_check;

alter table public.entity_resolution_decisions
  add constraint entity_resolution_decisions_entity_type_check
    check (entity_type in ('organizer', 'venue', 'artist', 'event'));

-- Provenance tables: admin-scoped RLS (consumer reads via published events projection).
alter table public.event_source_references enable row level security;
alter table public.event_field_provenance enable row level security;
alter table public.event_conflicts enable row level security;
alter table public.duplicate_decisions enable row level security;
alter table public.festivals enable row level security;
alter table public.festival_editions enable row level security;

drop policy if exists admin_read_event_source_references on public.event_source_references;
drop policy if exists admin_write_event_source_references on public.event_source_references;
drop policy if exists admin_read_event_field_provenance on public.event_field_provenance;
drop policy if exists admin_write_event_field_provenance on public.event_field_provenance;
drop policy if exists admin_read_event_conflicts on public.event_conflicts;
drop policy if exists admin_write_event_conflicts on public.event_conflicts;
drop policy if exists admin_read_duplicate_decisions on public.duplicate_decisions;
drop policy if exists admin_write_duplicate_decisions on public.duplicate_decisions;
drop policy if exists admin_read_festivals on public.festivals;
drop policy if exists admin_write_festivals on public.festivals;
drop policy if exists admin_read_festival_editions on public.festival_editions;
drop policy if exists admin_write_festival_editions on public.festival_editions;

create policy admin_read_event_source_references on public.event_source_references
  for select using (public.is_admin());

create policy admin_write_event_source_references on public.event_source_references
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_event_field_provenance on public.event_field_provenance
  for select using (public.is_admin());

create policy admin_write_event_field_provenance on public.event_field_provenance
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_event_conflicts on public.event_conflicts
  for select using (public.is_admin());

create policy admin_write_event_conflicts on public.event_conflicts
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_duplicate_decisions on public.duplicate_decisions
  for select using (public.is_admin());

create policy admin_write_duplicate_decisions on public.duplicate_decisions
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_festivals on public.festivals
  for select using (public.is_admin());

create policy admin_write_festivals on public.festivals
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_festival_editions on public.festival_editions
  for select using (public.is_admin());

create policy admin_write_festival_editions on public.festival_editions
  for all using (public.is_admin()) with check (public.is_admin());
