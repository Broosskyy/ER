-- Sprint 43.1 — Ticket.io connector repair version marker (metadata only).

update public.sources
set
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'connectorVersion', '1.2.0',
    'dataQualityRepairVersion', '4.3.1'
  ),
  updated_at = now()
where id like 'source-ticket-io-%'
   or id = 'source-bootshaus-ticket-io';
