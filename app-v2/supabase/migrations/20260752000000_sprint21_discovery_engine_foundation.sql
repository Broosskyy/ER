-- Eternal Rave — Sprint 21: Discovery Engine Foundation.
-- Additive only. Discovery query indexes and full-text search preparation.

-- Composite index for published event discovery queries (status + start date).
create index if not exists events_discovery_published_start_idx
  on public.events(status, start_date)
  where status = 'published';

-- City-scoped discovery via venue city FK.
create index if not exists events_discovery_city_start_idx
  on public.events(city_id, start_date)
  where status = 'published';

-- Entity-scoped discovery filters.
create index if not exists events_discovery_venue_start_idx
  on public.events(venue_id, start_date)
  where status = 'published' and venue_id is not null;

create index if not exists events_discovery_organizer_start_idx
  on public.events(organizer_id, start_date)
  where status = 'published' and organizer_id is not null;

create index if not exists events_discovery_festival_edition_idx
  on public.events(festival_edition_id, start_date)
  where status = 'published' and festival_edition_id is not null;

-- Full-text search preparation (no runtime dependency yet).
alter table public.events
  add column if not exists search_document tsvector;

create index if not exists events_search_document_gin_idx
  on public.events using gin(search_document);

-- Trigger function to maintain search_document from title + description.
create or replace function public.events_search_document_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_document :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.venue_name, '')), 'C');
  return new;
end;
$$;

drop trigger if exists events_search_document_update on public.events;

create trigger events_search_document_update
  before insert or update of title, description, venue_name
  on public.events
  for each row
  execute function public.events_search_document_trigger();

-- Backfill existing rows.
update public.events
set search_document =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(venue_name, '')), 'C')
where search_document is null;
