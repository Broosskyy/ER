-- Eternal Rave — Bootshaus production go-live activation
-- Run on STAGING first, then production after validation.
--
-- Required when Sprint 26.7 was applied with the earlier pilot posture
-- (publish_mode = conditional_review). Go-live requires auto_publish.

-- ============================================================================
-- 1. Pre-flight: verify source exists
-- ============================================================================

select id, enabled, active, archived, publish_mode, review_required,
       schedule_policy, schedule_enabled, schedule_interval_preset,
       next_scheduled_at, polling_interval_minutes, base_url,
       metadata->>'connectorKey' as metadata_connector_key,
       source_config->'reference'->>'connectorKey' as reference_connector_key,
       source_config->'website'->>'preferredStrategy' as preferred_strategy,
       source_config->'website'->'transforms' as title_transforms
from public.sources
where id = 'source-bootshaus-koeln';

-- STOP if no row returned.

-- ============================================================================
-- 2. Activate Bootshaus go-live posture
-- ============================================================================

begin;

update public.sources
set
  enabled = true,
  active = true,
  publish_mode = 'auto_publish',
  review_required = false,
  schedule_policy = 'interval',
  schedule_enabled = true,
  schedule_interval_preset = 'every_6_hours',
  polling_interval_minutes = 360,
  next_scheduled_at = coalesce(next_scheduled_at, pg_catalog.now()),
  updated_at = pg_catalog.now()
where id = 'source-bootshaus-koeln';

-- Review row count (expect 1), then COMMIT or ROLLBACK:
-- commit;
rollback;

-- ============================================================================
-- 3. Post-activation verification (expected values)
-- ============================================================================

select
  id,
  enabled = true as enabled_ok,
  active = true as active_ok,
  publish_mode = 'auto_publish' as publish_mode_ok,
  review_required = false as review_required_ok,
  schedule_policy = 'interval' as schedule_policy_ok,
  schedule_enabled = true as schedule_enabled_ok,
  schedule_interval_preset = 'every_6_hours' as interval_preset_ok,
  next_scheduled_at is not null as next_scheduled_ok,
  polling_interval_minutes = 360 as polling_ok,
  source_config->'website'->>'preferredStrategy' = 'html_selector' as html_selector_ok,
  jsonb_array_length(coalesce(source_config->'website'->'transforms', '[]'::jsonb)) >= 1 as transforms_ok,
  coalesce(metadata->>'connectorKey', source_config->'reference'->>'connectorKey') = 'club_website' as connector_ok
from public.sources
where id = 'source-bootshaus-koeln';

-- ============================================================================
-- 4. Ops platform state (worker/scheduler must not be paused)
-- ============================================================================

select id, scheduler_paused, worker_paused, global_maintenance_mode
from public.platform_operations_state
where id = 'default';
