-- Sprint 2.1 — Managed event sources for automatic discovery/import

do $$ begin
  create type event_source_type as enum (
    'ticketmaster', 'eventbrite', 'eventim', 'shotgun', 'resident_advisor',
    'club_website', 'festival_website', 'instagram', 'csv', 'text_paste', 'flyer_upload'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_source_import_status as enum (
    'idle', 'queued', 'running', 'success', 'needs_review', 'failed'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.event_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type event_source_type not null,
  url text,
  country text not null default '',
  city text not null default '',
  is_active boolean not null default true,
  last_checked_at timestamptz,
  import_status event_source_import_status not null default 'idle',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists event_sources_updated_at on public.event_sources;
create trigger event_sources_updated_at
  before update on public.event_sources
  for each row execute function public.set_updated_at();

alter table public.event_sources enable row level security;

create policy "Admins manage event sources"
  on public.event_sources for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create index if not exists idx_event_sources_active on public.event_sources(is_active);
create index if not exists idx_event_sources_type on public.event_sources(source_type);

-- Link import runs to managed sources
alter table public.import_sources
  add column if not exists event_source_id uuid references public.event_sources(id) on delete set null;

alter table public.events
  add column if not exists event_source_id uuid references public.event_sources(id) on delete set null;

create index if not exists idx_import_sources_event_source on public.import_sources(event_source_id);
