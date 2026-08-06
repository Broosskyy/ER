-- Single-Issue #001: enable Ticket Kings detail page fetches for lineup extraction.
-- Production sources were missing ticketPlatform.limits.maxDetailPages (defaults to 0 → no detail fetch).

update public.sources
set source_config = jsonb_set(
  source_config,
  '{ticketPlatform,limits,maxDetailPages}',
  '15'::jsonb,
  true
),
updated_at = now()
where id in (
  'source-affenkaefig-ticket-kings',
  'source-ticket-kings-org-elektrokuche',
  'source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt'
)
and coalesce((source_config #>> '{ticketPlatform,limits,maxDetailPages}')::int, 0) = 0;
