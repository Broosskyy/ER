-- Sprint 32: Ticket Kings production enrichment source (Affenkäfig ecosystem)

insert into public.sources (
  id,
  slug,
  stable_key,
  display_name,
  name,
  description,
  source_type,
  type,
  base_url,
  source_url,
  website,
  parser_type,
  adapter_key,
  acquisition_strategy,
  polling_interval_minutes,
  priority,
  trust_score,
  requires_authentication,
  enabled,
  active,
  archived,
  review_required,
  publish_mode,
  source_roles,
  source_lifecycle_status,
  connector_type,
  country_code,
  region,
  city,
  language_codes,
  default_timezone,
  source_config,
  metadata,
  notes,
  created_at,
  updated_at
) values (
  'source-affenkaefig-ticket-kings',
  'affenkaefig-ticket-kings',
  'affenkaefig-ticket-kings-v1',
  'Affenkäfig Ticket Kings',
  'Affenkäfig Ticket Kings',
  'Ticket Kings enrichment source for Affenkäfig and related electronic events.',
  'ticket_platform',
  'ticket_platform',
  'https://ticketkings.de/all-events/',
  'https://ticketkings.de/all-events/',
  'https://ticketkings.de/all-events/',
  'html',
  'html',
  'scheduled',
  360,
  64,
  68,
  false,
  true,
  true,
  false,
  true,
  'manual_review',
  array['ticketing'],
  'active',
  'ticket_platform',
  'DE',
  'Nordrhein-Westfalen',
  'Köln',
  array['de', 'en'],
  'Europe/Berlin',
  '{
    "reference": { "connectorKey": "ticket_platform" },
    "ticketPlatform": {
      "platform": "ticket_king",
      "shopSlug": "ticketkings",
      "listUrl": "https://ticketkings.de/all-events/",
      "timezone": "Europe/Berlin",
      "limits": { "maxEventsPerRun": 50, "requestsPerMinute": 15 },
      "scope": {
        "allowedVenues": ["essigfabrik", "elektroküche", "elektrokueche", "artheater"],
        "allowedOrganizers": ["affenkaefig", "affenkäfig", "mdma", "m.d.m.a", "underland", "elektroküche", "elektrokueche"]
      }
    },
    "publishPolicy": { "mode": "manual_review", "blockOnDuplicate": false },
    "defaults": {
      "cityName": "Köln",
      "cityId": "koeln",
      "countryCode": "DE",
      "organizerName": "Affenkäfig",
      "organizerId": "organizer-affenkaefig",
      "ticketUrlFallback": "eventUrl"
    }
  }'::jsonb,
  '{"category":"ticket_platform","platform":"ticket_king","enrichment":true}'::jsonb,
  'Sprint 32 Ticket Kings enrichment source for Affenkäfig ecosystem events.',
  now(),
  now()
)
on conflict (id) do update set
  slug = excluded.slug,
  stable_key = excluded.stable_key,
  display_name = excluded.display_name,
  name = excluded.name,
  description = excluded.description,
  source_type = excluded.source_type,
  type = excluded.type,
  base_url = excluded.base_url,
  source_url = excluded.source_url,
  website = excluded.website,
  parser_type = excluded.parser_type,
  adapter_key = excluded.adapter_key,
  acquisition_strategy = excluded.acquisition_strategy,
  polling_interval_minutes = excluded.polling_interval_minutes,
  priority = excluded.priority,
  trust_score = excluded.trust_score,
  review_required = excluded.review_required,
  publish_mode = excluded.publish_mode,
  source_roles = excluded.source_roles,
  connector_type = excluded.connector_type,
  country_code = excluded.country_code,
  region = excluded.region,
  city = excluded.city,
  language_codes = excluded.language_codes,
  default_timezone = excluded.default_timezone,
  source_config = excluded.source_config,
  metadata = excluded.metadata,
  notes = excluded.notes,
  updated_at = now();

update public.sources
set
  schedule_policy = 'interval',
  schedule_enabled = true,
  schedule_interval_preset = 'every_6_hours',
  polling_interval_minutes = 360,
  next_scheduled_at = coalesce(next_scheduled_at, now())
where id = 'source-affenkaefig-ticket-kings';
