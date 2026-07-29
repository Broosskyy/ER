-- Eternal Rave — Sprint 26.9.1: Production closure (venue canonicalization + search backfill)
-- Additive only. Generic mechanisms; Bootshaus data repair via source-scoped updates.

-- ============================================================================
-- 1. Canonical venue alias for normalized name "bootshaus"
-- Ensures name-based resolution prefers production canonical over staging seed.
-- ============================================================================

insert into public.entity_identity_aliases (
  id,
  entity_type,
  canonical_id,
  alias_type,
  alias_value,
  source_id,
  created_by,
  metadata
)
select
  'alias-venue-bootshaus-normalized-name',
  'venue',
  'venue-bootshaus-koeln',
  'normalized_name',
  'bootshaus',
  null,
  'sprint2691-migration',
  jsonb_build_object('reason', 'canonical_venue_repair', 'replaces', 'staging-seed-venue-bootshaus')
where not exists (
  select 1
  from public.entity_identity_aliases as existing
  where existing.entity_type = 'venue'
    and existing.alias_type = 'normalized_name'
    and existing.alias_value = 'bootshaus'
    and coalesce(existing.source_id, '') = ''
)
on conflict do nothing;

update public.entity_identity_aliases
set
  canonical_id = 'venue-bootshaus-koeln',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'reason', 'canonical_venue_repair',
    'updatedBy', 'sprint2691-migration'
  ),
  updated_at = pg_catalog.now()
where entity_type = 'venue'
  and alias_type = 'normalized_name'
  and alias_value = 'bootshaus'
  and canonical_id is distinct from 'venue-bootshaus-koeln';

-- ============================================================================
-- 2. Repair published Bootshaus events + import_records venue references
-- Scoped to source-bootshaus-koeln only. No new events created.
-- ============================================================================

update public.events
set
  venue_id = 'venue-bootshaus-koeln',
  updated_at = pg_catalog.now()
where source_id = 'source-bootshaus-koeln'
  and venue_id = 'staging-seed-venue-bootshaus';

update public.import_records
set
  matched_venue_id = 'venue-bootshaus-koeln',
  updated_at = pg_catalog.now()
where source_id = 'source-bootshaus-koeln'
  and matched_venue_id = 'staging-seed-venue-bootshaus';

-- ============================================================================
-- 3. Generic search_document backfill for rows missing tsvector content
-- Reuses the same weighting contract as events_search_document_trigger().
-- ============================================================================

update public.events
set search_document =
  pg_catalog.setweight(pg_catalog.to_tsvector('simple', coalesce(title, '')), 'A')
  ||
  pg_catalog.setweight(pg_catalog.to_tsvector('simple', coalesce(description, '')), 'B')
  ||
  pg_catalog.setweight(pg_catalog.to_tsvector('simple', coalesce(venue_name, '')), 'C')
where search_document is null;
