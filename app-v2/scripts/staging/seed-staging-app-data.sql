-- Eternal Rave — Staging app seed data (idempotent, safe to re-run)
-- Prefix: staging-seed-*  |  Featured demo IDs reused for Home highlights
-- Apply ONLY to staging after migrations + GRANT migration.
-- Do NOT delete non-staging rows.

BEGIN;

-- ── Cities (2) ───────────────────────────────────────────────────────────────
INSERT INTO public.cities (id, name, slug, country, active, updated_at)
VALUES
  ('staging-seed-city-koeln', 'Köln', 'koeln', 'Germany', true, now()),
  ('staging-seed-city-berlin', 'Berlin', 'berlin', 'Germany', true, now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  country = EXCLUDED.country,
  active = EXCLUDED.active,
  updated_at = now();

-- ── Genres (6) ───────────────────────────────────────────────────────────────
INSERT INTO public.genres (id, name, slug, active, sort_order, updated_at)
VALUES
  ('staging-seed-genre-techno', 'Techno', 'techno', true, 1, now()),
  ('staging-seed-genre-hard-techno', 'Hard Techno', 'hard-techno', true, 2, now()),
  ('staging-seed-genre-house', 'House', 'house', true, 3, now()),
  ('staging-seed-genre-trance', 'Trance', 'trance', true, 4, now()),
  ('staging-seed-genre-psy', 'Psy', 'psy', true, 5, now()),
  ('staging-seed-genre-industrial', 'Industrial', 'industrial', true, 6, now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- ── Venues (5) ───────────────────────────────────────────────────────────────
INSERT INTO public.venues (id, name, address, city_id, latitude, longitude, updated_at)
VALUES
  ('staging-seed-venue-bootshaus', 'Bootshaus', 'Auenweg 173, 51063 Köln', 'staging-seed-city-koeln', 50.9234, 6.9672, now()),
  ('staging-seed-venue-artheater', 'Artheater', 'Ehrenfeldgürtel 127, 50823 Köln', 'staging-seed-city-koeln', 50.9541, 6.9563, now()),
  ('staging-seed-venue-odessa', 'Odessa', 'Hornstraße 85, 50825 Köln', 'staging-seed-city-koeln', 50.9420, 6.9591, now()),
  ('staging-seed-venue-about-blank', '://about blank', 'Markgrafendamm 24, 10245 Berlin', 'staging-seed-city-berlin', 52.5090, 13.4412, now()),
  ('staging-seed-venue-berghain', 'Halle', 'Am Wriezener Bahnhof, 10243 Berlin', 'staging-seed-city-berlin', 52.5112, 13.4435, now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  city_id = EXCLUDED.city_id,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  updated_at = now();

-- ── Artists (8) ──────────────────────────────────────────────────────────────
INSERT INTO public.artists (id, name, updated_at)
VALUES
  ('staging-seed-artist-daxson', 'Daxson', now()),
  ('staging-seed-artist-charlotte', 'Charlotte de Witte', now()),
  ('staging-seed-artist-klangkuenstler', 'Klangkuenstler', now()),
  ('staging-seed-artist-i-hate-models', 'I Hate Models', now()),
  ('staging-seed-artist-peachlychee', 'Peachlychee', now()),
  ('staging-seed-artist-amelie', 'Amelie Lens', now()),
  ('staging-seed-artist-dvs1', 'DVS1', now()),
  ('staging-seed-artist-ellen', 'Ellen Allien', now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = now();

-- ── Collections (3) ─────────────────────────────────────────────────────────
INSERT INTO public.collections (id, title, slug, description, active, sort_order, updated_at)
VALUES
  ('staging-seed-collection-highlights', 'Staging Highlights', 'staging-highlights', 'Curated staging highlight events.', true, 1, now()),
  ('staging-seed-collection-weekend', 'Staging Weekend', 'staging-weekend', 'Weekend picks for staging validation.', true, 2, now()),
  ('staging-seed-collection-berlin', 'Staging Berlin Special', 'staging-berlin', 'Berlin-only staging collection.', true, 3, now())
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- ── Source (staging manual) ───────────────────────────────────────────────────
INSERT INTO public.sources (id, name, type, trust_score, active, adapter_key, review_required, updated_at)
VALUES (
  'staging-seed-source-manual',
  'Staging Manual Seed',
  'manual',
  100,
  true,
  'manual',
  false,
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  trust_score = EXCLUDED.trust_score,
  active = EXCLUDED.active,
  adapter_key = EXCLUDED.adapter_key,
  review_required = EXCLUDED.review_required,
  updated_at = now();

-- ── Events (18: 16 published + 2 draft) ─────────────────────────────────────
-- Dates aligned with app EVENT_REFERENCE_DATE = 2026-05-24 (Europe/Berlin)
INSERT INTO public.events (
  id, title, subtitle, description, genre_id, venue_id, city_id, artist_id,
  source_id, collection_id, start_date, end_date, ticket_url, image_url, status, updated_at
)
VALUES
  -- Featured / tonight (published)
  (
    'void-techno-saturday',
    'VOID: Techno Saturday',
    'Staging highlight',
    'Hard techno night with Daxson. Staging seed event for Home highlights.',
    'staging-seed-genre-techno',
    'staging-seed-venue-bootshaus',
    'staging-seed-city-koeln',
    'staging-seed-artist-daxson',
    'staging-seed-source-manual',
    'staging-seed-collection-highlights',
    '2026-05-24T22:00:00+02:00',
    '2026-05-25T06:00:00+02:00',
    'https://example.com/tickets/void-techno-saturday',
    NULL,
    'published',
    now()
  ),
  (
    'klangkuenstler-berghain',
    'Klangkuenstler at Halle',
    'Ausverkauft',
    'Berlin staging highlight with Klangkuenstler. Ticket link kept for sold-out UI test.',
    'staging-seed-genre-hard-techno',
    'staging-seed-venue-berghain',
    'staging-seed-city-berlin',
    'staging-seed-artist-klangkuenstler',
    'staging-seed-source-manual',
    'staging-seed-collection-berlin',
    '2026-05-30T23:00:00+02:00',
    '2026-05-31T10:00:00+02:00',
    'https://example.com/tickets/klangkuenstler-berghain',
    NULL,
    'published',
    now()
  ),
  (
    'staging-seed-event-tonight-house',
    'Cologne House Flow',
    'Free Entry',
    'Open-air house session with Peachlychee. Free entry staging event.',
    'staging-seed-genre-house',
    'staging-seed-venue-odessa',
    'staging-seed-city-koeln',
    'staging-seed-artist-peachlychee',
    'staging-seed-source-manual',
    'staging-seed-collection-highlights',
    '2026-05-24T20:00:00+02:00',
    '2026-05-25T02:00:00+02:00',
    NULL,
    NULL,
    'published',
    now()
  ),
  -- Tomorrow
  (
    'staging-seed-event-tomorrow-techno',
    'Monday Pressure: Charlotte de Witte',
    NULL,
    'Techno night in Köln. Searchable by artist and venue name.',
    'staging-seed-genre-techno',
    'staging-seed-venue-artheater',
    'staging-seed-city-koeln',
    'staging-seed-artist-charlotte',
    'staging-seed-source-manual',
    'staging-seed-collection-weekend',
    '2026-05-25T22:00:00+02:00',
    '2026-05-26T05:00:00+02:00',
    'https://example.com/tickets/monday-pressure',
    NULL,
    'published',
    now()
  ),
  -- This weekend
  (
    'staging-seed-event-weekend-industrial',
    'Industrial Ritual',
    NULL,
    'Industrial-focused weekend event at Bootshaus.',
    'staging-seed-genre-industrial',
    'staging-seed-venue-bootshaus',
    'staging-seed-city-koeln',
    'staging-seed-artist-i-hate-models',
    'staging-seed-source-manual',
    'staging-seed-collection-weekend',
    '2026-05-26T22:00:00+02:00',
    '2026-05-27T06:00:00+02:00',
    'https://example.com/tickets/industrial-ritual',
    NULL,
    'published',
    now()
  ),
  (
    'staging-seed-event-weekend-trance',
    'Trance Unity',
    NULL,
    'Trance night for weekend collection validation.',
    'staging-seed-genre-trance',
    'staging-seed-venue-odessa',
    'staging-seed-city-koeln',
    'staging-seed-artist-ellen',
    'staging-seed-source-manual',
    'staging-seed-collection-weekend',
    '2026-05-27T21:00:00+02:00',
    '2026-05-28T04:00:00+02:00',
    'https://example.com/tickets/trance-unity',
    NULL,
    'published',
    now()
  ),
  -- Upcoming future
  (
    'staging-seed-event-upcoming-psy',
    'Psy Garden Köln',
    NULL,
    'Psytrance gathering with map coordinates from venue.',
    'staging-seed-genre-psy',
    'staging-seed-venue-artheater',
    'staging-seed-city-koeln',
    'staging-seed-artist-dvs1',
    'staging-seed-source-manual',
    NULL,
    '2026-06-12T20:00:00+02:00',
    '2026-06-13T08:00:00+02:00',
    'https://example.com/tickets/psy-garden',
    NULL,
    'published',
    now()
  ),
  (
    'staging-seed-event-upcoming-june',
    'Summer Techno Marathon',
    NULL,
    'Long-form techno event for upcoming filters.',
    'staging-seed-genre-techno',
    'staging-seed-venue-bootshaus',
    'staging-seed-city-koeln',
    'staging-seed-artist-amelie',
    'staging-seed-source-manual',
    NULL,
    '2026-06-20T22:00:00+02:00',
    '2026-06-21T12:00:00+02:00',
    'https://example.com/tickets/summer-marathon',
    NULL,
    'published',
    now()
  ),
  -- Berlin
  (
    'staging-seed-event-berlin-house',
    'Berlin House District',
    NULL,
    'House night in Berlin for city filter validation.',
    'staging-seed-genre-house',
    'staging-seed-venue-about-blank',
    'staging-seed-city-berlin',
    'staging-seed-artist-peachlychee',
    'staging-seed-source-manual',
    'staging-seed-collection-berlin',
    '2026-05-28T23:00:00+02:00',
    '2026-05-29T08:00:00+02:00',
    'https://example.com/tickets/berlin-house',
    NULL,
    'published',
    now()
  ),
  -- Multi-genre title (primary genre in FK)
  (
    'staging-seed-event-multi-genre',
    'Techno x Hard Techno Fusion',
    NULL,
    'Title references multiple genres; primary genre_id is Techno.',
    'staging-seed-genre-techno',
    'staging-seed-venue-bootshaus',
    'staging-seed-city-koeln',
    'staging-seed-artist-daxson',
    'staging-seed-source-manual',
    NULL,
    '2026-06-05T22:00:00+02:00',
    NULL,
    'https://example.com/tickets/multi-genre',
    NULL,
    'published',
    now()
  ),
  -- B2B artists in title
  (
    'staging-seed-event-b2b',
    'DVS1 b2b Ellen Allien',
    NULL,
    'B2B billing in title; primary artist FK points to DVS1.',
    'staging-seed-genre-techno',
    'staging-seed-venue-artheater',
    'staging-seed-city-koeln',
    'staging-seed-artist-dvs1',
    'staging-seed-source-manual',
    NULL,
    '2026-06-07T22:00:00+02:00',
    NULL,
    'https://example.com/tickets/b2b-night',
    NULL,
    'published',
    now()
  ),
  -- No image
  (
    'staging-seed-event-no-image',
    'No Image Session',
    NULL,
    'Published event without image_url to verify placeholder UI.',
    'staging-seed-genre-house',
    'staging-seed-venue-odessa',
    'staging-seed-city-koeln',
    'staging-seed-artist-peachlychee',
    'staging-seed-source-manual',
    NULL,
    '2026-06-14T20:00:00+02:00',
    NULL,
    'https://example.com/tickets/no-image',
    NULL,
    'published',
    now()
  ),
  -- No ticket URL
  (
    'staging-seed-event-no-ticket',
    'Guestlist Only',
    NULL,
    'Published event without ticket_url.',
    'staging-seed-genre-techno',
    'staging-seed-venue-bootshaus',
    'staging-seed-city-koeln',
    'staging-seed-artist-charlotte',
    'staging-seed-source-manual',
    NULL,
    '2026-06-15T22:00:00+02:00',
    NULL,
    NULL,
    NULL,
    'published',
    now()
  ),
  -- Free entry
  (
    'staging-seed-event-free',
    'Open Decks Köln',
    'Free Entry',
    'Community free entry event for ticket CTA fallback.',
    'staging-seed-genre-house',
    'staging-seed-venue-odessa',
    'staging-seed-city-koeln',
    'staging-seed-artist-peachlychee',
    'staging-seed-source-manual',
    NULL,
    '2026-06-18T18:00:00+02:00',
    '2026-06-18T23:00:00+02:00',
    NULL,
    NULL,
    'published',
    now()
  ),
  -- Sold out (subtitle)
  (
    'staging-seed-event-soldout',
    'Sold Out Showcase',
    'Ausverkauft',
    'Staging event marked sold out via subtitle.',
    'staging-seed-genre-hard-techno',
    'staging-seed-venue-artheater',
    'staging-seed-city-koeln',
    'staging-seed-artist-i-hate-models',
    'staging-seed-source-manual',
    NULL,
    '2026-06-21T22:00:00+02:00',
    NULL,
    'https://example.com/tickets/sold-out',
    NULL,
    'published',
    now()
  ),
  -- Extra published for count
  (
    'staging-seed-event-late-july',
    'Late July Warehouse',
    NULL,
    'Additional future published event.',
    'staging-seed-genre-industrial',
    'staging-seed-venue-bootshaus',
    'staging-seed-city-koeln',
    'staging-seed-artist-i-hate-models',
    'staging-seed-source-manual',
    NULL,
    '2026-07-18T22:00:00+02:00',
    NULL,
    'https://example.com/tickets/late-july',
    NULL,
    'published',
    now()
  ),
  -- Draft (must NOT be public)
  (
    'staging-seed-event-draft-secret',
    'DRAFT Secret Rave',
    NULL,
    'Draft staging event — must not appear in public app.',
    'staging-seed-genre-techno',
    'staging-seed-venue-bootshaus',
    'staging-seed-city-koeln',
    'staging-seed-artist-daxson',
    'staging-seed-source-manual',
    NULL,
    '2026-05-24T22:00:00+02:00',
    NULL,
    NULL,
    NULL,
    'draft',
    now()
  ),
  (
    'staging-seed-event-draft-review',
    'DRAFT Review Queue Event',
    NULL,
    'Review-status staging event — must not appear in public app.',
    'staging-seed-genre-house',
    'staging-seed-venue-odessa',
    'staging-seed-city-koeln',
    'staging-seed-artist-peachlychee',
    'staging-seed-source-manual',
    NULL,
    '2026-05-25T20:00:00+02:00',
    NULL,
    NULL,
    NULL,
    'draft',
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  genre_id = EXCLUDED.genre_id,
  venue_id = EXCLUDED.venue_id,
  city_id = EXCLUDED.city_id,
  artist_id = EXCLUDED.artist_id,
  source_id = EXCLUDED.source_id,
  collection_id = EXCLUDED.collection_id,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  ticket_url = EXCLUDED.ticket_url,
  image_url = EXCLUDED.image_url,
  status = EXCLUDED.status,
  updated_at = now();

COMMIT;
