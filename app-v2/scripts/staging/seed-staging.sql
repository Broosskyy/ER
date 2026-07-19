-- Staging test seed data (clearly marked, no secrets).
-- Apply only to staging databases after migrations.

INSERT INTO public.cities (id, name, slug, country, active)
VALUES ('staging-city-koeln', 'Staging Köln', 'staging-koeln', 'Germany', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.venues (id, name, address, city_id, latitude, longitude)
VALUES (
  'staging-venue-club',
  'Staging Club',
  'Teststraße 1, Köln',
  'staging-city-koeln',
  50.9375,
  6.9603
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.artists (id, name)
VALUES
  ('staging-artist-a', 'Staging DJ Alpha'),
  ('staging-artist-b', 'Staging DJ Beta')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.genres (id, name, slug, active)
VALUES
  ('staging-genre-techno', 'Staging Techno', 'staging-techno', true),
  ('staging-genre-house', 'Staging House', 'staging-house', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (
  id, title, description, city_id, venue_id, genre_id, artist_id,
  start_date, status
)
VALUES (
  'staging-event-duplicate-target',
  'Staging Existing Event',
  'Used for duplicate detection tests.',
  'staging-city-koeln',
  'staging-venue-club',
  'staging-genre-techno',
  'staging-artist-a',
  '2026-10-15T22:00:00Z',
  'published'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sources (id, name, type, trust_score, active, adapter_key, review_required)
VALUES (
  'staging-source-rss',
  'Staging RSS Feed',
  'feed',
  80,
  true,
  'rss',
  true
)
ON CONFLICT (id) DO NOTHING;
