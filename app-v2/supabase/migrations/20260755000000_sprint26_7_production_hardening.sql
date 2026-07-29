-- Eternal Rave — Sprint 26.7: Production Hardening
-- Additive only. Hardens queue claim, source pilot posture, integrity constraints,
-- discovery/search indexes, and updated_at maintenance.

-- ============================================================================
-- 1. Hardened queue claim function
-- ============================================================================

create or replace function public.claim_import_job_queue_entries(
  p_limit integer,
  p_now timestamptz,
  p_worker_id text,
  p_lease_ms integer default 1800000
)
returns setof public.import_job_queue
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_effective_now timestamptz;
  v_worker_id text;
  v_worker_paused boolean := false;
  v_global_maintenance_mode boolean := false;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100 (received %)', p_limit
      using errcode = '22023';
  end if;

  v_effective_now := coalesce(p_now, pg_catalog.clock_timestamp());

  if p_worker_id is null or pg_catalog.length(pg_catalog.btrim(p_worker_id)) = 0 then
    raise exception 'p_worker_id must not be null or blank'
      using errcode = '22023';
  end if;

  v_worker_id := pg_catalog.btrim(p_worker_id);
  if pg_catalog.length(v_worker_id) > 128 then
    raise exception 'p_worker_id must be at most 128 characters'
      using errcode = '22023';
  end if;

  if p_lease_ms is null or p_lease_ms < 60000 or p_lease_ms > 3600000 then
    raise exception 'p_lease_ms must be between 60000 and 3600000 (received %)', p_lease_ms
      using errcode = '22023';
  end if;

  if pg_catalog.to_regclass('public.platform_operations_state') is not null then
    select
      coalesce(pos.worker_paused, false),
      coalesce(pos.global_maintenance_mode, false)
    into v_worker_paused, v_global_maintenance_mode
    from public.platform_operations_state as pos
    where pos.id = 'default'
    limit 1;
  end if;

  if v_worker_paused or v_global_maintenance_mode then
    return;
  end if;

  return query
  with candidates as (
    select q.id
    from public.import_job_queue as q
    where q.status = 'queued'
      and q.scheduled_for <= v_effective_now
      and (q.next_retry_at is null or q.next_retry_at <= v_effective_now)
      and q.dead_lettered_at is null
      and coalesce(q.attempt_count, 0) < coalesce(q.max_attempts, 3)
    order by
      q.priority desc,
      q.scheduled_for asc,
      q.enqueued_at asc,
      q.id asc
    limit p_limit
    for update skip locked
  )
  update public.import_job_queue as q
  set
    status = 'processing',
    started_at = v_effective_now,
    processing_started_at = v_effective_now,
    processing_lease_expires_at = v_effective_now + pg_catalog.make_interval(secs => p_lease_ms / 1000.0),
    worker_id = v_worker_id
  from candidates as c
  where q.id = c.id
    and q.status = 'queued'
  returning q.*;
end;
$$;

-- ============================================================================
-- 2. Function execute privileges (service_role only)
-- ============================================================================

do $$
begin
  if pg_catalog.to_regprocedure('public.claim_import_job_queue_entries(integer,timestamptz,text,integer)') is null then
    raise exception 'claim_import_job_queue_entries function was not created';
  end if;

  revoke all on function public.claim_import_job_queue_entries(integer, timestamptz, text, integer) from public;

  if exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.claim_import_job_queue_entries(integer, timestamptz, text, integer) from anon';
  end if;

  if exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.claim_import_job_queue_entries(integer, timestamptz, text, integer) from authenticated';
  end if;

  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.claim_import_job_queue_entries(integer, timestamptz, text, integer) to service_role';
  end if;
end;
$$;

-- ============================================================================
-- 2b. Ensure sources.publish_mode exists (Sprint 13 prerequisite; drift repair)
-- ============================================================================
-- Canonical definition: 20260744000000_sprint13_production_integration.sql
-- Repairs databases where Sprint 13 was not applied or publish_mode was dropped.

do $$
begin
  if pg_catalog.to_regclass('public.sources') is null then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sources'
      and column_name = 'publish_mode'
  ) then
    alter table public.sources
      add column publish_mode text not null default 'manual_review'
        check (publish_mode in ('auto_publish', 'manual_review', 'conditional_review'));

    create index if not exists sources_publish_mode_idx on public.sources(publish_mode);
  end if;
end;
$$;

-- ============================================================================
-- 3. Affenkäfig — disable reference source until confirmed live
-- ============================================================================

update public.sources
set
  enabled = false,
  active = false,
  review_required = true,
  publish_mode = 'manual_review',
  schedule_enabled = false,
  next_scheduled_at = null,
  updated_at = pg_catalog.now()
where id = 'source-affenkaefig';

-- ============================================================================
-- 4. Bootshaus — production go-live posture (schedule from Sprint 26.6 unchanged)
-- ============================================================================

update public.sources
set
  publish_mode = 'auto_publish',
  review_required = false,
  updated_at = pg_catalog.now()
where id = 'source-bootshaus-koeln'
  and enabled = true
  and coalesce(archived, false) = false
  and base_url is not null
  and pg_catalog.btrim(base_url) <> '';

-- ============================================================================
-- 5. Queue and operations integrity constraints
-- ============================================================================

do $$
begin
  if pg_catalog.to_regclass('public.import_job_queue') is not null then
    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'import_job_queue_attempt_count_nonnegative_chk'
        and c.conrelid = 'public.import_job_queue'::regclass
    ) then
      alter table public.import_job_queue
        add constraint import_job_queue_attempt_count_nonnegative_chk
        check (attempt_count >= 0) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'import_job_queue_attempt_count_nonnegative_chk'
        and c.conrelid = 'public.import_job_queue'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.import_job_queue where attempt_count < 0
    ) then
      alter table public.import_job_queue
        validate constraint import_job_queue_attempt_count_nonnegative_chk;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'import_job_queue_max_attempts_positive_chk'
        and c.conrelid = 'public.import_job_queue'::regclass
    ) then
      alter table public.import_job_queue
        add constraint import_job_queue_max_attempts_positive_chk
        check (max_attempts >= 1) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'import_job_queue_max_attempts_positive_chk'
        and c.conrelid = 'public.import_job_queue'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.import_job_queue where max_attempts < 1
    ) then
      alter table public.import_job_queue
        validate constraint import_job_queue_max_attempts_positive_chk;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'import_job_queue_attempt_count_within_max_chk'
        and c.conrelid = 'public.import_job_queue'::regclass
    ) then
      alter table public.import_job_queue
        add constraint import_job_queue_attempt_count_within_max_chk
        check (attempt_count <= max_attempts) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'import_job_queue_attempt_count_within_max_chk'
        and c.conrelid = 'public.import_job_queue'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.import_job_queue where attempt_count > max_attempts
    ) then
      alter table public.import_job_queue
        validate constraint import_job_queue_attempt_count_within_max_chk;
    end if;
  end if;

  if pg_catalog.to_regclass('public.operations_backfill_jobs') is not null then
    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'operations_backfill_jobs_batch_size_positive_chk'
        and c.conrelid = 'public.operations_backfill_jobs'::regclass
    ) then
      alter table public.operations_backfill_jobs
        add constraint operations_backfill_jobs_batch_size_positive_chk
        check (batch_size > 0) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'operations_backfill_jobs_batch_size_positive_chk'
        and c.conrelid = 'public.operations_backfill_jobs'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.operations_backfill_jobs where batch_size <= 0
    ) then
      alter table public.operations_backfill_jobs
        validate constraint operations_backfill_jobs_batch_size_positive_chk;
    end if;
  end if;

  if pg_catalog.to_regclass('public.scheduler_runs') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'scheduler_runs' and column_name = 'duration_ms'
     ) then
    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'scheduler_runs_duration_ms_nonnegative_chk'
        and c.conrelid = 'public.scheduler_runs'::regclass
    ) then
      alter table public.scheduler_runs
        add constraint scheduler_runs_duration_ms_nonnegative_chk
        check (duration_ms is null or duration_ms >= 0) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'scheduler_runs_duration_ms_nonnegative_chk'
        and c.conrelid = 'public.scheduler_runs'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.scheduler_runs where duration_ms < 0
    ) then
      alter table public.scheduler_runs
        validate constraint scheduler_runs_duration_ms_nonnegative_chk;
    end if;
  end if;

  if pg_catalog.to_regclass('public.worker_runs') is not null then
    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'worker_runs_duration_ms_nonnegative_chk'
        and c.conrelid = 'public.worker_runs'::regclass
    ) then
      alter table public.worker_runs
        add constraint worker_runs_duration_ms_nonnegative_chk
        check (duration_ms is null or duration_ms >= 0) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'worker_runs_duration_ms_nonnegative_chk'
        and c.conrelid = 'public.worker_runs'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.worker_runs where duration_ms < 0
    ) then
      alter table public.worker_runs
        validate constraint worker_runs_duration_ms_nonnegative_chk;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'worker_runs_finished_after_started_chk'
        and c.conrelid = 'public.worker_runs'::regclass
    ) then
      alter table public.worker_runs
        add constraint worker_runs_finished_after_started_chk
        check (finished_at is null or finished_at >= started_at) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'worker_runs_finished_after_started_chk'
        and c.conrelid = 'public.worker_runs'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.worker_runs where finished_at is not null and finished_at < started_at
    ) then
      alter table public.worker_runs
        validate constraint worker_runs_finished_after_started_chk;
    end if;
  end if;

  if pg_catalog.to_regclass('public.worker_recovery_runs') is not null then
    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'worker_recovery_runs_duration_ms_nonnegative_chk'
        and c.conrelid = 'public.worker_recovery_runs'::regclass
    ) then
      alter table public.worker_recovery_runs
        add constraint worker_recovery_runs_duration_ms_nonnegative_chk
        check (duration_ms is null or duration_ms >= 0) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'worker_recovery_runs_duration_ms_nonnegative_chk'
        and c.conrelid = 'public.worker_recovery_runs'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.worker_recovery_runs where duration_ms < 0
    ) then
      alter table public.worker_recovery_runs
        validate constraint worker_recovery_runs_duration_ms_nonnegative_chk;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'worker_recovery_runs_finished_after_started_chk'
        and c.conrelid = 'public.worker_recovery_runs'::regclass
    ) then
      alter table public.worker_recovery_runs
        add constraint worker_recovery_runs_finished_after_started_chk
        check (finished_at is null or finished_at >= started_at) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'worker_recovery_runs_finished_after_started_chk'
        and c.conrelid = 'public.worker_recovery_runs'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.worker_recovery_runs
      where finished_at is not null and finished_at < started_at
    ) then
      alter table public.worker_recovery_runs
        validate constraint worker_recovery_runs_finished_after_started_chk;
    end if;
  end if;

  if pg_catalog.to_regclass('public.connector_health_snapshots') is not null then
    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'connector_health_snapshots_avg_duration_nonnegative_chk'
        and c.conrelid = 'public.connector_health_snapshots'::regclass
    ) then
      alter table public.connector_health_snapshots
        add constraint connector_health_snapshots_avg_duration_nonnegative_chk
        check (average_duration_ms >= 0) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'connector_health_snapshots_avg_duration_nonnegative_chk'
        and c.conrelid = 'public.connector_health_snapshots'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.connector_health_snapshots where average_duration_ms < 0
    ) then
      alter table public.connector_health_snapshots
        validate constraint connector_health_snapshots_avg_duration_nonnegative_chk;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'connector_health_snapshots'
        and column_name = 'last_response_time_ms'
    ) then
      if not exists (
        select 1
        from pg_catalog.pg_constraint as c
        where c.conname = 'connector_health_snapshots_last_response_nonnegative_chk'
          and c.conrelid = 'public.connector_health_snapshots'::regclass
      ) then
        alter table public.connector_health_snapshots
          add constraint connector_health_snapshots_last_response_nonnegative_chk
          check (last_response_time_ms is null or last_response_time_ms >= 0) not valid;
      end if;

      if exists (
        select 1
        from pg_catalog.pg_constraint as c
        where c.conname = 'connector_health_snapshots_last_response_nonnegative_chk'
          and c.conrelid = 'public.connector_health_snapshots'::regclass
          and not c.convalidated
      ) and not exists (
        select 1 from public.connector_health_snapshots where last_response_time_ms < 0
      ) then
        alter table public.connector_health_snapshots
          validate constraint connector_health_snapshots_last_response_nonnegative_chk;
      end if;
    end if;
  end if;

  if pg_catalog.to_regclass('public.source_intelligence_snapshots') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'source_intelligence_snapshots'
         and column_name = 'avg_import_duration_ms'
     ) then
    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'source_intelligence_snapshots_avg_duration_nonnegative_chk'
        and c.conrelid = 'public.source_intelligence_snapshots'::regclass
    ) then
      alter table public.source_intelligence_snapshots
        add constraint source_intelligence_snapshots_avg_duration_nonnegative_chk
        check (avg_import_duration_ms is null or avg_import_duration_ms >= 0) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'source_intelligence_snapshots_avg_duration_nonnegative_chk'
        and c.conrelid = 'public.source_intelligence_snapshots'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.source_intelligence_snapshots where avg_import_duration_ms < 0
    ) then
      alter table public.source_intelligence_snapshots
        validate constraint source_intelligence_snapshots_avg_duration_nonnegative_chk;
    end if;
  end if;
end;
$$;

-- ============================================================================
-- 6. Festival, event, and schedule lifecycle constraints
-- ============================================================================

do $$
begin
  if pg_catalog.to_regclass('public.festival_editions') is not null then
    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'festival_editions_end_after_start_chk'
        and c.conrelid = 'public.festival_editions'::regclass
    ) then
      alter table public.festival_editions
        add constraint festival_editions_end_after_start_chk
        check (end_date is null or start_date is null or end_date >= start_date) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'festival_editions_end_after_start_chk'
        and c.conrelid = 'public.festival_editions'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.festival_editions
      where end_date is not null and start_date is not null and end_date < start_date
    ) then
      alter table public.festival_editions validate constraint festival_editions_end_after_start_chk;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'festival_editions' and column_name = 'year'
    ) then
      if not exists (
        select 1
        from pg_catalog.pg_constraint as c
        where c.conname = 'festival_editions_year_range_chk'
          and c.conrelid = 'public.festival_editions'::regclass
      ) then
        alter table public.festival_editions
          add constraint festival_editions_year_range_chk
          check (year is null or year between 1900 and 2200) not valid;
      end if;

      if exists (
        select 1
        from pg_catalog.pg_constraint as c
        where c.conname = 'festival_editions_year_range_chk'
          and c.conrelid = 'public.festival_editions'::regclass
          and not c.convalidated
      ) and not exists (
        select 1 from public.festival_editions where year is not null and (year < 1900 or year > 2200)
      ) then
        alter table public.festival_editions validate constraint festival_editions_year_range_chk;
      end if;
    end if;
  end if;

  if pg_catalog.to_regclass('public.events') is not null then
    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'events_end_after_start_chk'
        and c.conrelid = 'public.events'::regclass
    ) then
      alter table public.events
        add constraint events_end_after_start_chk
        check (end_date is null or end_date >= start_date) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'events_end_after_start_chk'
        and c.conrelid = 'public.events'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.events where end_date is not null and end_date < start_date
    ) then
      alter table public.events validate constraint events_end_after_start_chk;
    end if;
  end if;

  if pg_catalog.to_regclass('public.import_schedule_locks') is not null then
    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'import_schedule_locks_expires_after_acquired_chk'
        and c.conrelid = 'public.import_schedule_locks'::regclass
    ) then
      alter table public.import_schedule_locks
        add constraint import_schedule_locks_expires_after_acquired_chk
        check (expires_at >= acquired_at) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'import_schedule_locks_expires_after_acquired_chk'
        and c.conrelid = 'public.import_schedule_locks'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.import_schedule_locks where expires_at < acquired_at
    ) then
      alter table public.import_schedule_locks
        validate constraint import_schedule_locks_expires_after_acquired_chk;
    end if;
  end if;

  if pg_catalog.to_regclass('public.scheduler_runs') is not null then
    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'scheduler_runs_finished_after_started_chk'
        and c.conrelid = 'public.scheduler_runs'::regclass
    ) then
      alter table public.scheduler_runs
        add constraint scheduler_runs_finished_after_started_chk
        check (finished_at is null or finished_at >= started_at) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'scheduler_runs_finished_after_started_chk'
        and c.conrelid = 'public.scheduler_runs'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.scheduler_runs where finished_at is not null and finished_at < started_at
    ) then
      alter table public.scheduler_runs
        validate constraint scheduler_runs_finished_after_started_chk;
    end if;
  end if;
end;
$$;

-- ============================================================================
-- 7. Matching integrity
-- ============================================================================

do $$
declare
  v_duplicate_merge_pairs bigint;
  v_orphan_match_evaluations bigint;
begin
  if pg_catalog.to_regclass('public.event_match_evaluations') is not null then
    if not exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'event_match_evaluations_auto_link_requires_canonical_chk'
        and c.conrelid = 'public.event_match_evaluations'::regclass
    ) then
      alter table public.event_match_evaluations
        add constraint event_match_evaluations_auto_link_requires_canonical_chk
        check (decision <> 'auto_link' or canonical_event_id is not null) not valid;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conname = 'event_match_evaluations_auto_link_requires_canonical_chk'
        and c.conrelid = 'public.event_match_evaluations'::regclass
        and not c.convalidated
    ) and not exists (
      select 1 from public.event_match_evaluations
      where decision = 'auto_link' and canonical_event_id is null
    ) then
      alter table public.event_match_evaluations
        validate constraint event_match_evaluations_auto_link_requires_canonical_chk;
    end if;
  end if;

  if pg_catalog.to_regclass('public.event_merge_candidates') is not null then
    select count(*) into v_duplicate_merge_pairs
    from (
      select evaluation_id, canonical_event_id, count(*) as row_count
      from public.event_merge_candidates
      group by evaluation_id, canonical_event_id
      having count(*) > 1
    ) as duplicates;

    if v_duplicate_merge_pairs = 0 then
      create unique index if not exists event_merge_candidates_evaluation_canonical_unique_idx
        on public.event_merge_candidates(evaluation_id, canonical_event_id);
    end if;
  end if;

  if pg_catalog.to_regclass('public.import_records') is not null
     and pg_catalog.to_regclass('public.event_match_evaluations') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'import_records'
         and column_name = 'match_evaluation_id'
     ) then
    select count(*) into v_orphan_match_evaluations
    from public.import_records as ir
    where ir.match_evaluation_id is not null
      and not exists (
        select 1
        from public.event_match_evaluations as eme
        where eme.id = ir.match_evaluation_id
      );

    if v_orphan_match_evaluations = 0 then
      if not exists (
        select 1
        from pg_catalog.pg_constraint as c
        where c.conname = 'import_records_match_evaluation_id_fkey'
          and c.conrelid = 'public.import_records'::regclass
      ) then
        alter table public.import_records
          add constraint import_records_match_evaluation_id_fkey
          foreign key (match_evaluation_id)
          references public.event_match_evaluations(id)
          on delete set null
          not valid;
      end if;

      if exists (
        select 1
        from pg_catalog.pg_constraint as c
        where c.conname = 'import_records_match_evaluation_id_fkey'
          and c.conrelid = 'public.import_records'::regclass
          and not c.convalidated
      ) and v_orphan_match_evaluations = 0 then
        alter table public.import_records
          validate constraint import_records_match_evaluation_id_fkey;
      end if;
    end if;
  end if;
end;
$$;

-- ============================================================================
-- 8. Document percentage / confidence scales
-- ============================================================================

do $$
begin
  if pg_catalog.to_regclass('public.event_match_evaluations') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'event_match_evaluations'
         and column_name = 'confidence_score'
     ) then
    comment on column public.event_match_evaluations.confidence_score is
      'Match confidence score on a 0 to 100 scale.';
  end if;

  if pg_catalog.to_regclass('public.event_merge_candidates') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'event_merge_candidates'
         and column_name = 'confidence_score'
     ) then
    comment on column public.event_merge_candidates.confidence_score is
      'Merge confidence score on a 0 to 100 scale.';
  end if;

  if pg_catalog.to_regclass('public.duplicate_decisions') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'duplicate_decisions'
         and column_name = 'confidence'
     ) then
    comment on column public.duplicate_decisions.confidence is
      'Duplicate decision confidence represented as a decimal between 0.0 and 1.0.';
  end if;

  if pg_catalog.to_regclass('public.connector_health_snapshots') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'connector_health_snapshots'
         and column_name = 'success_rate'
     ) then
    comment on column public.connector_health_snapshots.success_rate is
      'Connector success rate represented as a decimal between 0.0 and 1.0.';
  end if;

  if pg_catalog.to_regclass('public.source_intelligence_snapshots') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'source_intelligence_snapshots'
        and column_name = 'availability_score'
    ) then
      comment on column public.source_intelligence_snapshots.availability_score is
        'Availability score represented as a percentage between 0 and 100.';
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'source_intelligence_snapshots'
        and column_name = 'success_rate'
    ) then
      comment on column public.source_intelligence_snapshots.success_rate is
        'Import success rate represented as a percentage between 0 and 100.';
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'source_intelligence_snapshots'
        and column_name = 'error_rate'
    ) then
      comment on column public.source_intelligence_snapshots.error_rate is
        'Import error rate represented as a percentage between 0 and 100.';
    end if;
  end if;

  if pg_catalog.to_regclass('public.import_review_queue') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'import_review_queue'
        and column_name = 'quality_score'
    ) then
      comment on column public.import_review_queue.quality_score is
        'Review quality score on the application trust/quality scale (typically 0 to 100).';
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'import_review_queue'
        and column_name = 'trust_score'
    ) then
      comment on column public.import_review_queue.trust_score is
        'Effective source trust score snapshot at review time (typically 0 to 100).';
    end if;
  end if;

  if pg_catalog.to_regclass('public.event_lifecycle_history') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'event_lifecycle_history'
         and column_name = 'confidence_score'
     ) then
    comment on column public.event_lifecycle_history.confidence_score is
      'Lifecycle confidence score on the application scale (typically 0 to 100).';
  end if;

  if pg_catalog.to_regclass('public.sources') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'sources'
        and column_name = 'trust_score'
    ) then
      comment on column public.sources.trust_score is
        'Source trust score represented as a percentage between 0 and 100.';
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'sources'
        and column_name = 'error_rate'
    ) then
      comment on column public.sources.error_rate is
        'Source import error rate represented as a percentage between 0 and 100.';
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'sources'
        and column_name = 'computed_trust_score'
    ) then
      comment on column public.sources.computed_trust_score is
        'Computed trust score snapshot represented as a percentage between 0 and 100.';
    end if;
  end if;

  if pg_catalog.to_regclass('public.import_records') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'import_records'
         and column_name = 'source_quality_score'
     ) then
    comment on column public.import_records.source_quality_score is
      'Per-import source quality score on the application scale (typically 0 to 100).';
  end if;
end;
$$;

-- ============================================================================
-- 9. updated_at trigger maintenance
-- ============================================================================

do $$
declare
  target record;
  v_trigger_fn text;
  v_existing_set_updated_at_suitable boolean := false;
begin
  if pg_catalog.to_regprocedure('public.set_updated_at()') is not null then
    select exists (
      select 1
      from pg_catalog.pg_proc as p
      join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'set_updated_at'
        and p.pronargs = 0
        and p.prorettype = 'trigger'::regtype
        and pg_catalog.pg_get_functiondef(p.oid) ilike '%new.updated_at%'
    ) into v_existing_set_updated_at_suitable;

    if v_existing_set_updated_at_suitable then
      v_trigger_fn := 'public.set_updated_at';
    end if;
  end if;

  if v_trigger_fn is null then
    if pg_catalog.to_regprocedure('public.sprint267_set_updated_at()') is null then
      execute $fn$
        create function public.sprint267_set_updated_at()
        returns trigger
        language plpgsql
        security definer
        set search_path = pg_catalog, public, pg_temp
        as $body$
        begin
          new.updated_at := pg_catalog.clock_timestamp();
          return new;
        end;
        $body$;
      $fn$;
    end if;
    v_trigger_fn := 'public.sprint267_set_updated_at';
  end if;

  for target in
    select *
    from (values
      ('trust_quality_rules', 'set_updated_at_trust_quality_rules'),
      ('import_review_queue', 'set_updated_at_import_review_queue'),
      ('festivals', 'set_updated_at_festivals'),
      ('festival_editions', 'set_updated_at_festival_editions'),
      ('event_merge_candidates', 'set_updated_at_event_merge_candidates'),
      ('event_series', 'set_updated_at_event_series'),
      ('platform_operations_state', 'set_updated_at_platform_operations_state'),
      ('operations_backfill_jobs', 'set_updated_at_operations_backfill_jobs')
    ) as tables(table_name, trigger_name)
  loop
    if pg_catalog.to_regclass(format('public.%I', target.table_name)) is not null
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = target.table_name
           and column_name = 'updated_at'
       )
       and not exists (
         select 1
         from pg_catalog.pg_trigger as t
         where t.tgname = target.trigger_name
           and t.tgrelid = pg_catalog.to_regclass(format('public.%I', target.table_name))
           and not t.tgisinternal
       ) then
      execute format(
        'create trigger %I before update on public.%I for each row execute function %s()',
        target.trigger_name,
        target.table_name,
        v_trigger_fn
      );
    end if;
  end loop;
end;
$$;

-- ============================================================================
-- 10. Queue claim index
-- ============================================================================

create index if not exists import_job_queue_claim_ready_idx
  on public.import_job_queue(priority desc, scheduled_for asc, enqueued_at asc, id asc)
  where status = 'queued'
    and dead_lettered_at is null;

-- ============================================================================
-- 11. Discovery index refinement
-- ============================================================================

create index if not exists events_discovery_start_date_only_idx
  on public.events(start_date)
  where status = 'published';

-- ============================================================================
-- 12. Event search infrastructure verification (no row backfill)
-- ============================================================================

alter table public.events
  add column if not exists search_document tsvector;

create index if not exists events_search_document_gin_idx
  on public.events using gin(search_document);

do $$
begin
  if pg_catalog.to_regprocedure('public.events_search_document_trigger()') is null then
    execute $fn$
      create function public.events_search_document_trigger()
      returns trigger
      language plpgsql
      set search_path = pg_catalog, public, pg_temp
      as $body$
      begin
        new.search_document :=
          pg_catalog.setweight(
            pg_catalog.to_tsvector(
              'simple',
              coalesce(new.title, '')
            ),
            'A'
          )
          ||
          pg_catalog.setweight(
            pg_catalog.to_tsvector(
              'simple',
              coalesce(new.description, '')
            ),
            'B'
          )
          ||
          pg_catalog.setweight(
            pg_catalog.to_tsvector(
              'simple',
              coalesce(new.venue_name, '')
            ),
            'C'
          );

        return new;
      end;
      $body$;
    $fn$;
  end if;

  if pg_catalog.to_regclass('public.events') is not null
     and not exists (
       select 1
       from pg_catalog.pg_trigger as t
       where t.tgname = 'events_search_document_update'
         and t.tgrelid = 'public.events'::regclass
         and not t.tgisinternal
     ) then
    execute $trg$
      create trigger events_search_document_update
        before insert or update of title, description, venue_name
        on public.events
        for each row
        execute function public.events_search_document_trigger();
    $trg$;
  end if;
end;
$$;
