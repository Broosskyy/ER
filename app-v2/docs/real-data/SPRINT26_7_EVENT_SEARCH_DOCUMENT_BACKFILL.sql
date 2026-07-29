-- Eternal Rave — Sprint 26.7
-- Manual operations script: controlled events.search_document backfill
--
-- IMPORTANT
-- - Run on STAGING first. Do not run on production until staging results are reviewed.
-- - This script is NOT part of the schema migration.
-- - No rows are deleted. Event status is not changed.
-- - Abort immediately if pre-flight checks fail (see section 4).
--
-- Stale-document detection limits
-- - Rows with search_document IS NULL can be identified safely without duplicating logic.
-- - Rows with a non-null but outdated search_document cannot be detected without repeating
--   the same tsvector expression used in public.events_search_document_trigger() (Sprint 21).
--   Section 3 therefore uses an explicit mirrored expression for counting and optional repair.
--   Section 5 only backfills NULL documents automatically; section 6 is optional and manual.

-- ============================================================================
-- 1. List all non-internal triggers on public.events
-- ============================================================================

select
  t.tgname as trigger_name,
  pg_catalog.pg_get_triggerdef(t.oid, true) as trigger_definition
from pg_catalog.pg_trigger as t
join pg_catalog.pg_class as c on c.oid = t.tgrelid
join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'events'
  and not t.tgisinternal
order by t.tgname;

-- Review the output before continuing.
-- Expected at minimum: events_search_document_update, enforce_admin_event_status_rules
-- STOP if unexpected write-side triggers appear that are not documented for your environment.

-- ============================================================================
-- 2. Verify search infrastructure exists
-- ============================================================================

select
  pg_catalog.to_regclass('public.events') is not null as events_table_exists,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'search_document'
  ) as search_document_column_exists,
  pg_catalog.to_regprocedure('public.events_search_document_trigger()') is not null
    as search_trigger_function_exists,
  exists (
    select 1
    from pg_catalog.pg_trigger as t
    join pg_catalog.pg_class as c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'events'
      and t.tgname = 'events_search_document_update'
      and not t.tgisinternal
  ) as search_trigger_exists,
  exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'events'
      and indexname = 'events_search_document_gin_idx'
  ) as search_gin_index_exists;

-- STOP if any value above is false.

-- ============================================================================
-- 3. Count rows needing backfill
-- ============================================================================

-- Safe count: NULL search documents
select count(*) as null_search_document_count
from public.events
where search_document is null;

-- Optional count: non-null but potentially stale (mirrors Sprint 21 trigger expression)
select count(*) as potentially_stale_search_document_count
from public.events as e
where e.search_document is not null
  and e.search_document is distinct from (
    setweight(to_tsvector('simple', coalesce(e.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(e.description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(e.venue_name, '')), 'C')
  );

-- If potentially_stale_search_document_count > 0, review before any optional repair in section 6.

-- ============================================================================
-- 4. Pre-flight abort checks (manual review)
-- ============================================================================

-- Run these checks and STOP if any fail:
--
-- 1) You are connected to STAGING, not production.
-- 2) Section 1 trigger list matches expectations for your environment.
-- 3) Section 2 infrastructure flags are all true.
-- 4) You have a recent backup or can restore from snapshot.
-- 5) null_search_document_count is acceptable for a controlled backfill window.
--
-- Uncomment to hard-abort when connected to a database named like production:
-- select case
--   when current_database() ilike '%prod%' then
--     pg_catalog.raise_exception('Abort: production database detected')
--   else null
-- end;

-- ============================================================================
-- 5. Controlled batch backfill for NULL search_document only
-- ============================================================================

-- Adjust batch size as needed. Repeat until null_search_document_count returns 0.
-- This updates only search_document and does not change status or delete rows.
-- The Sprint 21 search trigger does NOT fire on search_document-only updates.

begin;

with batch as (
  select e.id
  from public.events as e
  where e.search_document is null
  order by e.id
  limit 500
)
update public.events as e
set search_document =
  setweight(to_tsvector('simple', coalesce(e.title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(e.description, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(e.venue_name, '')), 'C')
from batch
where e.id = batch.id;

-- Review row count, then COMMIT or ROLLBACK:
-- commit;
rollback;

-- Re-run section 3 until null_search_document_count = 0.

-- ============================================================================
-- 6. OPTIONAL manual repair for non-null stale documents
-- ============================================================================

-- Only run after staging validation and explicit operator approval.
-- Requires duplicating the Sprint 21 trigger expression (see section 3 note).
-- Repeat in batches until potentially_stale_search_document_count = 0.

-- begin;
--
-- with batch as (
--   select e.id
--   from public.events as e
--   where e.search_document is not null
--     and e.search_document is distinct from (
--       setweight(to_tsvector('simple', coalesce(e.title, '')), 'A') ||
--       setweight(to_tsvector('simple', coalesce(e.description, '')), 'B') ||
--       setweight(to_tsvector('simple', coalesce(e.venue_name, '')), 'C')
--     )
--   order by e.id
--   limit 500
-- )
-- update public.events as e
-- set search_document =
--   setweight(to_tsvector('simple', coalesce(e.title, '')), 'A') ||
--   setweight(to_tsvector('simple', coalesce(e.description, '')), 'B') ||
--   setweight(to_tsvector('simple', coalesce(e.venue_name, '')), 'C')
-- from batch
-- where e.id = batch.id;
--
-- commit;

-- ============================================================================
-- 7. Post-backfill verification
-- ============================================================================

select count(*) as remaining_null_search_document_count
from public.events
where search_document is null;

select count(*) as remaining_potentially_stale_count
from public.events as e
where e.search_document is not null
  and e.search_document is distinct from (
    setweight(to_tsvector('simple', coalesce(e.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(e.description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(e.venue_name, '')), 'C')
  );
