-- Eternal Rave — Sprint 16: Trust & Quality Engine foundation.
-- Additive only. Extends existing publish pipeline with rule-based trust/quality decisions.

create table if not exists public.trust_quality_rules (
  id text primary key,
  rule_key text not null unique,
  category text not null
    check (category in ('field_required', 'plausibility', 'duplicate', 'trust', 'url', 'conflict')),
  severity text not null
    check (severity in ('blocking', 'warning', 'info')),
  decision_impact text not null
    check (decision_impact in ('reject', 'hold', 'review_required', 'none')),
  enabled boolean not null default true,
  weight numeric not null default 1 check (weight >= 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trust_quality_rules_enabled_idx
  on public.trust_quality_rules(enabled, category);

insert into public.trust_quality_rules (id, rule_key, category, severity, decision_impact, weight, config)
values
  ('rule-required-title', 'required_title', 'field_required', 'blocking', 'reject', 1,
    '{"field":"title"}'::jsonb),
  ('rule-required-start-date', 'required_start_date', 'field_required', 'blocking', 'reject', 1,
    '{"field":"startDate"}'::jsonb),
  ('rule-invalid-date', 'invalid_start_date', 'plausibility', 'blocking', 'reject', 1,
    '{"field":"startDate"}'::jsonb),
  ('rule-missing-venue', 'missing_venue', 'field_required', 'warning', 'review_required', 0.8,
    '{"field":"venueName"}'::jsonb),
  ('rule-missing-city', 'missing_city', 'field_required', 'warning', 'review_required', 0.8,
    '{"field":"cityName"}'::jsonb),
  ('rule-missing-organizer', 'missing_organizer', 'field_required', 'info', 'hold', 0.4,
    '{"field":"organizerName"}'::jsonb),
  ('rule-missing-image', 'missing_image', 'field_required', 'info', 'hold', 0.5,
    '{"field":"imageUrl"}'::jsonb),
  ('rule-invalid-ticket-url', 'invalid_ticket_url', 'url', 'warning', 'review_required', 0.9,
    '{"field":"ticketUrl"}'::jsonb),
  ('rule-duplicate-threshold', 'duplicate_threshold', 'duplicate', 'warning', 'review_required', 1,
    '{"thresholdKey":"duplicateThreshold"}'::jsonb),
  ('rule-low-trust-score', 'low_trust_score', 'trust', 'warning', 'review_required', 1,
    '{"thresholdKey":"minTrustScore"}'::jsonb),
  ('rule-low-extraction-confidence', 'low_extraction_confidence', 'trust', 'info', 'hold', 0.7,
    '{"thresholdKey":"minExtractionConfidence"}'::jsonb),
  ('rule-validation-errors', 'validation_errors', 'plausibility', 'blocking', 'reject', 1,
    '{}'::jsonb)
on conflict (rule_key) do nothing;

create table if not exists public.import_review_queue (
  id text primary key,
  import_record_id text not null references public.import_records(id) on delete cascade,
  import_job_id text references public.import_jobs(id) on delete set null,
  source_id text not null references public.sources(id) on delete cascade,
  external_event_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'on_hold', 'approved', 'rejected', 'expired')),
  decision text not null
    check (decision in ('auto_publish', 'review_required', 'hold', 'reject')),
  quality_score numeric,
  trust_score numeric,
  reasons jsonb not null default '[]'::jsonb,
  affected_fields jsonb not null default '[]'::jsonb,
  rule_ids jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists import_review_queue_status_idx
  on public.import_review_queue(status, created_at desc);

create index if not exists import_review_queue_source_idx
  on public.import_review_queue(source_id, status);

create unique index if not exists import_review_queue_record_unique_idx
  on public.import_review_queue(import_record_id)
  where status in ('pending', 'on_hold');

create table if not exists public.source_reputation_events (
  id text primary key,
  source_id text not null references public.sources(id) on delete cascade,
  event_type text not null
    check (event_type in (
      'import_success',
      'import_failure',
      'publish_success',
      'publish_queued',
      'publish_rejected',
      'manual_correction',
      'quality_improvement',
      'quality_regression'
    )),
  delta numeric not null default 0,
  previous_trust_score numeric not null,
  new_trust_score numeric not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists source_reputation_events_source_idx
  on public.source_reputation_events(source_id, created_at desc);

alter table public.sources
  add column if not exists computed_trust_score numeric,
  add column if not exists trust_score_updated_at timestamptz;

alter table public.trust_quality_rules enable row level security;
alter table public.import_review_queue enable row level security;
alter table public.source_reputation_events enable row level security;

drop policy if exists admin_read_trust_quality_rules on public.trust_quality_rules;
drop policy if exists admin_write_trust_quality_rules on public.trust_quality_rules;
drop policy if exists admin_read_import_review_queue on public.import_review_queue;
drop policy if exists admin_write_import_review_queue on public.import_review_queue;
drop policy if exists admin_read_source_reputation_events on public.source_reputation_events;
drop policy if exists admin_write_source_reputation_events on public.source_reputation_events;

create policy admin_read_trust_quality_rules on public.trust_quality_rules
  for select using (public.is_admin());

create policy admin_write_trust_quality_rules on public.trust_quality_rules
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_import_review_queue on public.import_review_queue
  for select using (public.is_admin());

create policy admin_write_import_review_queue on public.import_review_queue
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_source_reputation_events on public.source_reputation_events
  for select using (public.is_admin());

create policy admin_write_source_reputation_events on public.source_reputation_events
  for all using (public.is_admin()) with check (public.is_admin());
