-- Eternal Rave — Bootshaus review/import deduplication (Sprint 26.8)
-- Scope: source-bootshaus-koeln only. Does NOT touch published events or other sources.
--
-- Default: ROLLBACK after preview + mutation (safe dry-run).
-- To apply: uncomment COMMIT at the bottom and comment ROLLBACK.

-- ============================================================================
-- 0. Pre-flight scope guard
-- ============================================================================

select
  'import_records' as table_name,
  count(*) as total_rows,
  count(*) filter (where status = 'needs_review') as needs_review,
  count(distinct external_id) as distinct_external_ids
from public.import_records
where source_id = 'source-bootshaus-koeln';

select
  'import_review_queue' as table_name,
  count(*) as total_rows,
  count(*) filter (where status in ('pending', 'on_hold')) as active_rows,
  count(distinct external_event_id) as distinct_identities,
  count(*) filter (where status in ('pending', 'on_hold'))
    - count(distinct external_event_id) filter (where status in ('pending', 'on_hold')) as duplicate_surplus
from public.import_review_queue
where source_id = 'source-bootshaus-koeln';

-- STOP if source_id filter returns zero rows unexpectedly.

-- ============================================================================
-- 1. Preview duplicate identity groups
-- ============================================================================

select
  external_event_id,
  count(*) as review_count,
  array_agg(id order by updated_at desc) as review_ids_newest_first,
  array_agg(import_record_id order by updated_at desc) as import_record_ids_newest_first
from public.import_review_queue
where source_id = 'source-bootshaus-koeln'
  and status in ('pending', 'on_hold')
group by external_event_id
having count(*) > 1
order by count(*) desc, external_event_id;

select
  external_id,
  count(*) as import_record_count,
  array_agg(id order by updated_at desc) as record_ids_newest_first
from public.import_records
where source_id = 'source-bootshaus-koeln'
group by external_id
having count(*) > 1
order by count(*) desc, external_id;

-- ============================================================================
-- 2. Canonical selection (keep newest per external identity)
-- ============================================================================

begin;

create temporary table bootshaus_canonical_records on commit drop as
select distinct on (source_id, external_id)
  id as canonical_record_id,
  source_id,
  external_id,
  import_job_id,
  updated_at
from public.import_records
where source_id = 'source-bootshaus-koeln'
order by source_id, external_id, updated_at desc, created_at desc;

create temporary table bootshaus_duplicate_records on commit drop as
select ir.id as duplicate_record_id, ir.external_id, bcr.canonical_record_id
from public.import_records ir
join bootshaus_canonical_records bcr
  on bcr.source_id = ir.source_id
 and bcr.external_id = ir.external_id
where ir.source_id = 'source-bootshaus-koeln'
  and ir.id <> bcr.canonical_record_id;

create temporary table bootshaus_canonical_reviews on commit drop as
select distinct on (source_id, external_event_id)
  id as canonical_review_id,
  source_id,
  external_event_id,
  import_record_id,
  updated_at
from public.import_review_queue
where source_id = 'source-bootshaus-koeln'
  and status in ('pending', 'on_hold')
order by source_id, external_event_id, updated_at desc, created_at desc;

create temporary table bootshaus_duplicate_reviews on commit drop as
select irq.id as duplicate_review_id, irq.external_event_id, bcr.canonical_review_id
from public.import_review_queue irq
join bootshaus_canonical_reviews bcr
  on bcr.source_id = irq.source_id
 and bcr.external_event_id = irq.external_event_id
where irq.source_id = 'source-bootshaus-koeln'
  and irq.status in ('pending', 'on_hold')
  and irq.id <> bcr.canonical_review_id;

-- ============================================================================
-- 3. Preview counts before mutation
-- ============================================================================

select
  (select count(*) from bootshaus_duplicate_records) as duplicate_import_records_to_remove,
  (select count(*) from bootshaus_duplicate_reviews) as duplicate_reviews_to_remove,
  (select count(*) from bootshaus_canonical_records) as canonical_import_records_to_keep,
  (select count(*) from bootshaus_canonical_reviews) as canonical_reviews_to_keep;

-- ============================================================================
-- 4. Re-link canonical reviews to canonical import records (if drifted)
-- ============================================================================

update public.import_review_queue irq
set
  import_record_id = bcr.canonical_record_id,
  updated_at = pg_catalog.now()
from bootshaus_canonical_reviews bcrv
join bootshaus_canonical_records bcr
  on bcr.external_id = bcrv.external_event_id
where irq.id = bcrv.canonical_review_id
  and irq.import_record_id <> bcr.canonical_record_id;

-- ============================================================================
-- 5. Remove duplicate reviews (explicit, before record delete)
-- ============================================================================

delete from public.import_review_queue irq
using bootshaus_duplicate_reviews dup
where irq.id = dup.duplicate_review_id;

-- ============================================================================
-- 6. Remove duplicate import records (cascade-safe for remaining reviews)
-- ============================================================================

delete from public.import_records ir
using bootshaus_duplicate_records dup
where ir.id = dup.duplicate_record_id;

-- ============================================================================
-- 7. Post-mutation verification (expect 36 identities, 0 surplus)
-- ============================================================================

select
  count(*) as remaining_import_records,
  count(distinct external_id) as distinct_external_ids
from public.import_records
where source_id = 'source-bootshaus-koeln';

select
  count(*) as remaining_active_reviews,
  count(distinct external_event_id) as distinct_identities,
  count(*) - count(distinct external_event_id) as duplicate_surplus
from public.import_review_queue
where source_id = 'source-bootshaus-koeln'
  and status in ('pending', 'on_hold');

-- ============================================================================
-- 8. Optional DB hardening (run only after dedupe succeeds)
-- ============================================================================

-- Uncomment together with COMMIT when applying to production:

-- create unique index if not exists import_records_source_external_unique_idx
--   on public.import_records(source_id, external_id);

-- create unique index if not exists import_review_queue_source_external_active_unique_idx
--   on public.import_review_queue(source_id, external_event_id)
--   where status in ('pending', 'on_hold');

-- ============================================================================
-- 9. End transaction — default ROLLBACK (preview mode)
-- ============================================================================

rollback;

-- To apply changes, replace rollback with:
-- commit;
