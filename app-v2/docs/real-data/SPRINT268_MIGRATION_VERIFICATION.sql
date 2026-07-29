-- Eternal Rave — Sprint 26.8 migration verification (read-only)
-- Run after applying 20260757000000_sprint268_bootshaus_data_quality_idempotency.sql

-- ============================================================================
-- 1. City: Köln (unique, canonical id preferred)
-- ============================================================================

select
  count(*) as koeln_city_rows,
  count(*) filter (where id = 'koeln') as koeln_id_rows,
  count(*) filter (where slug in ('koeln', 'koln', 'cologne')) as koeln_slug_rows
from public.cities
where id = 'koeln'
   or slug in ('koeln', 'koln', 'cologne')
   or lower(name) in ('köln', 'koeln', 'cologne');

-- Expect: at least 1 row; ideally exactly 1 canonical row with id/slug koeln.

-- ============================================================================
-- 2. Venue: Bootshaus (slug NOT NULL, unique)
-- ============================================================================

select
  id,
  name,
  slug,
  city,
  country,
  city_id,
  address,
  street,
  postal_code,
  website,
  venue_type,
  slug is not null as slug_present,
  city is not null as city_present,
  country is not null as country_present
from public.venues
where id = 'venue-bootshaus-koeln'
   or slug = 'bootshaus-koeln'
   or (
     lower(name) = 'bootshaus'
     and lower(coalesce(city, '')) in ('köln', 'koeln', 'cologne')
   )
   or lower(regexp_replace(coalesce(website, ''), '/+$', '')) = 'https://bootshaus.tv'
order by case when id = 'venue-bootshaus-koeln' then 0 when slug = 'bootshaus-koeln' then 1 else 2 end, created_at;

select
  count(*) as bootshaus_venue_rows,
  count(*) filter (where slug is not null) as venues_with_slug,
  count(*) filter (where slug = 'bootshaus-koeln') as canonical_slug_rows,
  count(distinct slug) as distinct_slugs
from public.venues
where id = 'venue-bootshaus-koeln'
   or slug = 'bootshaus-koeln'
   or (
     lower(name) = 'bootshaus'
     and lower(coalesce(city, '')) in ('köln', 'koeln', 'cologne')
   )
   or lower(regexp_replace(coalesce(website, ''), '/+$', '')) = 'https://bootshaus.tv';

-- Expect: >= 1 row, slug_present = true, canonical slug bootshaus-koeln when inserted by migration.

-- ============================================================================
-- 3. Organizer: Bootshaus
-- ============================================================================

select
  id,
  slug,
  name,
  city,
  country,
  website
from public.organizers
where id = 'organizer-bootshaus'
   or slug = 'bootshaus'
   or (
     lower(name) = 'bootshaus'
     and lower(coalesce(city, '')) in ('köln', 'koeln', 'cologne')
   )
order by case when id = 'organizer-bootshaus' then 0 when slug = 'bootshaus' then 1 else 2 end, created_at;

select
  count(*) as bootshaus_organizer_rows,
  count(distinct slug) as distinct_slugs
from public.organizers
where id = 'organizer-bootshaus'
   or slug = 'bootshaus'
   or (
     lower(name) = 'bootshaus'
     and lower(coalesce(city, '')) in ('köln', 'koeln', 'cologne')
   );

-- ============================================================================
-- 4. Bootshaus source_config defaults
-- ============================================================================

select
  id,
  source_config->'defaults'->>'cityName' as default_city_name,
  source_config->'defaults'->>'cityId' as default_city_id,
  source_config->'defaults'->>'venueName' as default_venue_name,
  source_config->'defaults'->>'venueId' as default_venue_id,
  source_config->'defaults'->>'organizerName' as default_organizer_name,
  source_config->'defaults'->>'organizerId' as default_organizer_id,
  source_config->'defaults'->>'countryCode' as default_country_code,
  source_config->'defaults'->>'ticketUrlFallback' as ticket_url_fallback,
  source_config #>> '{website,htmlSelector,venueSelector}' as venue_selector_removed,
  source_config->'defaults' is not null as defaults_present
from public.sources
where id = 'source-bootshaus-koeln';

-- Expect:
--   default_city_name = Köln
--   default_venue_name = Bootshaus
--   default_organizer_name = Bootshaus
--   default_venue_id references an existing venues.id
--   venue_selector_removed IS NULL

-- ============================================================================
-- 5. Foreign-key consistency for defaults
-- ============================================================================

select
  s.id as source_id,
  s.source_config->'defaults'->>'venueId' as configured_venue_id,
  v.id as resolved_venue_id,
  v.slug as resolved_venue_slug,
  v.city_id as resolved_city_id,
  c.id as resolved_city_row_id,
  s.source_config->'defaults'->>'organizerId' as configured_organizer_id,
  o.id as resolved_organizer_id
from public.sources s
left join public.venues v
  on v.id = s.source_config->'defaults'->>'venueId'
left join public.cities c
  on c.id = s.source_config->'defaults'->>'cityId'
left join public.organizers o
  on o.id = s.source_config->'defaults'->>'organizerId'
where s.id = 'source-bootshaus-koeln';

-- Expect: resolved_venue_id and resolved_organizer_id NOT NULL after successful migration.

-- ============================================================================
-- 6. Duplicate guard summary
-- ============================================================================

select
  'venues_bootshaus_duplicates' as check_name,
  count(*) as row_count,
  count(distinct slug) as distinct_slugs
from public.venues
where lower(name) = 'bootshaus'
  and lower(coalesce(city, '')) in ('köln', 'koeln', 'cologne')

union all

select
  'organizers_bootshaus_duplicates',
  count(*),
  count(distinct slug)
from public.organizers
where lower(name) = 'bootshaus'
  and lower(coalesce(city, '')) in ('köln', 'koeln', 'cologne');

-- Expect: no uncontrolled duplicate explosion; ideally 1 row each.

-- ============================================================================
-- 7. Sprint 26.8 P0 canonical repair (explicit production IDs)
-- Run after 20260758000000_sprint268_bootshaus_canonical_entity_repair.sql
-- See also: SPRINT268_CANONICAL_ENTITY_REPAIR_VERIFICATION.sql
-- ============================================================================

select
  count(*) filter (where id = 'venue-bootshaus-koeln') as production_venue_id_count,
  count(*) filter (where slug = 'bootshaus-koeln') as production_venue_slug_count,
  count(*) filter (where id = 'staging-seed-venue-bootshaus') as staging_venue_preserved_count
from public.venues
where id in ('venue-bootshaus-koeln', 'staging-seed-venue-bootshaus')
   or slug = 'bootshaus-koeln';

-- Expect: production_venue_id_count = 1, production_venue_slug_count = 1, staging_venue_preserved_count = 1

select
  source_config->'defaults'->>'venueId' as default_venue_id,
  source_config->'defaults'->>'venueId' = 'venue-bootshaus-koeln' as points_to_production_venue
from public.sources
where id = 'source-bootshaus-koeln';

-- Expect: points_to_production_venue = true
