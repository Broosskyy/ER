-- Sprint 35 / Phase 3: Ticket.io production connector hardening

-- Ensure Bootshaus ticket.io enrichment publish policy is explicit
update public.sources
set
  source_config = jsonb_set(
    jsonb_set(
      coalesce(source_config, '{}'::jsonb),
      '{publishPolicy,behavior}',
      '"enrichment"'::jsonb,
      true
    ),
    '{publishPolicy,mode}',
    '"manual_review"'::jsonb,
    true
  ),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'connectorVersion', '1.1.0',
    'platform', 'ticket_io'
  ),
  updated_at = now()
where id = 'source-bootshaus-ticket-io';

-- Extended import job monitoring columns (optional metrics)
alter table public.import_jobs
  add column if not exists unchanged_count integer not null default 0,
  add column if not exists missing_count integer not null default 0,
  add column if not exists pages_processed integer not null default 0,
  add column if not exists connector_version text;
