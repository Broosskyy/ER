-- Eternal Rave — persistent multi-source event provenance and decisions.
-- Additive only. Canonical consumer events and saved references are not rewritten.

create table if not exists public.event_source_references (
  id text primary key,
  canonical_event_id text not null references public.events(id) on delete cascade,
  source_id text not null references public.sources(id) on delete restrict,
  external_event_id text not null,
  original_url text,
  raw_record_id text references public.import_records(id) on delete set null,
  import_job_id text references public.import_jobs(id) on delete set null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  last_changed_at timestamptz,
  active boolean not null default true,
  source_priority integer not null default 50,
  source_quality_score numeric,
  source_health_score numeric,
  metadata jsonb not null default '{}'::jsonb,
  unique (source_id, external_event_id)
);
create index if not exists event_source_references_canonical_idx
  on public.event_source_references(canonical_event_id, active);

create table if not exists public.event_field_provenance (
  id text primary key,
  canonical_event_id text not null references public.events(id) on delete cascade,
  field_path text not null,
  selected_value jsonb,
  selected_source_id text references public.sources(id) on delete set null,
  selected_at timestamptz not null,
  selection_reason text not null,
  alternatives jsonb not null default '[]'::jsonb,
  manually_overridden boolean not null default false,
  updated_at timestamptz not null,
  unique (canonical_event_id, field_path)
);
create index if not exists event_field_provenance_event_idx
  on public.event_field_provenance(canonical_event_id);

create table if not exists public.duplicate_decisions (
  id text primary key,
  candidate_ids text[] not null,
  source_ids text[] not null default '{}',
  canonical_event_id text references public.events(id) on delete set null,
  decision text not null,
  confidence numeric not null,
  reason text not null,
  decided_by text,
  decided_at timestamptz not null,
  fingerprint_snapshot jsonb not null default '{}'::jsonb,
  reversible boolean not null default true,
  reversed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  check (decision in ('merged','kept_separate','deferred','related_series','false_positive','false_negative_correction')),
  check (confidence >= 0 and confidence <= 1)
);
create index if not exists duplicate_decisions_candidates_idx
  on public.duplicate_decisions using gin(candidate_ids);

create table if not exists public.event_conflicts (
  id text primary key,
  canonical_event_id text not null references public.events(id) on delete cascade,
  field text not null,
  values jsonb not null,
  source_ids text[] not null,
  severity text not null,
  detected_at timestamptz not null,
  resolved boolean not null default false,
  resolution text,
  resolved_at timestamptz,
  check (severity in ('info','warning','critical'))
);
create index if not exists event_conflicts_unresolved_idx
  on public.event_conflicts(canonical_event_id, severity)
  where resolved = false;
