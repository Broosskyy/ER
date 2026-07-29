-- Eternal Rave — Sprint 26.8 P0 canonical entity repair verification (read-only)
-- Run after applying 20260758000000_sprint268_bootshaus_canonical_entity_repair.sql

-- ============================================================================
-- 1. Preconditions still satisfied (staging rows untouched)
-- ============================================================================

select
  count(*) filter (where id = 'staging-seed-city-koeln') as staging_city_count,
  count(*) filter (where id = 'staging-seed-venue-bootshaus') as staging_venue_count
from (
  select id from public.cities where id = 'staging-seed-city-koeln'
  union all
  select id from public.venues where id = 'staging-seed-venue-bootshaus'
) as staging_rows;

-- Expect: staging_city_count = 1, staging_venue_count = 1

-- ============================================================================
-- 2. Production canonical venue (explicit id + slug — no OR-only false positives)
-- ============================================================================

select
  count(*) filter (where id = 'venue-bootshaus-koeln') as production_venue_id_count,
  count(*) filter (where slug = 'bootshaus-koeln') as production_venue_slug_count
from public.venues
where id = 'venue-bootshaus-koeln'
   or slug = 'bootshaus-koeln';

-- Expect: production_venue_id_count = 1, production_venue_slug_count = 1

select
  id,
  slug,
  name,
  city,
  country,
  city_id,
  address,
  website,
  venue_type,
  latitude,
  longitude
from public.venues
where id = 'venue-bootshaus-koeln';

-- Expect: slug = bootshaus-koeln, city = Köln, website = https://bootshaus.tv, venue_type = club

-- ============================================================================
-- 3. Organizer unchanged
-- ============================================================================

select
  count(*) as organizer_bootshaus_count
from public.organizers
where id = 'organizer-bootshaus';

-- Expect: 1

-- ============================================================================
-- 4. Source defaults point to production venue (explicit equality)
-- ============================================================================

select
  id,
  source_config->'defaults'->>'venueId' as default_venue_id,
  source_config->'defaults'->>'venueName' as default_venue_name,
  source_config->'defaults'->>'cityId' as default_city_id,
  source_config->'defaults'->>'cityName' as default_city_name,
  source_config->'defaults'->>'organizerId' as default_organizer_id,
  source_config->'defaults'->>'organizerName' as default_organizer_name,
  source_config->'defaults'->>'countryCode' as default_country_code,
  publish_mode,
  review_required
from public.sources
where id = 'source-bootshaus-koeln';

-- Expect:
--   default_venue_id = venue-bootshaus-koeln
--   default_venue_name = Bootshaus
--   default_city_id unchanged (staging-seed-city-koeln on current live DB)
--   publish_mode = auto_publish

-- ============================================================================
-- 5. FK consistency for configured defaults
-- ============================================================================

select
  s.source_config->'defaults'->>'venueId' = 'venue-bootshaus-koeln' as venue_id_is_production,
  v.id is not null as venue_fk_resolves,
  v.slug as resolved_venue_slug,
  c.id is not null as city_fk_resolves,
  o.id is not null as organizer_fk_resolves
from public.sources s
left join public.venues v on v.id = s.source_config->'defaults'->>'venueId'
left join public.cities c on c.id = s.source_config->'defaults'->>'cityId'
left join public.organizers o on o.id = s.source_config->'defaults'->>'organizerId'
where s.id = 'source-bootshaus-koeln';

-- Expect: venue_id_is_production = true, venue_fk_resolves = true, organizer_fk_resolves = true

-- ============================================================================
-- 6. No foreign source mutation (spot check)
-- ============================================================================

select
  count(*) filter (where id = 'source-bootshaus-koeln') as bootshaus_source_count,
  count(*) filter (where id <> 'source-bootshaus-koeln') as other_sources_count
from public.sources;

-- Expect: bootshaus_source_count = 1; other_sources_count unchanged from baseline
