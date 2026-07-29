-- Eternal Rave — Sprint 28.1: Affenkäfig verified live domain (affenkaefig.info)
-- Append-only. Source remains DISABLED. No scheduler activation.

update public.organizers
set
  website = 'https://affenkaefig.info',
  updated_at = pg_catalog.now()
where id = 'organizer-affenkaefig';

update public.sources
set
  base_url = 'https://affenkaefig.info/tickets/',
  website = 'https://affenkaefig.info/tickets/',
  source_config = jsonb_build_object(
    'reference', jsonb_build_object('connectorKey', 'organizer_website'),
    'website', jsonb_build_object(
      'preferredStrategy', 'event_detail_page',
      'userAgent', 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; event-import)',
      'acceptLanguage', 'de-DE,de;q=0.9,en;q=0.8',
      'eventDetailPage', jsonb_build_object(
        'listPageUrl', 'https://affenkaefig.info/tickets/',
        'eventLinkSelector', 'a',
        'eventLinkAttribute', 'href',
        'linkIncludePattern', '/event/',
        'allowedDomains', jsonb_build_array('affenkaefig.info', 'www.affenkaefig.info'),
        'detailStrategy', 'json_ld'
      ),
      'limits', jsonb_build_object(
        'maxEventsPerRun', 50,
        'maxDetailPages', 50,
        'maxPaginationPages', 1,
        'maxPagesPerRun', 1,
        'timeoutMs', 30000
      )
    ),
    'regional', jsonb_build_object('countryCode', 'DE', 'languageCode', 'de'),
    'publishPolicy', jsonb_build_object('mode', 'manual_review', 'blockOnDuplicate', true),
    'defaults', jsonb_build_object(
      'cityName', 'Köln',
      'cityId', coalesce(
        (select id from public.cities where id = 'koeln' limit 1),
        (
          select id
          from public.cities
          where slug in ('koeln', 'koln', 'cologne')
             or lower(name) in ('köln', 'koeln', 'cologne')
          order by case when id = 'koeln' then 0 else 1 end, id
          limit 1
        ),
        'koeln'
      ),
      'countryCode', 'DE',
      'organizerName', 'Affenkäfig',
      'organizerId', coalesce(
        (select id from public.organizers where id = 'organizer-affenkaefig' limit 1),
        'organizer-affenkaefig'
      ),
      'ticketUrlFallback', 'eventUrl'
    )
  ),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'connectorKey', 'organizer_website',
    'officialDomain', 'affenkaefig.info',
    'legacyDomain', 'affenkaefig.de',
    'organizerName', 'Affenkäfig',
    'organizerId', 'organizer-affenkaefig',
    'genreNames', jsonb_build_array('Techno', 'House', 'Electronic'),
    'tags', jsonb_build_array('organizer', 'festival', 'koeln', 'production-source', 'sprint28', 'sprint281')
  ),
  notes = 'Sprint 28.1: verified live domain affenkaefig.info (event_detail_page + json_ld detail). Disabled until controlled import.',
  updated_at = pg_catalog.now()
where id = 'source-affenkaefig';

update public.sources
set
  enabled = false,
  active = false,
  review_required = true,
  publish_mode = 'manual_review',
  schedule_enabled = false,
  next_scheduled_at = null,
  updated_at = pg_catalog.now()
where id = 'source-affenkaefig';
