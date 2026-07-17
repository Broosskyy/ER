-- Eternal Rave — Sprint 2 initial schema
-- Run in Supabase SQL Editor or via supabase db push

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type user_role as enum ('user', 'organizer', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lifecycle_status as enum (
    'draft', 'pending_review', 'imported_draft', 'needs_review',
    'approved', 'published', 'rejected', 'duplicate'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type submission_status as enum ('pending', 'approved', 'rejected', 'duplicate');
exception when duplicate_object then null; end $$;

do $$ begin
  create type import_source_type as enum (
    'website', 'instagram', 'resident_advisor', 'eventbrite',
    'shotgun', 'csv', 'text', 'flyer'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type import_status as enum (
    'queued', 'parsed', 'needs_review', 'approved', 'rejected', 'duplicate', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_status as enum ('open', 'reviewed', 'dismissed');
exception when duplicate_object then null; end $$;

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  role user_role not null default 'user',
  created_at timestamptz not null default now()
);

-- Organizers
create table if not exists public.organizers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  logo_url text,
  instagram_url text,
  website_url text,
  verification_status verification_status not null default 'unverified',
  created_at timestamptz not null default now()
);

-- Venues
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  country text not null,
  address text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

-- Events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text,
  genres text[] not null default '{}',
  start_datetime timestamptz not null,
  end_datetime timestamptz,
  city text not null,
  country text not null,
  venue_name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  price numeric(10,2),
  age_restriction text,
  ticket_url text,
  instagram_url text,
  website_url text,
  flyer_url text,
  organizer_id uuid references public.organizers(id) on delete set null,
  source_url text,
  source_type text,
  lifecycle_status lifecycle_status not null default 'draft',
  confidence_score numeric(4,3),
  duplicate_of_event_id uuid references public.events(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Event artists
create table if not exists public.event_artists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  artist_name text not null,
  slot_time text,
  sort_order int not null default 0
);

-- Favorites
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

-- Event submissions (public user suggestions)
create table if not exists public.event_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  raw_payload jsonb not null default '{}',
  status submission_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- Import sources (future scraping pipeline)
create table if not exists public.import_sources (
  id uuid primary key default gen_random_uuid(),
  source_type import_source_type not null,
  source_url text,
  raw_text text,
  status import_status not null default 'queued',
  parsed_event_id uuid references public.events(id) on delete set null,
  confidence_score numeric(4,3),
  duplicate_warning text,
  created_at timestamptz not null default now()
);

-- Reports
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status report_status not null default 'open',
  created_at timestamptz not null default now()
);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: check admin role
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

create or replace function public.is_organizer()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('organizer', 'admin')
  );
$$ language sql stable security definer;

-- RLS
alter table public.profiles enable row level security;
alter table public.organizers enable row level security;
alter table public.venues enable row level security;
alter table public.events enable row level security;
alter table public.event_artists enable row level security;
alter table public.favorites enable row level security;
alter table public.event_submissions enable row level security;
alter table public.import_sources enable row level security;
alter table public.reports enable row level security;

-- Profiles policies
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Published events: public read
create policy "Anyone can read published events"
  on public.events for select using (lifecycle_status = 'published');

-- Admins read all events
create policy "Admins read all events"
  on public.events for select to authenticated using (public.is_admin());

-- Organizers read own events
create policy "Organizers read own events"
  on public.events for select to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- Organizers insert draft/pending
create policy "Organizers create events"
  on public.events for insert to authenticated
  with check (
    public.is_organizer()
    and created_by = auth.uid()
    and lifecycle_status in ('draft', 'pending_review')
  );

-- Organizers update own non-published events
create policy "Organizers update own events"
  on public.events for update to authenticated
  using (created_by = auth.uid() and lifecycle_status not in ('published', 'rejected', 'duplicate'))
  with check (created_by = auth.uid());

-- Admins update any event (review pipeline)
create policy "Admins update events"
  on public.events for update to authenticated
  using (public.is_admin());

-- Event artists: follow event visibility
create policy "Read artists for visible events"
  on public.event_artists for select using (
    exists (select 1 from public.events e where e.id = event_id and (
      e.lifecycle_status = 'published' or e.created_by = auth.uid() or public.is_admin()
    ))
  );
create policy "Organizers manage own event artists"
  on public.event_artists for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid()));

-- Favorites
create policy "Users manage own favorites"
  on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Submissions
create policy "Users create submissions"
  on public.event_submissions for insert to authenticated
  with check (submitted_by = auth.uid());
create policy "Users read own submissions"
  on public.event_submissions for select to authenticated
  using (submitted_by = auth.uid() or public.is_admin());
create policy "Admins update submissions"
  on public.event_submissions for update to authenticated
  using (public.is_admin());

-- Import sources (admin only)
create policy "Admins manage import sources"
  on public.import_sources for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Reports
create policy "Users create reports"
  on public.reports for insert to authenticated with check (user_id = auth.uid());
create policy "Users read own reports"
  on public.reports for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Organizers table
create policy "Anyone can read organizers"
  on public.organizers for select using (true);
create policy "Organizers manage own record"
  on public.organizers for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Venues: public read
create policy "Anyone can read venues"
  on public.venues for select using (true);

-- Indexes
create index if not exists idx_events_lifecycle on public.events(lifecycle_status);
create index if not exists idx_events_start on public.events(start_datetime);
create index if not exists idx_events_city on public.events(city);
create index if not exists idx_favorites_user on public.favorites(user_id);
create index if not exists idx_submissions_user on public.event_submissions(submitted_by);
create index if not exists idx_import_sources_status on public.import_sources(status);
