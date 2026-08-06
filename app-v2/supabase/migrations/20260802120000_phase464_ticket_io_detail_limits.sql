-- Phase 4.6.4: enable Ticket.io detail page fetches for lineup extraction.

update public.sources
set source_config = jsonb_set(
  source_config,
  '{ticketPlatform,limits,maxDetailPages}',
  '15'::jsonb,
  true
),
updated_at = now()
where source_config->'ticketPlatform'->>'platform' = 'ticket_io'
  and coalesce((source_config #>> '{ticketPlatform,limits,maxDetailPages}')::int, 0) = 0;
