-- Eternal Rave — ER-008 Multi-Artist Lineup Foundation
-- Canonical ordered many-to-many between events and artists.

create table if not exists public.event_artists (
  id text primary key default gen_random_uuid()::text,
  event_id text not null references public.events(id) on delete cascade,
  artist_id text not null references public.artists(id) on delete restrict,
  billing_role text not null default 'support'
    check (billing_role in ('headliner', 'support', 'special_guest', 'other')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, artist_id)
);

create index if not exists event_artists_event_id_idx on public.event_artists (event_id);
create index if not exists event_artists_artist_id_idx on public.event_artists (artist_id);
create index if not exists event_artists_event_sort_idx on public.event_artists (event_id, sort_order);

-- Backfill from legacy single-artist FK.
insert into public.event_artists (event_id, artist_id, billing_role, sort_order)
select e.id, e.artist_id, 'headliner', 0
from public.events e
where e.artist_id is not null
on conflict (event_id, artist_id) do nothing;

alter table public.event_artists enable row level security;

-- Public reads: only lineups for published events.
create policy "anon_read_published_event_lineups" on public.event_artists
  for select using (
    exists (
      select 1
      from public.events e
      where e.id = event_artists.event_id
        and e.status = 'published'
    )
  );

create policy "admin_read_event_artists" on public.event_artists
  for select using (public.is_admin());

create policy "admin_insert_event_artists" on public.event_artists
  for insert
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_update_event_artists" on public.event_artists
  for update
  using (public.has_admin_role(array['editor', 'admin', 'owner']))
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_delete_event_artists" on public.event_artists
  for delete
  using (public.has_admin_role(array['editor', 'admin', 'owner']));

create or replace function public.enforce_event_artists_mutation_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id text;
  event_status text;
  event_created_by uuid;
begin
  target_event_id := coalesce(new.event_id, old.event_id);

  select e.status, e.created_by
  into event_status, event_created_by
  from public.events e
  where e.id = target_event_id;

  if event_created_by is not null and event_status = 'review' then
    if not public.has_admin_role(array['admin', 'owner']) then
      raise exception 'contributor_review_lineup_requires_admin_role'
        using errcode = '42501';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists enforce_event_artists_mutation_rules on public.event_artists;

create trigger enforce_event_artists_mutation_rules
  before insert or update or delete on public.event_artists
  for each row
  execute function public.enforce_event_artists_mutation_rules();
