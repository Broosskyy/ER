-- Eternal Rave — Sprint 26.8 P0: Bootshaus canonical entity repair
-- Additive only. Closes live drift between staging-seed IDs and production canonical IDs.
-- Does NOT delete or modify staging-seed rows. Does NOT touch other sources.

-- ============================================================================
-- 1. Production venue: venue-bootshaus-koeln
-- Narrow existence guard: only id + slug (NOT name/city — that blocked Sprint 26.8).
-- Reuses existing Köln city row (staging-seed-city-koeln on current live DB).
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
  city.id,
  'Köln',
  'Germany',
  staging.latitude,
  staging.longitude,
  'https://bootshaus.tv',
  'club',
  pg_catalog.now(),
  pg_catalog.now()
from public.cities as city
left join lateral (
  select v.latitude, v.longitude
  from public.venues as v
  where v.id = 'staging-seed-venue-bootshaus'
  limit 1
) as staging on true
where city.id = 'staging-seed-city-koeln'
  and not exists (
    select 1
    from public.venues as v
    where v.id = 'venue-bootshaus-koeln'
       or v.slug = 'bootshaus-koeln'
  )
on conflict (id) do nothing;

-- ============================================================================
-- 2. Bootshaus source_config.defaults — point venue to production canonical ID
-- Preserves all other defaults (cityId, organizerId, address, publish settings, etc.).
-- ============================================================================

update public.sources
set
  source_config = jsonb_set(
    jsonb_set(
      coalesce(source_config, '{}'::jsonb),
      '{defaults,venueId}',
      to_jsonb('venue-bootshaus-koeln'::text),
      true
    ),
    '{defaults,venueName}',
    to_jsonb('Bootshaus'::text),
    true
  ),
  updated_at = pg_catalog.now()
where id = 'source-bootshaus-koeln'
  and coalesce(source_config->'defaults'->>'venueId', '') is distinct from 'venue-bootshaus-koeln';
