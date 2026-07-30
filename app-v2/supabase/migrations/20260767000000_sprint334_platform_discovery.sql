-- Eternal Rave — Sprint 33.4: Ticket platform discovery runs and source candidates.
-- Additive only. Stores discovery reports for admin review before source activation.

create table if not exists public.platform_discovery_runs (
  id text primary key,
  platform text not null,
  status text not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('running', 'completed', 'failed')),
  check (platform in ('ticket_io', 'ticket_king'))
);

create index if not exists platform_discovery_runs_platform_idx
  on public.platform_discovery_runs(platform, created_at desc);

create table if not exists public.platform_discovery_candidates (
  id text primary key,
  run_id text not null references public.platform_discovery_runs(id) on delete cascade,
  platform text not null,
  candidate_type text not null,
  identifier text not null,
  display_name text not null,
  list_url text,
  proposed_source_config jsonb,
  discovery_stats jsonb,
  status text not null,
  duplicate_source_id text references public.sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (platform in ('ticket_io', 'ticket_king')),
  check (candidate_type in ('platform_list', 'shop', 'organizer', 'venue')),
  check (status in ('discovered', 'review', 'approved', 'rejected', 'activated'))
);

create index if not exists platform_discovery_candidates_run_idx
  on public.platform_discovery_candidates(run_id, status);
create index if not exists platform_discovery_candidates_platform_idx
  on public.platform_discovery_candidates(platform, updated_at desc);

comment on table public.platform_discovery_runs is
  'Ticket platform discovery crawl runs (Ticket.io shop mining, Ticket Kings platform list).';
comment on table public.platform_discovery_candidates is
  'Discovered shops/organizers/platform lists pending admin review and source activation.';

alter table public.platform_discovery_runs enable row level security;
alter table public.platform_discovery_candidates enable row level security;

drop policy if exists admin_read_platform_discovery_runs on public.platform_discovery_runs;
drop policy if exists admin_write_platform_discovery_runs on public.platform_discovery_runs;
create policy admin_read_platform_discovery_runs on public.platform_discovery_runs
  for select using (public.is_admin());
create policy admin_write_platform_discovery_runs on public.platform_discovery_runs
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_read_platform_discovery_candidates on public.platform_discovery_candidates;
drop policy if exists admin_write_platform_discovery_candidates on public.platform_discovery_candidates;
create policy admin_read_platform_discovery_candidates on public.platform_discovery_candidates
  for select using (public.is_admin());
create policy admin_write_platform_discovery_candidates on public.platform_discovery_candidates
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists service_role_platform_discovery_runs on public.platform_discovery_runs;
create policy service_role_platform_discovery_runs on public.platform_discovery_runs
  for all to service_role using (true) with check (true);
drop policy if exists service_role_platform_discovery_candidates on public.platform_discovery_candidates;
create policy service_role_platform_discovery_candidates on public.platform_discovery_candidates
  for all to service_role using (true) with check (true);

grant select, insert, update, delete on public.platform_discovery_runs to service_role;
grant select, insert, update, delete on public.platform_discovery_candidates to service_role;
