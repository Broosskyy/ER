-- Eternal Rave — ER-009 Venue Admin CMS Foundation
-- Extend venues with canonical domain fields, slug, and scoped RLS.

alter table public.venues
  add column if not exists slug text,
  add column if not exists street text,
  add column if not exists house_number text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text,
  add column if not exists capacity integer check (capacity is null or capacity >= 0),
  add column if not exists notes text;

-- Backfill city/country from cities FK where available.
update public.venues as v
set
  city = coalesce(nullif(trim(v.city), ''), c.name),
  country = coalesce(nullif(trim(v.country), ''), c.country)
from public.cities as c
where v.city_id = c.id
  and (v.city is null or trim(v.city) = '' or v.country is null or trim(v.country) = '');

-- Backfill street from legacy address when street is empty.
update public.venues
set street = nullif(trim(address), '')
where (street is null or trim(street) = '')
  and address is not null
  and trim(address) <> '';

-- Backfill slug from name.
update public.venues
set slug = lower(
  regexp_replace(
    regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'),
    '(^-+|-+$)',
    '',
    'g'
  )
)
where slug is null or trim(slug) = '';

update public.venues as target
set slug = target.slug || '-' || right(target.id, 8)
from (
  select id
  from (
    select id, row_number() over (partition by slug order by created_at, id) as row_num
    from public.venues
  ) ranked
  where row_num > 1
) duplicates
where target.id = duplicates.id;

update public.venues
set city = coalesce(nullif(trim(city), ''), 'Unknown'),
    country = coalesce(nullif(trim(country), ''), 'Germany')
where city is null or trim(city) = '' or country is null or trim(country) = '';

alter table public.venues
  alter column slug set not null,
  alter column city set not null,
  alter column country set not null;

create unique index if not exists venues_slug_idx on public.venues (slug);
create index if not exists venues_name_idx on public.venues (name);
create index if not exists venues_city_idx on public.venues (city);
create index if not exists venues_country_idx on public.venues (country);
create index if not exists events_venue_id_idx on public.events (venue_id);

-- Backfill events.venue_id from deterministic name+city matches where still null.
update public.events as e
set venue_id = match.venue_id
from (
  select distinct on (e2.id)
    e2.id as event_id,
    v.id as venue_id
  from public.events e2
  join public.venues v
    on lower(trim(v.name)) = lower(trim(coalesce(e2.venue_name, '')))
   and lower(trim(v.city)) = lower(trim(coalesce(e2.venue_city, '')))
  where e2.venue_id is null
    and coalesce(e2.venue_name, '') <> ''
    and coalesce(e2.venue_city, '') <> ''
  order by e2.id, v.created_at, v.id
) as match
where e.id = match.event_id
  and e.venue_id is null;

alter table public.venues enable row level security;

drop policy if exists "anon_read_venues" on public.venues;
drop policy if exists "auth_manage_venues" on public.venues;
drop policy if exists "admin_manage_venues" on public.venues;

create policy "anon_read_public_event_venues" on public.venues
  for select using (
    exists (
      select 1
      from public.events e
      where e.venue_id = venues.id
        and e.status = 'published'
    )
  );

create policy "admin_read_venues" on public.venues
  for select using (public.is_admin());

create policy "admin_insert_venues" on public.venues
  for insert
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_update_venues" on public.venues
  for update
  using (public.has_admin_role(array['editor', 'admin', 'owner']))
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_delete_venues" on public.venues
  for delete
  using (public.has_admin_role(array['editor', 'admin', 'owner']));
