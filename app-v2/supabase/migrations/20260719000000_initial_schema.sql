-- Eternal Rave — Sprint 11 initial schema
-- Run via Supabase CLI: supabase db push

-- Extensions
create extension if not exists "pgcrypto";

-- Genres
create table if not exists public.genres (
  id text primary key,
  name text not null,
  slug text not null unique,
  icon text,
  color text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cities
create table if not exists public.cities (
  id text primary key,
  name text not null,
  slug text not null unique,
  country text not null default 'Germany',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Venues
create table if not exists public.venues (
  id text primary key,
  name text not null,
  address text,
  city_id text references public.cities(id),
  latitude double precision,
  longitude double precision,
  website text,
  instagram text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Artists
create table if not exists public.artists (
  id text primary key,
  name text not null,
  spotify text,
  instagram text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Collections
create table if not exists public.collections (
  id text primary key,
  title text not null,
  slug text not null unique,
  description text,
  cover text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sources
create table if not exists public.sources (
  id text primary key,
  name text not null,
  type text not null,
  website text,
  trust_score numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Events
create table if not exists public.events (
  id text primary key,
  title text not null,
  subtitle text,
  description text not null default '',
  genre_id text references public.genres(id),
  venue_id text references public.venues(id),
  city_id text references public.cities(id),
  artist_id text references public.artists(id),
  source_id text references public.sources(id),
  collection_id text references public.collections(id),
  start_date timestamptz not null,
  end_date timestamptz,
  ticket_url text,
  image_url text,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_status_idx on public.events(status);
create index if not exists events_start_date_idx on public.events(start_date);
create index if not exists events_city_id_idx on public.events(city_id);

-- Storage buckets
insert into storage.buckets (id, name, public)
values
  ('events', 'events', true),
  ('artists', 'artists', true),
  ('venues', 'venues', true),
  ('collections', 'collections', true)
on conflict (id) do nothing;

-- RLS
alter table public.genres enable row level security;
alter table public.cities enable row level security;
alter table public.venues enable row level security;
alter table public.artists enable row level security;
alter table public.collections enable row level security;
alter table public.sources enable row level security;
alter table public.events enable row level security;

-- Anonymous: read published events + active reference data
create policy "anon_read_published_events" on public.events
  for select using (status = 'published');

create policy "anon_read_active_genres" on public.genres
  for select using (active = true);

create policy "anon_read_active_cities" on public.cities
  for select using (active = true);

create policy "anon_read_active_collections" on public.collections
  for select using (active = true);

create policy "anon_read_active_sources" on public.sources
  for select using (active = true);

create policy "anon_read_venues" on public.venues
  for select using (true);

create policy "anon_read_artists" on public.artists
  for select using (true);

-- Authenticated editors/admins: full access (role refinement in Sprint 12)
create policy "auth_manage_events" on public.events
  for all using (auth.role() = 'authenticated');

create policy "auth_manage_genres" on public.genres
  for all using (auth.role() = 'authenticated');

create policy "auth_manage_cities" on public.cities
  for all using (auth.role() = 'authenticated');

create policy "auth_manage_venues" on public.venues
  for all using (auth.role() = 'authenticated');

create policy "auth_manage_artists" on public.artists
  for all using (auth.role() = 'authenticated');

create policy "auth_manage_collections" on public.collections
  for all using (auth.role() = 'authenticated');

create policy "auth_manage_sources" on public.sources
  for all using (auth.role() = 'authenticated');

-- Storage policies
create policy "public_read_event_images" on storage.objects
  for select using (bucket_id = 'events');

create policy "auth_upload_event_images" on storage.objects
  for insert with check (bucket_id = 'events' and auth.role() = 'authenticated');
