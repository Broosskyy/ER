-- Eternal Rave — Service role backend grants (go-live blocker fix)
-- Repairs PostgreSQL 42501 errors when ops scripts use SUPABASE_SERVICE_ROLE_KEY.
--
-- Context:
--   20260724000000_anon_authenticated_grants.sql grants table access to anon/authenticated only.
--   Sprint 20+ RLS policies allow service_role on ops tables, but table-level GRANTs were missing.
--
-- Scope:
--   - GRANT USAGE on schema public to service_role
--   - Explicit SELECT/INSERT/UPDATE/DELETE on backend/import/ops tables
--   - USAGE/SELECT on public sequences
--   - EXECUTE on claim_import_job_queue_entries for service_role only
--
-- Does NOT:
--   - change anon/authenticated grants
--   - disable RLS
--   - grant EXECUTE on admin/auth helper functions

-- ============================================================================
-- 1. Ensure service_role exists
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    raise exception 'service_role does not exist — cannot apply backend grants';
  end if;
end;
$$;

-- ============================================================================
-- 2. Schema usage
-- ============================================================================

grant usage on schema public to service_role;

-- ============================================================================
-- 3. Table privileges (explicit backend / import / ops list)
-- ============================================================================

do $$
declare
  v_table text;
  v_tables text[] := array[
    -- Operations platform
    'platform_operations_state',
    'operations_backfill_jobs',
    'source_intelligence_snapshots',
    'worker_runs',
    'worker_recovery_runs',
    'connector_health_snapshots',
  -- Scheduler / queue
    'scheduler_runs',
    'import_job_queue',
    'import_schedule_locks',
  -- Import pipeline
    'sources',
    'import_jobs',
    'import_records',
    'import_logs',
    'import_audit_logs',
    'import_review_queue',
  -- Trust / quality
    'trust_quality_rules',
    'source_reputation_events',
  -- Matching / provenance
    'event_blocking_keys',
    'event_match_evaluations',
    'event_merge_candidates',
    'event_source_references',
    'event_field_provenance',
    'duplicate_decisions',
    'event_conflicts',
  -- Lifecycle
    'event_lifecycle_history',
    'event_lifecycle_changes',
    'event_series',
  -- Event domain / publish / discovery
    'events',
    'festivals',
    'festival_editions',
  -- Entity resolution
    'entity_identity_aliases',
    'entity_resolution_decisions',
  -- Reference entities touched during import publish
    'venues',
    'organizers',
    'artists',
    'cities',
    'genres',
    'event_artists',
  -- Source management (scheduler reads/writes source state)
    'source_groups',
    'source_group_memberships',
    'source_relations',
    'source_status_history'
  ];
begin
  foreach v_table in array v_tables loop
    if pg_catalog.to_regclass('public.' || v_table) is not null then
      execute format(
        'grant select, insert, update, delete on table public.%I to service_role',
        v_table
      );
    end if;
  end loop;
end;
$$;

-- ============================================================================
-- 4. Sequence privileges (public schema)
-- ============================================================================

do $$
declare
  v_sequence record;
begin
  for v_sequence in
    select
      sequence_schema,
      sequence_name
    from information_schema.sequences
    where sequence_schema = 'public'
  loop
    execute format(
      'grant usage, select on sequence %I.%I to service_role',
      v_sequence.sequence_schema,
      v_sequence.sequence_name
    );
  end loop;
end;
$$;

-- ============================================================================
-- 5. RPC execute privileges (service_role only)
-- ============================================================================

do $$
begin
  if pg_catalog.to_regprocedure('public.claim_import_job_queue_entries(integer,timestamptz,text,integer)') is null then
    return;
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
