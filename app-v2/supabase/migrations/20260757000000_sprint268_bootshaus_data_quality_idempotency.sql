-- Eternal Rave — Sprint 26.8: Bootshaus canonical entities + source field defaults
-- Additive only. Reuses existing rows when present.

-- ============================================================================
-- 1. Canonical city: Köln
-- ============================================================================

insert into public.cities (id, name, slug, country, active, created_at, updated_at)
values ('koeln', 'Köln', 'koeln', 'Germany', true, now(), now())
on conflict (slug) do nothing;

insert into public.cities (id, name, slug, country, active, created_at, updated_at)
select 'koeln', 'Köln', 'koeln', 'Germany', true, now(), now()
where not exists (
  select 1 from public.cities
  where id = 'koeln'
     or slug in ('koeln', 'koln', 'cologne')
     or lower(name) in ('köln', 'koeln', 'cologne')
);

-- ============================================================================
-- 2. Canonical venue: Bootshaus (Köln)
-- venues NOT NULL (ER-009): name, slug, city, country
-- venues unique: slug (venues_slug_idx)
-- ============================================================================

insert into public.venues (
  id,
  name,
  slug,
  address,
  street,
  postal_code,
  city_id,
  city,
  country,
  latitude,
  longitude,
  website,
  venue_type,
  created_at,
  updated_at
)
select
  'venue-bootshaus-koeln',
  'Bootshaus',
  'bootshaus-koeln',
  'Auenweg 173, 51063 Köln',
  'Auenweg 173',
  '51063',
  c.id,
  'Köln',
  'Germany',
  50.965,
  7.005,
  'https://bootshaus.tv',
  'club',
  now(),
  now()
from (
  select id
  from public.cities
  where id = 'koeln'
     or slug in ('koeln', 'koln', 'cologne')
     or lower(name) in ('köln', 'koeln', 'cologne')
  order by case when id = 'koeln' then 0 else 1 end, id
  limit 1
) as c
where not exists (
  select 1
  from public.venues v
  where v.id = 'venue-bootshaus-koeln'
     or v.slug = 'bootshaus-koeln'
     or (
       lower(v.name) = 'bootshaus'
       and lower(coalesce(v.city, '')) in ('köln', 'koeln', 'cologne')
     )
     or lower(regexp_replace(coalesce(v.website, ''), '/+$', '')) = 'https://bootshaus.tv'
)
on conflict (id) do nothing;

-- ============================================================================
-- 3. Canonical organizer: Bootshaus
-- organizers NOT NULL: slug, name
-- organizers unique: slug (organizers_slug_idx)
-- ============================================================================

insert into public.organizers (id, slug, name, city, country, website, created_at, updated_at)
values (
  'organizer-bootshaus',
  'bootshaus',
  'Bootshaus',
  'Köln',
  'Germany',
  'https://bootshaus.tv',
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.organizers (id, slug, name, city, country, website, created_at, updated_at)
select
  'organizer-bootshaus',
  'bootshaus',
  'Bootshaus',
  'Köln',
  'Germany',
  'https://bootshaus.tv',
  now(),
  now()
where not exists (
  select 1
  from public.organizers o
  where o.id = 'organizer-bootshaus'
     or o.slug = 'bootshaus'
     or (
       lower(o.name) = 'bootshaus'
       and lower(coalesce(o.city, '')) in ('köln', 'koeln', 'cologne')
     )
);

-- ============================================================================
-- 4. Bootshaus source_config.defaults (normalization backfill)
-- Resolves canonical entity IDs at apply time (reuse existing rows when present).
-- ============================================================================

update public.sources
set
  source_config = coalesce(source_config, '{}'::jsonb) || jsonb_build_object(
    'defaults', jsonb_build_object(
      'cityName', 'Köln',
      'cityId', coalesce(
        (select id from public.cities where id = 'koeln' limit 1),
        (
          select id
          from public.cities
          where slug in ('koeln', 'koln', 'cologne')
             or lower(name) in ('köln', 'koeln', 'cologne')
          order by case when id = 'koeln' then 0 else 1 end, id
          limit 1
        ),
        'koeln'
      ),
      'venueName', 'Bootshaus',
      'venueId', coalesce(
        (select id from public.venues where id = 'venue-bootshaus-koeln' limit 1),
        (select id from public.venues where slug = 'bootshaus-koeln' limit 1),
        (
          select id
          from public.venues
          where lower(name) = 'bootshaus'
            and lower(coalesce(city, '')) in ('köln', 'koeln', 'cologne')
          order by case when id = 'venue-bootshaus-koeln' then 0 else 1 end, created_at, id
          limit 1
        ),
        'venue-bootshaus-koeln'
      ),
      'organizerName', 'Bootshaus',
      'organizerId', coalesce(
        (select id from public.organizers where id = 'organizer-bootshaus' limit 1),
        (select id from public.organizers where slug = 'bootshaus' limit 1),
        (
          select id
          from public.organizers
          where lower(name) = 'bootshaus'
            and lower(coalesce(city, '')) in ('köln', 'koeln', 'cologne')
          order by case when id = 'organizer-bootshaus' then 0 else 1 end, created_at, id
          limit 1
        ),
        'organizer-bootshaus'
      ),
      'countryCode', 'DE',
      'address', 'Auenweg 173',
      'postalCode', '51063',
      'venueAddress', 'Auenweg 173, 51063 Köln',
      'ticketUrlFallback', 'eventUrl'
    )
  ),
  updated_at = now()
where id = 'source-bootshaus-koeln';

-- Remove misleading venueSelector from website config (subtitle is not venue).
update public.sources
set
  source_config = source_config #- '{website,htmlSelector,venueSelector}',
  updated_at = now()
where id = 'source-bootshaus-koeln'
  and source_config #>> '{website,htmlSelector,venueSelector}' is not null;
