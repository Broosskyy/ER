-- Sprint 2.3 — optional seed for event_sources (run after 002_event_sources.sql)
-- Idempotent: skips if sources already exist by name.

insert into public.event_sources (name, source_type, url, city, country, is_active, notes)
select * from (values
  ('Resident Advisor Berlin', 'resident_advisor'::event_source_type, 'https://ra.co/events/de/berlin', 'Berlin', 'Germany', true, 'Weekly crawl — techno listings'),
  ('Berghain Club Site', 'club_website'::event_source_type, 'https://berghain.berlin/program', 'Berlin', 'Germany', true, 'Club program page'),
  ('Eventbrite Hamburg', 'eventbrite'::event_source_type, 'https://www.eventbrite.de/d/germany/hamburg/music/electronic/', 'Hamburg', 'Germany', true, 'Electronic events category'),
  ('Shotgun Amsterdam', 'shotgun'::event_source_type, 'https://shotgun.live/cities/amsterdam', 'Amsterdam', 'Netherlands', false, 'Paused — mock only'),
  ('Instagram @techno.berlin', 'instagram'::event_source_type, 'https://instagram.com/techno.berlin', 'Berlin', 'Germany', true, 'Social monitoring placeholder')
) as seed(name, source_type, url, city, country, is_active, notes)
where not exists (select 1 from public.event_sources limit 1);
