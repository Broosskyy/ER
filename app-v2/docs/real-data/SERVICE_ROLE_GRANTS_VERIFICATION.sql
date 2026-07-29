-- Eternal Rave — Service role backend grants verification (read-only)
-- Run after applying 20260756000000_service_role_backend_grants.sql
-- Does not persist test data.

-- ============================================================================
-- 1. Role and schema
-- ============================================================================

select
  exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') as service_role_exists,
  pg_catalog.has_schema_privilege('service_role', 'public', 'USAGE') as service_role_public_usage;

-- ============================================================================
-- 2. Core ops table privileges (service_role)
-- ============================================================================

select
  pg_catalog.has_table_privilege('service_role', 'public.platform_operations_state', 'SELECT') as platform_ops_select,
  pg_catalog.has_table_privilege('service_role', 'public.platform_operations_state', 'INSERT') as platform_ops_insert,
  pg_catalog.has_table_privilege('service_role', 'public.platform_operations_state', 'UPDATE') as platform_ops_update,
  pg_catalog.has_table_privilege('service_role', 'public.sources', 'SELECT') as sources_select,
  pg_catalog.has_table_privilege('service_role', 'public.sources', 'UPDATE') as sources_update,
  pg_catalog.has_table_privilege('service_role', 'public.scheduler_runs', 'INSERT') as scheduler_runs_insert,
  pg_catalog.has_table_privilege('service_role', 'public.import_job_queue', 'SELECT') as queue_select,
  pg_catalog.has_table_privilege('service_role', 'public.import_job_queue', 'UPDATE') as queue_update,
  pg_catalog.has_table_privilege('service_role', 'public.events', 'SELECT') as events_select,
  pg_catalog.has_table_privilege('service_role', 'public.events', 'INSERT') as events_insert,
  pg_catalog.has_table_privilege('service_role', 'public.events', 'UPDATE') as events_update;

-- ============================================================================
-- 3. RPC execute privilege
-- ============================================================================

select
  pg_catalog.has_function_privilege(
    'service_role',
    'public.claim_import_job_queue_entries(integer, timestamptz, text, integer)',
    'EXECUTE'
  ) as claim_queue_execute;

select
  pg_catalog.has_function_privilege('anon', 'public.claim_import_job_queue_entries(integer, timestamptz, text, integer)', 'EXECUTE') as anon_claim_execute,
  pg_catalog.has_function_privilege('authenticated', 'public.claim_import_job_queue_entries(integer, timestamptz, text, integer)', 'EXECUTE') as authenticated_claim_execute;

-- ============================================================================
-- 4. anon / authenticated must NOT gain ops write access
-- ============================================================================

select
  pg_catalog.has_table_privilege('anon', 'public.platform_operations_state', 'INSERT') as anon_platform_ops_insert,
  pg_catalog.has_table_privilege('anon', 'public.import_job_queue', 'INSERT') as anon_queue_insert,
  pg_catalog.has_table_privilege('anon', 'public.scheduler_runs', 'INSERT') as anon_scheduler_insert,
  pg_catalog.has_table_privilege('authenticated', 'public.platform_operations_state', 'INSERT') as auth_platform_ops_insert,
  pg_catalog.has_table_privilege('authenticated', 'public.import_job_queue', 'INSERT') as auth_queue_insert,
  pg_catalog.has_table_privilege('authenticated', 'public.scheduler_runs', 'INSERT') as auth_scheduler_insert;

-- Expected: service_role privileges = true; anon/authenticated ops inserts = false.

-- ============================================================================
-- 5. Optional write probe (rolled back)
-- ============================================================================

begin;

insert into public.scheduler_runs (
  id,
  started_at,
  status,
  sources_scanned,
  sources_due,
  jobs_enqueued,
  jobs_processed,
  jobs_succeeded,
  jobs_failed
) values (
  'verify-service-role-grants-probe',
  pg_catalog.now(),
  'completed',
  0,
  0,
  0,
  0,
  0,
  0
);

select id, status
from public.scheduler_runs
where id = 'verify-service-role-grants-probe';

rollback;

-- After ROLLBACK the probe row must not exist:
select count(*) as probe_row_count
from public.scheduler_runs
where id = 'verify-service-role-grants-probe';
