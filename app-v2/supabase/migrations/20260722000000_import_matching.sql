-- Eternal Rave — Sprint 12C Entity Matching & Duplicate Detection
-- Additive migration: matching fields on import_records

alter table public.import_records
  add column if not exists matched_city_id text references public.cities(id) on delete set null,
  add column if not exists matched_venue_id text references public.venues(id) on delete set null,
  add column if not exists matched_artist_ids text[] not null default '{}',
  add column if not exists matched_genre_ids text[] not null default '{}',
  add column if not exists duplicate_event_id text references public.events(id) on delete set null,
  add column if not exists duplicate_score integer,
  add column if not exists matching_warnings jsonb;

create index if not exists import_records_matched_city_id_idx on public.import_records(matched_city_id);
create index if not exists import_records_matched_venue_id_idx on public.import_records(matched_venue_id);
create index if not exists import_records_duplicate_event_id_idx on public.import_records(duplicate_event_id);
create index if not exists import_records_duplicate_score_idx on public.import_records(duplicate_score);
