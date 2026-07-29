-- Eternal Rave — Bootshaus review/import deduplication COMMIT (Sprint 26.8 P0)
-- Scope: source-bootshaus-koeln only. Unique indexes intentionally omitted.
-- Mirrors BOOTSHAUS_REVIEW_DEDUP_CLEANUP.sql with COMMIT instead of ROLLBACK.
-- Apply via: scripts/operations/_bootshaus-dedup-cleanup-commit.ts (preferred)
--         or direct Postgres SQL editor with SUPABASE_DB_URL.

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

-- Guard: abort if counts diverge from preview baseline
do $$
declare
  dup_records int;
  dup_reviews int;
begin
  select count(*) into dup_records from bootshaus_duplicate_records;
  select count(*) into dup_reviews from bootshaus_duplicate_reviews;
  if dup_records <> 36 or dup_reviews <> 36 then
    raise exception 'Pre-commit guard failed: expected 36 duplicates each, got records=% reviews=%', dup_records, dup_reviews;
  end if;
end $$;

update public.import_review_queue irq
set
  import_record_id = bcr.canonical_record_id,
  updated_at = pg_catalog.now()
from bootshaus_canonical_reviews bcrv
join bootshaus_canonical_records bcr
  on bcr.external_id = bcrv.external_event_id
where irq.id = bcrv.canonical_review_id
  and irq.import_record_id <> bcr.canonical_record_id;

delete from public.import_review_queue irq
using bootshaus_duplicate_reviews dup
where irq.id = dup.duplicate_review_id;

delete from public.import_records ir
using bootshaus_duplicate_records dup
where ir.id = dup.duplicate_record_id;

-- In-transaction verification
do $$
declare
  remaining_records int;
  remaining_reviews int;
  distinct_records int;
  distinct_reviews int;
  review_surplus int;
begin
  select count(*), count(distinct external_id)
    into remaining_records, distinct_records
  from public.import_records
  where source_id = 'source-bootshaus-koeln';

  select
    count(*) filter (where status in ('pending', 'on_hold')),
    count(distinct external_event_id) filter (where status in ('pending', 'on_hold')),
    count(*) filter (where status in ('pending', 'on_hold'))
      - count(distinct external_event_id) filter (where status in ('pending', 'on_hold'))
  into remaining_reviews, distinct_reviews, review_surplus
  from public.import_review_queue
  where source_id = 'source-bootshaus-koeln';

  if remaining_records <> 36 or distinct_records <> 36
     or remaining_reviews <> 36 or distinct_reviews <> 36 or review_surplus <> 0 then
    raise exception 'Post-mutation verification failed: records=%/% reviews=%/% surplus=%',
      remaining_records, distinct_records, remaining_reviews, distinct_reviews, review_surplus;
  end if;
end $$;

commit;
