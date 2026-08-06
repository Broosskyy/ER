-- Sprint 34.2 / Phase 2: Generic Source Platform foundations (field provenance extensions)
-- Additive only. No data loss. Existing rows remain valid.

alter table public.event_field_provenance
  add column if not exists confidence numeric,
  add column if not exists freshness_at timestamptz,
  add column if not exists origin_external_id text,
  add column if not exists merge_decision text,
  add column if not exists selected_tier text;

comment on column public.event_field_provenance.confidence is
  'Extraction or match confidence for the selected field value (0-1 or 0-100 per writer).';

comment on column public.event_field_provenance.freshness_at is
  'Timestamp when the selected value was last observed from the originating source.';

comment on column public.event_field_provenance.origin_external_id is
  'External event id from event_source_references for the originating import.';

comment on column public.event_field_provenance.merge_decision is
  'Field-trust merge outcome: accepted, rejected_tier, skipped_locked, skipped_empty, unchanged.';

comment on column public.event_field_provenance.selected_tier is
  'Source priority tier that owns this field after publish (field-ownership-policy).';

comment on table public.sources is
  'Acquisition sources. publishPolicy.behavior in source_config jsonb: auto_publish | manual_review | enrichment | disabled.';
