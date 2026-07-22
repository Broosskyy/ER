-- Eternal Rave — ER-010 Organizer Domain & Admin CMS Foundation
-- Canonical organizers table, event relationship, scoped RLS, deterministic backfill.

create table if not exists public.organizers (
  id text primary key default gen_random_uuid()::text,
  slug text not null,
  name text not null,
  description text,
  website text,
  email text,
  phone text,
  instagram text,
  facebook text,
  soundcloud text,
  resident_advisor text,
  logo_url text,
  city text,
  country text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organizers_slug_idx on public.organizers (slug);
create index if not exists organizers_name_idx on public.organizers (name);
create index if not exists organizers_city_idx on public.organizers (city);
create index if not exists organizers_country_idx on public.organizers (country);

alter table public.events
  add column if not exists organizer_id text references public.organizers(id) on delete restrict,
  add column if not exists organizer text;

create index if not exists events_organizer_id_idx on public.events (organizer_id);

-- Backfill organizers from repeated identical normalized organizer text on events.
insert into public.organizers (id, slug, name, city, country, created_at, updated_at)
select
  gen_random_uuid()::text,
  lower(
    regexp_replace(
      regexp_replace(trim(source.name), '[^a-zA-Z0-9]+', '-', 'g'),
      '(^-+|-+$)',
      '',
      'g'
    )
  ) || '-' || right(gen_random_uuid()::text, 8),
  source.name,
  source.city,
  source.country,
  now(),
  now()
from (
  select distinct on (lower(trim(e.organizer)))
    trim(e.organizer) as name,
    nullif(trim(coalesce(c.name, e.venue_city, '')), '') as city,
    coalesce(nullif(trim(v.country), ''), 'Germany') as country
  from public.events e
  left join public.cities c on c.id = e.city_id
  left join public.venues v on v.id = e.venue_id
  where e.organizer is not null
    and trim(e.organizer) <> ''
    and lower(trim(e.organizer)) not in (
      'various', 'unknown', 'tba', 'private', 'self-organized', 'community', 'local crew'
    )
  order by lower(trim(e.organizer)), e.created_at, e.id
) as source
where not exists (
  select 1
  from public.organizers o
  where lower(trim(o.name)) = lower(trim(source.name))
    and coalesce(lower(trim(o.city)), '') = coalesce(lower(trim(source.city)), '')
    and coalesce(lower(trim(o.country)), '') = coalesce(lower(trim(source.country)), '')
);

-- Link events to deterministic organizer matches.
update public.events as e
set organizer_id = match.organizer_id
from (
  select distinct on (e2.id)
    e2.id as event_id,
    o.id as organizer_id
  from public.events e2
  join public.organizers o
    on lower(trim(o.name)) = lower(trim(coalesce(e2.organizer, '')))
   and coalesce(lower(trim(o.city)), '') = coalesce(
     lower(trim(coalesce(
       (select c.name from public.cities c where c.id = e2.city_id),
       e2.venue_city,
       ''
     ))),
     ''
   )
  where e2.organizer_id is null
    and coalesce(e2.organizer, '') <> ''
  order by e2.id, o.created_at, o.id
) as match
where e.id = match.event_id
  and e.organizer_id is null;

alter table public.organizers enable row level security;

create policy "anon_read_public_event_organizers" on public.organizers
  for select using (
    exists (
      select 1
      from public.events e
      where e.organizer_id = organizers.id
        and e.status = 'published'
    )
  );

create policy "admin_read_organizers" on public.organizers
  for select using (public.is_admin());

create policy "admin_insert_organizers" on public.organizers
  for insert
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_update_organizers" on public.organizers
  for update
  using (public.has_admin_role(array['editor', 'admin', 'owner']))
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_delete_organizers" on public.organizers
  for delete
  using (public.has_admin_role(array['editor', 'admin', 'owner']));

alter table public.import_records
  add column if not exists matched_organizer_id text references public.organizers(id) on delete set null;

create index if not exists import_records_matched_organizer_id_idx on public.import_records(matched_organizer_id);
