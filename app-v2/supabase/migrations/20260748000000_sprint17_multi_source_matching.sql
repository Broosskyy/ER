-- Eternal Rave — Sprint 17: Multi-Source Matching & Deduplication Engine.
-- Additive only. Extends existing multi-source provenance with match evaluation and blocking keys.

create table if not exists public.event_blocking_keys (
  id text primary key,
  canonical_event_id text not null references public.events(id) on delete cascade,
  blocking_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists event_blocking_keys_lookup_idx
  on public.event_blocking_keys(blocking_key);

create index if not exists event_blocking_keys_event_idx
  on public.event_blocking_keys(canonical_event_id);

create unique index if not exists event_blocking_keys_unique_idx
  on public.event_blocking_keys(canonical_event_id, blocking_key);

create table if not exists public.event_match_evaluations (
  id text primary key,
  import_record_id text references public.import_records(id) on delete set null,
  import_job_id text references public.import_jobs(id) on delete set null,
  source_id text not null references public.sources(id) on delete cascade,
  external_event_id text not null,
  canonical_event_id text references public.events(id) on delete set null,
  confidence_score numeric not null check (confidence_score >= 0 and confidence_score <= 100),
  confidence_tier text not null
    check (confidence_tier in ('certain', 'probable', 'uncertain')),
  decision text not null
    check (decision in ('auto_link', 'review_required', 'keep_separate')),
  match_reasons jsonb not null default '[]'::jsonb,
  match_signals jsonb not null default '[]'::jsonb,
  field_differences jsonb not null default '[]'::jsonb,
  involved_source_ids jsonb not null default '[]'::jsonb,
  fingerprint_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists event_match_evaluations_source_idx
  on public.event_match_evaluations(source_id, created_at desc);

create index if not exists event_match_evaluations_canonical_idx
  on public.event_match_evaluations(canonical_event_id, created_at desc);

create index if not exists event_match_evaluations_record_idx
  on public.event_match_evaluations(import_record_id);

create table if not exists public.event_merge_candidates (
  id text primary key,
  evaluation_id text not null references public.event_match_evaluations(id) on delete cascade,
  canonical_event_id text not null references public.events(id) on delete cascade,
  source_id text not null references public.sources(id) on delete cascade,
  external_event_id text not null,
  confidence_score numeric not null check (confidence_score >= 0 and confidence_score <= 100),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'deferred')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_merge_candidates_canonical_idx
  on public.event_merge_candidates(canonical_event_id, status);

create index if not exists event_merge_candidates_status_idx
  on public.event_merge_candidates(status, created_at desc);

alter table public.import_records
  add column if not exists match_evaluation_id text;

create index if not exists import_records_match_evaluation_id_idx
  on public.import_records(match_evaluation_id);

alter table public.event_blocking_keys enable row level security;
alter table public.event_match_evaluations enable row level security;
alter table public.event_merge_candidates enable row level security;

drop policy if exists admin_read_event_blocking_keys on public.event_blocking_keys;
drop policy if exists admin_write_event_blocking_keys on public.event_blocking_keys;
drop policy if exists admin_read_event_match_evaluations on public.event_match_evaluations;
drop policy if exists admin_write_event_match_evaluations on public.event_match_evaluations;
drop policy if exists admin_read_event_merge_candidates on public.event_merge_candidates;
drop policy if exists admin_write_event_merge_candidates on public.event_merge_candidates;

create policy admin_read_event_blocking_keys on public.event_blocking_keys
  for select using (public.is_admin());

create policy admin_write_event_blocking_keys on public.event_blocking_keys
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_event_match_evaluations on public.event_match_evaluations
  for select using (public.is_admin());

create policy admin_write_event_match_evaluations on public.event_match_evaluations
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_event_merge_candidates on public.event_merge_candidates
  for select using (public.is_admin());

create policy admin_write_event_merge_candidates on public.event_merge_candidates
  for all using (public.is_admin()) with check (public.is_admin());
