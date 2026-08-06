-- Eternal Rave — Sprint 4.5: Bootshaus website detail extraction (list + og:description merge)
-- Append-only. Enables post-list detail enrichment without changing preferredStrategy.

update public.sources
set
  source_config = jsonb_set(
    jsonb_set(
      coalesce(source_config, '{}'::jsonb),
      '{website,limits,maxDetailPages}',
      '50'::jsonb,
      true
    ),
    '{website,eventDetailPage}',
    jsonb_build_object(
      'allowedDomains', jsonb_build_array('bootshaus.tv', 'www.bootshaus.tv'),
      'linkIncludePattern', '^/events/'
    ),
    true
  ),
  notes = coalesce(notes, '') || ' Sprint 4.5: enabled list+detail enrichment (maxDetailPages=50, og:description).',
  updated_at = pg_catalog.now()
where id = 'source-bootshaus-koeln';
