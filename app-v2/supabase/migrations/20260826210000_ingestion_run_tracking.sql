-- M8.4: additive ingestion run tracking and source health metadata.
-- Internal ingestion tables only; no consumer/event/ticket mutations.

CREATE TABLE IF NOT EXISTS public.ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('dry_run', 'apply')),
  trigger_type text NOT NULL CHECK (trigger_type IN ('manual', 'scheduled', 'retry', 'test')),
  status text NOT NULL CHECK (
    status IN ('queued', 'running', 'succeeded', 'partially_succeeded', 'failed', 'cancelled')
  ),
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  duration_ms integer,
  discovered_count integer NOT NULL DEFAULT 0,
  fetched_count integer NOT NULL DEFAULT 0,
  parsed_count integer NOT NULL DEFAULT 0,
  candidate_count integer NOT NULL DEFAULT 0,
  planned_count integer NOT NULL DEFAULT 0,
  exact_matches integer NOT NULL DEFAULT 0,
  strong_matches integer NOT NULL DEFAULT 0,
  review_required integer NOT NULL DEFAULT 0,
  new_events integer NOT NULL DEFAULT 0,
  safe_updates integer NOT NULL DEFAULT 0,
  noops integer NOT NULL DEFAULT 0,
  rejected integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0,
  applied_writes integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  error_categories text[] NOT NULL DEFAULT '{}',
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingestion_runs_connector_started_idx
  ON public.ingestion_runs (connector_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.ingestion_source_health (
  connector_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_duration_ms integer,
  last_discovered_count integer NOT NULL DEFAULT 0,
  last_parsed_count integer NOT NULL DEFAULT 0,
  last_applied_count integer NOT NULL DEFAULT 0,
  last_error_category text,
  health_status text NOT NULL DEFAULT 'unknown' CHECK (
    health_status IN ('healthy', 'degraded', 'failing', 'disabled', 'unknown')
  ),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_source_health ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ingestion_runs FROM anon, authenticated;
REVOKE ALL ON public.ingestion_source_health FROM anon, authenticated;

COMMENT ON TABLE public.ingestion_runs IS 'Internal ingestion sync run audit trail (service_role only).';
COMMENT ON TABLE public.ingestion_source_health IS 'Internal connector health metadata (service_role only).';
