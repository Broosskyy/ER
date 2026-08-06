-- Phase 4.6.8 — Structured lineup entries with billing preservation.

create table if not exists public.event_lineup_entries (
  id text primary key default gen_random_uuid()::text,
  event_id text not null references public.events(id) on delete cascade,
  sort_order integer not null default 0 check (sort_order >= 0),
  billing_relation text not null default 'SOLO'
    check (
      billing_relation in (
        'SOLO',
        'B2B',
        'F2F',
        'VS',
        'LIVE',
        'SUPPORT',
        'HOSTED_BY',
        'SPECIAL_GUEST'
      )
    ),
  stage text,
  start_time text,
  end_time text,
  running_order integer,
  confidence numeric(4, 3),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_lineup_entries_event_id_idx
  on public.event_lineup_entries (event_id);

create index if not exists event_lineup_entries_event_sort_idx
  on public.event_lineup_entries (event_id, sort_order);

create table if not exists public.event_lineup_entry_artists (
  id text primary key default gen_random_uuid()::text,
  entry_id text not null references public.event_lineup_entries(id) on delete cascade,
  artist_id text not null references public.artists(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  unique (entry_id, artist_id)
);

create index if not exists event_lineup_entry_artists_entry_id_idx
  on public.event_lineup_entry_artists (entry_id);

create index if not exists event_lineup_entry_artists_artist_id_idx
  on public.event_lineup_entry_artists (artist_id);

alter table public.event_lineup_entries enable row level security;
alter table public.event_lineup_entry_artists enable row level security;

create policy "anon_read_published_event_lineup_entries" on public.event_lineup_entries
  for select using (
    exists (
      select 1
      from public.events e
      where e.id = event_lineup_entries.event_id
        and e.status = 'published'
    )
  );

create policy "anon_read_published_event_lineup_entry_artists" on public.event_lineup_entry_artists
  for select using (
    exists (
      select 1
      from public.event_lineup_entries ele
      join public.events e on e.id = ele.event_id
      where ele.id = event_lineup_entry_artists.entry_id
        and e.status = 'published'
    )
  );

create policy "admin_read_event_lineup_entries" on public.event_lineup_entries
  for select using (public.is_admin());

create policy "admin_insert_event_lineup_entries" on public.event_lineup_entries
  for insert
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_update_event_lineup_entries" on public.event_lineup_entries
  for update
  using (public.has_admin_role(array['editor', 'admin', 'owner']))
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_delete_event_lineup_entries" on public.event_lineup_entries
  for delete
  using (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_read_event_lineup_entry_artists" on public.event_lineup_entry_artists
  for select using (public.is_admin());

create policy "admin_insert_event_lineup_entry_artists" on public.event_lineup_entry_artists
  for insert
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_update_event_lineup_entry_artists" on public.event_lineup_entry_artists
  for update
  using (public.has_admin_role(array['editor', 'admin', 'owner']))
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_delete_event_lineup_entry_artists" on public.event_lineup_entry_artists
  for delete
  using (public.has_admin_role(array['editor', 'admin', 'owner']));

-- Backfill SOLO entries from existing flat event_artists rows.
-- Use short deterministic entry ids (md5 of event_artists.id), not ea.id text
-- which embeds artist_id and can exceed B-tree composite index limits with artist_id.
-- Each INSERT needs its own CTE scope (PostgreSQL CTEs are statement-local).
with backfill_rows as (
  select
    ea.id,
    ea.event_id,
    ea.artist_id,
    ea.billing_role,
    ea.sort_order,
    ea.created_at,
    ea.updated_at,
    'ele-bf-' || md5('phase468-entry:' || ea.id) as lineup_entry_id,
    'elea-bf-' || md5('phase468-entry-artist:' || ea.id) as lineup_entry_artist_id
  from public.event_artists ea
  inner join public.artists a on a.id = ea.artist_id
  where coalesce(a.lineup_legacy_artifact, false) = false
)
insert into public.event_lineup_entries (
  id,
  event_id,
  sort_order,
  billing_relation,
  confidence,
  provenance,
  created_at,
  updated_at
)
select
  lineup_entry_id,
  event_id,
  sort_order,
  case
    when billing_role = 'special_guest' then 'SPECIAL_GUEST'
    when billing_role = 'headliner' then 'SOLO'
    else 'SOLO'
  end,
  0.5,
  jsonb_build_object(
    'source', 'event_artists_backfill',
    'sourceEventArtistId', id
  ),
  created_at,
  updated_at
from backfill_rows
on conflict (id) do nothing;

with backfill_rows as (
  select
    ea.artist_id,
    'ele-bf-' || md5('phase468-entry:' || ea.id) as lineup_entry_id,
    'elea-bf-' || md5('phase468-entry-artist:' || ea.id) as lineup_entry_artist_id
  from public.event_artists ea
  inner join public.artists a on a.id = ea.artist_id
  where coalesce(a.lineup_legacy_artifact, false) = false
)
insert into public.event_lineup_entry_artists (
  id,
  entry_id,
  artist_id,
  sort_order
)
select
  lineup_entry_artist_id,
  lineup_entry_id,
  artist_id,
  0
from backfill_rows
where exists (
  select 1
  from public.event_lineup_entries ele
  where ele.id = backfill_rows.lineup_entry_id
)
on conflict (id) do nothing;
