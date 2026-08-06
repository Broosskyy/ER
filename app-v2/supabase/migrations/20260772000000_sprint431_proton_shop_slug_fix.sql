-- Sprint 43.1 — Fix Proton The Club Ticket.io shop slug (live shop is proton-the-club, not protontheclub).

update public.sources
set
  source_config = jsonb_set(
    jsonb_set(
      coalesce(source_config, '{}'::jsonb),
      '{ticketPlatform,shopSlug}',
      '"proton-the-club"'::jsonb,
      true
    ),
    '{ticketPlatform,listUrl}',
    '"https://proton-the-club.ticket.io/"'::jsonb,
    true
  ),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'shopSlugRepair', '4.3.1-proton-the-club'
  ),
  updated_at = now()
where id = 'source-ticket-io-protontheclub';
