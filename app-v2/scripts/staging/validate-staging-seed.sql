-- Eternal Rave — Staging seed validation queries
-- Run after scripts/staging/seed-staging-app-data.sql

-- ── Row counts (staging-seed prefix) ─────────────────────────────────────────
SELECT 'cities' AS entity, count(*) AS total
FROM public.cities WHERE id LIKE 'staging-seed-%'
UNION ALL
SELECT 'venues', count(*) FROM public.venues WHERE id LIKE 'staging-seed-%'
UNION ALL
SELECT 'artists', count(*) FROM public.artists WHERE id LIKE 'staging-seed-%'
UNION ALL
SELECT 'genres', count(*) FROM public.genres WHERE id LIKE 'staging-seed-%'
UNION ALL
SELECT 'collections', count(*) FROM public.collections WHERE id LIKE 'staging-seed-%'
UNION ALL
SELECT 'sources', count(*) FROM public.sources WHERE id LIKE 'staging-seed-%'
UNION ALL
SELECT 'events_total', count(*) FROM public.events WHERE id LIKE 'staging-seed-%' OR id IN ('void-techno-saturday', 'klangkuenstler-berghain')
UNION ALL
SELECT 'events_published', count(*) FROM public.events
  WHERE status = 'published' AND (id LIKE 'staging-seed-%' OR id IN ('void-techno-saturday', 'klangkuenstler-berghain'))
UNION ALL
SELECT 'events_draft', count(*) FROM public.events
  WHERE status = 'draft' AND id LIKE 'staging-seed-%';

-- ── Data quality checks (should return 0 rows each) ──────────────────────────
-- Published events without venue
SELECT id, title FROM public.events
WHERE status = 'published'
  AND (id LIKE 'staging-seed-%' OR id IN ('void-techno-saturday', 'klangkuenstler-berghain'))
  AND venue_id IS NULL;

-- Published events without genre
SELECT id, title FROM public.events
WHERE status = 'published'
  AND (id LIKE 'staging-seed-%' OR id IN ('void-techno-saturday', 'klangkuenstler-berghain'))
  AND genre_id IS NULL;

-- Invalid time range (end before start)
SELECT id, title, start_date, end_date FROM public.events
WHERE end_date IS NOT NULL
  AND end_date < start_date
  AND (id LIKE 'staging-seed-%' OR id IN ('void-techno-saturday', 'klangkuenstler-berghain'));

-- Orphan venue city references
SELECT v.id, v.name, v.city_id FROM public.venues v
WHERE v.id LIKE 'staging-seed-%'
  AND NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.id = v.city_id);

-- Orphan event FK references
SELECT e.id, e.title, 'venue' AS missing_ref, e.venue_id AS ref_id
FROM public.events e
WHERE (e.id LIKE 'staging-seed-%' OR e.id IN ('void-techno-saturday', 'klangkuenstler-berghain'))
  AND e.venue_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.id = e.venue_id)
UNION ALL
SELECT e.id, e.title, 'city', e.city_id
FROM public.events e
WHERE (e.id LIKE 'staging-seed-%' OR e.id IN ('void-techno-saturday', 'klangkuenstler-berghain'))
  AND e.city_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.id = e.city_id)
UNION ALL
SELECT e.id, e.title, 'genre', e.genre_id
FROM public.events e
WHERE (e.id LIKE 'staging-seed-%' OR e.id IN ('void-techno-saturday', 'klangkuenstler-berghain'))
  AND e.genre_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.genres g WHERE g.id = e.genre_id)
UNION ALL
SELECT e.id, e.title, 'artist', e.artist_id
FROM public.events e
WHERE (e.id LIKE 'staging-seed-%' OR e.id IN ('void-techno-saturday', 'klangkuenstler-berghain'))
  AND e.artist_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.artists a WHERE a.id = e.artist_id);

-- Draft events visible to anon (run via API, not SQL) — SQL check only:
SELECT id, title, status FROM public.events
WHERE status = 'draft' AND id LIKE 'staging-seed-%';

-- ── Expected counts snapshot ─────────────────────────────────────────────────
-- cities: 2 | venues: 5 | artists: 8 | genres: 6 | collections: 3
-- events published: 16 | events draft: 2
