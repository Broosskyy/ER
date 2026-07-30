-- Eternal Rave — Sprint 33: Multi-origin metadata and automated source onboarding foundation.
-- Additive only. Existing event_source_references rows remain valid; metadata stores origin fields.

create table if not exists public.source_onboarding_jobs (
  id text primary key,
  submitted_url text not null,
  normalized_url text not null,
  hostname text not null,
  status text not null,
  detected_platform text,
  detected_framework text,
  detected_source_type text,
  confidence numeric not null default 0,
  discovery_result jsonb,
  generated_config jsonb,
  validation_result jsonb,
  dry_run_report jsonb,
  review_notes text,
  duplicate_source_id text references public.sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in (
    'submitted', 'probing', 'discovered', 'config_generated', 'dry_run',
    'review_required', 'ready', 'enabled', 'rejected'
  )),
  check (confidence >= 0 and confidence <= 1)
);

create index if not exists source_onboarding_jobs_hostname_idx
  on public.source_onboarding_jobs(hostname);
create index if not exists source_onboarding_jobs_status_idx
  on public.source_onboarding_jobs(status, updated_at desc);

comment on table public.source_onboarding_jobs is
  'Automated source discovery and declarative config generation jobs (admin onboarding wizard).';

comment on column public.event_source_references.metadata is
  'Origin metadata: role, platform, canonicalUrl, ticketUrl, syncStatus, isPrimary, etc.';

alter table public.source_onboarding_jobs enable row level security;
