-- Sprint 43.4 — Historical canonical rebuild activation marker (metadata only).

update public.sources
set
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'historicalRepairVersion', '4.3.4',
    'dataQualityRepairVersion', '4.3.4'
  ),
  updated_at = now()
where enabled = true
  and archived = false
  and coalesce(source_lifecycle_status, 'active') = 'active';
